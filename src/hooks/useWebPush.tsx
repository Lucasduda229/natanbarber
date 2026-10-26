import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// VAPID public key - must match the one in sw-push.js and edge function
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

// Convert base64 to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

/** Aguarda o SW ficar pronto com timeout máximo de ms milissegundos */
async function waitForSW(ms = 5000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}

/** Tenta registrar um SW mínimo se ainda não houver nenhum */
async function ensureSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  // Já existe um SW ativo?
  const existing = await waitForSW(3000);
  if (existing) return existing;

  // Tenta registrar o sw-push.js diretamente como fallback
  try {
    const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
    console.log('[WebPush] SW registrado manualmente:', reg);
    // Aguarda ativação
    const ready = await waitForSW(5000);
    return ready;
  } catch (err) {
    console.error('[WebPush] Falha ao registrar SW manualmente:', err);
    return null;
  }
}

export const useWebPush = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if push is supported and get SW registration
  useEffect(() => {
    const init = async () => {
      const hasSW = 'serviceWorker' in navigator;
      const hasPush = 'PushManager' in window;
      const hasNotif = 'Notification' in window;

      // Suporte mínimo: precisamos de Notification para qualquer coisa
      if (!hasNotif) return;

      setIsSupported(true);

      if (!hasSW || !hasPush) {
        // Navegador sem SW/Push — apenas notificações básicas via Notification API
        console.log('[WebPush] Modo básico (sem SW/Push)');
        return;
      }

      try {
        const reg = await waitForSW(3000);
        if (reg) {
          setRegistration(reg);
          const sub = await (reg as any).pushManager.getSubscription();
          if (sub) setIsSubscribed(true);
        }
      } catch (err) {
        console.debug('[WebPush] SW check failed:', err);
      }
    };

    init();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error('Faça login para ativar notificações');
      return false;
    }

    setIsLoading(true);

    try {
      // 1. Pede permissão primeiro (funciona em qualquer contexto)
      if (!('Notification' in window)) {
        toast.error('Seu navegador não suporta notificações');
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Permissão negada. Ative nas configurações do navegador.');
        return false;
      }

      // 2. Tenta obter/registrar SW para Push real
      const hasPush = 'PushManager' in window && 'serviceWorker' in navigator;

      if (hasPush) {
        // Usa SW já registrado ou tenta registrar um
        let reg = registration;
        if (!reg) {
          reg = await ensureSW();
          if (reg) setRegistration(reg);
        }

        if (reg && (reg as any).pushManager) {
          try {
            const subscription = await (reg as any).pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            const subscriptionJson = subscription.toJSON();
            const endpoint = subscriptionJson.endpoint!;
            const p256dh = subscriptionJson.keys?.p256dh || '';
            const auth = subscriptionJson.keys?.auth || '';

            const { error } = await supabase
              .from('push_subscriptions')
              .upsert(
                { user_id: user.id, endpoint, p256dh, auth, updated_at: new Date().toISOString() },
                { onConflict: 'endpoint' }
              );

            if (error) {
              console.error('[WebPush] Erro ao salvar subscription:', error);
              // Continua mesmo com erro no DB — notificações locais ainda funcionam
            }

            setIsSubscribed(true);
            toast.success('🔔 Notificações Push ativadas!', {
              description: 'Você receberá alertas mesmo com o app fechado.',
            });
            return true;
          } catch (pushErr) {
            console.warn('[WebPush] Push API falhou, usando modo básico:', pushErr);
            // Cai no modo básico abaixo
          }
        }
      }

      // 3. Modo básico: apenas Notification API (sem SW/Push background)
      // Mostra notificação de teste e considera ativado
      new Notification('🔔 Notificações ativadas!', {
        body: 'Você receberá alertas enquanto o app estiver aberto.',
        icon: '/pwa-192x192.png',
      });

      setIsSubscribed(true);
      toast.success('🔔 Notificações ativadas!', {
        description: 'Alertas ativos enquanto o app estiver aberto.',
      });
      return true;

    } catch (error) {
      console.error('[WebPush] Erro ao ativar notificações:', error);
      toast.error('Erro ao ativar notificações. Verifique as permissões do navegador.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration, user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    setIsLoading(true);

    try {
      const reg = registration || (await waitForSW(3000));
      if (reg) {
        const subscription = await (reg as any).pushManager?.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
        }
      }

      setIsSubscribed(false);
      toast.success('Notificações desativadas');
      return true;
    } catch (error) {
      console.error('[WebPush] Erro ao desativar:', error);
      toast.error('Erro ao desativar notificações');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration, user]);

  // Toggle subscription
  const toggleSubscription = useCallback(async () => {
    return isSubscribed ? unsubscribe() : subscribe();
  }, [isSubscribed, subscribe, unsubscribe]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    toggleSubscription,
  };
};
