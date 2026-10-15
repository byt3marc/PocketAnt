import type { I18n } from '@/i18n/traducir';
import { DIAS_PLURALES } from '@/i18n/calendario';

import { fechaDeClave, hoy, sumarDias } from './fechas';
import { aCentavos, deCentavos } from './saldo';
import type { Movimiento, PeriodoRecurrencia } from './tipos';

/** Días de cada periodo comparado (el actual y el anterior). */
export const DIAS_PERIODO = 30;
/** Ventana para buscar cobros que se repiten sin estar marcados como recurrentes. */
export const DIAS_BUSQUEDA_SUSCRIPCIONES = 180;
/** Ventana para el patrón por día de la semana (más datos = menos azar). */
export const DIAS_PATRON_SEMANAL = 90;

/** Un gasto es «hormiga» si cuesta hasta esta fracción de los ingresos del periodo (si no hay ingresos, hasta la mediana). */
export const FRACCION_HORMIGA = 0.02;
/** Con menos compras pequeñas que estas no se habla de gasto hormiga. */
export const MIN_COMPRAS_HORMIGA = 5;
/** Margen de diferencia entre montos para considerar que un cobro es «el mismo» (±10 %). */
const TOLERANCIA_MONTO = 0.1;
/** Meses distintos que debe repetirse un motivo para sospechar que es una suscripción. */
const MIN_MESES_SUSCRIPCION = 3;
const MIN_GASTOS_PATRON_SEMANAL = 10;
const MAX_MOTIVOS = 5;

export interface ResumenPeriodo {
  desde: string;
  hasta: string;
  ingresos: number;
  gastos: number;
  neto: number;
  /** Cuántos gastos hubo. */
  cantidadGastos: number;
  /** % de los ingresos que no se gastó (puede ser negativo). `null` si no hubo ingresos. */
  tasaAhorro: number | null;
}

export interface GrupoMotivo {
  /** El nombre tal como lo escribió el usuario (el más frecuente del grupo). */
  motivo: string;
  total: number;
  cantidad: number;
  /** % de los gastos del periodo (0–100). */
  porcentaje: number;
}

export interface Suscripcion {
  motivo: string;
  /** Monto de cada cobro. */
  monto: number;
  /** Costo equivalente por mes (un cobro anual cuenta 1/12). */
  mensual: number;
  anual: number;
  /** `marcada`: el usuario la marcó como recurrente. `detectada`: se repite varios meses con monto parecido. */
  origen: 'marcada' | 'detectada';
}

export interface GastoHormiga {
  /** Monto máximo que cuenta como compra pequeña. */
  umbral: number;
  cantidad: number;
  total: number;
  /** % de los gastos del periodo (0–100). */
  porcentaje: number;
  /** El motivo que más veces se repite entre las compras pequeñas, si se repite al menos 3 veces. */
  masFrecuente: GrupoMotivo | null;
}

export interface Tendencia {
  actual: number;
  anterior: number;
  /** Actual menos anterior: positivo = se gastó más. */
  diferencia: number;
  /** Variación en % respecto al periodo anterior. `null` si no hubo gastos antes. */
  porcentaje: number | null;
}

export interface DiaCaro {
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  total: number;
  /** % de los gastos de la ventana (0–100). */
  porcentaje: number;
}

export interface HechosAnalisis {
  hayDatos: boolean;
  dias: number;
  actual: ResumenPeriodo;
  anterior: ResumenPeriodo;
  topMotivos: GrupoMotivo[];
  suscripciones: Suscripcion[];
  totalSuscripcionesMensual: number;
  totalSuscripcionesAnual: number;
  hormiga: GastoHormiga | null;
  tendencia: Tendencia;
  diaMasCaro: DiaCaro | null;
}

