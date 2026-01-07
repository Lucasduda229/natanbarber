import { Gift, Award, Percent, Crown } from "lucide-react";

const PackageBenefits = () => {
  return (
    <div className="space-y-3">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-600/20 border border-amber-500/30 p-4">
        <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <Crown className="w-5 h-5 text-background" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Benefícios Exclusivos</h3>
            <p className="text-xs text-muted-foreground">Para assinantes recorrentes</p>
          </div>
        </div>
      </div>

      {/* Benefits Cards - Stacked for mobile */}
      <div className="grid gap-3">
        {/* 6 Months Benefit */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 p-4 active:scale-[0.98] transition-transform">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl" />
          <div className="relative flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                  6 MESES
                </span>
              </div>
              <h4 className="font-semibold text-sm text-foreground mb-0.5">Copo Stanley</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ganhe um copo Stanley exclusivo ao completar 6 meses de assinatura!
              </p>
            </div>
          </div>
        </div>

        {/* 12 Months Benefit */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4 active:scale-[0.98] transition-transform">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-primary/10 rounded-full blur-xl" />
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold animate-pulse">
              MELHOR
            </span>
          </div>
          <div className="relative flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 pr-12">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                  12 MESES
                </span>
              </div>
              <h4 className="font-semibold text-sm text-foreground mb-0.5">Kit Exclusivo + Desconto</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ganhe um kit completo + <span className="text-primary font-medium">30% OFF</span> em qualquer pacote
                <span className="text-muted-foreground/60"> (válido 1 mês)</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageBenefits;
