import Constants from 'expo-constants';

import { fetchConTiempoMaximo } from '@/datos/red';
import type { Idioma } from '@/i18n/traducir';
import { NOMBRE_APP } from '@/marca';

import { FORMULARIO_REPORTES, type FormularioReportes } from './config';

/** Lo que se envía al reportar una respuesta de la IA: solo esa respuesta y con qué se generó. Nada más. */
export interface Reporte {
  texto: string;
  idioma: Idioma;
  modelo: string;
}

/** Un reporte no necesita más (un informe ronda los 1500 caracteres); así no se manda nada desmesurado. */
export const MAX_CARACTERES_REPORTE = 8000;
/** Más que esto sin respuesta y se da por no enviado. */
const TIEMPO_MAXIMO_REPORTE_MS = 15_000;

/** ¿Hay un formulario de Google Forms puesto en `config.ts`? Sin él, reportar solo oculta la respuesta. */
export function formularioConfigurado(formulario: FormularioReportes = FORMULARIO_REPORTES): boolean {
  return formulario.url.startsWith('https://') && formulario.campo.startsWith('entry.');
}

/** El texto que llega al formulario: una cabecera para saber de qué versión viene y la respuesta reportada. */
export function cuerpoDelReporte(reporte: Reporte, version = Constants.expoConfig?.version ?? '?'): string {
  const cabecera = `${NOMBRE_APP} ${version} · ${reporte.idioma} · ${reporte.modelo}`;
  return `${cabecera}\n\n${reporte.texto.slice(0, MAX_CARACTERES_REPORTE)}`;
}

/**
 * Envía el reporte al formulario sin salir de la app (Google Play lo exige para el contenido generado con IA). Rechaza si
 * no se pudo: sin conexión, tiempo agotado o el formulario respondió con un error.
 */
export async function enviarReporte(
  reporte: Reporte,
  formulario: FormularioReportes = FORMULARIO_REPORTES,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  if (!formularioConfigurado(formulario)) throw new Error('No hay formulario de reportes configurado');
  const cuerpo = `${encodeURIComponent(formulario.campo)}=${encodeURIComponent(cuerpoDelReporte(reporte))}`;
  const respuesta = await fetchConTiempoMaximo(
    fetchFn,
    formulario.url,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: cuerpo },
    TIEMPO_MAXIMO_REPORTE_MS,
  );
  if (!respuesta.ok) throw new Error(`El formulario respondió ${respuesta.status}`);
}