/** «Café  », «café» y «CAFÉ» son el mismo motivo. */
export function normalizarMotivo(motivo: string): string {
  return motivo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const entre = (clave: string, desde: string, hasta: string) => clave >= desde && clave <= hasta;

const mediana = (valores: readonly number[]): number => {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[mitad] : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
};

const redondear = (valor: number, decimales = 1) => {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
};

function resumir(movimientos: readonly Movimiento[], desde: string, hasta: string): ResumenPeriodo {
  let ingresos = 0;
  let gastos = 0;
  let cantidadGastos = 0;
  for (const m of movimientos) {
    if (!entre(m.fecha, desde, hasta)) continue;
    if (m.tipo === 'ingreso') {
      ingresos += aCentavos(m.monto);
    } else {
      gastos += aCentavos(m.monto);
      cantidadGastos += 1;
    }
  }
  return {
    desde,
    hasta,
    ingresos: deCentavos(ingresos),
    gastos: deCentavos(gastos),
    neto: deCentavos(ingresos - gastos),
    cantidadGastos,
    tasaAhorro: ingresos > 0 ? redondear(((ingresos - gastos) / ingresos) * 100) : null,
  };
}

interface Acumulado {
  nombres: Map<string, number>;
  total: number; // centavos
  cantidad: number;
}

/** Agrupa gastos por motivo normalizado, del que más suma al que menos. `totalGastos` en centavos. */
function agrupar(gastos: readonly Movimiento[], totalGastos: number): GrupoMotivo[] {
  const grupos = new Map<string, Acumulado>();
  for (const g of gastos) {
    const clave = normalizarMotivo(g.motivo) || '—';
    const grupo = grupos.get(clave) ?? { nombres: new Map(), total: 0, cantidad: 0 };
    const nombre = g.motivo.trim() || '—';
    grupo.nombres.set(nombre, (grupo.nombres.get(nombre) ?? 0) + 1);
    grupo.total += aCentavos(g.monto);
    grupo.cantidad += 1;
    grupos.set(clave, grupo);
  }
  return [...grupos.values()]
    .map((grupo) => {
      const [motivo] = [...grupo.nombres.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        motivo,
        total: deCentavos(grupo.total),
        cantidad: grupo.cantidad,
        porcentaje: totalGastos > 0 ? redondear((grupo.total / totalGastos) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total || b.cantidad - a.cantidad || a.motivo.localeCompare(b.motivo));
}

/** Meses que dura cada cobro de un movimiento recurrente (mensual = 1, anual = 12, por su frecuencia). */
function mesesPorCobro(periodo: PeriodoRecurrencia, frecuencia: number | null): number {
  return (periodo === 'mensual' ? 1 : 12) * Math.max(1, frecuencia ?? 1);
}

function detectarSuscripciones(
  movimientos: readonly Movimiento[],
  diaFinal: string,
): Suscripcion[] {
  const resultado = new Map<string, Suscripcion>();

  // 1) Las que el usuario ya marcó como recurrentes. Si un motivo está repetido, manda la más reciente.
  const marcadas = movimientos
    .filter((m) => m.tipo === 'gasto' && m.recurrente && m.periodo !== null)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  for (const m of marcadas) {
    const mensual = deCentavos(Math.round(aCentavos(m.monto) / mesesPorCobro(m.periodo!, m.frecuencia)));
    resultado.set(normalizarMotivo(m.motivo), {
      motivo: m.motivo.trim(),
      monto: m.monto,
      mensual,
      anual: deCentavos(aCentavos(mensual) * 12),
      origen: 'marcada',
    });
  }

  // 2) Cobros que se repiten varios meses con un monto parecido, aunque no estén marcados.
  const desde = sumarDias(diaFinal, -(DIAS_BUSQUEDA_SUSCRIPCIONES - 1));
  const porMotivo = new Map<string, Movimiento[]>();
  for (const m of movimientos) {
    if (m.tipo !== 'gasto' || m.recurrente || !entre(m.fecha, desde, diaFinal)) continue;
    const clave = normalizarMotivo(m.motivo);
    if (!clave || resultado.has(clave)) continue;
    porMotivo.set(clave, [...(porMotivo.get(clave) ?? []), m]);
  }
  for (const [clave, lista] of porMotivo) {
    const meses = new Set(lista.map((m) => m.fecha.slice(0, 7)));
    if (meses.size < MIN_MESES_SUSCRIPCION) continue;
    const tipico = mediana(lista.map((m) => m.monto));
    if (tipico <= 0) continue;
    const parecidos = lista.every((m) => Math.abs(m.monto - tipico) <= tipico * TOLERANCIA_MONTO);
    if (!parecidos) continue;
    const recientes = [...lista].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    resultado.set(clave, {
      motivo: recientes[0].motivo.trim(),
      monto: redondear(tipico, 2),
      mensual: redondear(tipico, 2),
      anual: redondear(tipico * 12, 2),
      origen: 'detectada',
    });
  }

  return [...resultado.values()].sort((a, b) => b.mensual - a.mensual || a.motivo.localeCompare(b.motivo));
}

function detectarHormiga(
  gastos: readonly Movimiento[],
  ingresosPeriodo: number,
  totalGastos: number,
): GastoHormiga | null {
  if (gastos.length === 0 || totalGastos <= 0) return null;
  const umbral =
    ingresosPeriodo > 0
      ? redondear(ingresosPeriodo * FRACCION_HORMIGA, 2)
      : mediana(gastos.map((g) => g.monto));
  const pequenos = gastos.filter((g) => g.monto <= umbral);
  if (pequenos.length < MIN_COMPRAS_HORMIGA) return null;

  const total = pequenos.reduce((suma, g) => suma + aCentavos(g.monto), 0);
  // «El que más se repite»: el grupo con más compras (no el que más suma), si se repite al menos 3 veces.
  const [masRepetido] = [...agrupar(pequenos, total)].sort((x, y) => y.cantidad - x.cantidad || y.total - x.total);
  return {
    umbral,
    cantidad: pequenos.length,
    total: deCentavos(total),
    porcentaje: redondear((total / totalGastos) * 100),
    masFrecuente: masRepetido && masRepetido.cantidad >= 3 ? masRepetido : null,
  };
}

function detectarDiaCaro(gastos: readonly Movimiento[]): DiaCaro | null {
  if (gastos.length < MIN_GASTOS_PATRON_SEMANAL) return null;
  const porDia = new Array<number>(7).fill(0);
  let total = 0;
  for (const g of gastos) {
    const centavos = aCentavos(g.monto);
    porDia[fechaDeClave(g.fecha).getDay()] += centavos;
    total += centavos;
  }
  if (total <= 0) return null;
  let mejor = 0;
  for (let i = 1; i < 7; i += 1) if (porDia[i] > porDia[mejor]) mejor = i;
  return {
    diaSemana: mejor,
    total: deCentavos(porDia[mejor]),
    porcentaje: redondear((porDia[mejor] / total) * 100),
  };
}

/**
 * Todo lo que se puede saber de los gastos con cuentas simples: sin IA, al instante y sin salir del teléfono.
 * El periodo actual son los `dias` que terminan en `diaFinal`; el anterior, los `dias` justo antes.
 */
export function analizar(
  movimientos: readonly Movimiento[],
  diaFinal: string = hoy(),
  dias: number = DIAS_PERIODO,
): HechosAnalisis {
  const activos = movimientos.filter((m) => !m.eliminado);
  const desdeActual = sumarDias(diaFinal, -(dias - 1));
  const hastaAnterior = sumarDias(diaFinal, -dias);
  const desdeAnterior = sumarDias(diaFinal, -(2 * dias - 1));

  const actual = resumir(activos, desdeActual, diaFinal);
  const anterior = resumir(activos, desdeAnterior, hastaAnterior);

  const gastosActuales = activos.filter((m) => m.tipo === 'gasto' && entre(m.fecha, desdeActual, diaFinal));
  const totalGastosCentavos = aCentavos(actual.gastos);

  const suscripciones = detectarSuscripciones(activos, diaFinal);
  const clavesSuscripcion = new Set(suscripciones.map((s) => normalizarMotivo(s.motivo)));
  const mensualCentavos = suscripciones.reduce((suma, s) => suma + aCentavos(s.mensual), 0);

  const gastosPatron = activos.filter(
    (m) => m.tipo === 'gasto' && entre(m.fecha, sumarDias(diaFinal, -(DIAS_PATRON_SEMANAL - 1)), diaFinal),
  );

  return {
    hayDatos: gastosActuales.length > 0 || actual.ingresos > 0,
    dias,
    actual,
    anterior,
    topMotivos: agrupar(gastosActuales, totalGastosCentavos).slice(0, MAX_MOTIVOS),
    suscripciones,
    totalSuscripcionesMensual: deCentavos(mensualCentavos),
    totalSuscripcionesAnual: deCentavos(mensualCentavos * 12),
    // Lo recurrente tiene su propia sección: aquí solo cuentan las compras sueltas.
    hormiga: detectarHormiga(
      gastosActuales.filter((g) => !g.recurrente && !clavesSuscripcion.has(normalizarMotivo(g.motivo))),
      actual.ingresos,
      totalGastosCentavos,
    ),
    tendencia: {
      actual: actual.gastos,
      anterior: anterior.gastos,
      diferencia: deCentavos(aCentavos(actual.gastos) - aCentavos(anterior.gastos)),
      porcentaje:
        anterior.gastos > 0 ? redondear(((actual.gastos - anterior.gastos) / anterior.gastos) * 100) : null,
    },
    diaMasCaro: detectarDiaCaro(gastosPatron),
  };
}

type Formatear = (valor: number) => string;

/**
 * Consejos en texto, de lo más urgente a lo menos, como máximo 4. Solo usan lo calculado en `analizar`.
 * Si no hay nada que señalar pero sí datos, devuelve una frase tranquilizadora.
 */
export function generarConsejos(hechos: HechosAnalisis, i18n: I18n, formatear: Formatear): string[] {
  if (!hechos.hayDatos) return [];
  const consejos: string[] = [];
  const { actual, tendencia, hormiga, suscripciones, topMotivos, diaMasCaro } = hechos;

  // Sin ingresos anotados no se sabe si hay déficit: puede que el usuario no registre lo que gana.
  if (actual.ingresos > 0 && actual.neto < 0) {
    consejos.push(i18n.t('analisis.consejo_deficit', { monto: formatear(Math.abs(actual.neto)) }));
  }

  if (suscripciones.length > 0) {
    consejos.push(
      i18n.t('analisis.consejo_suscripciones', {
        mensual: formatear(hechos.totalSuscripcionesMensual),
        anual: formatear(hechos.totalSuscripcionesAnual),
      }),
    );
    const mayor = suscripciones[0];
    if (suscripciones.length > 1 && mayor.anual > 0) {
      consejos.push(i18n.t('analisis.consejo_mayor_suscripcion', { motivo: mayor.motivo, anual: formatear(mayor.anual) }));
    }
  }

  if (hormiga && hormiga.porcentaje >= 10) {
    consejos.push(
      i18n.t('analisis.consejo_hormiga', {
        n: hormiga.cantidad,
        umbral: formatear(hormiga.umbral),
        total: formatear(hormiga.total),
        porcentaje: Math.round(hormiga.porcentaje),
        mitad: formatear(deCentavos(Math.round(aCentavos(hormiga.total) / 2))),
      }),
    );
  }

  const [primero] = topMotivos;
  if (primero && primero.porcentaje >= 30 && actual.cantidadGastos >= 3) {
    consejos.push(
      i18n.t('analisis.consejo_concentracion', {
        motivo: primero.motivo,
        porcentaje: Math.round(primero.porcentaje),
        total: formatear(primero.total),
      }),
    );
  }

  if (tendencia.porcentaje !== null && tendencia.porcentaje >= 15) {
    consejos.push(
      i18n.t('analisis.consejo_sube', {
        porcentaje: Math.round(tendencia.porcentaje),
        diferencia: formatear(tendencia.diferencia),
      }),
    );
  } else if (tendencia.porcentaje !== null && tendencia.porcentaje <= -15) {
    consejos.push(
      i18n.t('analisis.consejo_baja', {
        porcentaje: Math.round(Math.abs(tendencia.porcentaje)),
        diferencia: formatear(Math.abs(tendencia.diferencia)),
      }),
    );
  }

  if (diaMasCaro && diaMasCaro.porcentaje >= 25) {
    consejos.push(
      i18n.t('analisis.consejo_dia', {
        dia: DIAS_PLURALES[i18n.idioma][diaMasCaro.diaSemana],
        porcentaje: Math.round(diaMasCaro.porcentaje),
      }),
    );
  }

  if (actual.tasaAhorro !== null && actual.neto >= 0) {
    if (actual.tasaAhorro < 10) {
      consejos.push(i18n.t('analisis.consejo_ahorro_bajo', { porcentaje: Math.round(actual.tasaAhorro) }));
    } else if (actual.tasaAhorro >= 20) {
      consejos.push(i18n.t('analisis.consejo_ahorro_bien', { porcentaje: Math.round(actual.tasaAhorro) }));
    }
  }

  if (consejos.length === 0) return [i18n.t('analisis.consejo_estable')];
  return consejos.slice(0, 4);
}
