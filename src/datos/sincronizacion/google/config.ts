import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { moduloAutorizacion } from '../../../../modules/autorizacion-google';

/** Único permiso que se pide: la carpeta oculta de esta app en el Drive del usuario. No es un permiso sensible. */
export const SCOPE_DRIVE_APPDATA = 'https://www.googleapis.com/auth/drive.appdata';

/**
 * Drive se enciende en `app.json` → `expo.extra.driveActivado: true`, **después** de registrar la app en Google Cloud
 * (cliente OAuth de Android con el paquete y el SHA-1 de la firma; ver Info.md). Mientras esté en `false`, Ajustes no
 * muestra nada de Drive: una fila que no funciona confunde al usuario y a la revisión de Google Play.
 */
export const DRIVE_ACTIVADO = Constants.expoConfig?.extra?.driveActivado === true;

/** Solo Android por ahora, y solo en un build con el módulo nativo `autorizacion-google`. */
export const DRIVE_DISPONIBLE = Platform.OS === 'android' && moduloAutorizacion !== null && DRIVE_ACTIVADO;
