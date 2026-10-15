import { Directory, DownloadTask, File, Paths, type DownloadProgress } from 'expo-file-system';

import type { ArchivosModelo, TareaDescarga } from './descargaModelo';

/**
 * Los archivos del modelo en el almacenamiento de la app. `expo-ai-kit` busca el modelo en
 * `<filesDir>/models/<id>.litertlm` (que es `Paths.document`) y guarda lo que va bajando en `<id>.litertlm.tmp`:
 * se usan esos mismos nombres para que «eliminar el modelo» de la librería también limpie lo parcial.
 */
export function crearArchivosModelo(id: string): ArchivosModelo {
  const carpeta = () => new Directory(Paths.document, 'models');
  const parcial = () => new File(carpeta(), `${id}.litertlm.tmp`);
  const definitivo = () => new File(carpeta(), `${id}.litertlm`);

  return {
    tamanoParcial() {
      const archivo = parcial();
      return archivo.exists ? archivo.size : 0;
    },

    borrarParcial() {
      const archivo = parcial();
      if (archivo.exists) archivo.delete();
    },

    // Se calcula en el teléfono, leyendo el archivo de a 64 KB (no lo carga entero en memoria).
    md5Parcial: () => parcial().md5,

    promoverParcial() {
      const destino = definitivo();
      if (destino.exists) destino.delete();
      // Mismo directorio: es un renombrado, no una copia, así que o queda entero o no queda.
      parcial().moveSync(destino);
    },

    crearTarea(url, desde, onBytes): TareaDescarga {
      carpeta().create({ intermediates: true, idempotent: true });
      const opciones = { onProgress: ({ bytesWritten }: DownloadProgress) => onBytes(bytesWritten) };
      // Para continuar se le dice a la tarea cuántos bytes hay: pide `Range: bytes=<desde>-` y añade al final.
      // Si el servidor no soporta `Range` (responde 200), la tarea reinicia desde cero por su cuenta.
      const tarea =
        desde > 0
          ? DownloadTask.fromSavable(
              { url, fileUri: parcial().uri, isDirectory: false, resumeData: String(desde) },
              opciones,
            )
          : File.createDownloadTask(url, parcial(), opciones);

      return {
        async ejecutar() {
          const archivo = desde > 0 ? await tarea.resumeAsync() : await tarea.downloadAsync();
          // `null` = la tarea se pausó antes de terminar.
          return archivo === null ? 'pausada' : 'completa';
        },
        pausar: () => tarea.pauseAsync(),
        cancelar: () => tarea.cancel(),
      };
    },
  };
}
