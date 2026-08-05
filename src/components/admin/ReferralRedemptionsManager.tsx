import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Gift, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ReferralRedemptionsManager() {
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const fetchRedemptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("referral_redemptions")
        .select(`
          id,
          created_at,
          status,
          referral_rewards (name, cost_in_coupons),
          profiles (full_name, phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRedemptions(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar resgates", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: "completed" | "rejected" | "pending") => {
    try {
      const { error } = await supabase
        .from("referral_redemptions")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) {
        // If constraint fails, try alternative status values
        console.error('Status update error:', error);
        toast.error("Erro ao atualizar status", { description: `Valor '${newStatus}' não aceito. Verifique o banco de dados.` });
        return;
      }

      setRedemptions(prev =>
        prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
      );

      const messages: Record<string, string> = {
        completed: "Resgate aprovado! ✅",
        rejected: "Resgate recusado. ❌",
        pending: "Resgate marcado como pendente. ⏳",
      };
      toast.success(messages[newStatus]);
    } catch (error: any) {
      toast.error("Erro ao atualizar status", { description: error.message });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold">
            <CheckCircle className="w-3.5 h-3.5" />
            Aprovado
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-semibold">
            <XCircle className="w-3.5 h-3.5" />
            Recusado
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" />
            Pendente
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border/50">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="w-5 h-5 text-primary" />
            Resgates de Indicações
          </CardTitle>
          <CardDescription className="mt-1">
            Aprove ou recuse os prêmios solicitados pelos clientes via programa de indicações.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRedemptions} className="shrink-0">
          <RefreshCw className="w-4 h-4 mr-1" />
          Atualizar
        </Button>
      </CardHeader>

      <CardContent>
        {redemptions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎁</div>
            <p className="text-muted-foreground font-medium">Nenhum resgate solicitado ainda.</p>
            <p className="text-muted-foreground text-sm mt-1">Quando um cliente resgatar um prêmio de indicação, ele aparecerá aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {redemptions.map((r) => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-background/50 border border-border/40 rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Gift className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {r.referral_rewards?.name || "Prêmio"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {r.profiles?.full_name || "Cliente"}{r.profiles?.phone ? ` • ${r.profiles.phone}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseISO(r.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  {getStatusBadge(r.status)}

                  {r.status !== "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-500/40 text-green-400 hover:bg-green-500/10 hover:border-green-500 text-xs"
                      onClick={() => updateStatus(r.id, "completed")}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Aprovar
                    </Button>
                  )}

                  {r.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 text-xs"
                      onClick={() => updateStatus(r.id, "rejected")}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Recusar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
