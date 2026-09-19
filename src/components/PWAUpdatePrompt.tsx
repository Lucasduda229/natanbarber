import { useEffect, useCallback, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * PWAUpdatePrompt — Atualização automática e silenciosa do Service Worker.
 *
 * Estratégia multi-camada para cobrir todos os casos, especialmente Android:
 * 1. useRegisterSW detecta novo SW disponível e chama updateServiceWorker()
 * 2. skipWaiting + clientsClaim no workbox ativam o novo SW imediatamente
 * 3. Listener "controllerchange" detecta a troca e recarrega a página
 * 4. Polling periódico (60s) garante que dispositivos ociosos também atualizem
 * 5. Hard reload fallback caso o reload suave falhe no Android
 */
export function PWAUpdatePrompt() {
  const reloadingRef = useRef(false);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (!r) return;
      console.log("[PWA] Service Worker registrado.");

      // Polling a cada 60 segundos para verificar atualizações
      const intervalId = setInterval(() => {
        r.update().catch(() => {});
      }, 60 * 1000);

      // Verifica ao voltar para a aba/app (muito comum no Android)
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          r.update().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      // Verifica ao ganhar foco (desktop e iOS)
      const onFocus = () => r.update().catch(() => {});
      window.addEventListener("focus", onFocus);

      // Limpa listeners ao desmontar (improvável mas correto)
      return () => {
        clearInterval(intervalId);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("focus", onFocus);
      };
    },
    onRegisterError(error) {
      console.error("[PWA] Erro ao registrar Service Worker:", error);
    },
  });

  // Função de reload com fallback hard-reload para Android
  const performReload = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;

    console.log("[PWA] Recarregando para aplicar atualização...");

    // Tenta reload normal primeiro
    try {
      window.location.reload();
    } catch {
      // Fallback: força hard reload ignorando o cache do browser
      window.location.href = window.location.href;
    }
  }, []);

  const doUpdate = useCallback(() => {
    if (reloadingRef.current) return;
    console.log("[PWA] Nova versão detectada — ativando Service Worker...");

    // Solicita ao SW que pule a fila de espera (skipWaiting)
    updateServiceWorker(true);

    // Fallback: se o controllerchange não disparar em 3s, força o reload
    // Isso cobre casos onde o Android não emite o evento corretamente
    updateTimerRef.current = setTimeout(() => {
      if (!reloadingRef.current) {
        console.log("[PWA] Timeout — forçando reload...");
        performReload();
      }
    }, 3000);
  }, [updateServiceWorker, performReload]);

  // Atualiza imediatamente ao detectar nova versão
  useEffect(() => {
    if (needRefresh) {
      doUpdate();
    }
  }, [needRefresh, doUpdate]);

  // Listener para quando o novo SW assume o controle da página
  // Este é o ponto de trigger definitivo no Android
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      // Cancela o timer de fallback pois o evento disparou corretamente
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      performReload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [performReload]);

  // Listener para mensagens do Service Worker (para SWs customizados)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        console.log("[PWA] Mensagem do SW — forçando reload...");
        performReload();
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [performReload]);

  // Limpa timers ao desmontar
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, []);

  return null;
}
