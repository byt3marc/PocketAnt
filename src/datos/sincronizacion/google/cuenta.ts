import {
  codigoDeError,
  moduloAutorizacion,
  type ModuloAutorizacion,
} from '../../../../modules/autorizacion-google';

import { fetchConTiempoMaximo } from '@/datos/red';

import { SCOPE_DRIVE_APPDATA } from './config';
import { ErrorDrive } from './errores';

export interface CuentaGoogle {
  email: string;
}

/** Lo que la app necesita de la cuenta de Google para hablar con Drive. */
export interface AccesoGoogle {
  /** Muestra la pantalla de Google (elegir cuenta y aceptar). `null` si el usuario la cierra. */
  conectarCuenta: () => Promise<CuentaGoogle | null>;
  /** Retira el permiso de la app en esa cuenta. No borra la copia que ya está en Drive. */
  desconectarCuenta: (email: string | null) => Promise<void>;
  /** Token de acceso vigente, sin mostrar nada. Si Google pide confirmar de nuevo, hay que reconectar. */
  obtenerTokenDeAcceso: () => Promise<string>;
  /** Google rechazó este token: se descarta para que el siguiente sea nuevo. */
  descartarToken: (token: string) => Promise<void>;
}

const SCOPES = [SCOPE_DRIVE_APPDATA];
/** `about` acepta el permiso `drive.appdata`: así se sabe el correo de la cuenta sin pedir otro permiso. */
const URL_USUARIO = 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)';

/** Traduce un fallo del módulo nativo a un error que se puede mostrar. */
function errorDeAutorizacion(error: unknown, alConectar: boolean): ErrorDrive {
  switch (codigoDeError(error)) {
    case 'NECESITA_PERMISO':
      return new ErrorDrive('error.drive.sin_sesion', { requiereReconectar: true });
    case 'RED':
      return new ErrorDrive('error.drive.red');
    case 'CONFIGURACION':
      return new ErrorDrive('error.drive.configuracion');
    default:
      return alConectar ? new ErrorDrive('error.drive.conectar') : new ErrorDrive('error.drive.red');
  }
}

/**
 * Acceso a la cuenta de Google con `AuthorizationClient` (Google Identity Services, módulo local
 * `modules/autorizacion-google`). No hay «inicio de sesión»: solo se pide permiso para la carpeta oculta de la app en
 * Drive, y Google entrega un token de acceso que renueva solo mientras el permiso siga dado.
 */
export function crearAccesoGoogle(modulo: ModuloAutorizacion | null, fetchFn: typeof fetch = fetch): AccesoGoogle {
  const usar = (): ModuloAutorizacion => {
    if (!modulo) throw new ErrorDrive('error.drive.conectar');
    return modulo;
  };

  async function leerCorreo(token: string): Promise<string> {
    let respuesta: Response;
    try {
      respuesta = await fetchConTiempoMaximo(fetchFn, URL_USUARIO, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new ErrorDrive('error.drive.red');
    }
    if (!respuesta.ok) throw new ErrorDrive('error.drive.conectar');
    const datos = (await respuesta.json()) as { user?: { emailAddress?: unknown } };
    const correo = datos.user?.emailAddress;
    if (typeof correo !== 'string' || correo === '') throw new ErrorDrive('error.drive.conectar');
    return correo;
  }

  return {
    async conectarCuenta() {
      let autorizacion;
      try {
        autorizacion = await usar().autorizar(SCOPES, true);
      } catch (error) {
        if (error instanceof ErrorDrive) throw error;
        if (codigoDeError(error) === 'CANCELADO' || codigoDeError(error) === 'EN_CURSO') return null;
        throw errorDeAutorizacion(error, true);
      }
      if (!autorizacion) return null; // cerró la pantalla de Google
      if (!autorizacion.scopes.includes(SCOPE_DRIVE_APPDATA)) {
        throw new ErrorDrive('error.drive.permiso', { requiereReconectar: true });
      }
      return { email: await leerCorreo(autorizacion.token) };
    },

    async desconectarCuenta(email) {
      if (!email || !modulo) return;
      await modulo.revocar(email, SCOPES);
    },

    async obtenerTokenDeAcceso() {
      let autorizacion;
      try {
        autorizacion = await usar().autorizar(SCOPES, false);
      } catch (error) {
        if (error instanceof ErrorDrive) throw error;
        throw errorDeAutorizacion(error, false);
      }
      if (!autorizacion) throw new ErrorDrive('error.drive.sin_sesion', { requiereReconectar: true });
      return autorizacion.token;
    },

    async descartarToken(token) {
      try {
        await modulo?.limpiarToken(token);
      } catch {
        // Si no se pudo limpiar, el reintento fallará y se reportará como permiso.
      }
    },
  };
}

/** El acceso real (sin módulo nativo, p. ej. en la web, todo falla con «no se pudo conectar»). */
export const accesoGoogle = crearAccesoGoogle(moduloAutorizacion);
