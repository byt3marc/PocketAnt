import type { ErrorTraducido } from './tipos';

/** Lo máximo que se muestra del motivo técnico: suficiente para entender, sin llenar la pantalla. */
const MAX_DETALLE = 300;

function codigoDe(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
}

function mensajeDe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as { message: unknown }).message);
  return '';
}

/**
 * El motivo técnico de un error, para mostrarlo en el aviso: `CODIGO: lo que dijo el motor`. Expo envuelve los
 * errores nativos («Call to function 'X' has been rejected. → Caused by: java.lang.RuntimeException: …»): se queda
 * con lo que viene después del último «Caused by:» y sin el nombre de la clase de Java.
 */
export function detalleDeError(error: unknown): string {
  let texto = mensajeDe(error);
  const causa = texto.lastIndexOf('Caused by:');
  if (causa >= 0) texto = texto.slice(causa + 'Caused by:'.length);
  texto = texto
    .replace(/^\s*(?:[\w$]+\.)+[\w$]*(?:Exception|Error):\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const codigo = codigoDe(error);
  if (codigo && codigo !== 'undefined' && !texto.startsWith(codigo)) {
    texto = texto ? `${codigo}: ${texto}` : codigo;
  }
  return texto.length > MAX_DETALLE ? `${texto.slice(0, MAX_DETALLE - 1)}…` : texto;
}

/**
 * Convierte un error de la librería de IA (`ModelError`, con un `code`) en un texto para el usuario y en el motivo
 * técnico (`detalle`). Se lee el `code` sin importar la clase para no depender del módulo nativo (en pruebas y en la web).
 */
export function traducirErrorIA(error: unknown): ErrorTraducido {
  const detalle = detalleDeError(error);
  const resultado = (cancelado: boolean, clave: ErrorTraducido['clave']): ErrorTraducido => ({ cancelado, clave, detalle });

  switch (codigoDe(error)) {
    case 'DOWNLOAD_CANCELLED':
    case 'INFERENCE_CANCELLED':
      return resultado(true, 'ia.error_desconocido');
    case 'DOWNLOAD_FAILED':
      return resultado(false, 'ia.error_descarga');
    case 'DOWNLOAD_STORAGE_FULL':
      return resultado(false, 'ia.error_disco');
    case 'DOWNLOAD_CORRUPT':
      return resultado(false, 'ia.error_corrupto');
    case 'DOWNLOAD_UNVERIFIED':
      return resultado(false, 'ia.error_verificar');
    case 'MODEL_LOAD_FAILED':
    case 'MODEL_NOT_DOWNLOADED':
    case 'MODEL_NOT_FOUND':
      return resultado(false, 'ia.error_carga');
    case 'INFERENCE_OOM':
      return resultado(false, 'ia.error_memoria');
    case 'INFERENCE_BUSY':
      return resultado(false, 'ia.error_ocupado');
    case 'INFERENCE_FAILED':
      return resultado(false, 'ia.error_generar');
    case 'DEVICE_NOT_SUPPORTED':
    case 'LLM_NOT_ENABLED':
      return resultado(false, 'ia.no_compatible_generico');
    default:
      return resultado(false, 'ia.error_desconocido');
  }
}
