import { DIAS_PLURALES } from '@/i18n/calendario';
import type { Idioma } from '@/i18n/traducir';

import type { HechosAnalisis } from './analisis';

export interface MensajeIA {
  role: 'system' | 'user';
  content: string;
}

type Formatear = (valor: number) => string;

/** Cuántos motivos y cobros fijos se le cuentan a la IA como máximo (el contexto del modelo es corto). */
const MAX_MOTIVOS_PROMPT = 8;
const MAX_LARGO_MOTIVO = 40;

/**
 * Los motivos los escribe el usuario: se dejan en una sola línea, sin comillas ni caracteres de control y con
 * un largo máximo, para que no puedan romper el formato de los datos ni colarse como instrucciones.
 */
export function limpiarMotivo(motivo: string): string {
  const limpio = motivo
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/["“”«»`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return limpio.length > MAX_LARGO_MOTIVO ? `${limpio.slice(0, MAX_LARGO_MOTIVO - 1)}…` : limpio || '—';
}

const INSTRUCCIONES: Record<Idioma, string> = {
  es: [
    'Eres un asistente de finanzas personales dentro de una app de control de gastos.',
    'Responde SIEMPRE en español, con un tono cercano y claro.',
    'Usa SOLO los datos que te doy: no inventes cifras ni supongas datos que no aparecen. Si algo no está en los datos, no lo menciones.',
    'No des consejos de inversión ni legales.',
    'Formato: primero un resumen de 2 o 3 frases; después EXACTAMENTE 3 recomendaciones, cada una en su propia línea que empiece con «• » y sea concreta y accionable (qué hacer y, si hay datos, cuánto se podría ahorrar).',
    'Sin títulos, sin tablas, sin emojis y en menos de 150 palabras.',
  ].join(' '),
  en: [
    'You are a personal finance assistant inside a spending tracker app.',
    'ALWAYS answer in English, in a friendly and clear tone.',
    'Use ONLY the data I give you: do not invent figures or assume data that is not there. If something is not in the data, do not mention it.',
    'Do not give investment or legal advice.',
    'Format: first a summary of 2 or 3 sentences; then EXACTLY 3 recommendations, each on its own line starting with “• ” and being concrete and actionable (what to do and, if the data allows, how much could be saved).',
    'No headings, no tables, no emojis, and fewer than 150 words.',
  ].join(' '),
};

interface Etiquetas {
  periodo: (dias: number, desde: string, hasta: string) => string;
  ingresos: string;
  gastos: (n: number) => string;
  balance: (neto: string, ahorro: number | null) => string;
  tendencia: (porcentaje: number, diferencia: string) => string;
  sinBase: string;
  motivos: string;
  motivo: (motivo: string, total: string, porcentaje: number, veces: number) => string;
  suscripciones: (mensual: string, anual: string) => string;
  suscripcion: (motivo: string, mensual: string, marcada: boolean) => string;
  sinSuscripciones: string;
  hormiga: (n: number, umbral: string, total: string, porcentaje: number) => string;
  hormigaFrecuente: (motivo: string, veces: number) => string;
  sinHormiga: string;
  dia: (dia: string, porcentaje: number) => string;
  cierre: string;
}

const ETIQUETAS: Record<Idioma, Etiquetas> = {
  es: {
    periodo: (dias, desde, hasta) => `Periodo analizado: últimos ${dias} días (${desde} a ${hasta}). Las cifras ya están en la moneda del usuario.`,
    ingresos: 'Ingresos',
    gastos: (n) => `Gastos (${n} en total)`,
    balance: (neto, ahorro) =>
      `Balance: ${neto}${ahorro === null ? ' (no hay ingresos registrados en el periodo)' : `; ahorro: ${ahorro}% de los ingresos`}`,
    tendencia: (porcentaje, diferencia) =>
      `Gastos frente a los días anteriores: ${porcentaje > 0 ? '+' : ''}${porcentaje}% (${diferencia})`,
    sinBase: 'Gastos frente a los días anteriores: sin datos para comparar',
    motivos: 'En qué se gasta más:',
    motivo: (motivo, total, porcentaje, veces) => `- '${motivo}': ${total} (${porcentaje}% de los gastos, ${veces} ${veces === 1 ? 'vez' : 'veces'})`,
    suscripciones: (mensual, anual) => `Suscripciones y cobros fijos (total ${mensual} al mes, ${anual} al año):`,
    suscripcion: (motivo, mensual, marcada) => `- '${motivo}': ${mensual} al mes (${marcada ? 'marcada como recurrente' : 'se repite cada mes'})`,
    sinSuscripciones: 'Suscripciones y cobros fijos: ninguno encontrado',
    hormiga: (n, umbral, total, porcentaje) =>
      `Gasto hormiga: ${n} compras de hasta ${umbral} sumaron ${total} (${porcentaje}% de los gastos)`,
    hormigaFrecuente: (motivo, veces) => `La compra pequeña que más se repite: '${motivo}' (${veces} veces)`,
    sinHormiga: 'Gasto hormiga: no hay compras pequeñas que se repitan mucho',
    dia: (dia, porcentaje) => `Día de la semana con más gasto: ${dia} (${porcentaje}% de los gastos)`,
    cierre: 'Con solo estos datos, escribe el informe.',
  },
  en: {
    periodo: (dias, desde, hasta) => `Period analyzed: last ${dias} days (${desde} to ${hasta}). Figures are already in the user's currency.`,
    ingresos: 'Income',
    gastos: (n) => `Expenses (${n} in total)`,
    balance: (neto, ahorro) =>
      `Balance: ${neto}${ahorro === null ? ' (no income recorded in the period)' : `; savings: ${ahorro}% of income`}`,
    tendencia: (porcentaje, diferencia) =>
      `Expenses compared with the previous days: ${porcentaje > 0 ? '+' : ''}${porcentaje}% (${diferencia})`,
    sinBase: 'Expenses compared with the previous days: no data to compare',
    motivos: 'Where most of the money goes:',
    motivo: (motivo, total, porcentaje, veces) => `- '${motivo}': ${total} (${porcentaje}% of expenses, ${veces} ${veces === 1 ? 'time' : 'times'})`,
    suscripciones: (mensual, anual) => `Subscriptions and fixed charges (total ${mensual} a month, ${anual} a year):`,
    suscripcion: (motivo, mensual, marcada) => `- '${motivo}': ${mensual} a month (${marcada ? 'marked as recurring' : 'repeats every month'})`,
    sinSuscripciones: 'Subscriptions and fixed charges: none found',
    hormiga: (n, umbral, total, porcentaje) =>
      `Small purchases: ${n} purchases of up to ${umbral} added up to ${total} (${porcentaje}% of expenses)`,
    hormigaFrecuente: (motivo, veces) => `Most repeated small purchase: '${motivo}' (${veces} times)`,
    sinHormiga: 'Small purchases: no small purchases that repeat a lot',
    dia: (dia, porcentaje) => `Weekday with the most spending: ${dia} (${porcentaje}% of expenses)`,
    cierre: 'Using only this data, write the report.',
  },
};

/**
 * Mensajes para pedirle a la IA el informe. Solo lleva cifras que `analizar` ya calculó y que ya vienen
 * formateadas: la IA redacta, no calcula. El idioma de las instrucciones y de los datos es el de la app.
 */
export function construirPrompt(hechos: HechosAnalisis, idioma: Idioma, formatear: Formatear): MensajeIA[] {
  const e = ETIQUETAS[idioma];
  const { actual, tendencia } = hechos;
  const lineas: string[] = [
    e.periodo(hechos.dias, actual.desde, actual.hasta),
    `${e.ingresos}: ${formatear(actual.ingresos)}`,
    `${e.gastos(actual.cantidadGastos)}: ${formatear(actual.gastos)}`,
    e.balance(formatear(actual.neto), actual.tasaAhorro === null ? null : Math.round(actual.tasaAhorro)),
    tendencia.porcentaje === null
      ? e.sinBase
      : e.tendencia(Math.round(tendencia.porcentaje), formatear(tendencia.diferencia)),
  ];

  if (hechos.topMotivos.length > 0) {
    lineas.push(e.motivos);
    for (const g of hechos.topMotivos.slice(0, MAX_MOTIVOS_PROMPT)) {
      lineas.push(e.motivo(limpiarMotivo(g.motivo), formatear(g.total), Math.round(g.porcentaje), g.cantidad));
    }
  }

  if (hechos.suscripciones.length > 0) {
    lineas.push(
      e.suscripciones(formatear(hechos.totalSuscripcionesMensual), formatear(hechos.totalSuscripcionesAnual)),
    );
    for (const s of hechos.suscripciones.slice(0, MAX_MOTIVOS_PROMPT)) {
      lineas.push(e.suscripcion(limpiarMotivo(s.motivo), formatear(s.mensual), s.origen === 'marcada'));
    }
  } else {
    lineas.push(e.sinSuscripciones);
  }

  if (hechos.hormiga) {
    const h = hechos.hormiga;
    lineas.push(e.hormiga(h.cantidad, formatear(h.umbral), formatear(h.total), Math.round(h.porcentaje)));
    if (h.masFrecuente) lineas.push(e.hormigaFrecuente(limpiarMotivo(h.masFrecuente.motivo), h.masFrecuente.cantidad));
  } else {
    lineas.push(e.sinHormiga);
  }

  if (hechos.diaMasCaro) {
    lineas.push(e.dia(DIAS_PLURALES[idioma][hechos.diaMasCaro.diaSemana], Math.round(hechos.diaMasCaro.porcentaje)));
  }

  lineas.push('', e.cierre);

  return [
    { role: 'system', content: INSTRUCCIONES[idioma] },
    { role: 'user', content: lineas.join('\n') },
  ];
}

/** Límite de seguridad para el texto de la respuesta (un modelo pequeño a veces no sabe parar). */
export const MAX_CARACTERES_RESPUESTA = 1800;
