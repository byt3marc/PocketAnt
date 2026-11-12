import { DRIVE_POR_DEFECTO, normalizarDrive, type AjustesDrive } from '@/dominio/ajustesDrive';
import { MAX_COBROS_OMITIDOS } from '@/dominio/cobros';
import { esClaveValida } from '@/dominio/fechas';
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
/** Qué muestra la pantalla «Gráficas e Historial» al abrirla: la última vista que se eligió. */
export type VistaEstadisticas = 'graficas' | 'historial';

export interface Ajustes {
  tema: PreferenciaTema;
  /** `"auto"` (según la región del dispositivo) o un código de moneda como `"PEN"`. */
  moneda: string;
  tipoGrafica: TipoGrafica;
  vistaEstadisticas: VistaEstadisticas;
  /** `"sistema"` (idioma del dispositivo) o `"es"` / `"en"`. */
  idioma: PreferenciaIdioma;
  notificaciones: AjustesNotificaciones;
  /** Sincronización con Google Drive. */
  drive: AjustesDrive;
  /** Fuente del texto de toda la app. */
  fuente: FuenteApp;
  /** Cobros recurrentes que el usuario decidió no anotar (`id|YYYY-MM-DD`), del más antiguo al más reciente. */
  cobrosOmitidos: string[];
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  tema: 'sistema',
  moneda: MONEDA_AUTOMATICA,
  tipoGrafica: 'linea',
  vistaEstadisticas: 'graficas',
  idioma: 'sistema',
  notificaciones: NOTIFICACIONES_POR_DEFECTO,
  drive: DRIVE_POR_DEFECTO,
  fuente: FUENTE_POR_DEFECTO,
  cobrosOmitidos: [],
};

const TEMAS: readonly PreferenciaTema[] = ['sistema', 'claro', 'oscuro'];
const TIPOS_GRAFICA: readonly TipoGrafica[] = ['linea', 'barras', 'area'];
const VISTAS_ESTADISTICAS: readonly VistaEstadisticas[] = ['graficas', 'historial'];

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
    vistaEstadisticas: VISTAS_ESTADISTICAS.includes(datos.vistaEstadisticas as VistaEstadisticas)
      ? (datos.vistaEstadisticas as VistaEstadisticas)
      : AJUSTES_POR_DEFECTO.vistaEstadisticas,
    idioma: esPreferenciaDeIdioma(datos.idioma) ? datos.idioma : AJUSTES_POR_DEFECTO.idioma,
    notificaciones: normalizarNotificaciones(datos.notificaciones),
    drive: normalizarDrive(datos.drive),
    fuente: esFuenteApp(datos.fuente) ? datos.fuente : AJUSTES_POR_DEFECTO.fuente,
    cobrosOmitidos: normalizarCobrosOmitidos(datos.cobrosOmitidos),
  };
}

/** Una clave `id|YYYY-MM-DD` de un cobro omitido. */
function esClaveCobro(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const separador = valor.lastIndexOf('|');
  return separador > 0 && esClaveValida(valor.slice(separador + 1));
}

/** Sin repetidos y solo las 50 más recientes (las últimas de la lista). */
export function normalizarCobrosOmitidos(crudo: unknown): string[] {
  if (!Array.isArray(crudo)) return [];
  const claves: string[] = [];
  for (const valor of crudo) {
    if (!esClaveCobro(valor)) continue;
    const previa = claves.indexOf(valor);
    if (previa !== -1) claves.splice(previa, 1);
    claves.push(valor);
  }
  return claves.slice(-MAX_COBROS_OMITIDOS);
}
