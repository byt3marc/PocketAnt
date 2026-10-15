import * as Device from 'expo-device';
import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { crearArchivosModelo } from './archivosModeloExpo';
import { MODELO, RAM_HOLGADA_BYTES, RAM_MINIMA_BYTES } from './config';
import { crearDescarga, ErrorDescarga, type Descarga } from './descargaModelo';
import type { EvaluacionIA, Generacion, InfoModelo, ServicioIA } from './tipos';

export const MODELO_GEMMA: InfoModelo = {
  id: MODELO.id,
  nombre: MODELO.nombre,
  tamanoBytes: MODELO.tamanoBytes,
};

/** Respuestas más estables: es un informe con cifras, no una conversación creativa. */
const GENERACION = { temperature: 0.3, topK: 40, topP: 0.9 } as const;

/**
 * Siempre en CPU. Con `auto` la librería prueba primero la GPU y solo cae a CPU si falla al *inicializar*; el motor
 * (LiteRT-LM 0.10.0) puede inicializar la GPU sin OpenCL y fallar en la primera generación (LiteRT-LM #1860, #1850,
 * #2421), algo habitual en teléfonos Qualcomm. La CPU anda en cualquier teléfono: ~15–50 palabras por segundo.
 */
const BACKEND = 'cpu';

// La librería se carga al usarla, no al abrir la app: así un build sin el módulo nativo (o la web) no se rompe. Es un
// `require` diferido (y no `import()`) para que funcione igual en Metro y en Jest.
const libreria = (): Promise<typeof import('expo-ai-kit')> =>
  new Promise((resolver, rechazar) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      resolver(require('expo-ai-kit'));
    } catch (error) {
      rechazar(error);
    }
  });

function leerDisco(): number | null {
  try {
    const libre = Paths.availableDiskSpace;
    return Number.isFinite(libre) ? libre : null;
  } catch {
    return null;
  }
}

/**
 * IA local con `expo-ai-kit` (LiteRT-LM). El modelo se descarga con `descargaModelo` (pausable y comprobada) y la
 * librería solo lo carga y lo ejecuta: para ella el archivo aparece de golpe, ya entero y verificado, en su carpeta.
 */
export function crearServicioExpoAiKit(): ServicioIA {
  const archivos = crearArchivosModelo(MODELO.id);
  let descarga: Descarga | null = null;

  return {
    modelo: MODELO_GEMMA,

    async evaluar(): Promise<EvaluacionIA> {
      const ramBytes = Device.totalMemory;
      // Solo Android por ahora: el motor también corre en iOS, pero no se ha probado ahí.
      if (Platform.OS !== 'android') return { compatible: false, motivo: 'plataforma', ramBytes };
      if (ramBytes !== null && ramBytes < RAM_MINIMA_BYTES) return { compatible: false, motivo: 'ram', ramBytes };

      try {
        const catalogo = await (await libreria()).getDownloadableModels();
        const modelo = catalogo.find((m) => m.id === MODELO.id);
        if (!modelo) return { compatible: false, motivo: 'generico', ramBytes };
        if (!modelo.meetsRequirements) return { compatible: false, motivo: 'ram', ramBytes };
        const descargado = modelo.status === 'downloaded' || modelo.status === 'loading' || modelo.status === 'ready';
        return {
          compatible: true,
          descargado,
          parcialBytes: descargado ? 0 : archivos.tamanoParcial(),
          cargado: modelo.status === 'ready',
          ramBytes,
          ramJusta: ramBytes !== null && ramBytes < RAM_HOLGADA_BYTES,
          discoLibreBytes: leerDisco(),
        };
      } catch {
        // Sin el módulo nativo (build sin `llm`) o error del motor: se queda solo el análisis por reglas.
        return { compatible: false, motivo: 'generico', ramBytes };
      }
    },

    async descargar(onProgreso, onVerificando) {
      const actual = crearDescarga(archivos, MODELO);
      descarga = actual;
      try {
        const resultado = await actual.iniciar(onProgreso, onVerificando);
        if (resultado === 'completa') {
          // La librería debe ver el archivo en su sitio; si no (cambió dónde lo busca), no se deja a medias.
          const kit = await libreria();
          const modelo = (await kit.getDownloadableModels()).find((m) => m.id === MODELO.id);
          if (modelo?.status !== 'downloaded') {
            await kit.deleteModel(MODELO.id);
            throw new ErrorDescarga('DOWNLOAD_FAILED', 'expo-ai-kit no reconoce el archivo descargado');
          }
        }
        return resultado;
      } finally {
        if (descarga === actual) descarga = null;
      }
    },

    async pausarDescarga() {
      await descarga?.pausar();
    },

    async cancelarDescarga() {
      if (descarga) descarga.descartar();
      else archivos.borrarParcial();
    },

    async eliminar() {
      // `deleteModel` borra el modelo y el `.tmp` de la librería, que es el mismo parcial de arriba.
      await (await libreria()).deleteModel(MODELO.id);
      archivos.borrarParcial();
    },

    async cargar() {
      await (await libreria()).setModel(MODELO.id, { backend: BACKEND, generation: GENERACION });
    },

    generar(mensajes, onTexto): Generacion {
      let detener = () => {};
      // Si piden detener antes de que el motor haya arrancado, se detiene en cuanto arranca.
      let detenerPedido = false;
      const promesa = libreria().then((kit) => {
        const flujo = kit.streamMessage(mensajes, (evento) => onTexto(evento.accumulatedText));
        detener = flujo.stop;
        if (detenerPedido) flujo.stop();
        return flujo.promise.then((respuesta) => respuesta.text);
      });
      return {
        promesa,
        detener: () => {
          detenerPedido = true;
          detener();
        },
      };
    },

    async liberar() {
      await (await libreria()).unloadModel();
    },
  };
}
