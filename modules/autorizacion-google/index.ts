import { requireOptionalNativeModule } from 'expo';

/** Lo que devuelve Google al autorizar: el token de acceso (dura ~1 h) y los permisos concedidos. */
export interface Autorizacion {
  token: string;
  scopes: string[];
}

/**
 * Por qué falló una llamada (el `code` del error que lanza el módulo):
 * - `NECESITA_PERMISO`: hay que volver a mostrar la pantalla de Google (permiso retirado, otra cuenta…).
 * - `RED`: sin conexión con Google.
 * - `CANCELADO`: el usuario la cerró a medias.
 * - `CONFIGURACION`: esta app (paquete + firma) no está registrada como cliente Android en Google Cloud.
 * - `EN_CURSO`: ya hay una pantalla de Google abierta.
 * - `GENERICO`: cualquier otro fallo.
 */
export type CodigoErrorAutorizacion =
  | 'NECESITA_PERMISO'
  | 'RED'
  | 'CANCELADO'
  | 'CONFIGURACION'
  | 'EN_CURSO'
  | 'GENERICO';

export interface ModuloAutorizacion {
  /** `null` si el usuario cerró la pantalla de Google. Sin `interactivo` nunca muestra nada. */
  autorizar: (scopes: string[], interactivo: boolean) => Promise<Autorizacion | null>;
  limpiarToken: (token: string) => Promise<void>;
  revocar: (email: string, scopes: string[]) => Promise<void>;
}

// Solo existe en Android y en un build que lo incluya; en la web, en Jest y en un APK viejo es `null`.
const nativo = requireOptionalNativeModule<ModuloAutorizacion>('AutorizacionGoogle');

/** El módulo nativo, o `null` si este build no lo trae (entonces Drive no está disponible). */
export const moduloAutorizacion: ModuloAutorizacion | null = nativo;

const CODIGOS: readonly CodigoErrorAutorizacion[] = [
  'NECESITA_PERMISO',
  'RED',
  'CANCELADO',
  'CONFIGURACION',
  'EN_CURSO',
  'GENERICO',
];

/** El código de un error lanzado por el módulo (`GENERICO` si no trae uno conocido). */
export function codigoDeError(error: unknown): CodigoErrorAutorizacion {
  const codigo = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return CODIGOS.includes(codigo as CodigoErrorAutorizacion) ? (codigo as CodigoErrorAutorizacion) : 'GENERICO';
}
