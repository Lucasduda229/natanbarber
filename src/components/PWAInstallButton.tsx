import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/hooks/usePWA";
import { Link } from "react-router-dom";

export const PWAInstallButton = () => {
  const { isInstallable, isInstalled, isIOS, installApp } = usePWA();

  // Don't show if already installed
  if (isInstalled) return null;

  const handleInstall = async () => {
    await installApp();
  };

  // For iOS or when not installable, show link to install page
  if (isIOS || !isInstallable) {
    return (
      <Link to="/install">
        <Button
          size="sm"
          variant="outline"
          className="border-primary/50 text-foreground hover:bg-primary/10 gap-2 rounded-full px-4"
        >
          <Smartphone className="h-4 w-4" />
          <span className="hidden sm:inline">Instalar App</span>
          <span className="sm:hidden">App</span>
        </Button>
      </Link>
    );
  }

  // For Android/Chrome, show direct install button
  return (
    <Button
      size="sm"
      onClick={handleInstall}
      className="bg-gold-gradient hover:opacity-90 text-background gap-2 rounded-full px-4"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Instalar App</span>
      <span className="sm:hidden">App</span>
    </Button>
  );
};
