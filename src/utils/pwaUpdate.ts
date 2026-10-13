import { toast } from "sonner";

export interface VersionInfo {
  version: string;
  builtAt?: string;
}

/**
 * Retorna a versão local empacotada no bundle da aplicação
 */
export function getLocalAppVersion(): string {
  try {
    return typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Remove registros de Service Workers legados ou conflitantes (como sw-push.js isolado)
 */
export async function cleanupRogueServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active?.scriptURL.includes("sw-push.js")) {
        console.log("[PWA] Desregistrando sw-push.js legado conflitante:", reg.active.scriptURL);
        await reg.unregister().catch(() => {});
      }
    }
  } catch (err) {
    console.debug("[PWA] Falha ao verificar registros de SW:", err);
  }
}

/**
 * Consulta o servidor (bypassing cache) para checar se uma versão mais recente foi publicada
 */
export async function checkServerVersion(): Promise<{
  hasUpdate: boolean;
  serverVersion: string | null;
  localVersion: string;
}> {
  const localVersion = getLocalAppVersion();

  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!res.ok) {
      return { hasUpdate: false, serverVersion: null, localVersion };
    }

    const data: VersionInfo = await res.json();
    if (data && typeof data.version === "string") {
      const hasUpdate = localVersion !== "unknown" && data.version !== localVersion;
      return {
        hasUpdate,
        serverVersion: data.version,
        localVersion,
      };
    }
  } catch (err) {
    console.debug("[PWA] Erro ao consultar version.json:", err);
  }

  return { hasUpdate: false, serverVersion: null, localVersion };
}

/**
 * Força atualização completa:
 * 1. Limpa todas as caches locais (CacheStorage)
 * 2. Atualiza Service Workers ativos
 * 3. Recarrega a aplicação forçando bypass de cache
 */
export async function forceAppUpdate(options?: { notify?: boolean }): Promise<void> {
  const shouldNotify = options?.notify ?? true;

  if (shouldNotify) {
    toast.loading("Atualizando aplicativo para a versão mais recente...", {
      id: "pwa-update-loading",
      duration: 10000,
    });
  }

  try {
    // 1. Limpa CacheStorage para remover bundles JS/CSS antigos
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      console.log("[PWA] Caches apagados com sucesso:", keys);
    }

    // 2. Limpa SWs conflitantes e comanda update
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        if (reg.active?.scriptURL.includes("sw-push.js")) {
          await reg.unregister().catch(() => {});
        } else {
          await reg.update().catch(() => {});
        }
      }
    }
  } catch (error) {
    console.error("[PWA] Erro ao limpar caches durante atualização:", error);
  }

  // 3. Força reload com parâmetro único para invalidar qualquer cache residual do webview
  setTimeout(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("app_updated", Date.now().toString());
      window.location.href = url.toString();
    } catch {
      window.location.reload();
    }
  }, 500);
}
