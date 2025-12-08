import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, Scissors, ChevronLeft, Check, X, Lock, Unlock, Users, Settings, BarChart3, RotateCcw } from "lucide-react";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import AdminStatusToggle from "@/components/AdminStatusToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo-barbershop.png";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  payment_status: string;
  profiles: {
    full_name: string | null;
    phone: string | null;
  } | null;
  services: {
    name: string;
    price: number;
  };
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  blocked_time: string | null;
  reason: string | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  confirmed: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  completed: "bg-green-500/20 text-green-500 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-500 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

// Notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for a pleasant notification tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Two-tone notification sound
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1108.73, audioContext.currentTime + 0.15); // C#6
    
    oscillator.type = 'sine';
    
    // Fade in and out for smooth sound
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.2);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.35);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.35);
    
    // Cleanup
    setTimeout(() => {
      audioContext.close();
    }, 500);
  } catch (error) {
    console.log('Could not play notification sound:', error);
  }
};

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [stats, setStats] = useState({ today: 0, pending: 0, completed: 0, revenue: 0 });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error("Acesso negado", { description: "Você não tem permissão para acessar esta página." });
      navigate("/booking");
      return;
    }

    gsap.fromTo(".admin-container", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" });
    fetchData();

    // Set up realtime subscription for appointments
    const appointmentsChannel = supabase
      .channel('admin-appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('Appointment change detected:', payload);
          // Refresh data when any appointment changes
          fetchData();
          
          // Show notification and play sound for new appointments
          if (payload.eventType === 'INSERT') {
            playNotificationSound();
            toast.info("🔔 Novo agendamento!", { 
              description: "Um novo pedido foi recebido.",
              duration: 5000
            });
          }
        }
      )
      .subscribe();

    // Set up realtime subscription for blocked_dates
    const blockedDatesChannel = supabase
      .channel('admin-blocked-dates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_dates'
        },
        () => {
          fetchBlockedDates();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(blockedDatesChannel);
    };
  }, [isAdmin, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchAppointments(), fetchBlockedDates(), fetchStats()]);
    setLoading(false);
  };

  const fetchAppointments = async () => {
    // Fetch appointments
    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        status,
        payment_status,
        user_id,
        services (
          name,
          price
        )
      `)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (appointmentsError) {
      console.error("Error fetching appointments:", appointmentsError);
      return;
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      setAppointments([]);
      return;
    }

    // Get unique user_ids
    const userIds = [...new Set(appointmentsData.map(a => a.user_id))];

    // Fetch profiles for these users
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    // Create a map of user_id to profile
    const profilesMap = new Map(
      (profilesData || []).map(p => [p.user_id, { full_name: p.full_name, phone: p.phone }])
    );

    // Combine appointments with profiles
    const appointmentsWithProfiles = appointmentsData.map(appointment => ({
      ...appointment,
      profiles: profilesMap.get(appointment.user_id) || null,
    }));

    setAppointments(appointmentsWithProfiles as unknown as Appointment[]);
  };

  const fetchBlockedDates = async () => {
    const { data, error } = await supabase
      .from("blocked_dates")
      .select("*")
      .order("blocked_date", { ascending: true });

    if (!error && data) {
      setBlockedDates(data);
    }
  };

  const fetchStats = async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    const { data: todayData } = await supabase
      .from("appointments")
      .select("id")
      .eq("appointment_date", today)
      .neq("status", "cancelled");

    const { data: pendingData } = await supabase
      .from("appointments")
      .select("id")
      .eq("status", "pending");

    const { data: completedData } = await supabase
      .from("appointments")
      .select("services(price)")
      .eq("status", "completed");

    const revenue = completedData?.reduce((sum, a) => sum + (a.services?.price || 0), 0) || 0;

    setStats({
      today: todayData?.length || 0,
      pending: pendingData?.length || 0,
      completed: completedData?.length || 0,
      revenue,
    });
  };

  const updateAppointmentStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success(`Status atualizado para ${statusLabels[status]}`);
    fetchData();
  };

  const updatePaymentStatus = async (id: string, payment_status: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ payment_status })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar pagamento");
      return;
    }

    toast.success("Pagamento atualizado");
    fetchData();
  };

  const blockDate = async (date: string, time?: string) => {
    const { error } = await supabase
      .from("blocked_dates")
      .insert({ blocked_date: date, blocked_time: time || null });

    if (error) {
      toast.error("Erro ao bloquear data/horário");
      return;
    }

    toast.success(time ? "Horário bloqueado" : "Data bloqueada");
    fetchBlockedDates();
  };

  const unblockDate = async (id: string) => {
    const { error } = await supabase
      .from("blocked_dates")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao desbloquear");
      return;
    }

    toast.success("Desbloqueado com sucesso");
    fetchBlockedDates();
  };

  const resetStats = async () => {
    setLoading(true);
    
    // Archive all completed appointments by changing status to 'archived'
    const { error } = await supabase
      .from("appointments")
      .update({ status: "archived" })
      .eq("status", "completed");

    if (error) {
      toast.error("Erro ao resetar estatísticas");
      setLoading(false);
      return;
    }

    toast.success("Estatísticas resetadas!", { 
      description: "Os agendamentos concluídos foram arquivados." 
    });
    fetchData();
  };

  const filteredAppointments = appointments.filter((a) => {
    if (!filterDate) return true;
    return a.appointment_date === filterDate;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/booking")} className="text-foreground hover:text-primary">
          <ChevronLeft className="w-5 h-5 mr-2" />
          Voltar
        </Button>
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Natan Barbershop" className="w-10 h-10 rounded-full object-cover border-2 border-primary/30" />
          <Badge className="bg-primary/20 text-primary border-primary/30">Admin</Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="admin-container relative z-10 px-4 py-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
          <div className="w-full md:w-auto md:max-w-sm">
            <AdminStatusToggle />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Estatísticas</h2>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-primary/30 text-primary hover:bg-primary/10"
                disabled={stats.completed === 0}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Resetar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-primary/20">
              <AlertDialogHeader>
                <AlertDialogTitle>Resetar Estatísticas</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai arquivar todos os {stats.completed} agendamentos concluídos e zerar a receita de R$ {stats.revenue.toFixed(2)}. 
                  <br /><br />
                  Os agendamentos pendentes e confirmados não serão afetados.
                  <br /><br />
                  <strong>Esta ação não pode ser desfeita.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={resetStats}
                  className="bg-primary hover:bg-primary/90"
                >
                  Confirmar Reset
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.today}</p>
                <p className="text-sm text-muted-foreground">Hoje</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-yellow-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-green-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                <p className="text-sm text-muted-foreground">Concluídos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">R$ {stats.revenue.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Receita Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="space-y-6">
          <TabsList className="bg-card/40 backdrop-blur-xl border border-primary/20">
            <TabsTrigger value="appointments" className="data-[state=active]:bg-primary data-[state=active]:text-background">
              <Scissors className="w-4 h-4 mr-2" />
              Agendamentos
            </TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-background">
              <Lock className="w-4 h-4 mr-2" />
              Horários
            </TabsTrigger>
          </TabsList>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6">
            {/* Pending Appointments Section - Always visible at top */}
            {appointments.filter(a => a.status === "pending").length > 0 && (
              <Card className="bg-yellow-500/5 backdrop-blur-xl border-yellow-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-yellow-500">
                    <Clock className="w-5 h-5" />
                    Pedidos Aguardando Aprovação ({appointments.filter(a => a.status === "pending").length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {appointments
                    .filter(a => a.status === "pending")
                    .sort((a, b) => {
                      const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
                      const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
                      return dateA.getTime() - dateB.getTime();
                    })
                    .map((appointment) => (
                    <div 
                      key={appointment.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-card/40 border border-yellow-500/20"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex flex-col items-center justify-center">
                          <span className="text-lg font-bold text-yellow-500">
                            {format(parseISO(appointment.appointment_date), "dd")}
                          </span>
                          <span className="text-xs text-yellow-500 uppercase">
                            {format(parseISO(appointment.appointment_date), "MMM", { locale: ptBR })}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <Users className="w-4 h-4 text-yellow-500" />
                            {appointment.profiles?.full_name || "Cliente"}
                          </h3>
                          <p className="text-sm text-muted-foreground">{appointment.profiles?.phone || "Sem telefone"}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {appointment.appointment_time.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Scissors className="w-4 h-4" />
                              {appointment.services.name}
                            </span>
                            <span className="font-bold text-primary">R$ {appointment.services.price.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Aceitar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-primary/20">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Agendamento</AlertDialogTitle>
                              <AlertDialogDescription>
                                Deseja confirmar o agendamento de {appointment.profiles?.full_name || "Cliente"} para {format(parseISO(appointment.appointment_date), "dd/MM/yyyy")} às {appointment.appointment_time.slice(0, 5)}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => updateAppointmentStatus(appointment.id, "confirmed")}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Recusar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-primary/20">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Recusar Agendamento</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja recusar o agendamento de {appointment.profiles?.full_name || "Cliente"}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => updateAppointmentStatus(appointment.id, "cancelled")}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Recusar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* All Appointments Section */}
            <div className="flex items-center gap-4 mb-4">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-card/40 border border-primary/20 rounded-lg px-4 py-2 text-foreground"
              />
              <Button variant="outline" onClick={() => setFilterDate("")}>
                Ver Todos
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredAppointments.length === 0 ? (
              <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum agendamento encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((appointment) => (
                  <Card key={appointment.id} className="bg-card/40 backdrop-blur-xl border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
                            <span className="text-lg font-bold text-primary">
                              {format(parseISO(appointment.appointment_date), "dd")}
                            </span>
                            <span className="text-xs text-primary uppercase">
                              {format(parseISO(appointment.appointment_date), "MMM", { locale: ptBR })}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" />
                              {appointment.profiles?.full_name || "Cliente"}
                            </h3>
                            <p className="text-sm text-muted-foreground">{appointment.profiles?.phone || "Sem telefone"}</p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {appointment.appointment_time.slice(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Scissors className="w-4 h-4" />
                                {appointment.services.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="outline" className={statusColors[appointment.status]}>
                            {statusLabels[appointment.status]}
                          </Badge>

                          <span className="font-bold text-primary">R$ {appointment.services.price.toFixed(2)}</span>

                          <Select
                            value={appointment.status}
                            onValueChange={(value) => updateAppointmentStatus(appointment.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8 bg-card/60">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="confirmed">Confirmado</SelectItem>
                              <SelectItem value="completed">Concluído</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={appointment.payment_status}
                            onValueChange={(value) => updatePaymentStatus(appointment.id, value)}
                          >
                            <SelectTrigger className="w-28 h-8 bg-card/60">
                              <SelectValue placeholder="Pagamento" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Aguardando</SelectItem>
                              <SelectItem value="paid">Pago</SelectItem>
                              <SelectItem value="refunded">Reembolsado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Lock className="w-5 h-5 text-primary" />
                  Bloquear Data/Horário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <input
                    type="date"
                    id="blockDate"
                    className="bg-card/40 border border-primary/20 rounded-lg px-4 py-2 text-foreground"
                  />
                  <input
                    type="time"
                    id="blockTime"
                    className="bg-card/40 border border-primary/20 rounded-lg px-4 py-2 text-foreground"
                    placeholder="Opcional"
                  />
                  <Button
                    onClick={() => {
                      const dateInput = document.getElementById("blockDate") as HTMLInputElement;
                      const timeInput = document.getElementById("blockTime") as HTMLInputElement;
                      if (dateInput.value) {
                        blockDate(dateInput.value, timeInput.value || undefined);
                      }
                    }}
                    className="bg-gold-gradient text-background"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Bloquear
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Deixe o horário em branco para bloquear o dia inteiro
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Unlock className="w-5 h-5 text-primary" />
                  Datas/Horários Bloqueados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {blockedDates.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Nenhum bloqueio ativo</p>
                ) : (
                  <div className="space-y-2">
                    {blockedDates.map((blocked) => (
                      <div
                        key={blocked.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                      >
                        <div className="flex items-center gap-3">
                          <Lock className="w-4 h-4 text-destructive" />
                          <span className="text-foreground">
                            {format(parseISO(blocked.blocked_date), "dd/MM/yyyy")}
                            {blocked.blocked_time && ` às ${blocked.blocked_time.slice(0, 5)}`}
                          </span>
                          {blocked.reason && (
                            <span className="text-muted-foreground text-sm">- {blocked.reason}</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => unblockDate(blocked.id)}
                          className="text-destructive hover:bg-destructive/20"
                        >
                          <Unlock className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
