import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Users, Phone, Calendar, DollarSign, Star, History, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { CustomerHistory } from "./CustomerHistory";

interface ClientProfile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  totalVisits: number;
  totalSpent: number;
  lastVisit: string | null;
}

export function ClientsList() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

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

      // Fetch all appointments with confirmed/completed status
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
        .in("status", ["confirmed", "completed"]);

      if (appointmentsError) {
        console.error("Error fetching appointments:", appointmentsError);
      }

      // Calculate stats for each client
      const clientsWithStats: ClientProfile[] = profilesData.map((profile) => {
        const clientAppointments = appointmentsData?.filter(
          (a) => a.user_id === profile.user_id
        ) || [];

        const totalVisits = clientAppointments.length;
        const totalSpent = clientAppointments.reduce(
          (sum, a) => sum + (a.services?.price || 0),
          0
        );
        const sortedAppointments = [...clientAppointments].sort(
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
        };
      });

      setClients(clientsWithStats);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalClients}</p>
              <p className="text-sm text-muted-foreground">Total Cadastrados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-xl border-green-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Star className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeClients}</p>
              <p className="text-sm text-muted-foreground">Clientes Ativos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-xl border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">R$ {totalRevenue.toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Receita Total</p>
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
                    className="bg-background/30 border-primary/10 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedClientId(client.user_id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
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
                            {client.lastVisit && (
                              <span className="text-muted-foreground">
                                Última: {format(parseISO(client.lastVisit), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                        </div>

                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                          <ChevronRight className="w-5 h-5" />
                        </Button>
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
    </div>
  );
}
