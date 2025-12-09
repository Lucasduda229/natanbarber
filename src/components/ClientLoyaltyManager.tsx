import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, Plus, Minus, Gift, Check } from "lucide-react";
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

interface ClientLoyaltyManagerProps {
  clientId: string;
  clientName: string;
}

const ClientLoyaltyManager = ({ clientId, clientName }: ClientLoyaltyManagerProps) => {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [progress, setProgress] = useState<Record<string, LoyaltyProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Buscar programas ativos
    const { data: programsData } = await supabase
      .from("loyalty_programs")
      .select("id, name, description, required_visits, reward_description")
      .eq("is_active", true);

    // Buscar progresso do cliente
    const { data: progressData } = await supabase
      .from("loyalty_progress")
      .select("*")
      .eq("user_id", clientId);

    setPrograms(programsData || []);
    
    const progressMap: Record<string, LoyaltyProgress> = {};
    progressData?.forEach((p) => {
      progressMap[p.program_id] = p;
    });
    setProgress(progressMap);
    
    setLoading(false);
  };

  const updateVisits = async (programId: string, increment: number) => {
    const currentProgress = progress[programId];
    const newVisits = Math.max(0, (currentProgress?.current_visits || 0) + increment);

    if (currentProgress) {
      const { error } = await supabase
        .from("loyalty_progress")
        .update({ current_visits: newVisits })
        .eq("id", currentProgress.id);

      if (error) {
        toast.error("Erro ao atualizar visitas");
        return;
      }
    } else {
      const { error } = await supabase
        .from("loyalty_progress")
        .insert([{
          user_id: clientId,
          program_id: programId,
          current_visits: newVisits,
        }]);

      if (error) {
        toast.error("Erro ao registrar visita");
        return;
      }
    }

    toast.success(increment > 0 ? "Visita adicionada!" : "Visita removida!");
    fetchData();
  };

  const claimReward = async (programId: string, program: LoyaltyProgram) => {
    const currentProgress = progress[programId];
    if (!currentProgress || currentProgress.current_visits < program.required_visits) {
      toast.error("Visitas insuficientes para resgatar");
      return;
    }

    // Resetar contagem e incrementar recompensas
    const { error: updateError } = await supabase
      .from("loyalty_progress")
      .update({
        current_visits: currentProgress.current_visits - program.required_visits,
        rewards_claimed: (currentProgress.rewards_claimed || 0) + 1,
      })
      .eq("id", currentProgress.id);

    if (updateError) {
      toast.error("Erro ao resgatar recompensa");
      return;
    }

    // Registrar no histórico
    await supabase
      .from("loyalty_rewards_history")
      .insert([{
        user_id: clientId,
        program_id: programId,
      }]);

    toast.success(`Recompensa resgatada: ${program.reward_description}`);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <Trophy className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum programa de fidelidade ativo</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        Fidelidade - {clientName}
      </h3>
      
      {programs.map((program) => {
        const clientProgress = progress[program.id];
        const currentVisits = clientProgress?.current_visits || 0;
        const progressPercent = Math.min((currentVisits / program.required_visits) * 100, 100);
        const canClaim = currentVisits >= program.required_visits;

        return (
          <Card key={program.id} className="bg-card/60 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-foreground flex items-center justify-between">
                {program.name}
                {canClaim && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                    Prêmio disponível!
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="text-foreground font-medium">
                    {currentVisits} / {program.required_visits} visitas
                  </span>
                </div>
                <Progress value={progressPercent} className="h-3" />
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gift className="h-4 w-4 text-primary" />
                <span>Recompensa: {program.reward_description}</span>
              </div>

              {clientProgress?.rewards_claimed > 0 && (
                <div className="flex items-center gap-1 text-xs text-primary">
                  <Check className="h-3 w-3" />
                  <span>{clientProgress.rewards_claimed} recompensa(s) já resgatada(s)</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateVisits(program.id, -1)}
                  disabled={currentVisits === 0}
                  className="flex-1"
                >
                  <Minus className="h-4 w-4 mr-1" />
                  Remover
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateVisits(program.id, 1)}
                  className="flex-1 bg-gold-gradient"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {canClaim && (
                <Button
                  onClick={() => claimReward(program.id, program)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Resgatar Recompensa
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ClientLoyaltyManager;
