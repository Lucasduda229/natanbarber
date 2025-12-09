import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, Scissors, ChevronLeft, Check, X, Lock, Unlock, Users, Settings, BarChart3, RotateCcw, RefreshCw, Bot, Image, History, UserCheck, Trophy } from "lucide-react";
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
import { AIAssistantPanel } from "@/components/AIAssistantPanel";
import { GalleryManager } from "@/components/GalleryManager";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { CustomerHistory } from "@/components/CustomerHistory";
import { ClientsList } from "@/components/ClientsList";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { getConfirmationMessage } from "@/lib/whatsapp";
import LoyaltyProgramManager from "@/components/LoyaltyProgramManager";

interface Appointment {
  id: string;
  user_id: string;
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
  } | null;
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
  const [refreshing, setRefreshing] = useState(false);
  const [filterDate, setFilterDate] = useState<string>("");
  const [stats, setStats] = useState({ today: 0, pending: 0, confirmed: 0, revenue: 0 });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isConnected, setIsConnected] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success("Dashboard atualizado!", { duration: 2000 });
  }, []);

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
      .channel('admin-appointments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('Appointment change detected:', payload);
          setLastUpdate(new Date());
          // Refresh all data when any appointment changes
          fetchData(true);
          
          // Show notification and play sound for new appointments
          if (payload.eventType === 'INSERT') {
            playNotificationSound();
            toast.info("🔔 Novo agendamento!", { 
              description: "Um novo pedido foi recebido.",
              duration: 5000
            });
          } else if (payload.eventType === 'UPDATE') {
            toast.info("📝 Agendamento atualizado", { duration: 2000 });
          } else if (payload.eventType === 'DELETE') {
            toast.info("🗑️ Agendamento removido", { duration: 2000 });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          console.error('Appointments channel error');
          toast.error("Erro na conexão real-time. Clique em Atualizar.");
        }
      });

    // Set up realtime subscription for blocked_dates
    const blockedDatesChannel = supabase
      .channel('admin-blocked-dates-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_dates'
        },
        (payload) => {
          console.log('Blocked dates change detected:', payload);
          setLastUpdate(new Date());
          fetchBlockedDates();
          
          if (payload.eventType === 'INSERT') {
            toast.info("🚫 Horário bloqueado", { duration: 2000 });
          } else if (payload.eventType === 'DELETE') {
            toast.info("✅ Horário desbloqueado", { duration: 2000 });
          }
        }
      )
      .subscribe();

    // Set up realtime subscription for barbershop_status
    const statusChannel = supabase
      .channel('admin-status-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'barbershop_status'
        },
        (payload) => {
          console.log('Barbershop status change detected:', payload);
          setLastUpdate(new Date());
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds as fallback
    const autoRefreshInterval = setInterval(() => {
      fetchData(true);
      setLastUpdate(new Date());
    }, 30000);

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(blockedDatesChannel);
      supabase.removeChannel(statusChannel);
      clearInterval(autoRefreshInterval);
    };
  }, [isAdmin, authLoading]);

  const fetchData = async (showSyncing = false) => {
    if (showSyncing) setSyncing(true);
    try {
      await Promise.all([fetchAppointments(), fetchBlockedDates(), fetchStats()]);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
      if (showSyncing) setSyncing(false);
    }
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
      .neq("status", "cancelled")
      .neq("status", "archived");

    const { data: pendingData } = await supabase
      .from("appointments")
      .select("id")
      .eq("status", "pending");

    // Count all confirmed appointments
    const { data: confirmedData } = await supabase
      .from("appointments")
      .select("services(price)")
      .eq("status", "confirmed");

    // Count completed appointments for revenue
    const { data: completedData } = await supabase
      .from("appointments")
      .select("services(price)")
      .eq("status", "completed");

    const confirmedRevenue = confirmedData?.reduce((sum, a) => sum + (a.services?.price || 0), 0) || 0;
    const completedRevenue = completedData?.reduce((sum, a) => sum + (a.services?.price || 0), 0) || 0;
    const totalRevenue = confirmedRevenue + completedRevenue;

    setStats({
      today: todayData?.length || 0,
      pending: pendingData?.length || 0,
      confirmed: confirmedData?.length || 0,
      revenue: totalRevenue,
    });
  };

  const updateAppointmentStatus = async (id: string, status: string) => {
    // Get appointment details for notification
    const appointment = appointments.find(a => a.id === id);
    
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    // Criar notificação push interna quando confirmar ou cancelar
    if ((status === "confirmed" || status === "cancelled") && appointment) {
      const { data: appointmentData } = await supabase
        .from("appointments")
        .select("user_id, appointment_date, appointment_time, services(name, price)")
        .eq("id", id)
        .single();

      if (appointmentData) {
        const dateFormatted = format(parseISO(appointmentData.appointment_date), "dd/MM/yyyy", { locale: ptBR });
        const timeFormatted = appointmentData.appointment_time.slice(0, 5);
        const serviceName = appointmentData.services?.name || "Serviço";
        const servicePrice = appointmentData.services?.price || 0;

        const title = status === "confirmed" 
          ? "Agendamento Confirmado! ✓" 
          : "Agendamento Cancelado";
        
        const message = status === "confirmed"
          ? `Seu agendamento de ${serviceName} para ${dateFormatted} às ${timeFormatted} foi confirmado! Valor: R$ ${servicePrice.toFixed(2)}`
          : `Seu agendamento de ${serviceName} para ${dateFormatted} às ${timeFormatted} foi cancelado.`;

        await supabase.from("notifications").insert({
          user_id: appointmentData.user_id,
          title,
          message,
          type: status,
          appointment_id: id
        });
      }
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

  const unblockAllDates = async () => {
    const { error } = await supabase
      .from("blocked_dates")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows

    if (error) {
      toast.error("Erro ao desbloquear horários");
      console.error("Error unblocking all:", error);
      return;
    }

    toast.success("Todos os horários foram desbloqueados!");
    fetchBlockedDates();
  };

  const resetStats = async () => {
    setLoading(true);
    
    try {
      // Get current admin user id to exclude from deletion
      const { data: { user } } = await supabase.auth.getUser();
      const adminUserId = user?.id;

      // DELETE ALL appointments permanently
      const { error: appointmentsError } = await supabase
        .from("appointments")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (appointmentsError) {
        console.error("Error deleting appointments:", appointmentsError);
        toast.error("Erro ao deletar agendamentos");
        setLoading(false);
        return;
      }

      // DELETE ALL blocked dates
      const { error: blockedError } = await supabase
        .from("blocked_dates")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (blockedError) {
        console.error("Error deleting blocked dates:", blockedError);
      }

      // DELETE ALL notifications
      const { error: notificationsError } = await supabase
        .from("notifications")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (notificationsError) {
        console.error("Error deleting notifications:", notificationsError);
      }

      // DELETE ALL reviews
      const { error: reviewsError } = await supabase
        .from("reviews")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (reviewsError) {
        console.error("Error deleting reviews:", reviewsError);
      }

      // DELETE ALL profiles EXCEPT admin
      if (adminUserId) {
        const { error: profilesError } = await supabase
          .from("profiles")
          .delete()
          .neq("user_id", adminUserId);

        if (profilesError) {
          console.error("Error deleting profiles:", profilesError);
        }

        // DELETE ALL user roles EXCEPT admin
        const { error: rolesError } = await supabase
          .from("user_roles")
          .delete()
          .neq("user_id", adminUserId);

        if (rolesError) {
          console.error("Error deleting user roles:", rolesError);
        }
      }

      toast.success("Painel resetado!", { 
        description: "Todos os dados foram excluídos permanentemente." 
      });
      fetchData();
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Erro ao resetar painel");
    } finally {
      setLoading(false);
    }
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
      <header className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/booking")} className="text-foreground hover:text-primary px-2 sm:px-4">
          <ChevronLeft className="w-5 h-5 sm:mr-2" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationsDropdown />
          <img src={logoImage} alt="Natan Barbershop" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary/30" />
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs sm:text-sm">Admin</Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="admin-container relative z-10 px-3 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Painel Administrativo</h1>
            <div className="flex items-center gap-2">
              {syncing ? (
                <>
                  <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-primary font-medium">Sincronizando...</span>
                </>
              ) : (
                <>
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-xs text-muted-foreground">
                    {isConnected ? 'Sincronizado' : 'Desconectado'}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="w-full md:w-auto md:max-w-sm">
            <AdminStatusToggle />
          </div>
        </div>
        
        {/* Last update indicator */}
        <div className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Última atualização: {format(lastUpdate, "HH:mm:ss", { locale: ptBR })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Estatísticas</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="border-primary/30 hover:bg-primary/10 h-8 text-xs sm:text-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-destructive/50 text-destructive hover:bg-destructive/10 h-8 text-xs sm:text-sm"
                disabled={appointments.filter(a => a.status !== "archived").length === 0}
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Resetar Painel</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-destructive/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive text-base sm:text-lg">⚠️ Resetar Sistema Completo</AlertDialogTitle>
                <AlertDialogDescription className="text-sm max-h-[60vh] overflow-y-auto">
                  Isso vai <strong>EXCLUIR PERMANENTEMENTE</strong> todos os dados:
                  <br /><br />
                  <strong>Agendamentos:</strong>
                  <br />
                  • {stats.pending} pendentes
                  <br />
                  • {appointments.filter(a => a.status === "confirmed").length} confirmados
                  <br />
                  • {appointments.filter(a => a.status === "completed").length} concluídos
                  <br />
                  • {appointments.filter(a => a.status === "cancelled").length} cancelados
                  <br />
                  • Receita perdida: R$ {stats.revenue.toFixed(2)}
                  <br /><br />
                  <strong>Também serão deletados:</strong>
                  <br />
                  • Todos os clientes cadastrados (exceto admin)
                  <br />
                  • Todas as notificações
                  <br />
                  • Todas as avaliações
                  <br />
                  • Todos os horários bloqueados
                  <br /><br />
                  <strong className="text-destructive">⚠️ ATENÇÃO: Esta ação NÃO pode ser desfeita!</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={resetStats}
                  className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto"
                >
                  Confirmar Reset Total
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.today}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Hoje</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-yellow-500/20">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Pendentes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-blue-500/20">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.confirmed}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Confirmados</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-primary">R$ {stats.revenue.toFixed(0)}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Receita</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="appointments" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="bg-card/40 backdrop-blur-xl border border-primary/20 inline-flex w-auto min-w-max gap-0.5 p-1">
              <TabsTrigger value="appointments" className="data-[state=active]:bg-primary data-[state=active]:text-background whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Agendamentos</span>
              </TabsTrigger>
              <TabsTrigger value="ai-assistant" className="data-[state=active]:bg-primary data-[state=active]:text-background whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Assistente IA</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-background whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Horários</span>
              </TabsTrigger>
              <TabsTrigger value="gallery" className="data-[state=active]:bg-primary data-[state=active]:text-background whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <Image className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Galeria</span>
              </TabsTrigger>
              <TabsTrigger value="clients" className="data-[state=active]:bg-primary data-[state=active]:text-background whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Clientes</span>
              </TabsTrigger>
              <TabsTrigger value="loyalty" className="data-[state=active]:bg-primary data-[state=active]:text-background whitespace-nowrap px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Fidelidade</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* AI Assistant Tab */}
          <TabsContent value="ai-assistant">
            <AIAssistantPanel />
          </TabsContent>

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
                      className="flex flex-col gap-3 p-3 sm:p-4 rounded-lg bg-card/40 border border-yellow-500/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-yellow-500/10 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-base sm:text-lg font-bold text-yellow-500">
                            {format(parseISO(appointment.appointment_date), "dd")}
                          </span>
                          <span className="text-[10px] sm:text-xs text-yellow-500 uppercase">
                            {format(parseISO(appointment.appointment_date), "MMM", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
                            <span className="truncate">{appointment.profiles?.full_name || "Cliente"}</span>
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{appointment.profiles?.phone || "Sem telefone"}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              {appointment.appointment_time.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="truncate max-w-[80px] sm:max-w-none">{appointment.services?.name || "Serviço"}</span>
                            </span>
                            <span className="font-bold text-primary">R$ {appointment.services?.price?.toFixed(2) || "0.00"}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-1 sm:flex-none"
                            >
                              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Aceitar</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-primary/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Confirmar Agendamento</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Deseja confirmar o agendamento de {appointment.profiles?.full_name || "Cliente"} para {format(parseISO(appointment.appointment_date), "dd/MM/yyyy")} às {appointment.appointment_time.slice(0, 5)}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => updateAppointmentStatus(appointment.id, "confirmed")}
                                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
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
                              className="border-red-500/50 text-red-500 hover:bg-red-500/10 h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm flex-1 sm:flex-none"
                            >
                              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Recusar</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-primary/20 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Recusar Agendamento</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Tem certeza que deseja recusar o agendamento de {appointment.profiles?.full_name || "Cliente"}? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="w-full sm:w-auto">Voltar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => updateAppointmentStatus(appointment.id, "cancelled")}
                                className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                              >
                                Recusar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <WhatsAppButton
                          phone={appointment.profiles?.phone || ""}
                          message={getConfirmationMessage(
                            appointment.profiles?.full_name || "Cliente",
                            appointment.services?.name || "Serviço",
                            format(parseISO(appointment.appointment_date), "dd/MM/yyyy"),
                            appointment.appointment_time.slice(0, 5)
                          )}
                          disabled={!appointment.profiles?.phone}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* All Appointments Section */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 mb-4">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-card/40 border border-primary/20 rounded-lg px-3 sm:px-4 py-2 text-foreground text-sm w-full sm:w-auto"
              />
              <Button variant="outline" onClick={() => setFilterDate("")} className="w-full sm:w-auto">
                Ver Todos
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/admin/history")} 
                className="w-full sm:w-auto gap-2"
              >
                <History className="w-4 h-4" />
                Histórico Completo
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
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                            <span className="text-base sm:text-lg font-bold text-primary">
                              {format(parseISO(appointment.appointment_date), "dd")}
                            </span>
                            <span className="text-[10px] sm:text-xs text-primary uppercase">
                              {format(parseISO(appointment.appointment_date), "MMM", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                              <span className="truncate">{appointment.profiles?.full_name || "Cliente"}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-muted-foreground hover:text-primary flex-shrink-0"
                                onClick={() => setSelectedCustomerId(appointment.user_id)}
                                title="Ver histórico do cliente"
                              >
                                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{appointment.profiles?.phone || "Sem telefone"}</p>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                {appointment.appointment_time.slice(0, 5)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="truncate max-w-[100px] sm:max-w-none">{appointment.services?.name || "Serviço"}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-border">
                          <Badge variant="outline" className={`${statusColors[appointment.status]} text-xs`}>
                            {statusLabels[appointment.status]}
                          </Badge>

                          <span className="font-bold text-primary text-sm sm:text-base">R$ {appointment.services?.price?.toFixed(2) || "0.00"}</span>

                          <Select
                            value={appointment.status}
                            onValueChange={(value) => updateAppointmentStatus(appointment.id, value)}
                          >
                            <SelectTrigger className="w-[110px] sm:w-32 h-7 sm:h-8 bg-card/60 text-xs sm:text-sm">
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
                            <SelectTrigger className="w-[100px] sm:w-28 h-7 sm:h-8 bg-card/60 text-xs sm:text-sm">
                              <SelectValue placeholder="Pagamento" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Aguardando</SelectItem>
                              <SelectItem value="paid">Pago</SelectItem>
                              <SelectItem value="refunded">Reembolsado</SelectItem>
                            </SelectContent>
                          </Select>

                          <WhatsAppButton
                            phone={appointment.profiles?.phone || ""}
                            message={getConfirmationMessage(
                              appointment.profiles?.full_name || "Cliente",
                              appointment.services?.name || "Serviço",
                              format(parseISO(appointment.appointment_date), "dd/MM/yyyy"),
                              appointment.appointment_time.slice(0, 5)
                            )}
                            disabled={!appointment.profiles?.phone}
                          />
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Unlock className="w-5 h-5 text-primary" />
                  Datas/Horários Bloqueados
                </CardTitle>
                {blockedDates.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/50 text-destructive hover:bg-destructive/10"
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        Desbloquear Todos
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-destructive/20">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Desbloquear Todos os Horários</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso vai desbloquear <strong>{blockedDates.length} horário(s)</strong>, incluindo:
                          <br /><br />
                          • Horários bloqueados manualmente
                          <br />
                          • Horários bloqueados automaticamente por agendamentos confirmados
                          <br /><br />
                          <strong>Atenção:</strong> Os horários de agendamentos confirmados ficarão disponíveis novamente para novos agendamentos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={unblockAllDates}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Desbloquear Todos
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
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

          {/* Gallery Tab */}
          <TabsContent value="gallery">
            <GalleryManager />
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients">
            <ClientsList />
          </TabsContent>

          {/* Loyalty Tab */}
          <TabsContent value="loyalty">
            <LoyaltyProgramManager />
          </TabsContent>
        </Tabs>
      </main>

      {/* Customer History Modal */}
      <CustomerHistory
        userId={selectedCustomerId || ""}
        isOpen={!!selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />
    </div>
  );
};

export default Admin;
