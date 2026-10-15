import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { asegurarCanal } from './canal';

/**
 * - `concedido`: se pueden mostrar notificaciones.
 * - `pendiente`: todavía se puede mostrar el aviso del sistema.
 * - `denegado`: el usuario las rechazó y el sistema ya no vuelve a preguntar (solo desde sus ajustes).
 * - `no_disponible`: la plataforma no las soporta (web).
 */
export type EstadoPermiso = 'concedido' | 'pendiente' | 'denegado' | 'no_disponible';

export async function leerPermiso(): Promise<EstadoPermiso> {
  if (Platform.OS === 'web') return 'no_disponible';
  const respuesta = await Notifications.getPermissionsAsync();
  if (respuesta.granted) return 'concedido';
  return respuesta.canAskAgain ? 'pendiente' : 'denegado';
}

/** Muestra el aviso de permiso del sistema (si todavía se puede) y devuelve el estado resultante. */
export async function solicitarPermiso(nombreCanal: string): Promise<EstadoPermiso> {
  if (Platform.OS === 'web') return 'no_disponible';
  await asegurarCanal(nombreCanal);
  await Notifications.requestPermissionsAsync();
  return leerPermiso();
}
