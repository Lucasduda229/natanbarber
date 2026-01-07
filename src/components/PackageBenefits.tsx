import { Gift, Award, Crown, Clock, AlertCircle } from "lucide-react";

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
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/10 border border-blue-500/30 p-4">
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl" />
          
          {/* Badge Destaque */}
          <div className="flex justify-center mb-3">
            <div className="inline-flex items-center gap-1.5 bg-blue-500 text-white px-3 py-1.5 rounded-full text-[11px] font-black animate-pulse shadow-lg">
              <Clock className="w-3.5 h-3.5" />
              6 MESES RECORRENTES SEM PAUSA
            </div>
          </div>

          <div className="relative flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-foreground mb-0.5">🏆 Copo Stanley Original</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ganhe um copo Stanley exclusivo ao completar 6 meses!
              </p>
            </div>
          </div>

          {/* Aviso importante */}
          <div className="mt-3 bg-blue-500/20 rounded-lg p-2.5 border border-blue-400/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
              <p className="text-blue-200 text-[10px] leading-tight">
                <span className="font-bold">Obrigatório:</span> Assinatura ativa por 6 meses consecutivos sem pausas ou cancelamentos.
              </p>
            </div>
          </div>
        </div>

        {/* 12 Months Benefit */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/15 to-yellow-600/10 border border-amber-500/30 p-4">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl" />
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-bold animate-pulse">
              👑 MELHOR
            </span>
          </div>

          {/* Badge Destaque */}
          <div className="flex justify-center mb-3">
            <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black px-3 py-1.5 rounded-full text-[11px] font-black animate-pulse shadow-lg">
              <Crown className="w-3.5 h-3.5" />
              12 MESES RECORRENTES SEM PAUSA
            </div>
          </div>

          <div className="relative flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0 pr-12">
              <h4 className="font-bold text-sm text-foreground mb-0.5">🎁 Kit Exclusivo + Desconto</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ganhe um kit completo + <span className="text-amber-400 font-bold">30% OFF</span> em qualquer pacote
              </p>
            </div>
          </div>

          {/* Aviso importante */}
          <div className="mt-3 bg-amber-500/20 rounded-lg p-2.5 border border-amber-400/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200 text-[10px] leading-tight">
                <span className="font-bold">Obrigatório:</span> Assinatura ativa por 12 meses consecutivos sem pausas ou cancelamentos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackageBenefits;
