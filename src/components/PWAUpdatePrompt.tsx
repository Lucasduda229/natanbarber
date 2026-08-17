import { useEffect, useCallback, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export function PWAUpdatePrompt() {
  const reloadingRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (!r) return;

      // Verifica atualização a cada 30 segundos
      setInterval(() => r.update(), 30 * 1000);

      // Verifica quando o usuário volta para a aba
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          r.update();
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      // Verifica quando a janela ganha foco
      window.addEventListener("focus", () => r.update());
    },
    onRegisterError(error) {
      console.error("[PWA] Erro ao registrar Service Worker:", error);
    },
  });

  const doUpdate = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  // Atualização imediata ao detectar nova versão
  useEffect(() => {
    if (needRefresh) {
      console.log("[PWA] Nova versão detectada — atualizando...");
      doUpdate();
    }
  }, [needRefresh, doUpdate]);

  // Recarrega a página quando um novo SW assume o controle
  // Cobre dispositivos com PWA instalado (Android/iOS)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      console.log("[PWA] Novo SW assumiu o controle — recarregando...");
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
    };
  }, []);

  return null;
}
