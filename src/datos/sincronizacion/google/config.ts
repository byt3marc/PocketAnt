import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Único permiso que se pide: la carpeta oculta de esta app en el Drive del usuario. No es un permiso sensible. */
export const SCOPE_DRIVE_APPDATA = 'https://www.googleapis.com/auth/drive.appdata';

/**
 * ID de cliente OAuth de tipo **Web** creado en Google Cloud (es público, no un secreto). Se pone en
 * `app.json` → `expo.extra.googleWebClientId`. Mientras esté vacío, la sincronización queda desactivada
 * y Ajustes muestra «Configuración pendiente».
 */
export const WEB_CLIENT_ID: string = (() => {
  const valor = Constants.expoConfig?.extra?.googleWebClientId;
  return typeof valor === 'string' ? valor.trim() : '';
})();

/** Solo Android por ahora (iOS necesita además el esquema de URL de su propio cliente de Google). */
export const DRIVE_DISPONIBLE = Platform.OS === 'android' && WEB_CLIENT_ID !== '';
