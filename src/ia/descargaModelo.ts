/**
 * Descarga del modelo que se puede pausar y continuar, con el archivo comprobado antes de usarlo.
 *
 * La librería de IA baja el modelo de una sola vez: si se corta, empieza de cero (2.6 GB) y, aun así, no
 * revisa que el archivo esté entero al abrir la app. Aquí se descarga a un archivo parcial que se conserva
 * entre cortes y cierres de la app, se continúa con una petición `Range` desde lo que ya hay, y **solo** cuando
 * el archivo tiene el tamaño exacto y el MD5 esperado se mueve a su lugar definitivo. Mientras tanto, para la
 * librería el modelo «no existe», así que nunca puede cargar un archivo a medias.
 */

export interface EspecModelo {
  /** URL fija (con la versión del repositorio) del archivo del modelo. */
  url: string;
  /** Tamaño exacto del archivo, en bytes. */
  tamanoBytes: number;
  /** MD5 del archivo completo, en minúsculas. */
  md5: string;
}

export type ResultadoDescarga = 'completa' | 'pausada';

/** Una transferencia en curso. */
export interface TareaDescarga {
  /** Descarga hasta terminar (`completa`) o hasta que se pause (`pausada`). Rechaza si la red falla. */
  ejecutar: () => Promise<ResultadoDescarga>;
  /** Detiene la transferencia conservando lo descargado. */
  pausar: () => Promise<void>;
  /** Aborta la transferencia. */
  cancelar: () => void;
}

/** Lo que la descarga necesita del disco. En la app lo implementa `expo-file-system`. */
export interface ArchivosModelo {
  /** Bytes que tiene el archivo parcial (0 si no existe). */
  tamanoParcial: () => number;
  borrarParcial: () => void;
  /** MD5 del archivo parcial, o `null` si no se pudo calcular. */
  md5Parcial: () => string | null;
  /** Mueve el parcial a su lugar definitivo. */
  promoverParcial: () => void;
  /** `desde` bytes ya descargados: 0 empieza de cero y más de 0 continúa con una petición `Range`. */
  crearTarea: (url: string, desde: number, onBytes: (bytes: number) => void) => TareaDescarga;
}

/** Error con un `code` como los de la librería de IA, para que `traducirErrorIA` lo entienda. */
export class ErrorDescarga extends Error {
  constructor(
    public code: 'DOWNLOAD_FAILED' | 'DOWNLOAD_CORRUPT' | 'DOWNLOAD_CANCELLED' | 'DOWNLOAD_STORAGE_FULL',
    mensaje?: string,
  ) {
    super(mensaje ?? code);
  }
}

/** Convierte lo que lance la transferencia en un error con código (sin sobrescribir los que ya lo tienen). */
export function aErrorDescarga(error: unknown): ErrorDescarga {
  if (error instanceof ErrorDescarga) return error;
  const texto = error instanceof Error ? error.message : String(error);
  if (/ENOSPC|No space left|not enough space|espacio/i.test(texto)) {
    return new ErrorDescarga('DOWNLOAD_STORAGE_FULL', texto);
  }
  return new ErrorDescarga('DOWNLOAD_FAILED', texto);
}

export interface Descarga {
  /**
   * Empieza o continúa. `onProgreso` recibe la fracción (0–1); `onVerificando` se llama cuando ya se bajó todo y se
   * comprueba el archivo. Resuelve `completa` (archivo verificado y en su sitio) o `pausada`.
   * Rechaza con `ErrorDescarga`: `DOWNLOAD_FAILED` (se corta, lo descargado se conserva), `DOWNLOAD_CORRUPT`
   * (el archivo no coincide: se borra) o `DOWNLOAD_CANCELLED` (se descartó).
   */
  iniciar: (onProgreso: (fraccion: number) => void, onVerificando?: () => void) => Promise<ResultadoDescarga>;
  /** Detiene la descarga conservando lo descargado. */
  pausar: () => Promise<void>;
  /** Cancela y **borra** lo descargado. Sirve también cuando no hay nada en curso (descarga pausada). */
  descartar: () => void;
}

/** Deja que la pantalla se repinte antes de un trabajo largo que bloquea el hilo de JavaScript (el MD5). */
const cederPasoPorDefecto = () => new Promise<void>((resolver) => setTimeout(resolver, 60));

export function crearDescarga(
  archivos: ArchivosModelo,
  espec: EspecModelo,
  cederPaso: () => Promise<void> = cederPasoPorDefecto,
): Descarga {
  let tarea: TareaDescarga | null = null;
  let pausaPedida = false;
  let descartada = false;

  const fraccion = (bytes: number) => Math.min(1, Math.max(0, bytes / espec.tamanoBytes));

  return {
    async iniciar(onProgreso, onVerificando) {
      pausaPedida = false;
      descartada = false;

      let hay = archivos.tamanoParcial();
      // Más grande de lo que debe ser: no sirve para continuar.
      if (hay > espec.tamanoBytes) {
        archivos.borrarParcial();
        hay = 0;
      }
      onProgreso(fraccion(hay));

      if (hay < espec.tamanoBytes) {
        tarea = archivos.crearTarea(espec.url, hay, (bytes) => onProgreso(fraccion(bytes)));
        let resultado: ResultadoDescarga;
        try {
          resultado = await tarea.ejecutar();
        } catch (error) {
          // Cancelar aborta la petición pero no borra el archivo: se borra aquí.
          if (descartada) {
            archivos.borrarParcial();
            throw new ErrorDescarga('DOWNLOAD_CANCELLED');
          }
          throw aErrorDescarga(error);
        } finally {
          tarea = null;
        }
        if (descartada) {
          archivos.borrarParcial();
          throw new ErrorDescarga('DOWNLOAD_CANCELLED');
        }
        if (resultado === 'pausada' || pausaPedida) return 'pausada';
      }

      const tamano = archivos.tamanoParcial();
      if (tamano < espec.tamanoBytes) {
        // Se cortó sin avisar: lo que hay vale para continuar después.
        throw new ErrorDescarga('DOWNLOAD_FAILED', `Descarga incompleta: ${tamano} de ${espec.tamanoBytes} bytes`);
      }
      onVerificando?.();
      await cederPaso();
      if (tamano > espec.tamanoBytes || archivos.md5Parcial()?.toLowerCase() !== espec.md5.toLowerCase()) {
        archivos.borrarParcial();
        throw new ErrorDescarga('DOWNLOAD_CORRUPT');
      }
      archivos.promoverParcial();
      return 'completa';
    },

    async pausar() {
      pausaPedida = true;
      await tarea?.pausar();
    },

    descartar() {
      descartada = true;
      if (tarea) tarea.cancelar();
      else archivos.borrarParcial();
    },
  };
}
