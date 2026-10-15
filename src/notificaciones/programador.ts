import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { SolicitudNotificacion } from '@/dominio/planNotificaciones';

import { CANAL_ID } from './canal';

async function ejecutar(solicitudes: readonly SolicitudNotificacion[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const solicitud of solicitudes) {
    const { disparo } = solicitud;
    await Notifications.scheduleNotificationAsync({
      content: { title: solicitud.titulo, body: solicitud.cuerpo, data: solicitud.datos },
      trigger:
        disparo.tipo === 'diario'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: disparo.hora,
              minute: disparo.minuto,
              channelId: CANAL_ID,
            }
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: disparo.fecha,
              channelId: CANAL_ID,
            },
    });
  }
}

// Las reprogramaciones se encolan para que nunca se mezclen dos "cancelar todo y programar".
let cola: Promise<void> = Promise.resolve();

/**
 * Deja programado exactamente `solicitudes` (cancela lo anterior). Es idempotente, así que se puede llamar
 * cada vez que cambien los datos, los ajustes o el idioma. Con una lista vacía solo cancela.
 */
export function aplicarPlan(solicitudes: readonly SolicitudNotificacion[]): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  const trabajo = cola.then(() => ejecutar(solicitudes));
  cola = trabajo.catch(() => undefined); // un fallo no debe bloquear las siguientes
  return trabajo;
}
