import { AlertCircle, Clock, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CancellationPolicyProps {
  variant?: "full" | "compact";
}

const CancellationPolicy = ({ variant = "full" }: CancellationPolicyProps) => {
  if (variant === "compact") {
    return (
      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <Info className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
        <p>Cancelamento gratuito até 2 horas antes do horário agendado.</p>
      </div>
    );
  }

  return (
    <Alert className="bg-card/60 border-primary/20">
      <AlertCircle className="w-5 h-5 text-primary" />
      <AlertTitle className="text-foreground font-semibold">Política de Cancelamento</AlertTitle>
      <AlertDescription className="space-y-2 mt-2 text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span>Cancele até <strong className="text-foreground">2 horas antes</strong> do horário agendado sem custo.</span>
        </div>
        <p className="text-sm">
          Cancelamentos tardios ou faltas podem resultar em cobrança de taxa de até 50% do valor do serviço.
        </p>
      </AlertDescription>
    </Alert>
  );
};

export default CancellationPolicy;
