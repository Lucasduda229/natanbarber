import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, Clock, ShoppingBag, Search, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { openWhatsApp } from "@/lib/whatsapp";

interface Redemption {
  id: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    phone: string | null;
  } | null;
  store_products: {
    name: string;
    image_url: string;
    category: string;
  } | null;
}

export function RedemptionsManager() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const fetchRedemptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("store_redemptions")
        .select(`
          id,
          status,
          created_at,
          profiles:user_id (full_name, phone),
          store_products:product_id (name, image_url, category)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRedemptions(data || []);
    } catch (error: any) {
      console.error("Error fetching redemptions:", error);
      toast.error("Erro ao carregar os resgates", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkFulfilled = async (id: string) => {
    if (!confirm("Confirmar que este resgate foi utilizado/entregue ao cliente?")) return;

    try {
      const { error } = await supabase
        .from("store_redemptions")
        .update({ status: "fulfilled" })
        .eq("id", id);

      if (error) throw error;
      toast.success("Resgate marcado como utilizado!");
      fetchRedemptions();
    } catch (error: any) {
      console.error("Error fulfilling redemption:", error);
      toast.error("Erro ao atualizar resgate", { description: error.message });
    }
  };

  const filteredRedemptions = redemptions.filter(r => {
    const matchesSearch = r.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.store_products?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <Card className="bg-card/40 backdrop-blur-md border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              Histórico de Resgates
            </CardTitle>
            <CardDescription>Gerencie os vales e produtos resgatados pelos clientes.</CardDescription>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou produto..."
              className="pl-9 bg-background/50 border-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="flex h-10 w-full sm:w-[200px] rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-primary/20"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Disponíveis (Pendentes)</option>
            <option value="fulfilled">Utilizados (Concluídos)</option>
          </select>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRedemptions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-background/30">
            Nenhum resgate encontrado.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRedemptions.map((redemption) => {
              const isPending = redemption.status === "pending";
              const isFulfilled = redemption.status === "fulfilled";
              
              return (
                <div key={redemption.id} className="bg-background/60 border border-border/50 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-16 h-16 rounded-md bg-black/40 border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {redemption.store_products?.image_url ? (
                        <img src={redemption.store_products.image_url} alt={redemption.store_products.name} className="w-full h-full object-contain" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-muted-foreground/30" />
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-foreground text-lg">{redemption.store_products?.name}</h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        Resgatado por <span className="font-medium text-foreground">{redemption.profiles?.full_name || "Cliente"}</span>
                      </p>
                      
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          {format(new Date(redemption.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                        
                        {redemption.profiles?.phone && (
                          <button
                            onClick={() => openWhatsApp(redemption.profiles!.phone!)}
                            className="text-xs text-[#25D366] hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {isPending && (
                      <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 flex items-center gap-1 py-1">
                        <Clock className="w-3 h-3" />
                        Disponível
                      </Badge>
                    )}
                    {isFulfilled && (
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 flex items-center gap-1 py-1">
                        <CheckCircle className="w-3 h-3" />
                        Utilizado
                      </Badge>
                    )}
                    {redemption.status === "cancelled" && (
                      <Badge variant="destructive" className="flex items-center gap-1 py-1">
                        Cancelado
                      </Badge>
                    )}
                    
                    {isPending && (
                      <Button 
                        size="sm" 
                        onClick={() => handleMarkFulfilled(redemption.id)}
                        className="w-full sm:w-auto bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-black font-semibold shadow-[0_0_10px_rgba(0,212,170,0.2)]"
                      >
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        Concluir Resgate
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
