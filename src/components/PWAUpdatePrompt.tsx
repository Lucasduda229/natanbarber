import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 60 seconds
      r && setInterval(() => r.update(), 60 * 1000);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast("Nova versao disponivel!", {
        description: "Atualizando automaticamente...",
        duration: 3000,
      });
      // Force immediate update without user action
      setTimeout(() => {
        updateServiceWorker(true);
      }, 1500);
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
