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
  /** Trae el archivo de datos del origen. `null` si el usuario cancela. */
  descargar(): Promise<ArchivoAnalizado | null>;
}
