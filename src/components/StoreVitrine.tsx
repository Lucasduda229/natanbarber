import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Store, Gift, ShoppingBag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface StoreProduct {
  id: string;
  name: string;
  image_url: string;
  cost_in_tickets: number;
}

interface StoreVitrineProps {
  ticketsBalance: number;
  onRedeemSuccess: () => void;
}

export function StoreVitrine({ ticketsBalance, onRedeemSuccess }: StoreVitrineProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("store_products")
        .select("*")
        .eq("active", true)
        .order("cost_in_tickets", { ascending: true });
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (product: StoreProduct) => {
    if (!user) return;
    
    if (ticketsBalance < product.cost_in_tickets) {
      toast.error("Tickets insuficientes", { 
        description: `Você precisa de ${product.cost_in_tickets} tickets, mas tem ${ticketsBalance}.` 
      });
      return;
    }

    try {
      setRedeemingId(product.id);
      
      const { error } = await supabase.rpc('redeem_store_product', {
        p_user_id: user.id,
        p_product_id: product.id
      });

      if (error) throw error;

      toast.success("Resgate solicitado com sucesso!", {
        description: "Apresente-se na barbearia para retirar seu produto."
      });
      
      onRedeemSuccess();
    } catch (error: any) {
      console.error("Redeem error:", error);
      toast.error("Erro ao resgatar", { description: error.message });
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-black font-bold shadow-[0_0_15px_rgba(0,212,170,0.3)]">
          <Store className="w-5 h-5 mr-2" />
          Acessar Loja
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-background/95 backdrop-blur-xl border-primary/20">
        <DialogHeader className="pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <ShoppingBag className="w-6 h-6 text-[#00D4AA]" />
            Vitrine de Produtos
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground">Seu saldo atual:</span>
            <span className="bg-[#00D4AA]/10 text-[#00D4AA] px-3 py-1 rounded-full font-bold text-sm border border-[#00D4AA]/30 shadow-[0_0_10px_rgba(0,212,170,0.1)] flex items-center gap-1.5">
              <Gift className="w-4 h-4" />
              {ticketsBalance} {ticketsBalance === 1 ? 'ticket' : 'tickets'}
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-1 py-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <span className="w-8 h-8 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
              <Store className="w-12 h-12 mb-3 opacity-20" />
              <p>Nenhum produto disponível na loja no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {products.map((product) => {
                const isReady = ticketsBalance >= product.cost_in_tickets;
                const isRedeeming = redeemingId === product.id;

                return (
                  <div key={product.id} className="bg-card/50 border border-border/50 rounded-2xl overflow-hidden flex flex-col hover:border-[#00D4AA]/30 transition-all duration-300">
                    <div className="aspect-square bg-black/20 relative">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-12 h-12 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold border border-border flex items-center gap-1 shadow-sm">
                        <Gift className="w-3.5 h-3.5 text-[#00D4AA]" />
                        {product.cost_in_tickets}
                      </div>
                    </div>
                    
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-bold text-foreground line-clamp-2 mb-3 flex-1">{product.name}</h3>
                      
                      <Button 
                        onClick={() => handleRedeem(product)}
                        disabled={!isReady || isRedeeming}
                        className={`w-full ${isReady 
                          ? 'bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-black shadow-[0_0_10px_rgba(0,212,170,0.2)]' 
                          : 'bg-muted text-muted-foreground'}`}
                      >
                        {isRedeeming ? (
                          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : isReady ? (
                          "Resgatar Produto"
                        ) : (
                          "Tickets Insuficientes"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
