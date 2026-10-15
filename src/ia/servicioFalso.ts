import type { MensajeIA } from '@/dominio/promptIA';

import type { ResultadoDescarga } from './descargaModelo';
import type { EvaluacionIA, Generacion, InfoModelo, ServicioIA } from './tipos';

/** Un error con el `code` de la librería real (`ModelError`), para probar los mensajes. */
export class ErrorFalso extends Error {
  constructor(
    public code: string,
    mensaje?: string,
  ) {
    super(mensaje ?? code);
  }
}

export interface OpcionesServicioFalso {
  evaluacion?: EvaluacionIA;
  /** Milisegundos entre pasos (progreso de la descarga, trozos de texto). 0 = todo seguido, sin esperas. */
  pasoMs?: number;
  /** Texto que «genera» la IA. */
  informe?: string;
  /**
   * Códigos de error de la librería. Cada uno salta **una sola vez** (el siguiente intento sale bien): el de `descargar`
   * a mitad de la descarga (un corte de red: lo descargado se conserva y se continúa), y los de `cargar` y `generar`
   * al empezar. Con `mensajes` se les pone el texto que daría el motor.
   */
  fallos?: { descargar?: string; cargar?: string; generar?: string };
  /** El texto del motor para cada fallo de `fallos` (por defecto, el propio código). */
  mensajes?: { descargar?: string; cargar?: string; generar?: string };
}

export const MODELO_FALSO: InfoModelo = { id: 'falso', nombre: 'Gemma 4 E2B', tamanoBytes: 2_588_147_712 };

export const INFORME_FALSO =
  'Este mes gastaste más en comida y en suscripciones de lo que ingresaste en extras. En general vas bien, pero hay margen para ahorrar.\n' +
  '• Revisa tus suscripciones: cancelar la que menos uses te ahorraría dinero cada mes.\n' +
  '• Reduce las compras pequeñas de café: a la mitad serían unos cuantos soles al mes.\n' +
  '• Pon un tope semanal a la comida fuera de casa y revísalo los domingos.';

const esperar = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

const PASOS_DESCARGA = 10;

/**
 * IA falsa para pruebas y para la vista previa web: simula la descarga (pausable, con progreso y verificación), la
 * carga y la generación en streaming, y deja inyectar errores. Tiene el mismo contrato que la real.
 */
export function crearServicioFalso(
  opciones: OpcionesServicioFalso = {},
): ServicioIA & { descargado: boolean; parcialBytes: number } {
  const pasoMs = opciones.pasoMs ?? 0;
  const tamano = MODELO_FALSO.tamanoBytes;
  let evaluacion: EvaluacionIA = opciones.evaluacion ?? {
    compatible: true,
    descargado: false,
    parcialBytes: 0,
    cargado: false,
    ramBytes: 17_179_869_184,
    ramJusta: false,
    discoLibreBytes: 50_000_000_000,
  };
  // Lo que hay descargado a medias: se conserva entre cortes y pausas, como el archivo parcial real.
  let parcial = evaluacion.compatible ? evaluacion.parcialBytes : 0;
  let enCurso = false;
  let pausaPedida = false;
  let descartada = false;
  let falloPendiente = opciones.fallos?.descargar;
  let falloCargarPendiente = opciones.fallos?.cargar;
  let falloGenerarPendiente = opciones.fallos?.generar;

  const cambiar = (cambios: { descargado?: boolean; cargado?: boolean }) => {
    if (evaluacion.compatible) evaluacion = { ...evaluacion, ...cambios };
  };

  return {
    modelo: MODELO_FALSO,
    get descargado() {
      return evaluacion.compatible && evaluacion.descargado;
    },
    get parcialBytes() {
      return parcial;
    },

    async evaluar() {
      await esperar(pasoMs);
      return evaluacion.compatible ? { ...evaluacion, parcialBytes: evaluacion.descargado ? 0 : parcial } : evaluacion;
    },

    async descargar(onProgreso, onVerificando): Promise<ResultadoDescarga> {
      enCurso = true;
      pausaPedida = false;
      descartada = false;
      try {
        const primero = Math.floor((parcial / tamano) * PASOS_DESCARGA) + 1;
        for (let i = primero; i <= PASOS_DESCARGA; i += 1) {
          await esperar(pasoMs);
          if (descartada) {
            parcial = 0;
            throw new ErrorFalso('DOWNLOAD_CANCELLED');
          }
          if (pausaPedida) return 'pausada';
          if (falloPendiente && i === 5) {
            const codigo = falloPendiente;
            falloPendiente = undefined;
            throw new ErrorFalso(codigo, opciones.mensajes?.descargar);
          }
          parcial = Math.round((i / PASOS_DESCARGA) * tamano);
          onProgreso(i / PASOS_DESCARGA);
        }
        onVerificando?.();
        await esperar(pasoMs);
        parcial = 0;
        cambiar({ descargado: true });
        return 'completa';
      } finally {
        enCurso = false;
      }
    },

    async pausarDescarga() {
      pausaPedida = true;
    },

    async cancelarDescarga() {
      if (enCurso) descartada = true;
      else parcial = 0;
    },

    async eliminar() {
      parcial = 0;
      cambiar({ descargado: false, cargado: false });
    },

    async cargar() {
      await esperar(pasoMs);
      if (falloCargarPendiente) {
        const codigo = falloCargarPendiente;
        falloCargarPendiente = undefined;
        throw new ErrorFalso(codigo, opciones.mensajes?.cargar);
      }
      cambiar({ cargado: true });
    },

    generar(_mensajes: MensajeIA[], onTexto): Generacion {
      let detenida = false;
      const texto = opciones.informe ?? INFORME_FALSO;
      const promesa = (async () => {
        await esperar(pasoMs);
        if (falloGenerarPendiente) {
          const codigo = falloGenerarPendiente;
          falloGenerarPendiente = undefined;
          throw new ErrorFalso(codigo, opciones.mensajes?.generar);
        }
        let acumulado = '';
        const palabras = texto.split(' ');
        for (let i = 0; i < palabras.length; i += 1) {
          if (detenida) break;
          acumulado += i === 0 ? palabras[i] : ` ${palabras[i]}`;
          onTexto(acumulado);
          await esperar(pasoMs);
        }
        return acumulado;
      })();
      return {
        promesa,
        detener: () => {
          detenida = true;
        },
      };
    },

    async liberar() {
      cambiar({ cargado: false });
    },
  };
}
