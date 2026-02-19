import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Users, Phone, Calendar, DollarSign, Star, History, ChevronRight, Trophy, Trash2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomerHistory } from "./CustomerHistory";
import ClientLoyaltyManager from "./ClientLoyaltyManager";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
interface ClientProfile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  totalVisits: number;
  totalSpent: number;
  lastVisit: string | null;
  noShows: number;
}

export function ClientsList() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loyaltyClientId, setLoyaltyClientId] = useState<string | null>(null);
  const [loyaltyClientName, setLoyaltyClientName] = useState<string>("");

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        setLoading(false);
        return;
      }

      if (!profilesData || profilesData.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      // Fetch all appointments with confirmed/completed/no_show status
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          user_id,
          appointment_date,
          status,
          services (
            price
          )
        `)
        .in("status", ["confirmed", "completed", "no_show"]);

      if (appointmentsError) {
        console.error("Error fetching appointments:", appointmentsError);
      }

      // Calculate stats for each client
      const clientsWithStats: ClientProfile[] = profilesData.map((profile) => {
        const clientAppointments = appointmentsData?.filter(
          (a) => a.user_id === profile.user_id
        ) || [];

        const visitAppointments = clientAppointments.filter(a => a.status === "confirmed" || a.status === "completed");
        const noShowAppointments = clientAppointments.filter(a => a.status === "no_show");
        const totalVisits = visitAppointments.length;
        const totalSpent = visitAppointments.reduce(
          (sum, a) => sum + (a.services?.price || 0),
          0
        );
        const sortedAppointments = [...visitAppointments].sort(
          (a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
        );
        const lastVisit = sortedAppointments[0]?.appointment_date || null;

        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          phone: profile.phone,
          created_at: profile.created_at,
          totalVisits,
          totalSpent,
          lastVisit,
          noShows: noShowAppointments.length,
        };
      });

      setClients(clientsWithStats);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (userId: string, clientName: string) => {
    try {
      
      // Delete loyalty progress
      const { error: loyaltyError } = await supabase
        .from("loyalty_progress")
        .delete()
        .eq("user_id", userId);
      if (loyaltyError) console.error("Error deleting loyalty_progress:", loyaltyError);

      // Delete loyalty rewards history
      const { error: rewardsError } = await supabase
        .from("loyalty_rewards_history")
        .delete()
        .eq("user_id", userId);
      if (rewardsError) console.error("Error deleting loyalty_rewards_history:", rewardsError);

      // Delete notifications
      const { error: notifError } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", userId);
      if (notifError) console.error("Error deleting notifications:", notifError);

      // Delete reviews
      const { error: reviewsError } = await supabase
        .from("reviews")
        .delete()
        .eq("user_id", userId);
      if (reviewsError) console.error("Error deleting reviews:", reviewsError);

      // Delete appointment_services for user's appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id")
        .eq("user_id", userId);

      if (appointments && appointments.length > 0) {
        const appointmentIds = appointments.map(a => a.id);
        const { error: appServError } = await supabase
          .from("appointment_services")
          .delete()
          .in("appointment_id", appointmentIds);
        if (appServError) console.error("Error deleting appointment_services:", appServError);
      }

      // Delete appointments
      const { error: appError } = await supabase
        .from("appointments")
        .delete()
        .eq("user_id", userId);
      if (appError) console.error("Error deleting appointments:", appError);

      // Delete user_roles
      const { error: rolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (rolesError) console.error("Error deleting user_roles:", rolesError);

      // Delete profile - force delete all profiles with this user_id
      const { error: profileError, count } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", userId)
        .select();

      

      if (profileError) {
        console.error("Error deleting profile:", profileError);
        toast.error(`Erro ao excluir cliente: ${profileError.message}`);
        return;
      }

      toast.success(`Cliente ${clientName} excluído com sucesso`);
      
      // Remove from local state immediately for better UX
      setClients(prev => prev.filter(c => c.user_id !== userId));
      
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Erro ao excluir cliente");
    }
  };

  const filteredClients = clients.filter((client) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.full_name?.toLowerCase().includes(searchLower) ||
      client.phone?.toLowerCase().includes(searchLower)
    );
  });

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.totalVisits > 0).length;
  const totalRevenue = clients.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{totalClients}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Cadastrados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-xl border-green-500/20">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{activeClients}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Ativos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-xl border-blue-500/20 col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">R$ {totalRevenue.toFixed(0)}</p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Receita Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Clientes Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/50 border-primary/20"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {filteredClients.map((client) => (
                  <Card
                    key={client.user_id}
                    className="bg-background/30 border-primary/10 hover:border-primary/30 transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => setSelectedClientId(client.user_id)}>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground">
                              {client.full_name || "Cliente sem nome"}
                            </h3>
                            {client.totalVisits > 0 && (
                              <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                                Ativo
                              </Badge>
                            )}
                            {client.totalVisits === 0 && (
                              <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs">
                                Novo
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {client.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {client.phone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Desde {format(parseISO(client.created_at), "MMM/yyyy", { locale: ptBR })}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                            <span className="flex items-center gap-1 text-primary font-medium">
                              <History className="w-3 h-3" />
                              {client.totalVisits} visitas
                            </span>
                            <span className="flex items-center gap-1 text-green-500 font-medium">
                              <DollarSign className="w-3 h-3" />
                              R$ {client.totalSpent.toFixed(2)}
                            </span>
                            {client.noShows > 0 && (
                              <span className="flex items-center gap-1 text-orange-500 font-medium">
                                <XCircle className="w-3 h-3" />
                                {client.noShows} {client.noShows === 1 ? 'falta' : 'faltas'}
                              </span>
                            )}
                            {client.lastVisit && (
                              <span className="text-muted-foreground">
                                Última: {format(parseISO(client.lastVisit), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setLoyaltyClientId(client.user_id);
                              setLoyaltyClientName(client.full_name || "Cliente");
                            }}
                            className="border-primary/30 text-primary hover:bg-primary/10 px-2 sm:px-3"
                          >
                            <Trophy className="w-4 h-4 sm:mr-1" />
                            <span className="hidden sm:inline">Fidelidade</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="icon"
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-destructive/20">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-foreground">Excluir Cliente</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir <strong>{client.full_name || "este cliente"}</strong>?
                                  <br /><br />
                                  Isso irá remover permanentemente:
                                  <br />• Todos os agendamentos
                                  <br />• Histórico de fidelidade
                                  <br />• Avaliações
                                  <br />• Notificações
                                  <br /><br />
                                  <strong className="text-destructive">Esta ação não pode ser desfeita!</strong>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteClient(client.user_id, client.full_name || "Cliente")}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setSelectedClientId(client.user_id)}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Customer History Modal */}
      {selectedClientId && (
        <CustomerHistory
          userId={selectedClientId}
          isOpen={!!selectedClientId}
          onClose={() => setSelectedClientId(null)}
        />
      )}

      {/* Loyalty Management Sheet */}
      <Sheet open={!!loyaltyClientId} onOpenChange={(open) => !open && setLoyaltyClientId(null)}>
        <SheetContent className="bg-card border-primary/20 w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">Gerenciar Fidelidade</SheetTitle>
          </SheetHeader>
          {loyaltyClientId && (
            <div className="mt-6">
              <ClientLoyaltyManager 
                clientId={loyaltyClientId} 
                clientName={loyaltyClientName} 
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
