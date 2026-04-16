import { AlertCircle, Clock, Info, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CancellationPolicyProps {
  variant?: "full" | "compact";
}

const CancellationPolicy = ({ variant = "compact" }: CancellationPolicyProps) => {
  if (variant === "compact") {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <Info className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
          <p>Cancelamento gratuito até <strong className="text-foreground">2 horas antes</strong> do horário agendado.</p>
        </div>
        <div className="flex items-start gap-2 text-sm bg-destructive/10 border border-destructive/30 p-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
          <p className="text-foreground">
            Cancelar em cima da hora ou não comparecer gera <strong className="text-destructive">taxa de R$ 5,00</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Alert className="bg-card/60 border-primary/20">
      <AlertCircle className="w-5 h-5 text-primary" />
      <AlertTitle className="text-foreground font-semibold">Política de Cancelamento</AlertTitle>
      <AlertDescription className="mt-2 text-muted-foreground space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary flex-shrink-0" />
          <span>Cancele até <strong className="text-foreground">2 horas antes</strong> do horário agendado.</span>
        </div>
        <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 p-2 rounded-md mt-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
          <span className="text-foreground text-sm">
            Cancelamentos em cima da hora ou <strong>não comparecimento</strong> geram <strong className="text-destructive">taxa de R$ 5,00</strong>.
          </span>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default CancellationPolicy;
