import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

import { SCOPE_DRIVE_APPDATA, WEB_CLIENT_ID } from './config';
import { ErrorDrive } from './errores';

export interface CuentaGoogle {
  email: string;
}

let configurado = false;
function configurar(): void {
  if (configurado) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    scopes: [SCOPE_DRIVE_APPDATA],
    offlineAccess: false,
  });
  configurado = true;
}

/**
 * Abre el selector de cuentas de Google y pide acceso a la carpeta de la app en Drive.
 * Devuelve `null` si el usuario cancela.
 */
export async function conectarCuenta(): Promise<CuentaGoogle | null> {
  configurar();
  try {
    await GoogleSignin.hasPlayServices();
    const respuesta = await GoogleSignin.signIn();
    if (!isSuccessResponse(respuesta)) return null; // canceló

    let datos = respuesta.data;
    if (!datos.scopes.includes(SCOPE_DRIVE_APPDATA)) {
      const ampliada = await GoogleSignin.addScopes({ scopes: [SCOPE_DRIVE_APPDATA] });
      if (!ampliada || !isSuccessResponse(ampliada) || !ampliada.data.scopes.includes(SCOPE_DRIVE_APPDATA)) {
        throw new ErrorDrive('error.drive.permiso', { requiereReconectar: true });
      }
      datos = ampliada.data;
    }
    return { email: datos.user.email };
  } catch (error) {
    if (error instanceof ErrorDrive) throw error;
    if (isErrorWithCode(error) && (error.code === statusCodes.IN_PROGRESS || error.code === statusCodes.SIGN_IN_CANCELLED)) {
      return null;
    }
    throw new ErrorDrive('error.drive.conectar');
  }
}

/** Cierra la sesión de Google en este dispositivo. No borra la copia que ya está en Drive. */
export async function desconectarCuenta(): Promise<void> {
  configurar();
  await GoogleSignin.signOut();
}

/**
 * Token de acceso vigente. Tras reiniciar la app hay que restaurar antes la sesión de Google (`signInSilently`);
 * si Google ya no la reconoce, el usuario debe volver a conectar la cuenta.
 */
export async function obtenerTokenDeAcceso(): Promise<string> {
  configurar();
  if (!GoogleSignin.getCurrentUser()) {
    let restaurada;
    try {
      restaurada = await GoogleSignin.signInSilently();
    } catch {
      throw new ErrorDrive('error.drive.red');
    }
    if (restaurada.type !== 'success') {
      throw new ErrorDrive('error.drive.sin_sesion', { requiereReconectar: true });
    }
  }
  try {
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_REQUIRED) {
      throw new ErrorDrive('error.drive.sin_sesion', { requiereReconectar: true });
    }
    throw new ErrorDrive('error.drive.red');
  }
}

/** Google rechazó este token: se descarta de la caché para que `getTokens` pida uno nuevo. */
export async function descartarToken(token: string): Promise<void> {
  configurar();
  try {
    await GoogleSignin.clearCachedAccessToken(token);
  } catch {
    // Si no se pudo limpiar, el reintento fallará y se reportará como permiso.
  }
}
