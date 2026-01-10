import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if browser supports notifications
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Seu navegador não suporta notificações');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('Notificações ativadas! 🔔');
        // Send a test notification
        showNotification({
          title: 'Notificações Ativadas',
          body: 'Você receberá alertas de novos agendamentos mesmo com o navegador minimizado.',
          icon: '/pwa-192x192.png'
        });
        return true;
      } else if (result === 'denied') {
        toast.error('Notificações bloqueadas. Ative nas configurações do navegador.');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Erro ao solicitar permissão de notificação');
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback(({ 
    title, 
    body, 
    icon = '/pwa-192x192.png',
    tag,
    requireInteraction = false
  }: PushNotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      return null;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon,
        tag,
        requireInteraction,
        badge: '/pwa-192x192.png',
        silent: false
      });

      // Auto close after 10 seconds if not interacted
      if (!requireInteraction) {
        setTimeout(() => notification.close(), 10000);
      }

      // Focus window on click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  const notifyNewAppointment = useCallback((clientName: string, service: string, time: string) => {
    showNotification({
      title: '🔔 Novo Agendamento!',
      body: `${clientName} agendou ${service} para ${time}`,
      tag: 'new-appointment',
      requireInteraction: true
    });
  }, [showNotification]);

  const notifyCancellation = useCallback((clientName: string) => {
    showNotification({
      title: '❌ Agendamento Cancelado',
      body: `${clientName} cancelou o agendamento`,
      tag: 'cancellation'
    });
  }, [showNotification]);

  const notifyUpdate = useCallback((message: string) => {
    showNotification({
      title: '📝 Atualização',
      body: message,
      tag: 'update'
    });
  }, [showNotification]);

  return {
    permission,
    isSupported,
    isEnabled: permission === 'granted',
    requestPermission,
    showNotification,
    notifyNewAppointment,
    notifyCancellation,
    notifyUpdate
  };
};
