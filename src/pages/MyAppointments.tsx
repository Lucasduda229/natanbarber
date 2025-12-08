import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, Scissors, ChevronLeft, X, Check, AlertCircle, Star } from "lucide-react";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { ReviewForm } from "@/components/ReviewForm";
import { ProfileMenu } from "@/components/ProfileMenu";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  services: {
    name: string;
    price: number;
    duration_minutes: number;
  };
  hasReview?: boolean;
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

const paymentLabels: Record<string, string> = {
  pending: "Aguardando",
  paid: "Pago",
  refunded: "Reembolsado",
};

const MyAppointments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviewedAppointments, setReviewedAppointments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gsap.fromTo(".appointments-container", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" });
    if (user) {
      fetchAppointments();
    }
  }, [user]);

  const fetchAppointments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        status,
        payment_status,
        services (
          name,
          price,
          duration_minutes
        )
      `)
      .eq("user_id", user?.id)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });

    if (!error && data) {
      // Check which appointments have reviews
      const { data: reviews } = await supabase
        .from("reviews")
        .select("appointment_id")
        .eq("user_id", user?.id);

      const reviewedIds = new Set((reviews || []).map(r => r.appointment_id));
      setReviewedAppointments(reviewedIds);

      setAppointments(data as Appointment[]);
    }
    
    setLoading(false);
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId);

    if (error) {
      toast.error("Erro ao cancelar", { description: "Tente novamente mais tarde." });
      return;
    }

    toast.success("Agendamento cancelado com sucesso");
    fetchAppointments();
  };

  const upcomingAppointments = appointments.filter(
    (a) => a.status !== "cancelled" && a.status !== "completed" && !isPast(parseISO(`${a.appointment_date}T${a.appointment_time}`))
  );

  const pastAppointments = appointments.filter(
    (a) => a.status === "completed" || a.status === "cancelled" || isPast(parseISO(`${a.appointment_date}T${a.appointment_time}`))
  );

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
          <NotificationsDropdown />
          <ProfileMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="appointments-container relative z-10 px-4 py-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-8 text-center">Meus Agendamentos</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming Appointments */}
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Próximos Agendamentos
              </h2>

              {upcomingAppointments.length === 0 ? (
                <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
                  <CardContent className="py-12 text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Você não tem agendamentos futuros</p>
                    <Button onClick={() => navigate("/booking")} className="mt-4 bg-gold-gradient text-background">
                      Agendar Agora
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {upcomingAppointments.map((appointment) => (
                    <Card key={appointment.id} className="bg-card/40 backdrop-blur-xl border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                                <Scissors className="w-4 h-4 text-primary" />
                                {appointment.services.name}
                              </h3>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {appointment.appointment_time.slice(0, 5)}
                                </span>
                                <span>{appointment.services.duration_minutes} min</span>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={statusColors[appointment.status]}>
                                  {statusLabels[appointment.status]}
                                </Badge>
                                <Badge variant="outline" className="bg-muted/50">
                                  {paymentLabels[appointment.payment_status]} (PIX)
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-primary">
                              R$ {appointment.services.price.toFixed(2)}
                            </span>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                                  <X className="w-4 h-4 mr-1" />
                                  Cancelar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-foreground">Cancelar Agendamento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="border-border">Voltar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancelAppointment(appointment.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Sim, Cancelar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Past Appointments */}
            {pastAppointments.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Check className="w-5 h-5 text-muted-foreground" />
                  Histórico
                </h2>

                <div className="space-y-3">
                  {pastAppointments.map((appointment) => (
                    <Card key={appointment.id} className="bg-card/20 backdrop-blur-xl border-border/50 opacity-70">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-muted/30 flex flex-col items-center justify-center">
                              <span className="text-sm font-bold text-muted-foreground">
                                {format(parseISO(appointment.appointment_date), "dd")}
                              </span>
                              <span className="text-xs text-muted-foreground uppercase">
                                {format(parseISO(appointment.appointment_date), "MMM", { locale: ptBR })}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-medium text-muted-foreground">{appointment.services.name}</h3>
                              <span className="text-sm text-muted-foreground">{appointment.appointment_time.slice(0, 5)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {appointment.status === "completed" && !reviewedAppointments.has(appointment.id) && (
                              <ReviewForm 
                                appointmentId={appointment.id} 
                                serviceName={appointment.services.name}
                                onReviewSubmitted={fetchAppointments}
                              />
                            )}
                            {reviewedAppointments.has(appointment.id) && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                <Star className="w-3 h-3 mr-1 fill-primary" />
                                Avaliado
                              </Badge>
                            )}
                            <Badge variant="outline" className={statusColors[appointment.status]}>
                              {statusLabels[appointment.status]}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyAppointments;
