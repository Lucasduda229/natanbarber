import { useState, useEffect } from "react";
import { Crown, Search, Plus, Minus, Award, Gift, Check, User, Phone, Calendar, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SubscriptionWithProfile {
  id: string;
  user_id: string;
  subscription_start_date: string;
  consecutive_months: number;
  last_payment_date: string | null;
  is_active: boolean;
  reward_6_months_claimed: boolean;
  reward_12_months_claimed: boolean;
  created_at: string;
  updated_at: string;
  profile: {
    full_name: string | null;
    phone: string | null;
  } | null;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
}

const SubscriptionManager = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all subscriptions
      const { data: subsData, error: subsError } = await supabase
        .from("subscription_progress")
        .select("*")
        .order("consecutive_months", { ascending: false });

      if (subsError) throw subsError;

      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone");

      if (profilesError) throw profilesError;

      setProfiles(profilesData || []);

      // Map subscriptions with profiles
      const subsWithProfiles = (subsData || []).map(sub => ({
        ...sub,
        profile: profilesData?.find(p => p.user_id === sub.user_id) || null
      }));

      setSubscriptions(subsWithProfiles);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar assinaturas");
    } finally {
      setLoading(false);
    }
  };

  const updateMonths = async (subscriptionId: string, change: number) => {
    const sub = subscriptions.find(s => s.id === subscriptionId);
    if (!sub) return;

    const newMonths = Math.max(0, sub.consecutive_months + change);

    try {
      const { error } = await supabase
        .from("subscription_progress")
        .update({ 
          consecutive_months: newMonths,
          last_payment_date: change > 0 ? new Date().toISOString().split('T')[0] : sub.last_payment_date
        })
        .eq("id", subscriptionId);

      if (error) throw error;

      setSubscriptions(prev => 
        prev.map(s => s.id === subscriptionId ? { ...s, consecutive_months: newMonths } : s)
      );

      toast.success(`Meses atualizados: ${newMonths}`);
    } catch (error) {
      console.error("Error updating months:", error);
      toast.error("Erro ao atualizar meses");
    }
  };

  const toggleActive = async (subscriptionId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("subscription_progress")
        .update({ is_active: !currentActive })
        .eq("id", subscriptionId);

      if (error) throw error;

      setSubscriptions(prev => 
        prev.map(s => s.id === subscriptionId ? { ...s, is_active: !currentActive } : s)
      );

      toast.success(currentActive ? "Assinatura pausada" : "Assinatura reativada");
    } catch (error) {
      console.error("Error toggling active:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const toggleRewardClaimed = async (subscriptionId: string, rewardType: '6' | '12', currentValue: boolean) => {
    const field = rewardType === '6' ? 'reward_6_months_claimed' : 'reward_12_months_claimed';
    
    try {
      const { error } = await supabase
        .from("subscription_progress")
        .update({ [field]: !currentValue })
        .eq("id", subscriptionId);

      if (error) throw error;

      setSubscriptions(prev => 
        prev.map(s => s.id === subscriptionId ? { ...s, [field]: !currentValue } : s)
      );

      toast.success(!currentValue ? "Recompensa marcada como resgatada" : "Recompensa desmarcada");
    } catch (error) {
      console.error("Error toggling reward:", error);
      toast.error("Erro ao atualizar recompensa");
    }
  };

  const createSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("subscription_progress")
        .insert({
          user_id: userId,
          subscription_start_date: new Date().toISOString().split('T')[0],
          consecutive_months: 0,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      const profile = profiles.find(p => p.user_id === userId);
      setSubscriptions(prev => [...prev, { ...data, profile }]);
      setShowAddModal(false);
      setSelectedUserId("");
      toast.success("Assinatura criada com sucesso!");
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      if (error.code === '23505') {
        toast.error("Este cliente já possui uma assinatura");
      } else {
        toast.error("Erro ao criar assinatura");
      }
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const name = sub.profile?.full_name?.toLowerCase() || "";
    const phone = sub.profile?.phone || "";
    return name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);
  });

  const usersWithoutSubscription = profiles.filter(
    p => !subscriptions.find(s => s.user_id === p.user_id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400" />
            Gerenciar Assinaturas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {subscriptions.length} assinantes • {subscriptions.filter(s => s.is_active).length} ativos
          </p>
        </div>

        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Assinatura
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Add Subscription Modal */}
      {showAddModal && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Adicionar Nova Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {usersWithoutSubscription.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todos os clientes já possuem assinatura
              </p>
            ) : (
              <>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full p-2 rounded-lg bg-background border border-border text-foreground"
                >
                  <option value="">Selecione um cliente...</option>
                  {usersWithoutSubscription.map(profile => (
                    <option key={profile.user_id} value={profile.user_id}>
                      {profile.full_name || "Sem nome"} - {profile.phone || "Sem telefone"}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedUserId("");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => selectedUserId && createSubscription(selectedUserId)}
                    disabled={!selectedUserId}
                  >
                    Criar Assinatura
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subscriptions List */}
      <div className="space-y-3">
        {filteredSubscriptions.length === 0 ? (
          <Card className="bg-muted/20">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Nenhuma assinatura encontrada</p>
            </CardContent>
          </Card>
        ) : (
          filteredSubscriptions.map(sub => (
            <Card 
              key={sub.id} 
              className={`border ${sub.is_active ? 'border-primary/30' : 'border-muted/30 opacity-60'}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Client Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground truncate">
                        {sub.profile?.full_name || "Cliente sem nome"}
                      </span>
                      {!sub.is_active && (
                        <Badge variant="secondary" className="text-[10px]">PAUSADA</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {sub.profile?.phone || "Sem telefone"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Desde {format(new Date(sub.subscription_start_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  {/* Months Counter */}
                  <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-4 py-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => updateMonths(sub.id, -1)}
                      disabled={sub.consecutive_months === 0}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <div className="text-center min-w-[60px]">
                      <div className="text-2xl font-black text-primary">{sub.consecutive_months}</div>
                      <div className="text-[10px] text-muted-foreground">meses</div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => updateMonths(sub.id, 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Rewards */}
                  <div className="flex gap-2">
                    {/* 6 Months Reward */}
                    <button
                      onClick={() => toggleRewardClaimed(sub.id, '6', sub.reward_6_months_claimed)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        sub.consecutive_months >= 6
                          ? sub.reward_6_months_claimed
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse'
                          : 'bg-muted/20 text-muted-foreground border border-muted/30'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      <span>6M</span>
                      {sub.reward_6_months_claimed && <Check className="w-3 h-3" />}
                    </button>

                    {/* 12 Months Reward */}
                    <button
                      onClick={() => toggleRewardClaimed(sub.id, '12', sub.reward_12_months_claimed)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        sub.consecutive_months >= 12
                          ? sub.reward_12_months_claimed
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                          : 'bg-muted/20 text-muted-foreground border border-muted/30'
                      }`}
                    >
                      <Gift className="w-4 h-4" />
                      <span>12M</span>
                      {sub.reward_12_months_claimed && <Check className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Actions */}
                  <Button
                    variant={sub.is_active ? "outline" : "default"}
                    size="sm"
                    onClick={() => toggleActive(sub.id, sub.is_active)}
                  >
                    {sub.is_active ? "Pausar" : "Reativar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SubscriptionManager;