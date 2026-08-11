import { useEffect, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (!r) return;

      // Check for updates every 15 seconds
      setInterval(() => r.update(), 15 * 1000);

      // Check for updates when the app regains focus (user switches back to the app)
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          r.update();
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      // Check for updates on page navigation
      const onFocus = () => r.update();
      window.addEventListener("focus", onFocus);
    },
  });

  const doUpdate = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  useEffect(() => {
    if (needRefresh) {
      toast("Nova versão disponível!", {
        description: "Atualizando automaticamente...",
        duration: 2000,
      });
      // Force immediate update
      setTimeout(doUpdate, 1000);
    }
  }, [needRefresh, doUpdate]);

  return null;
}
