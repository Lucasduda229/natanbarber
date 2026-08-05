import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Gift, CheckCircle, Clock, Trash2, Plus, ArrowRight, History, Users, Calendar as CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddManualReferral } from "./AddManualReferral";

export default function ReferralsTab() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("adminReferralsTab") || "gerenciamento";
  });

  useEffect(() => {
    localStorage.setItem("adminReferralsTab", activeTab);
  }, [activeTab]);

  // New reward form state
  const [newRewardName, setNewRewardName] = useState("");
  const [newRewardCost, setNewRewardCost] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rewardsRes, redemptionsRes, historyRes] = await Promise.all([
        supabase.from("referral_rewards").select("*").order("cost_in_coupons", { ascending: true }),
        supabase
          .from("referral_redemptions")
          .select(`
            id,
            status,
            created_at,
            reward_id,
            user_id,
            referral_rewards (name, cost_in_coupons),
            profiles (full_name, phone)
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("referral_history")
          .select(`
            id,
            created_at,
            is_valid,
            referrer_id,
            referred_id,
            referrer:profiles!referral_history_referrer_id_fkey(full_name, phone),
            referred:profiles!referral_history_referred_id_fkey(full_name, phone)
          `)
          .order("created_at", { ascending: false })
      ]);

      if (rewardsRes.error) throw rewardsRes.error;
      if (redemptionsRes.error) throw redemptionsRes.error;

      setRewards(rewardsRes.data || []);
      setRedemptions(redemptionsRes.data || []);
      
      let historyItems = historyRes.data || [];
      
      // Auto-validate any pending referrals
      const pendingReferrals = historyItems.filter((h: any) => h.is_valid === false || h.is_valid === null);
      if (pendingReferrals.length > 0) {
        const pendingIds = pendingReferrals.map((h: any) => h.referred_id).filter(Boolean);
        
        if (pendingIds.length > 0) {
          const { data: aptData } = await supabase
            .from("appointments")
            .select("user_id")
            .in("user_id", pendingIds);
            
          if (aptData && aptData.length > 0) {
            const newlyValidatedIds = new Set(aptData.map(a => a.user_id));
            let autoValidatedCount = 0;
            
            for (const referral of pendingReferrals) {
              if (newlyValidatedIds.has(referral.referred_id)) {
                // Set valid in DB
                const { data, error } = await supabase.from("referral_history").update({ is_valid: true }).eq("id", referral.id).select();
                
                if (!error && data && data.length > 0) {
                  autoValidatedCount++;
                  
                  // Add tickets to referrer
                  const { data: profile } = await supabase.from("profiles").select("tickets_balance, total_referrals").eq("user_id", referral.referrer_id).maybeSingle();
                  if (profile) {
                    await supabase.from("profiles").update({
                      tickets_balance: (profile.tickets_balance || 0) + 2,
                      total_referrals: (profile.total_referrals || 0) + 1
                    }).eq("user_id", referral.referrer_id);
                  }
                  
                  // Update local state
                  const index = historyItems.findIndex((h: any) => h.id === referral.id);
                  if (index !== -1) historyItems[index].is_valid = true;
                } else {
                  console.error("Admin auto-validate failed for referral", referral.id, error);
                }
              }
            }
            if (autoValidatedCount > 0) {
              toast.success(`${autoValidatedCount} indicações foram validadas automaticamente!`);
            }
          }
        }
      }
      
      setHistory(historyItems);
    } catch (error: any) {
      toast.error("Erro ao carregar dados", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddReward = async () => {
    if (!newRewardName.trim() || !newRewardCost) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      const { error } = await supabase.from("referral_rewards").insert({
        name: newRewardName,
        cost_in_coupons: parseInt(newRewardCost)
      });

      if (error) throw error;
      toast.success("Prêmio adicionado com sucesso!");
      setNewRewardName("");
      setNewRewardCost("");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao adicionar prêmio", { description: error.message });
    }
  };

  const toggleRewardActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("referral_rewards")
        .update({ active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao atualizar status", { description: error.message });
    }
  };

  const deleteReward = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este prêmio?")) return;
    try {
      const { error } = await supabase
        .from("referral_rewards")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Prêmio removido!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir", { description: error.message });
    }
  };

  const markRedemptionFulfilled = async (id: string) => {
    try {
      const { error } = await supabase
        .from("referral_redemptions")
        .update({ status: 'fulfilled' })
        .eq("id", id);

      if (error) throw error;
      toast.success("Prêmio marcado como entregue!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao atualizar", { description: error.message });
    }
  };

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Agrupar histórico por quem indicou
  const groupedHistory = history.reduce((acc, curr) => {
    if (!acc[curr.referrer_id]) {
      acc[curr.referrer_id] = {
        referrer: curr.referrer,
        items: []
      };
    }
    acc[curr.referrer_id].items.push(curr);
    return acc;
  }, {} as Record<string, { referrer: any, items: any[] }>);

  const deleteReferral = async (referral: any) => {
    if (!confirm(`Tem certeza que deseja excluir a indicação de "${referral.referred?.full_name || 'Amigo'}"?`)) return;
    
    try {
      // If it was valid, deduct points
      if (referral.is_valid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tickets_balance, total_referrals")
          .eq("user_id", referral.referrer_id)
          .maybeSingle();
          
        if (profile) {
          const newTickets = Math.max(0, (profile.tickets_balance || 0) - 2);
          const newTotal = Math.max(0, (profile.total_referrals || 0) - 1);
          
          await supabase.from("profiles").update({
            tickets_balance: newTickets,
            total_referrals: newTotal
          }).eq("user_id", referral.referrer_id);
        }
      }
      
      const { data, error } = await supabase
        .from("referral_history")
        .delete()
        .eq("id", referral.id)
        .select();
        
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("A indicação não pôde ser excluída. Verifique as permissões do banco de dados (RLS).");
      
      toast.success("Indicação excluída!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir indicação", { description: error.message });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mb-6 grid w-full grid-cols-2">
        <TabsTrigger value="gerenciamento">Prêmios e Resgates</TabsTrigger>
        <TabsTrigger value="historico">Histórico de Indicações</TabsTrigger>
      </TabsList>

      <TabsContent value="gerenciamento">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Rewards Configuration */}
      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Configuração de Prêmios
          </CardTitle>
          <CardDescription>Defina o que os clientes podem resgatar de acordo com o número de indicações feitas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add New */}
          <div className="bg-background/50 p-4 rounded-xl border border-border/50 space-y-4">
            <h4 className="text-sm font-medium text-foreground">Novo Prêmio</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome (ex: Corte Grátis)</Label>
                <Input 
                  value={newRewardName} 
                  onChange={(e) => setNewRewardName(e.target.value)} 
                  placeholder="Nome do prêmio" 
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Indicações (Custo por Resgate)</Label>
                <Input 
                  type="number" 
                  value={newRewardCost} 
                  onChange={(e) => setNewRewardCost(e.target.value)} 
                  placeholder="Ex: 5" 
                  className="bg-background"
                />
              </div>
            </div>
            <Button onClick={handleAddReward} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* List */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Prêmios Ativos</h4>
            {rewards.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum prêmio configurado.</p>
            ) : (
              rewards.map((reward) => (
                <div key={reward.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30">
                  <div>
                    <p className="font-medium text-sm text-foreground">{reward.name}</p>
                    <p className="text-xs text-muted-foreground">{reward.cost_in_coupons} {reward.cost_in_coupons === 1 ? 'indicação necessária' : 'indicações necessárias'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs cursor-pointer text-muted-foreground">Ativo</Label>
                      <Switch 
                        checked={reward.active} 
                        onCheckedChange={() => toggleRewardActive(reward.id, reward.active)} 
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteReward(reward.id)} className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Redemptions List */}
      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Solicitações de Resgate
          </CardTitle>
          <CardDescription>Gerencie os prêmios que os clientes estão resgatando.</CardDescription>
        </CardHeader>
        <CardContent>
          {redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum resgate solicitado ainda.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {redemptions.map((redemption) => (
                <div key={redemption.id} className="p-4 rounded-xl border border-border/50 bg-background/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{redemption.profiles?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{redemption.profiles?.phone || "Sem telefone"}</p>
                    </div>
                    <Badge variant={redemption.status === 'pending' ? 'outline' : 'default'} className={redemption.status === 'pending' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' : 'bg-green-500 text-white'}>
                      {redemption.status === 'pending' ? 'Pendente' : 'Entregue'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-primary/10 p-2 rounded-lg">
                    <Gift className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{redemption.referral_rewards?.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      ({redemption.referral_rewards?.cost_in_coupons} indicações)
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(redemption.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {redemption.status === 'pending' && (
                      <Button size="sm" onClick={() => markRedemptionFulfilled(redemption.id)} className="h-7 text-xs bg-primary text-primary-foreground">
                        <CheckCircle className="w-3 h-3 mr-1.5" />
                        Marcar como Entregue
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </TabsContent>

      <TabsContent value="historico">
        <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Histórico Geral de Indicações
              </CardTitle>
              <CardDescription>
                Visualize quem indicou quem e as datas exatas.
              </CardDescription>
            </div>
            <AddManualReferral onAdded={fetchData} />
          </CardHeader>
          <CardContent>
            {Object.keys(groupedHistory).length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                Nenhuma indicação registrada no histórico.
              </p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(groupedHistory).map(([referrerId, group]) => (
                  <div key={referrerId} className="border border-border/50 rounded-xl overflow-hidden bg-background/30">
                    <div 
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-primary/5 transition-colors"
                      onClick={() => toggleUserExpanded(referrerId)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{group.referrer?.full_name || "Cliente Desconhecido"}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.items.length} {group.items.length === 1 ? 'indicação' : 'indicações'}
                          </p>
                        </div>
                      </div>
                      {expandedUsers[referrerId] ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    
                    {expandedUsers[referrerId] && (
                      <div className="p-4 bg-background/50 border-t border-border/50 space-y-3">
                        {group.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-center bg-card/50 p-3 rounded-lg border border-primary/10">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {item.referrer_id === item.referred_id ? "Registro Manual" : (item.referred?.full_name || "Amigo")}
                              </p>
                              <div className="flex items-center gap-3 mt-1 opacity-80">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CalendarIcon className="w-3 h-3" />
                                  {format(parseISO(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(parseISO(item.created_at), "HH:mm")}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.is_valid ? (
                                <div className="bg-green-500/20 text-green-500 p-1.5 rounded-full" title="Válida (Ganhou pontos)">
                                  <CheckCircle className="w-4 h-4" />
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-[10px]" title="Aguardando primeiro pagamento">
                                  Pendente
                                </Badge>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 -mr-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteReferral(item);
                                }}
                                title="Excluir indicação"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
