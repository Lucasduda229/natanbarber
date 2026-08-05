import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Gift, Share2, Check, ArrowLeft, Users, Ticket, History, Calendar as CalendarIcon, Clock, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Store } from "lucide-react";

export default function Referrals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [view, setView] = useState<"dashboard" | "history">("dashboard");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("referral_code, referrals_balance, total_referrals, tickets_balance, full_name")
        .eq("user_id", user?.id)
        .single();
      
      setProfile(profileData);

      const { data: rewardsData } = await supabase
        .from("referral_rewards")
        .select("*")
        .eq("active", true)
        .order("cost_in_coupons", { ascending: true });
      
      setRewards(rewardsData || []);

      // Fetch user's redemptions
      const { data: redemptionsData } = await supabase
        .from("referral_redemptions")
        .select("id, created_at, status, referral_rewards(name, cost_in_coupons)")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      
      setRedemptions(redemptionsData || []);

      // Fetch history with the referred user's name, ID, and is_valid status
      const { data: historyData, error: historyError } = await supabase
        .from("referral_history")
        .select("id, created_at, referred_id, is_valid, profiles!referral_history_referred_id_fkey(full_name)")
        .eq("referrer_id", user?.id)
        .order("created_at", { ascending: false });
      
      if (!historyError && historyData && historyData.length > 0) {
        // Find referrals that are not yet valid
        const pendingReferrals = historyData.filter((h: any) => h.is_valid === false || h.is_valid === null);
        const pendingIds = pendingReferrals.map((h: any) => h.referred_id).filter(Boolean);
        
        let newlyValidatedIds = new Set<string>();
        let newlyValidatedCount = 0;
        
        if (pendingIds.length > 0) {
          const { data: aptData } = await supabase
            .from("appointments")
            .select("user_id")
            .in("user_id", pendingIds);
            
          if (aptData) {
            aptData.forEach(apt => newlyValidatedIds.add(apt.user_id));
          }
        }
        
        // If we found any pending referral that now has an appointment, update DB
        if (newlyValidatedIds.size > 0) {
          
          // Update referral_history to valid
          for (const referral of pendingReferrals) {
            if (newlyValidatedIds.has(referral.referred_id)) {
              const { data, error } = await supabase
                .from("referral_history")
                .update({ is_valid: true })
                .eq("id", referral.id)
                .select();
                
              if (!error && data && data.length > 0) {
                newlyValidatedCount++;
              } else {
                console.error("Failed to update referral history (RLS policy issue?):", error);
                // We remove it from newlyValidatedIds so we don't mark it valid locally
                newlyValidatedIds.delete(referral.referred_id);
              }
            }
          }
          
          // Only update profile if we successfully updated at least one referral in the DB
          if (newlyValidatedCount > 0 && profileData) {
            const newTickets = (profileData.tickets_balance || 0) + (newlyValidatedCount * 2);
            const newTotal = (profileData.total_referrals || 0) + newlyValidatedCount;
            const newBalance = (profileData.referrals_balance || 0) + newlyValidatedCount;
            
            await supabase
              .from("profiles")
              .update({ 
                tickets_balance: newTickets,
                total_referrals: newTotal,
                referrals_balance: newBalance
              })
              .eq("user_id", user?.id);
              
            setProfile(prev => prev ? ({
              ...prev,
              tickets_balance: newTickets,
              total_referrals: newTotal,
              referrals_balance: newBalance
            }) : prev);
            
            toast.success("Indicações validadas! 🎉", {
              description: `Você ganhou ${newlyValidatedCount * 2} tickets porque seus amigos agendaram!`
            });
          }
        }
        
        const enhancedHistory = historyData.map((h: any) => ({
          ...h,
          isValid: h.is_valid === true || newlyValidatedIds.has(h.referred_id)
        }));
        
        setHistory(enhancedHistory);
      } else {
        setHistory([]);
      }

    } catch (error) {
      console.error("Error fetching referral data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Use first name sanitized for URL, and include actual code for exact matching
  const firstName = profile?.full_name
    ? profile.full_name.split(' ')[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
    : (profile?.referral_code || "");
  const referralLink = profile?.referral_code 
    ? `${window.location.origin}/register?ref=${firstName}&code=${profile.referral_code}`
    : "";

  const handleCopyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copiado!", { description: "Agora é só mandar para seus amigos!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralLink) return;
    try {
      await navigator.share({
        title: "Natan Barber",
        text: `${firstName} convidou você para a Natan Barber! Cadastre-se e agende seu horário:`,
        url: referralLink,
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  const handleRedeem = async (reward: any) => {
    if (!user || !profile) return;
    
    if (profile.referrals_balance < reward.cost_in_coupons) {
      toast.error("Indicações insuficientes", { 
        description: `Você precisa de ${reward.cost_in_coupons} indicações, mas tem ${profile.referrals_balance}.` 
      });
      return;
    }

    try {
      const { error } = await supabase.rpc('redeem_reward', {
        p_user_id: user.id,
        p_reward_id: reward.id
      });

      if (error) throw error;

      toast.success("Resgate solicitado!", {
        description: "Apresente-se na barbearia para utilizar seu prêmio."
      });
      fetchData(); // refresh balance
    } catch (error: any) {
      console.error("Redeem error:", error);
      toast.error("Erro ao resgatar", { description: error.message });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden safe-bottom">
      <AnimatedBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center p-4 max-w-5xl mx-auto safe-top">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => {
            if (view === "history") setView("dashboard");
            else navigate("/booking");
          }}
          className="text-foreground hover:bg-white/10 rounded-full"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold ml-2 text-foreground flex items-center gap-2">
          {view === "history" ? (
            <>
              <History className="w-5 h-5 text-primary" />
              Histórico
            </>
          ) : (
            <>
              <Gift className="w-5 h-5 text-primary" />
              Indique e Ganhe
            </>
          )}
        </h1>
      </header>

      <main className="relative z-10 px-4 pb-12 max-w-2xl mx-auto space-y-8 mt-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : view === "dashboard" ? (
          <div className="space-y-8 animate-fade-in">
            
            {/* Header Text */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Convide seus amigos!</h2>
              <p className="text-muted-foreground">
                Compartilhe seu link exclusivo. A cada amigo que se cadastrar através dele e fizer o primeiro agendamento, você acumula 1 indicação para trocar por prêmios!
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {/* Amigos Indicados */}
              <div className="bg-card/60 backdrop-blur-xl border border-primary/20 rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary mb-1 sm:mb-2 opacity-80" />
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">Amigos<br/>Indicados</p>
                <div className="flex items-end gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-bold text-foreground">{profile?.total_referrals || 0}</span>
                </div>

              </div>

              {/* Saldo Serviços */}
              <div className="bg-primary/10 backdrop-blur-xl border border-primary/30 rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-center text-center shadow-gold-glow relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10">
                  <Gift className="w-16 h-16 sm:w-20 sm:h-20 text-primary" />
                </div>
                <p className="text-[10px] sm:text-xs font-medium text-primary relative z-10 leading-tight">Saldo p/<br/>Serviços</p>
                <div className="flex items-end gap-1 mt-1 relative z-10">
                  <span className="text-2xl sm:text-3xl font-bold text-primary">{profile?.referrals_balance || 0}</span>
                </div>

              </div>

              {/* Tickets Produtos */}
              <div className="bg-[#00D4AA]/10 backdrop-blur-xl border border-[#00D4AA]/30 rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-center text-center shadow-[0_0_15px_rgba(0,212,170,0.15)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10">
                  <Ticket className="w-16 h-16 sm:w-20 sm:h-20 text-[#00D4AA]" />
                </div>
                <p className="text-[10px] sm:text-xs font-medium text-[#00D4AA] relative z-10 leading-tight">Tickets p/<br/>Produtos</p>
                <div className="flex items-end gap-1 mt-1 relative z-10">
                  <span className="text-2xl sm:text-3xl font-bold text-[#00D4AA]">{profile?.tickets_balance || 0}</span>
                </div>

              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center mt-2 gap-2">
              <Button 
                variant="outline" 
                className="w-full sm:w-auto border-primary/30 text-primary hover:bg-primary/10 rounded-xl flex items-center gap-2"
                onClick={() => setView("history")}
              >
                <History className="w-4 h-4" />
                Ver Histórico
              </Button>
              <Button 
                className="w-full sm:w-auto bg-[#00D4AA] hover:bg-[#00D4AA]/90 text-black font-bold shadow-[0_0_15px_rgba(0,212,170,0.3)] flex items-center gap-2"
                onClick={() => navigate('/loja')}
              >
                <Store className="w-5 h-5" />
                Acessar Loja
              </Button>
            </div>
            {/* Link Section */}
            <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6 space-y-4 relative overflow-hidden">
              <h3 className="font-semibold text-foreground">Seu Link Exclusivo</h3>
              <p className="text-sm text-muted-foreground">Copie ou compartilhe o link abaixo com quem você quiser indicar:</p>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <Input 
                  value={referralLink} 
                  readOnly 
                  className="bg-background/80 border-primary/20 focus-visible:ring-primary/50 font-mono text-sm h-12 w-full" 
                />
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    className="border-primary/20 hover:bg-primary/10 h-12 flex-1 sm:flex-none" 
                    onClick={handleCopyLink}
                  >
                    {copied ? <Check className="w-5 h-5 text-green-500 mr-2" /> : <Copy className="w-5 h-5 text-primary mr-2" />}
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                  {navigator.share && (
                    <Button 
                      className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 flex-1 sm:flex-none" 
                      onClick={handleShare}
                    >
                      <Share2 className="w-5 h-5 mr-2" />
                      Compartilhar
                    </Button>
                  )}
                </div>
              </div>

            </div>

            {/* Rewards Section */}
            <div className="space-y-4">
              <h3 className="font-bold text-xl text-foreground flex items-center gap-2">
                Prêmios Disponíveis
              </h3>
              
              {rewards.length === 0 ? (
                <div className="bg-card/40 backdrop-blur-xl rounded-xl p-8 text-center border border-border/50">
                  <p className="text-muted-foreground italic">
                    Nenhum prêmio configurado no momento.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {rewards.map((reward) => {
                    const progress = Math.min(100, ((profile?.referrals_balance || 0) / reward.cost_in_coupons) * 100);
                    const isReady = (profile?.referrals_balance || 0) >= reward.cost_in_coupons;

                    return (
                      <div key={reward.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-xl hover:border-primary/30 transition-colors gap-4 relative overflow-hidden">
                        <div className="flex-1 w-full space-y-3">
                          <div>
                            <p className="font-bold text-lg text-foreground leading-none mb-1">{reward.name}</p>
                            <p className="text-sm text-primary">{reward.cost_in_coupons} {reward.cost_in_coupons === 1 ? 'indicação' : 'indicações'}</p>
                          </div>
                          
                          {/* Animated Progress Bar */}
                          <div className="space-y-1.5 pr-0 sm:pr-8">
                            <div className="flex justify-between text-xs text-muted-foreground font-medium">
                              <span>Progresso</span>
                              <span>{Math.min(profile?.referrals_balance || 0, reward.cost_in_coupons)} / {reward.cost_in_coupons}</span>
                            </div>
                            <div className="w-full bg-background/80 rounded-full h-2.5 overflow-hidden border border-border/30">
                              <div 
                                className={`h-full transition-all duration-1000 ease-out relative overflow-hidden ${isReady ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-primary'}`}
                                style={{ width: `${progress}%` }}
                              >
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button 
                          size="lg" 
                          variant={isReady ? "default" : "outline"}
                          className={`w-full sm:w-auto shrink-0 ${isReady ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold-glow" : "opacity-70"}`}
                          disabled={!isReady}
                          onClick={() => handleRedeem(reward)}
                        >
                          Resgatar Prêmio
                        </Button>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Prêmios Resgatados */}
            <div className="pt-6">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                Prêmios Resgatados
              </h2>

              {redemptions.length === 0 ? (
                <div className="bg-card/40 backdrop-blur-xl border border-border/40 rounded-2xl p-8 text-center">
                  <div className="text-4xl mb-3">🎁</div>
                  <p className="text-muted-foreground text-sm">Você ainda não resgatou nenhum prêmio.</p>
                  <p className="text-muted-foreground text-xs mt-1">Acumule indicações e troque por recompensas!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {redemptions.map((r: any) => (
                    <div key={r.id} className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Gift className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{r.referral_rewards?.name || "Prêmio"}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(r.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                        r.status === 'completed'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : r.status === 'rejected'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {r.status === 'completed' ? '✅ Aprovado' : r.status === 'rejected' ? '❌ Recusado' : '⏳ Pendente'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-6">
              <h3 className="font-bold text-lg text-foreground mb-4">Suas Indicações</h3>
              
              <div className="space-y-3">
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12 text-sm italic">
                    Você ainda não indicou nenhum amigo. Compartilhe seu link!
                  </p>
                ) : (
                  history.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {item.referred_id === user?.id ? "Registro Manual" : (item.profiles?.full_name || "Usuário")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(item.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        {item.isValid ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-xs font-medium">
                            <Check className="w-3.5 h-3.5" />
                            Válido
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            Pendente
                          </div>
                        )}
                      </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
