import { useEffect, useState } from "react";
import { Crown, Gift, Award, Trophy, Lock, Check, MessageCircle, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SubscriptionData {
  consecutive_months: number;
  is_active: boolean;
}

interface RewardItem {
  id: string;
  name: string;
  required_months: number;
  required_visits: number | null;
  reward_description: string;
  target_audience: string;
  requirement_type: string;
}

const COLORS = [
  { bg: "from-blue-500/10 to-blue-600/5", border: "border-blue-500/20", icon: "text-blue-400", bar: "from-blue-500 to-blue-400", barBg: "bg-blue-900/30", label: "text-blue-300", labelFaded: "text-blue-300/70", marker: "bg-blue-700", markerFilled: "bg-white" },
  { bg: "from-amber-500/10 to-yellow-600/5", border: "border-amber-500/20", icon: "text-amber-400", bar: "from-amber-500 to-yellow-400", barBg: "bg-amber-900/30", label: "text-amber-300", labelFaded: "text-amber-300/70", marker: "bg-amber-700", markerFilled: "bg-white" },
  { bg: "from-purple-500/10 to-purple-600/5", border: "border-purple-500/20", icon: "text-purple-400", bar: "from-purple-500 to-purple-400", barBg: "bg-purple-900/30", label: "text-purple-300", labelFaded: "text-purple-300/70", marker: "bg-purple-700", markerFilled: "bg-white" },
  { bg: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/20", icon: "text-emerald-400", bar: "from-emerald-500 to-emerald-400", barBg: "bg-emerald-900/30", label: "text-emerald-300", labelFaded: "text-emerald-300/70", marker: "bg-emerald-700", markerFilled: "bg-white" },
];

const SubscriptionProgress = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [claimedRewardIds, setClaimedRewardIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [subRes, rewardsRes, claimsRes] = await Promise.all([
        supabase
          .from("subscription_progress")
          .select("consecutive_months, is_active")
          .eq("user_id", user?.id)
          .maybeSingle(),
        supabase
          .from("subscriber_rewards")
          .select("id, name, required_months, required_visits, reward_description, target_audience, requirement_type")
          .eq("is_active", true)
          .order("required_months", { ascending: true }),
        supabase
          .from("reward_claims")
          .select("reward_id")
          .eq("user_id", user?.id || "")
          .in("status", ["pending", "delivered"]),
      ]);

      if (!subRes.error) setSubscription(subRes.data);
      if (!rewardsRes.error) setRewards(rewardsRes.data || []);
      if (!claimsRes.error) {
        setClaimedRewardIds(new Set(claimsRes.data?.map(c => c.reward_id).filter(Boolean) as string[]));
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (reward: RewardItem) => {
    if (!user) return;
    setClaiming(reward.id);
    try {
      const { error } = await supabase.from("reward_claims").insert({
        reward_id: reward.id,
        user_id: user.id,
        reward_name: reward.name,
        reward_description: reward.reward_description,
        status: "pending",
      });
      if (error) { toast.error("Erro ao solicitar premiação"); return; }

      setClaimedRewardIds(prev => new Set([...prev, reward.id]));
      toast.success("Premiação solicitada! Aguarde a confirmação.");

      // Open WhatsApp
      const message = reward.requirement_type === "months"
        ? `Olá! Completei ${subscription?.consecutive_months || 0} meses consecutivos de assinatura e gostaria de resgatar minha premiação: ${reward.reward_description}. 🎉`
        : `Olá! Completei as visitas necessárias e gostaria de resgatar minha premiação: ${reward.reward_description}. 🎉`;
      window.open(`https://wa.me/554891824897?text=${encodeURIComponent(message)}`, "_blank");
    } finally {
      setClaiming(null);
    }
  };

  if (!user) {
    return (
      <div className="bg-muted/30 rounded-xl p-4 border border-border/50 text-center">
        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Faça login para acompanhar seu progresso</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-muted/30 rounded-xl p-4 border border-border/50 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-3"></div>
        <div className="h-8 bg-muted rounded w-full"></div>
      </div>
    );
  }

  const months = subscription?.consecutive_months || 0;
  const isSubscriber = subscription?.is_active || false;

  // Filter rewards visible to this user
  const visibleRewards = rewards.filter(r => {
    if (r.target_audience === "subscribers" && !isSubscriber) return false;
    return true;
  });

  // Only show months-based rewards here (visit-based shown in CustomerLoyaltyCard or elsewhere)
  const monthRewards = visibleRewards.filter(r => r.requirement_type === "months");

  if (!subscription && monthRewards.length === 0) {
    return (
      <div className="bg-muted/20 rounded-xl p-4 border border-border/30 text-center">
        <p className="text-sm text-muted-foreground">Você ainda não tem uma assinatura ativa</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Assine um plano recorrente para começar a acumular benefícios!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary">SEU PROGRESSO</span>
        </div>
      </div>

      {!subscription ? (
        <div className="bg-muted/20 rounded-xl p-4 border border-border/30 text-center">
          <p className="text-sm text-muted-foreground">Você ainda não tem uma assinatura ativa</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 text-center">
            <div className="text-4xl font-black text-primary mb-1">{months}</div>
            <p className="text-xs text-muted-foreground">
              {months === 1 ? "mês consecutivo" : "meses consecutivos"}
            </p>
          </div>

          {monthRewards.length === 0 ? (
            <div className="bg-muted/20 rounded-xl p-4 border border-border/30 text-center">
              <p className="text-xs text-muted-foreground">Nenhuma premiação disponível no momento</p>
            </div>
          ) : (
            monthRewards.map((reward, index) => {
              const color = COLORS[index % COLORS.length];
              const progress = Math.min((months / reward.required_months) * 100, 100);
              const monthsRemaining = Math.max(reward.required_months - months, 0);
              const achieved = months >= reward.required_months;
              const alreadyClaimed = claimedRewardIds.has(reward.id);

              const step = reward.required_months <= 12 ? 1 : Math.ceil(reward.required_months / 6);
              const milestones: number[] = [];
              for (let i = step; i <= reward.required_months; i += step) milestones.push(i);
              if (!milestones.includes(reward.required_months)) milestones.push(reward.required_months);

              return (
                <div key={reward.id} className={`bg-gradient-to-br ${color.bg} rounded-xl p-4 ${color.border} border`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Award className={`w-5 h-5 ${color.icon}`} />
                      <span className="text-sm font-bold text-foreground">{reward.name}</span>
                    </div>
                    {achieved ? (
                      alreadyClaimed ? (
                        <div className="flex items-center gap-1 bg-primary/20 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3 text-primary" />
                          <span className="text-[10px] font-bold text-primary">SOLICITADO</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-green-500/20 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3 text-green-400" />
                          <span className="text-[10px] font-bold text-green-400">CONQUISTADO!</span>
                        </div>
                      )
                    ) : (
                      <span className={`text-xs ${color.label} font-medium`}>
                        Faltam {monthsRemaining} {monthsRemaining === 1 ? "mês" : "meses"}
                      </span>
                    )}
                  </div>

                  <div className={`relative h-3 ${color.barBg} rounded-full overflow-hidden`}>
                    <div
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${color.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${progress}%` }}
                    />
                    {milestones.map((m) => (
                      <div
                        key={m}
                        className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${
                          months >= m ? color.markerFilled : color.marker
                        }`}
                        style={{ left: `${(m / reward.required_months) * 100 - 2}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className={`text-[10px] ${color.labelFaded}`}>0</span>
                    <span className={`text-[10px] ${color.labelFaded}`}>{reward.required_months} meses</span>
                  </div>

                  {achieved && !alreadyClaimed && (
                    <Button
                      onClick={() => handleClaim(reward)}
                      disabled={claiming === reward.id}
                      className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white font-semibold gap-2 text-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {claiming === reward.id ? "Solicitando..." : `Resgatar ${reward.name}`}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default SubscriptionProgress;
