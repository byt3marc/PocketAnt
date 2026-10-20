import { requireOptionalNativeModule } from 'expo';

/** Lo que el usuario toca en la notificación de la descarga. */
export type AccionNotificacion = 'pausar' | 'cancelar';

/** Los textos de la notificación, ya traducidos: el módulo nativo no sabe de idiomas. */
export interface TextosNotificacion {
  titulo: string;
  texto: string;
  pausar: string;
  cancelar: string;
  /** Nombres de los dos canales de notificación (aparecen en los ajustes de notificaciones del sistema). */
  canalProgreso: string;
  canalResultado: string;
}

interface ModuloNativo {
  iniciar: (textos: TextosNotificacion) => void;
  actualizar: (fraccion: number, texto: string) => void;
  terminar: (titulo: string, texto: string, mostrarAviso: boolean) => void;
  sha256?: (ruta: string) => Promise<string>;
  addListener: (
    evento: 'onAccion',
    escucha: (datos: { accion: AccionNotificacion }) => void,
  ) => { remove: () => void };
}

// Solo existe en Android y en un build que lo incluya; en la web, en Jest y en un APK viejo es `null` y todo es un no-op.
const nativo = requireOptionalNativeModule<ModuloNativo>('DescargaSegundoPlano');

/** ¿Está el servicio en primer plano en este build? */
export const disponible = nativo !== null;

/** Enciende el servicio en primer plano con su notificación de progreso. Solo desde un toque del usuario. */
export function iniciar(textos: TextosNotificacion): void {
  nativo?.iniciar(textos);
}

/** `fraccion` de 0 a 1; negativa = barra indeterminada. */
export function actualizar(fraccion: number, texto: string): void {
  nativo?.actualizar(fraccion, texto);
}

/** Apaga el servicio; con `mostrarAviso` deja una notificación normal con el resultado. */
export function terminar(titulo: string, texto: string, mostrarAviso: boolean): void {
  nativo?.terminar(titulo, texto, mostrarAviso);
}

/** Avisa cuando el usuario toca «Pausar» o «Cancelar» en la notificación. Devuelve cómo dejar de escuchar. */
export function alAccion(escucha: (accion: AccionNotificacion) => void): () => void {
  const suscripcion = nativo?.addListener('onAccion', (datos) => escucha(datos.accion));
  return () => suscripcion?.remove();
}

/**
 * SHA-256 (hexadecimal, minúsculas) de un archivo, calculado en un hilo nativo de E/S: no congela la app aunque el
 * archivo pese gigas. `null` si este build no lo trae: sin él no se puede verificar el modelo.
 */
export const sha256DeArchivo: ((ruta: string) => Promise<string>) | null =
  typeof nativo?.sha256 === 'function' ? (ruta) => nativo.sha256!(ruta) : null;
