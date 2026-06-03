import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Calendar, Crown, ChevronDown, ChevronUp, History, CreditCard } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PackagePayment {
  id: string;
  user_id: string;
  package_id: string | null;
  package_name: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
}

interface ClientHistory {
  user_id: string;
  profile: Profile | null;
  payments: PackagePayment[];
  total_spent: number;
  total_purchases: number;
}

export const SubscribersHistory = () => {
  const [loading, setLoading] = useState(true);
  const [clientHistories, setClientHistories] = useState<ClientHistory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, profilesRes] = await Promise.all([
        supabase.from("package_payments").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name, phone"),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const payments = paymentsRes.data as PackagePayment[];
      const profiles = profilesRes.data as Profile[];

      const historyMap = new Map<string, ClientHistory>();

      payments.forEach((payment) => {
        if (!historyMap.has(payment.user_id)) {
          historyMap.set(payment.user_id, {
            user_id: payment.user_id,
            profile: profiles.find((p) => p.user_id === payment.user_id) || null,
            payments: [],
            total_spent: 0,
            total_purchases: 0,
          });
        }
        const client = historyMap.get(payment.user_id)!;
        client.payments.push(payment);
        client.total_spent += Number(payment.amount) || 0;
        client.total_purchases += 1;
      });

      // Convert map to array and sort by most recent purchase
      const historyArray = Array.from(historyMap.values()).sort((a, b) => {
        const dateA = new Date(a.payments[0].created_at).getTime();
        const dateB = new Date(b.payments[0].created_at).getTime();
        return dateB - dateA;
      });

      setClientHistories(historyArray);
    } catch (error) {
      console.error("Error fetching subscriber history:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleClient = (userId: string) => {
    setExpandedClients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const filteredHistories = clientHistories.filter((client) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const nameMatch = client.profile?.full_name?.toLowerCase().includes(search);
    const phoneMatch = client.profile?.phone?.toLowerCase().includes(search);
    return nameMatch || phoneMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Crown className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            Histórico de Assinantes
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Veja todas as compras de pacotes por cliente
          </p>
        </div>
      </div>

      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background/50 border-primary/20"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredHistories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum histórico encontrado.
              </p>
            ) : (
              filteredHistories.map((client) => {
                const isExpanded = expandedClients.has(client.user_id);
                return (
                  <div
                    key={client.user_id}
                    className="rounded-lg border border-primary/10 bg-background/30 overflow-hidden"
                  >
                    {/* Header that acts as a toggle */}
                    <div
                      className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => toggleClient(client.user_id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Crown className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {client.profile?.full_name || "Cliente sem nome"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {client.profile?.phone || "Sem telefone"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                        <div className="flex flex-col items-start sm:items-end flex-1 sm:flex-none">
                          <span className="text-sm font-medium text-foreground">
                            {client.total_purchases} {client.total_purchases === 1 ? 'compra' : 'compras'}
                          </span>
                          <span className="text-xs text-primary font-semibold">
                            Total: R$ {client.total_spent.toFixed(2)}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" className="p-0 h-8 w-8 text-muted-foreground hover:text-primary">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="p-4 border-t border-primary/10 bg-background/50">
                        <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Histórico de Compras
                        </h4>
                        <div className="space-y-2">
                          {client.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex flex-col sm:flex-row justify-between sm:items-center p-3 rounded-md bg-card border border-border/50 gap-2"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-sm text-foreground">
                                  {payment.package_name}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm")}
                                </span>
                              </div>
                              
                              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                                <Badge variant="outline" className="text-[10px] sm:text-xs">
                                  {payment.payment_method === 'pix' ? 'PIX' : payment.payment_method === 'cash' ? 'Dinheiro' : payment.payment_method === 'card' ? 'Cartão' : 'Outro'}
                                </Badge>
                                <span className="font-semibold text-sm text-primary whitespace-nowrap">
                                  R$ {Number(payment.amount).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
