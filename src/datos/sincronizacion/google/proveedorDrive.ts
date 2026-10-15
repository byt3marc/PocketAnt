import { analizarArchivo, serializarArchivo } from '../formatoArchivo';
import type { ProveedorSync } from '../proveedor';

import type { ClienteDrive } from './driveApi';

/**
 * Proveedor de sincronización con Google Drive: guarda todos los datos en un único `datos.json` dentro de la
 * carpeta oculta de la app. Implementa la misma interfaz que el archivo JSON, así que el resto de la app no
 * sabe de dónde vienen ni a dónde van los datos.
 */
export function crearProveedorDrive(cliente: ClienteDrive): ProveedorSync {
  // Id del archivo ya conocido en esta sesión, para no buscarlo de nuevo al subir.
  let idConocido: string | null = null;

  return {
    id: 'google-drive',
    nombre: 'Google Drive',

    async descargar() {
      const archivo = await cliente.buscar();
      if (!archivo) {
        idConocido = null;
        return null; // todavía no hay copia en la nube
      }
      idConocido = archivo.id;
      return analizarArchivo(await cliente.leer(archivo.id));
    },

    async subir(datos) {
      const contenido = serializarArchivo(datos);
      const id = idConocido ?? (await cliente.buscar())?.id ?? null;
      if (id) {
        idConocido = id;
        await cliente.actualizar(id, contenido);
      } else {
        idConocido = await cliente.crear(contenido);
      }
    },
  };
}
