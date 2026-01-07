import { useEffect, useState } from "react";
import { Crown, Gift, Award, Trophy, Lock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SubscriptionData {
  consecutive_months: number;
  is_active: boolean;
  reward_6_months_claimed: boolean;
  reward_12_months_claimed: boolean;
}

const SubscriptionProgress = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_progress")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-muted/30 rounded-xl p-4 border border-border/50 text-center">
        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Faça login para acompanhar seu progresso
        </p>
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
  const progress6 = Math.min((months / 6) * 100, 100);
  const progress12 = Math.min((months / 12) * 100, 100);
  const monthsTo6 = Math.max(6 - months, 0);
  const monthsTo12 = Math.max(12 - months, 0);

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
          <p className="text-sm text-muted-foreground">
            Você ainda não tem uma assinatura ativa
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Assine um plano recorrente para começar a acumular benefícios!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Current Month Counter */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20 text-center">
            <div className="text-4xl font-black text-primary mb-1">{months}</div>
            <p className="text-xs text-muted-foreground">
              {months === 1 ? "mês consecutivo" : "meses consecutivos"}
            </p>
          </div>

          {/* 6 Months Progress */}
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-bold text-foreground">Copo Stanley</span>
              </div>
              {months >= 6 ? (
                <div className="flex items-center gap-1 bg-green-500/20 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-bold text-green-400">CONQUISTADO!</span>
                </div>
              ) : (
                <span className="text-xs text-blue-300 font-medium">
                  Faltam {monthsTo6} {monthsTo6 === 1 ? "mês" : "meses"}
                </span>
              )}
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-3 bg-blue-900/30 rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${progress6}%` }}
              />
              {/* Milestone markers */}
              {[1, 2, 3, 4, 5, 6].map((m) => (
                <div 
                  key={m}
                  className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${
                    months >= m ? "bg-white" : "bg-blue-700"
                  }`}
                  style={{ left: `${(m / 6) * 100 - 2}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-blue-300/70">0</span>
              <span className="text-[10px] text-blue-300/70">6 meses</span>
            </div>
          </div>

          {/* 12 Months Progress */}
          <div className="bg-gradient-to-br from-amber-500/10 to-yellow-600/5 rounded-xl p-4 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-foreground">Kit + 30% OFF</span>
              </div>
              {months >= 12 ? (
                <div className="flex items-center gap-1 bg-green-500/20 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-bold text-green-400">CONQUISTADO!</span>
                </div>
              ) : (
                <span className="text-xs text-amber-300 font-medium">
                  Faltam {monthsTo12} {monthsTo12 === 1 ? "mês" : "meses"}
                </span>
              )}
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-3 bg-amber-900/30 rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${progress12}%` }}
              />
              {/* Milestone markers */}
              {[3, 6, 9, 12].map((m) => (
                <div 
                  key={m}
                  className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${
                    months >= m ? "bg-white" : "bg-amber-700"
                  }`}
                  style={{ left: `${(m / 12) * 100 - 2}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-amber-300/70">0</span>
              <span className="text-[10px] text-amber-300/70">12 meses</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionProgress;