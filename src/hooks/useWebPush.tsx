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

export const useWebPush = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if push is supported and register service worker
  useEffect(() => {
    const checkSupport = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      setIsSupported(true);

      try {
        // Usa o Service Worker principal do PWA (que importa /sw-push.js no Workbox)
        const reg = await navigator.serviceWorker.ready;
        console.log('Push SW registration ready:', reg);
        setRegistration(reg);

        // Check existing subscription
        const subscription = await (reg as any).pushManager.getSubscription();
        if (subscription) {
          console.log('Existing push subscription found');
          setIsSubscribed(true);
        }
      } catch (error) {
        console.error('Error getting push SW registration:', error);
      }
    };

    checkSupport();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user) {
      toast.error('Faça login para ativar notificações');
      return false;
    }

    setIsLoading(true);

    try {
      // If registration is not ready yet, wait for it (with timeout)
      let reg = registration;
      if (!reg) {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          toast.error('Seu navegador não suporta notificações push');
          return false;
        }
        try {
          // Wait max 5 seconds for SW to be ready
          reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('SW timeout')), 5000)
            )
          ]) as ServiceWorkerRegistration;
          setRegistration(reg);
        } catch (swError) {
          console.error('Service Worker not ready:', swError);
          toast.error('Serviço indisponível. Tente recarregar a página.');
          return false;
        }
      }

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Permissão negada. Ative nas configurações do navegador.');
        return false;
      }

      // Subscribe to push manager
      const subscription = await (reg as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      console.log('Push subscription:', subscription);

      // Extract keys from subscription
      const subscriptionJson = subscription.toJSON();
      const endpoint = subscriptionJson.endpoint!;
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'endpoint'
        });

      if (error) {
        console.error('Error saving subscription:', error);
        toast.error('Erro ao salvar inscrição');
        return false;
      }

      setIsSubscribed(true);
      toast.success('🔔 Notificações Push ativadas!', {
        description: 'Você receberá alertas mesmo com o app fechado.'
      });

      return true;

    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Erro ao ativar notificações push');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration, user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!registration || !user) return false;

    setIsLoading(true);

    try {
      const subscription = await (registration as any).pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id);
      }

      setIsSubscribed(false);
      toast.success('Notificações push desativadas');
      setIsLoading(false);
      return true;

    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Erro ao desativar notificações');
      setIsLoading(false);
      return false;
    }
  }, [registration, user]);

  // Toggle subscription
  const toggleSubscription = useCallback(async () => {
    if (isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [isSubscribed, subscribe, unsubscribe]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    toggleSubscription
  };
};
