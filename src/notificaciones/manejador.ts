import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { leerDatosNotificacion } from '@/dominio/planNotificaciones';

/**
 * Qué pasa si una notificación llega con la app abierta: el recordatorio de registro se oculta (ya estás
 * en la app), pero el aviso de un cobro sí se muestra. Se llama una vez al arrancar.
 */
export function configurarManejadorDeNotificaciones(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async (notificacion) => {
      const datos = leerDatosNotificacion(notificacion.request.content.data);
      const mostrar = datos?.tipo !== 'recordatorio';
      return {
        shouldShowBanner: mostrar,
        shouldShowList: mostrar,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
  });
}
