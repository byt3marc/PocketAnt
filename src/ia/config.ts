/**
 * RAM mínima para ofrecer el modelo. `Device.totalMemory` es lo que ve el kernel, algo menos de lo que
 * anuncia el fabricante: un teléfono de «4 GB» marca ~3.5–3.9e9 bytes. Por debajo, no se ofrece.
 */
export const RAM_MINIMA_BYTES = 3_500_000_000;
/** Cómo se le dice al usuario ese mínimo («al menos 4 GB»). */
export const RAM_MINIMA_ETIQUETA = '4 GB';
/** Entre el mínimo y esto se ofrece, pero avisando de que va justo (un «6 GB» marca ~5.5e9). */
export const RAM_HOLGADA_BYTES = 5_400_000_000;

/**
 * Correo al que se envía una respuesta de la IA reportada. Vacío = el reporte solo oculta la respuesta en el
 * teléfono. Antes de publicar en Google Play hay que poner aquí un canal real (la política de contenido
 * generado por IA pide poder reportar dentro de la app).
 */
export const CORREO_REPORTES = '';

/**
 * El modelo que se ofrece: Gemma 4 E2B en formato LiteRT-LM (el nombre se muestra igual en todos los idiomas).
 * La URL lleva el commit del repositorio en Hugging Face, así el archivo no cambia aunque lo actualicen.
 * El tamaño y el MD5 son los de ese archivo; su SHA-256 (`181938105e0e…a63c`) coincide con el que fija
 * `expo-ai-kit` para `gemma-e2b`.
 */
export const MODELO = {
  /** Id en el catálogo de `expo-ai-kit`; también da nombre al archivo (`<id>.litertlm`) en `files/models/`. */
  id: 'gemma-e2b',
  nombre: 'Gemma 4 E2B',
  url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1/gemma-4-E2B-it.litertlm',
  tamanoBytes: 2_588_147_712,
  md5: '1b8446203a216cfd31f6a2a22f75e5e5',
} as const;
