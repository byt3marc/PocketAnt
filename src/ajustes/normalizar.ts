import { DRIVE_POR_DEFECTO, normalizarDrive, type AjustesDrive } from '@/dominio/ajustesDrive';
import {
  normalizarNotificaciones,
  NOTIFICACIONES_POR_DEFECTO,
  type AjustesNotificaciones,
} from '@/dominio/ajustesNotificaciones';
import { esAjusteDeMonedaValido, MONEDA_AUTOMATICA } from '@/dominio/moneda';
import { esPreferenciaDeIdioma, type PreferenciaIdioma } from '@/i18n/traducir';
import { esFuenteApp, FUENTE_POR_DEFECTO, type FuenteApp } from '@/tema/fuentes';

export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro';
export type TipoGrafica = 'linea' | 'barras' | 'area';

export interface Ajustes {
  tema: PreferenciaTema;
  /** `"auto"` (según la región del dispositivo) o un código de moneda como `"PEN"`. */
  moneda: string;
  tipoGrafica: TipoGrafica;
  /** `"sistema"` (idioma del dispositivo) o `"es"` / `"en"`. */
  idioma: PreferenciaIdioma;
  notificaciones: AjustesNotificaciones;
  /** Sincronización con Google Drive. */
  drive: AjustesDrive;
  /** Fuente del texto de toda la app. */
  fuente: FuenteApp;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  tema: 'sistema',
  moneda: MONEDA_AUTOMATICA,
  tipoGrafica: 'linea',
  idioma: 'sistema',
  notificaciones: NOTIFICACIONES_POR_DEFECTO,
  drive: DRIVE_POR_DEFECTO,
  fuente: FUENTE_POR_DEFECTO,
};

const TEMAS: readonly PreferenciaTema[] = ['sistema', 'claro', 'oscuro'];
const TIPOS_GRAFICA: readonly TipoGrafica[] = ['linea', 'barras', 'area'];

/** Convierte lo que haya guardado (posiblemente incompleto o de una versión vieja) en ajustes válidos. */
export function normalizarAjustes(crudo: unknown): Ajustes {
  const datos = typeof crudo === 'object' && crudo !== null ? (crudo as Record<string, unknown>) : {};
  return {
    tema: TEMAS.includes(datos.tema as PreferenciaTema)
      ? (datos.tema as PreferenciaTema)
      : AJUSTES_POR_DEFECTO.tema,
    moneda: esAjusteDeMonedaValido(datos.moneda) ? datos.moneda : AJUSTES_POR_DEFECTO.moneda,
    tipoGrafica: TIPOS_GRAFICA.includes(datos.tipoGrafica as TipoGrafica)
      ? (datos.tipoGrafica as TipoGrafica)
      : AJUSTES_POR_DEFECTO.tipoGrafica,
    idioma: esPreferenciaDeIdioma(datos.idioma) ? datos.idioma : AJUSTES_POR_DEFECTO.idioma,
    notificaciones: normalizarNotificaciones(datos.notificaciones),
    drive: normalizarDrive(datos.drive),
    fuente: esFuenteApp(datos.fuente) ? datos.fuente : AJUSTES_POR_DEFECTO.fuente,
  };
}
