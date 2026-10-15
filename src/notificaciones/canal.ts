import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const CANAL_ID = 'recordatorios';

/**
 * Android 8+ exige un canal para cada notificación; además, el aviso de permiso de Android 13+ no
 * aparece hasta que existe al menos uno. Se puede llamar varias veces: solo actualiza el nombre.
 */
export async function asegurarCanal(nombre: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_ID, {
    name: nombre,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}
