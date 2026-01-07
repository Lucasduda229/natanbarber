import { Gift, Award, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PackageBenefits = () => {
  return (
    <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-amber-400">
          <Gift className="h-5 w-5" />
          Benefícios Exclusivos para Assinantes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border border-amber-500/20">
          <div className="p-2 bg-amber-500/20 rounded-full">
            <Award className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">6 Meses Recorrentes</h4>
            <p className="text-sm text-muted-foreground">
              Ganhe um <span className="text-amber-400 font-medium">Copo Stanley</span> exclusivo!
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border border-amber-500/20">
          <div className="p-2 bg-amber-500/20 rounded-full">
            <Percent className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">12 Meses Recorrentes</h4>
            <p className="text-sm text-muted-foreground">
              Ganhe um <span className="text-amber-400 font-medium">Kit Exclusivo</span> + 
              <span className="text-amber-400 font-medium"> 30% de desconto</span> em qualquer pacote no próximo mês
              <span className="text-xs text-muted-foreground/70"> (validade 1 mês)</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PackageBenefits;
