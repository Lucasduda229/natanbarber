import { useEffect, useCallback, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X, Sparkles } from "lucide-react";
import {
  checkServerVersion,
  forceAppUpdate,
  cleanupRogueServiceWorkers,
} from "@/utils/pwaUpdate";

/**
 * PWAUpdatePrompt — Banner visível e detector ativo de atualização disponível.
 *
 * Estratégia de garantia total:
 * 1. Limpa SWs legados (como sw-push.js standalone) que causavam travamento
 * 2. Checagem ativa periódica contra /version.json (ignora qualquer cache)
 * 3. Escuta eventos nativos do Service Worker (needRefresh e controllerchange)
 * 4. Ao clicar "Atualizar agora", limpa CacheStorage e força reload do app
 */
export function PWAUpdatePrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (!r) return;
      console.log("[PWA] Service Worker registrado com sucesso.");

      // Limpa workers conflitantes
      cleanupRogueServiceWorkers();

      // Checagem periódica a cada 30 segundos
      const intervalId = setInterval(() => {
        r.update().catch(() => {});
        checkServerVersion().then(({ hasUpdate }) => {
          if (hasUpdate) setShowBanner(true);
        });
      }, 30 * 1000);

      // Checagem ao retornar para a tela/app (mobile resume)
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          r.update().catch(() => {});
          checkServerVersion().then(({ hasUpdate }) => {
            if (hasUpdate) setShowBanner(true);
          });
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      const onFocus = () => {
        r.update().catch(() => {});
        checkServerVersion().then(({ hasUpdate }) => {
          if (hasUpdate) setShowBanner(true);
        });
      };
      window.addEventListener("focus", onFocus);

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

  // Checagem ativa logo na inicialização
  useEffect(() => {
    cleanupRogueServiceWorkers();

    const initialCheck = async () => {
      const { hasUpdate } = await checkServerVersion();
      if (hasUpdate) {
        console.log("[PWA] Nova versão detectada via version.json!");
        setShowBanner(true);
      }
    };

    initialCheck();

    // Timer secundário de polling leve para version.json
    checkTimerRef.current = setInterval(initialCheck, 45 * 1000);
    return () => {
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
    };
  }, []);

  // Quando o VitePWA detectar nova versão no SW
  useEffect(() => {
    if (needRefresh) {
      console.log("[PWA] needRefresh detectado pelo Service Worker.");
      setShowBanner(true);
    }
  }, [needRefresh]);

  // Quando o usuário clica em Atualizar
  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);
    console.log("[PWA] Usuário confirmou atualização — executando forceAppUpdate...");
    try {
      updateServiceWorker(true);
    } catch {
      // continua para o forceAppUpdate
    }
    await forceAppUpdate({ notify: true });
  }, [updateServiceWorker]);

  // Escuta troca de controller (novo SW assumiu controle em segundo plano)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      console.log("[PWA] controllerchange detectado!");
      setShowBanner(true);
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-safe-bottom"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
    >
      <div
        className="mx-auto max-w-md mb-4 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden"
        style={{
          animation: "slideUpBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {/* Barra dourada no topo */}
        <div className="h-1 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500" />

        <div className="p-4 flex items-start gap-3">
          {/* Ícone animado */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mt-0.5">
            <RefreshCw
              className={`w-5 h-5 text-primary ${isUpdating ? "animate-spin" : ""}`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm">
              {isUpdating ? "Atualizando..." : "Nova versão disponível! 🚀"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isUpdating
                ? "Aguarde, recarregando o app..."
                : "Toque em Atualizar para aplicar as melhorias mais recentes."}
            </p>

            {!isUpdating && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleUpdate}
                  className="flex-1 h-9 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-background font-semibold text-sm transition-all active:scale-95 hover:brightness-110"
                >
                  ✨ Atualizar agora
                </button>
                <button
                  onClick={() => setShowBanner(false)}
                  className="w-9 h-9 rounded-xl border border-border/50 bg-muted/30 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-all active:scale-95"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUpBanner {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
