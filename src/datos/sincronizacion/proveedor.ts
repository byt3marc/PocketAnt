import type { Movimiento } from '@/dominio/tipos';

import type { AlmacenImagenes } from '../almacenImagenes';
import type { ArchivoAnalizado, ArchivoDatos } from './formatoArchivo';

/**
 * Origen/destino de una copia de los datos. Hoy existe un solo proveedor (archivo JSON
 * compartido desde el teléfono). La sincronización con Google Drive (`appDataFolder`)
 * será otro proveedor que implemente esta misma interfaz, sin tocar pantallas ni repositorio.
 */
export interface ProveedorSync {
  readonly id: string;
  readonly nombre: string;
  /** Envía el archivo de datos al destino (menú de compartir, subida a Drive…). */
  subir(archivo: ArchivoDatos): Promise<void>;
  /**
   * Exporta las fotos en streaming: el JSON se genera movimiento a movimiento y el proveedor lo
   * va escribiendo por trozos, así la memoria depende de un movimiento y no del historial.
   * Quien no lo implemente sigue usando `subir(archivo)` con todo en memoria.
   */
  subirConImagenes?(movimientos: readonly Movimiento[], almacen: AlmacenImagenes): Promise<void>;
  /** Trae el archivo de datos del origen. `null` si el usuario cancela. */
  descargar(): Promise<ArchivoAnalizado | null>;
}
