import type { MensajeIA } from '@/dominio/promptIA';
import type { ClaveTexto } from '@/i18n/es';

import type { ResultadoDescarga } from './descargaModelo';

/** Datos fijos del modelo que se ofrece (sirven para los textos antes de consultar nada al teléfono). */
export interface InfoModelo {
  id: string;
  nombre: string;
  /** Tamaño exacto de la descarga, en bytes. */
  tamanoBytes: number;
}

export type MotivoNoCompatible = 'plataforma' | 'ram' | 'generico';

/** Lo que se sabe del teléfono y del modelo antes de ofrecer la descarga. */
export type EvaluacionIA =
  | {
      compatible: false;
      motivo: MotivoNoCompatible;
      /** RAM total en bytes, si se pudo leer. */
      ramBytes: number | null;
    }
  | {
      compatible: true;
      /** El archivo del modelo ya está en el teléfono, completo y comprobado. */
      descargado: boolean;
      /** Bytes de una descarga a medias (pausada o cortada) que se pueden continuar; 0 si no hay. */
      parcialBytes: number;
      /** El modelo ya está cargado en memoria y listo para generar. */
      cargado: boolean;
      ramBytes: number | null;
      /** La RAM alcanza, pero va justa: hay que avisar. */
      ramJusta: boolean;
      /** Espacio libre en el almacenamiento, si se pudo leer. */
      discoLibreBytes: number | null;
    };

export interface Generacion {
  /** Se resuelve con el texto completo (o el acumulado si se detuvo). */
  promesa: Promise<string>;
  detener: () => void;
}

/**
 * Lo único que la app necesita de una IA local. Detrás hay `expo-ai-kit` (Gemma 4 con LiteRT-LM), pero
 * las pantallas y las pruebas solo conocen esta interfaz.
 */
export interface ServicioIA {
  modelo: InfoModelo;
  evaluar: () => Promise<EvaluacionIA>;
  /**
   * Descarga o continúa la descarga. `onProgreso` recibe una fracción de 0 a 1 y `onVerificando` avisa de que ya se
   * bajó todo y se está comprobando el archivo. Resuelve `completa` o `pausada`; si la red falla, rechaza pero **lo
   * descargado se conserva** para continuar.
   */
  descargar: (onProgreso: (fraccion: number) => void, onVerificando?: () => void) => Promise<ResultadoDescarga>;
  /** Detiene la descarga conservando lo descargado. */
  pausarDescarga: () => Promise<void>;
  /** Cancela y **borra** lo descargado. */
  cancelarDescarga: () => Promise<void>;
  /** Borra el archivo del modelo del teléfono. */
  eliminar: () => Promise<void>;
  /** Carga el modelo en memoria. */
  cargar: () => Promise<void>;
  /** `onTexto` recibe el texto acumulado cada vez que llega un trozo. */
  generar: (mensajes: MensajeIA[], onTexto: (acumulado: string) => void) => Generacion;
  /** Saca el modelo de la memoria (el archivo sigue en disco). */
  liberar: () => Promise<void>;
}

export interface ErrorTraducido {
  /** El usuario canceló (descarga o generación): no es un fallo. */
  cancelado: boolean;
  clave: ClaveTexto;
  /** El motivo técnico (`CODIGO: lo que dijo el motor`), para mostrarlo en el aviso de error. */
  detalle: string;
}
