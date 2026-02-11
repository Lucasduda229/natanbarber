import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, Calendar, Star, Scissors, Phone, MessageSquare, Save, X, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CustomerProfile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  admin_notes: string | null;
  created_at: string;
}

interface CustomerAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  services: {
    name: string;
    price: number;
  } | null;
}

interface CustomerReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface CustomerHistoryProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Falta",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-500",
  confirmed: "bg-blue-500/20 text-blue-500",
  completed: "bg-green-500/20 text-green-500",
  cancelled: "bg-red-500/20 text-red-500",
  no_show: "bg-orange-500/20 text-orange-500",
};

export function CustomerHistory({ userId, isOpen, onClose }: CustomerHistoryProps) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchCustomerData();
    }
  }, [isOpen, userId]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, admin_notes, created_at")
        .eq("user_id", userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
      } else {
        setProfile(profileData);
        setAdminNotes(profileData?.admin_notes || "");
      }

      // Fetch appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          appointment_time,
          status,
          services (
            name,
            price
          )
        `)
        .eq("user_id", userId)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });

      if (appointmentsError) {
        console.error("Error fetching appointments:", appointmentsError);
      } else {
        setAppointments(appointmentsData as CustomerAppointment[]);
      }

      // Fetch reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (reviewsError) {
        console.error("Error fetching reviews:", reviewsError);
      } else {
        setReviews(reviewsData || []);
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveAdminNotes = async () => {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ admin_notes: adminNotes })
        .eq("user_id", userId);

      if (error) {
        toast.error("Erro ao salvar notas");
        console.error("Error saving notes:", error);
      } else {
        toast.success("Notas salvas com sucesso!");
      }
    } catch (error) {
      toast.error("Erro ao salvar notas");
    } finally {
      setSavingNotes(false);
    }
  };

  // Calculate stats - include confirmed and completed appointments
  const confirmedOrCompleted = appointments.filter(a => a.status === "completed" || a.status === "confirmed");
  const totalSpent = confirmedOrCompleted.reduce((sum, a) => sum + (a.services?.price || 0), 0);
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) 
    : "N/A";

  // Find favorite service based on confirmed/completed
  const serviceCounts: Record<string, number> = {};
  confirmedOrCompleted.forEach(a => {
    const serviceName = a.services?.name || "Desconhecido";
    serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
  });
  const favoriteService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <History className="w-5 h-5 text-primary" />
            Histórico do Cliente
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-4">
            {/* Customer Info */}
            <Card className="bg-background/50 border-primary/20 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  {profile?.full_name || "Cliente"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile?.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {profile.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Cliente desde {profile?.created_at ? format(parseISO(profile.created_at), "MMMM 'de' yyyy", { locale: ptBR }) : "N/A"}
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Card className="bg-primary/10 border-primary/20">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-primary">{confirmedOrCompleted.length}</div>
                  <div className="text-xs text-muted-foreground">Visitas</div>
                </CardContent>
              </Card>
              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-green-500">R$ {totalSpent.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Total gasto</div>
                </CardContent>
              </Card>
              <Card className="bg-yellow-500/10 border-yellow-500/20">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-500 flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 fill-current" />
                    {averageRating}
                  </div>
                  <div className="text-xs text-muted-foreground">Avaliação média</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-500/10 border-blue-500/20">
                <CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-blue-500 truncate">{favoriteService}</div>
                  <div className="text-xs text-muted-foreground">Favorito</div>
                </CardContent>
              </Card>
            </div>

            {/* Admin Notes */}
            <Card className="bg-background/50 border-primary/20 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Notas do Atendimento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Ex: Prefere corte mais curto nas laterais, gosta de conversar sobre futebol..."
                  className="bg-background/50 border-primary/20 min-h-[80px] text-sm"
                />
                <Button 
                  size="sm" 
                  onClick={saveAdminNotes}
                  disabled={savingNotes}
                  className="bg-primary text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {savingNotes ? "Salvando..." : "Salvar Notas"}
                </Button>
              </CardContent>
            </Card>

            <Separator className="my-4" />

            {/* Appointment History */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Scissors className="w-4 h-4 text-primary" />
                Histórico de Agendamentos ({appointments.length})
              </h3>
              
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum agendamento encontrado
                </p>
              ) : (
                <div className="space-y-2">
                  {appointments.map((appointment) => (
                    <Card key={appointment.id} className="bg-background/30 border-primary/10">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {appointment.services?.name || "Serviço"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(appointment.appointment_date), "dd/MM/yyyy", { locale: ptBR })} às {appointment.appointment_time.slice(0, 5)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-primary">
                            R$ {appointment.services?.price?.toFixed(2) || "0.00"}
                          </span>
                          <Badge className={statusColors[appointment.status] || ""}>
                            {statusLabels[appointment.status] || appointment.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            {reviews.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary" />
                    Avaliações ({reviews.length})
                  </h3>
                  <div className="space-y-2">
                    {reviews.map((review) => (
                      <Card key={review.id} className="bg-background/30 border-primary/10">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3 h-3 ${
                                    star <= review.rating
                                      ? "text-yellow-500 fill-yellow-500"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(review.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-muted-foreground">{review.comment}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}