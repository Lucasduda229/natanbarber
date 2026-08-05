import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Store as StoreIcon, Gift, ShoppingBag, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AnimatedBackground from "@/components/AnimatedBackground";

interface StoreProduct {
  id: string;
  name: string;
  image_url: string;
  cost_in_tickets: number;
  category?: string;
}

export default function Store() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [ticketsBalance, setTicketsBalance] = useState(0);
  const [activeTab, setActiveTab] = useState("Vales");

  useEffect(() => {
    if (user?.id) {
      fetchProducts();
      fetchProfile();
    } else if (user === null) {
      navigate("/login");
    }
  }, [user?.id, navigate]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("tickets_balance")
        .eq("user_id", user?.id)
        .single();
        
      if (error) throw error;
      if (data) {
        setTicketsBalance(data.tickets_balance || 0);
      }
    } catch (error) {
      console.error("Error fetching profile tickets:", error);
    }
  };

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
      
      fetchProfile();
    } catch (error: any) {
      console.error("Redeem error:", error);
      toast.error("Erro ao resgatar", { description: error.message });
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-20">
      <AnimatedBackground />

      <main className="container max-w-4xl px-4 pt-6 mx-auto relative z-10 flex flex-col min-h-screen">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/indique')}
            className="mr-2 hover:bg-primary/20"
          >
            <ArrowLeft className="w-5 h-5 text-primary" />
          </Button>
          <div className="flex-1 flex items-center gap-2">
            <StoreIcon className="w-6 h-6 text-[#00D4AA]" />
            <h1 className="text-2xl font-bold text-foreground">Loja</h1>
          </div>
          <div className="flex items-center gap-2 bg-[#00D4AA]/10 text-[#00D4AA] px-3 py-1.5 rounded-full border border-[#00D4AA]/30 shadow-[0_0_10px_rgba(0,212,170,0.1)]">
            <Gift className="w-4 h-4" />
            <span className="font-bold text-sm">{ticketsBalance} {ticketsBalance === 1 ? 'ticket' : 'tickets'}</span>
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <span className="w-8 h-8 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Tabs defaultValue="Vales" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-card/60 backdrop-blur-xl border border-border/50">
                <TabsTrigger value="Vales" className="data-[state=active]:bg-[#00D4AA]/20 data-[state=active]:text-[#00D4AA]">Vales & Cupons</TabsTrigger>
                <TabsTrigger value="Produtos" className="data-[state=active]:bg-[#00D4AA]/20 data-[state=active]:text-[#00D4AA]">Produtos Físicos</TabsTrigger>
              </TabsList>
              
              {["Vales", "Produtos"].map(tabCategory => {
                const categoryProducts = products.filter(p => (p.category || 'Produtos') === tabCategory);
                
                return (
                  <TabsContent key={tabCategory} value={tabCategory} className="mt-0">
                    {categoryProducts.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground flex flex-col items-center bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl">
                        <StoreIcon className="w-12 h-12 mb-3 opacity-20" />
                        <p>Nenhum item disponível nesta categoria no momento.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {categoryProducts.map((product) => {
                          const isReady = ticketsBalance >= product.cost_in_tickets;
                          const isRedeeming = redeemingId === product.id;

                          return (
                            <div key={product.id} className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden flex flex-col hover:border-[#00D4AA]/30 transition-all duration-300 shadow-lg">
                              <div className="aspect-video bg-black/40 relative flex items-center justify-center p-2">
                                {product.image_url ? (
                                  <img 
                                    src={product.image_url} 
                                    alt={product.name} 
                                    className="w-full h-full object-contain rounded-md"
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
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}
