import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isPast, subHours, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, Scissors, ChevronLeft, X, Check, AlertCircle, Star, Trophy, CreditCard, Receipt, Hash } from "lucide-react";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { ReviewForm } from "@/components/ReviewForm";
import { ProfileMenu } from "@/components/ProfileMenu";
import CancellationPolicy from "@/components/CancellationPolicy";
import CustomerLoyaltyCard from "@/components/CustomerLoyaltyCard";
import { gsap } from "gsap";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
  payment_method: string | null;
  services: {
    name: string;
    price: number;
  } | null;
  extra_services?: { name: string; price: number }[];
  total_price?: number;
  combined_name?: string;
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

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
};

const MyAppointments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviewedAppointments, setReviewedAppointments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

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
        payment_method,
        services (
          name,
          price
        ),
        appointment_services (
          services (
            name,
            price
          )
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

      // Combine main service + extras into single display entry
      const combined = (data as any[]).map((apt) => {
        const extras = (apt.appointment_services || [])
          .map((as: any) => as.services)
          .filter(Boolean) as { name: string; price: number }[];

        const mainPrice = apt.services?.price || 0;
        const extrasPrice = extras.reduce((sum, s) => sum + (s.price || 0), 0);
        const allNames = [apt.services?.name, ...extras.map(e => e.name)].filter(Boolean);

        return {
          ...apt,
          extra_services: extras,
          total_price: mainPrice + extrasPrice,
          combined_name: allNames.join(" + "),
        } as Appointment;
      });

      setAppointments(combined);
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

  const isWithinCancellationWindow = (date: string, time: string): boolean => {
    const appointmentDateTime = parseISO(`${date}T${time}`);
    const twoHoursBefore = subHours(appointmentDateTime, 2);
    return isBefore(new Date(), twoHoursBefore);
  };

  const upcomingAppointments = appointments.filter(
    (a) => a.status !== "cancelled" && a.status !== "completed" && !isPast(parseISO(`${a.appointment_date}T${a.appointment_time}`))
  );

  const pastAppointments = appointments.filter(
    (a) => a.status === "completed" || a.status === "cancelled" || isPast(parseISO(`${a.appointment_date}T${a.appointment_time}`))
  );

  return (
    <div className="min-h-screen relative overflow-hidden safe-bottom">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 max-w-7xl mx-auto safe-top">
        <Button variant="ghost" onClick={() => navigate("/booking")} className="text-foreground hover:text-primary px-2 sm:px-4 touch-target">
          <ChevronLeft className="w-5 h-5 sm:mr-2" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationsDropdown />
          <ProfileMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="appointments-container relative z-10 px-3 sm:px-4 py-4 sm:py-6 max-w-4xl mx-auto pb-8">
        <Tabs defaultValue="appointments" className="space-y-4 sm:space-y-6">
          <TabsList className="bg-card/40 backdrop-blur-xl border border-primary/20 w-full grid grid-cols-2 h-12 sm:h-10">
            <TabsTrigger value="appointments" className="data-[state=active]:bg-primary data-[state=active]:text-background py-3 sm:py-2 text-sm sm:text-sm font-medium">
              <Calendar className="w-4 h-4 mr-1.5 sm:mr-2" />
              Agendamentos
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="data-[state=active]:bg-primary data-[state=active]:text-background py-3 sm:py-2 text-sm sm:text-sm font-medium">
              <Trophy className="w-4 h-4 mr-1.5 sm:mr-2" />
              Fidelidade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="space-y-8">
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
                <div className="space-y-3">
                  {upcomingAppointments.map((appointment) => (
                    <Card key={appointment.id} className="bg-card/40 backdrop-blur-xl border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                              <span className="text-lg font-bold text-primary">
                                {format(parseISO(appointment.appointment_date), "dd")}
                              </span>
                              <span className="text-xs text-primary uppercase">
                                {format(parseISO(appointment.appointment_date), "MMM", { locale: ptBR })}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground flex items-start gap-2 text-sm sm:text-base">
                                <Scissors className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                                <span className="break-words">{appointment.combined_name || appointment.services?.name || "Serviço"}</span>
                              </h3>
                              {appointment.extra_services && appointment.extra_services.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1 ml-6">
                                  {appointment.extra_services.length} serviço{appointment.extra_services.length > 1 ? 's' : ''} extra{appointment.extra_services.length > 1 ? 's' : ''}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {appointment.appointment_time.slice(0, 5)}
                                </span>
                                <span className="text-lg font-bold text-primary">
                                  R$ {(appointment.total_price ?? appointment.services?.price ?? 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <Badge variant="outline" className={statusColors[appointment.status]}>
                                  {statusLabels[appointment.status]}
                                </Badge>
                                <Badge variant="outline" className="bg-muted/50 text-xs">
                                  {paymentLabels[appointment.payment_status]} ({paymentMethodLabels[appointment.payment_method || 'pix'] || appointment.payment_method || 'PIX'})
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-border">
                            <CancellationPolicy variant="compact" />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10 h-9 px-3 touch-target">
                                  <X className="w-4 h-4 mr-1.5" />
                                  Cancelar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar Agendamento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja cancelar este agendamento?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogAction
                                    onClick={() => handleCancelAppointment(appointment.id)}
                                  >
                                    Sim, Cancelar
                                  </AlertDialogAction>
                                  <AlertDialogCancel>Voltar</AlertDialogCancel>
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

                <div className="space-y-2 sm:space-y-3">
                  {pastAppointments.map((appointment) => (
                    <Card
                      key={appointment.id}
                      onClick={() => setSelectedAppointment(appointment)}
                      className="bg-card/20 backdrop-blur-xl border-border/50 opacity-80 cursor-pointer hover:opacity-100 hover:border-primary/40 hover:bg-card/40 transition-all active:scale-[0.99]"
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted/30 flex flex-col items-center justify-center flex-shrink-0">
                              <span className="text-xs sm:text-sm font-bold text-muted-foreground">
                                {format(parseISO(appointment.appointment_date), "dd")}
                              </span>
                              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">
                                {format(parseISO(appointment.appointment_date), "MMM", { locale: ptBR })}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-muted-foreground text-sm break-words">
                                {appointment.combined_name || appointment.services?.name || "Serviço"}
                              </h3>
                              <span className="text-xs sm:text-sm text-muted-foreground">{appointment.appointment_time.slice(0, 5)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {appointment.status === "completed" && !reviewedAppointments.has(appointment.id) && (
                              <ReviewForm 
                                appointmentId={appointment.id} 
                                serviceName={appointment.services?.name || "Serviço"}
                                onReviewSubmitted={fetchAppointments}
                              />
                            )}
                            {reviewedAppointments.has(appointment.id) && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                                <Star className="w-3 h-3 mr-1 fill-primary" />
                                <span className="hidden xs:inline">Avaliado</span>
                              </Badge>
                            )}
                            <Badge variant="outline" className={`${statusColors[appointment.status]} text-xs`}>
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
          </TabsContent>

          <TabsContent value="loyalty">
            <CustomerLoyaltyCard />
          </TabsContent>
        </Tabs>
      </main>

      {/* Appointment Details Modal */}
      <Dialog open={!!selectedAppointment} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-primary/20">
          {selectedAppointment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-foreground">
                  <Receipt className="w-5 h-5 text-primary" />
                  Detalhes do Agendamento
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Informações completas do seu pedido
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Status & Date */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="outline" className={statusColors[selectedAppointment.status]}>
                    {statusLabels[selectedAppointment.status]}
                  </Badge>
                  <Badge variant="outline" className="bg-muted/50 text-xs">
                    {paymentLabels[selectedAppointment.payment_status]} ({paymentMethodLabels[selectedAppointment.payment_method || 'pix'] || selectedAppointment.payment_method || 'PIX'})
                  </Badge>
                </div>

                {/* Date & Time block */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-primary">
                      {format(parseISO(selectedAppointment.appointment_date), "dd")}
                    </span>
                    <span className="text-xs text-primary uppercase">
                      {format(parseISO(selectedAppointment.appointment_date), "MMM", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(selectedAppointment.appointment_date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                    <p className="flex items-center gap-1.5 text-foreground font-semibold mt-1">
                      <Clock className="w-4 h-4 text-primary" />
                      {selectedAppointment.appointment_time.slice(0, 5)}
                    </p>
                  </div>
                </div>

                {/* Services */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    Serviços
                  </h4>
                  <div className="space-y-1.5 rounded-xl bg-muted/20 border border-border/50 p-3">
                    {selectedAppointment.services && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{selectedAppointment.services.name}</span>
                        <span className="text-muted-foreground">R$ {selectedAppointment.services.price.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedAppointment.extra_services?.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{s.name}</span>
                        <span className="text-muted-foreground">R$ {s.price.toFixed(2)}</span>
                      </div>
                    ))}
                    <Separator className="my-2 bg-border/50" />
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-foreground">Total</span>
                      <span className="text-primary text-lg">
                        R$ {(selectedAppointment.total_price ?? selectedAppointment.services?.price ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/20 border border-border/50">
                  <CreditCard className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="flex-1 text-sm">
                    <p className="text-muted-foreground">Pagamento</p>
                    <p className="text-foreground font-medium">
                      {paymentMethodLabels[selectedAppointment.payment_method || 'pix'] || selectedAppointment.payment_method || 'PIX'} • {paymentLabels[selectedAppointment.payment_status]}
                    </p>
                  </div>
                </div>

                {/* Booking ID */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Hash className="w-3 h-3" />
                  <span className="font-mono truncate">{selectedAppointment.id}</span>
                </div>

                {/* Review action if completed and not reviewed */}
                {selectedAppointment.status === "completed" && !reviewedAppointments.has(selectedAppointment.id) && (
                  <div className="pt-2">
                    <ReviewForm
                      appointmentId={selectedAppointment.id}
                      serviceName={selectedAppointment.combined_name || selectedAppointment.services?.name || "Serviço"}
                      onReviewSubmitted={() => {
                        fetchAppointments();
                        setSelectedAppointment(null);
                      }}
                    />
                  </div>
                )}
                {reviewedAppointments.has(selectedAppointment.id) && (
                  <div className="flex items-center justify-center gap-2 text-sm text-primary pt-1">
                    <Star className="w-4 h-4 fill-primary" />
                    Você já avaliou este serviço
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyAppointments;
