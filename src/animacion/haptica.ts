import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Qué se quiere transmitir con la vibración:
 * - `seleccion`: cambiar de opción (selector, contador, interruptor). Muy leve.
 * - `exito`: algo se guardó.
 * - `aviso`: algo se eliminó u omitió.
 * - `error`: no se pudo (p. ej. faltan datos en el formulario).
 */
export type TipoVibracion = 'seleccion' | 'exito' | 'aviso' | 'error';

/**
 * En Android se usa el motor háptico del sistema (`View.performHapticFeedback`): respeta el ajuste «Respuesta táctil»
 * del teléfono y no necesita el permiso de vibración. Las constantes nuevas (`Confirm`, `Reject` desde Android 11;
 * `Segment_Tick` desde Android 14) no existen en teléfonos viejos y el módulo rechaza la promesa: ahí se cae a una que
 * existe en todas las versiones.
 */
const ANDROID: Record<TipoVibracion, [Haptics.AndroidHaptics, Haptics.AndroidHaptics]> = {
  seleccion: [Haptics.AndroidHaptics.Segment_Tick, Haptics.AndroidHaptics.Clock_Tick],
  exito: [Haptics.AndroidHaptics.Confirm, Haptics.AndroidHaptics.Virtual_Key],
  aviso: [Haptics.AndroidHaptics.Reject, Haptics.AndroidHaptics.Long_Press],
  error: [Haptics.AndroidHaptics.Reject, Haptics.AndroidHaptics.Long_Press],
};

const IOS: Record<Exclude<TipoVibracion, 'seleccion'>, Haptics.NotificationFeedbackType> = {
  exito: Haptics.NotificationFeedbackType.Success,
  aviso: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

const ignorar = () => {};

function lanzar(tipo: TipoVibracion): Promise<void> {
  if (Platform.OS === 'android') {
    const [preferida, respaldo] = ANDROID[tipo];
    return Haptics.performAndroidHapticsAsync(preferida).catch(() => Haptics.performAndroidHapticsAsync(respaldo));
  }
  return tipo === 'seleccion' ? Haptics.selectionAsync() : Haptics.notificationAsync(IOS[tipo]);
}

/**
 * Una vibración corta que acompaña a una acción. Nunca falla ni hace esperar: si el teléfono no puede, no pasa nada.
 * En la web (solo desarrollo) no hace nada.
 */
export function vibrar(tipo: TipoVibracion): void {
  if (Platform.OS === 'web') return;
  try {
    lanzar(tipo).catch(ignorar);
  } catch {
    // Sin módulo nativo (p. ej. Expo Go viejo): la vibración es un extra, no un requisito.
  }
}
