import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Gift, Star, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface LoyaltyProgram {
  id: string;
  name: string;
  description: string | null;
  required_visits: number;
  reward_description: string;
}

interface LoyaltyProgress {
  id: string;
  program_id: string;
  current_visits: number;
  rewards_claimed: number;
}

const CustomerLoyaltyCard = () => {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [progress, setProgress] = useState<Record<string, LoyaltyProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Buscar programas ativos
    const { data: programsData } = await supabase
      .from("loyalty_programs")
      .select("id, name, description, required_visits, reward_description")
      .eq("is_active", true);

    // Buscar progresso do usuário
    const { data: progressData } = await supabase
      .from("loyalty_progress")
      .select("*")
      .eq("user_id", user.id);

    setPrograms(programsData || []);
    
    const progressMap: Record<string, LoyaltyProgress> = {};
    progressData?.forEach((p) => {
      progressMap[p.program_id] = p;
    });
    setProgress(progressMap);
    
    setLoading(false);
  };

  if (!user) return null;

  if (loading) {
    return (
      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardContent className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (programs.length === 0) {
    return (
      <Card className="bg-card/40 backdrop-blur-xl border-primary/20">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum programa de fidelidade disponível no momento</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 rounded-full bg-primary/20">
          <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Programa de Fidelidade</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Acompanhe seu progresso e recompensas</p>
        </div>
      </div>

      {programs.map((program) => {
        const clientProgress = progress[program.id];
        const currentVisits = clientProgress?.current_visits || 0;
        const progressPercent = Math.min((currentVisits / program.required_visits) * 100, 100);
        const canClaim = currentVisits >= program.required_visits;
        const rewardsClaimed = clientProgress?.rewards_claimed || 0;

        return (
          <Card 
            key={program.id} 
            className={`bg-card/40 backdrop-blur-xl border-primary/20 overflow-hidden transition-all ${canClaim ? "ring-2 ring-primary/50" : ""}`}
          >
            {canClaim && (
              <div className="bg-gold-gradient px-3 sm:px-4 py-1.5 sm:py-2 text-background text-center text-xs sm:text-sm font-semibold">
                🎉 Parabéns! Você pode resgatar sua recompensa!
              </div>
            )}
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-full flex-shrink-0 ${canClaim ? "bg-primary" : "bg-primary/20"}`}>
                  <Star className={`h-4 w-4 sm:h-5 sm:w-5 ${canClaim ? "text-background" : "text-primary"}`} />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg text-foreground truncate">{program.name}</CardTitle>
                  {program.description && (
                    <CardDescription className="text-muted-foreground text-xs sm:text-sm line-clamp-2">
                      {program.description}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
              {/* Progress visualization */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-muted-foreground">Seu progresso</span>
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    {currentVisits} / {program.required_visits}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-3 sm:h-4" />
                
                {/* Stamp visualization */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center py-2">
                  {Array.from({ length: program.required_visits }).map((_, index) => (
                    <div
                      key={index}
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                        index < currentVisits
                          ? "bg-primary border-primary text-background"
                          : "bg-transparent border-muted-foreground/30 text-muted-foreground/30"
                      }`}
                    >
                      {index < currentVisits ? (
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      ) : (
                        <span className="text-[10px] sm:text-xs font-bold">{index + 1}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Reward info */}
              <div className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg ${canClaim ? "bg-primary/20" : "bg-muted/20"}`}>
                <Gift className={`h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 ${canClaim ? "text-primary" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-foreground">Recompensa</p>
                  <p className={`text-xs sm:text-sm truncate ${canClaim ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                    {program.reward_description}
                  </p>
                </div>
              </div>

              {/* Stats */}
              {rewardsClaimed > 0 && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-primary">
                  <Trophy className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>
                    {rewardsClaimed} recompensa{rewardsClaimed > 1 ? "s" : ""} já resgatada{rewardsClaimed > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {!canClaim && (
                <p className="text-center text-xs sm:text-sm text-muted-foreground">
                  Faltam <span className="font-bold text-primary">{program.required_visits - currentVisits}</span> visita(s) para sua recompensa
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default CustomerLoyaltyCard;
