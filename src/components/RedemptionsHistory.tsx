import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ShoppingBag, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Redemption {
  id: string;
  status: string;
  created_at: string;
  store_products: {
    name: string;
    image_url: string;
  } | null;
}

export function RedemptionsHistory() {
  const { user } = useAuth();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRedemptions();
    }
  }, [user]);

  const fetchRedemptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("store_redemptions")
        .select(`
          id,
          status,
          created_at,
          store_products:product_id (name, image_url)
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRedemptions(data || []);
    } catch (error: any) {
      console.error("Error fetching redemptions:", error);
      toast.error("Erro ao carregar seu histórico de resgates");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border mb-4">
        <CardContent className="flex justify-center py-8">
          <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (redemptions.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShoppingBag className="w-5 h-5 text-primary" />
          Meus Resgates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {redemptions.map((redemption) => {
            const isPending = redemption.status === "pending";
            const isFulfilled = redemption.status === "fulfilled";

            return (
              <div key={redemption.id} className="flex items-center gap-3 bg-background/50 p-3 rounded-lg border border-border/50">
                <div className="w-12 h-12 bg-black/30 rounded flex items-center justify-center shrink-0 border border-border/30 overflow-hidden">
                  {redemption.store_products?.image_url ? (
                    <img src={redemption.store_products.image_url} alt={redemption.store_products.name} className="w-full h-full object-contain" />
                  ) : (
                    <ShoppingBag className="w-5 h-5 text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-foreground line-clamp-1">{redemption.store_products?.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(redemption.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  {isPending && (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className="hidden sm:inline">Disponível</span>
                    </Badge>
                  )}
                  {isFulfilled && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      <span className="hidden sm:inline">Utilizado</span>
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

