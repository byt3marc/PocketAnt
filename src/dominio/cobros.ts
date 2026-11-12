import { normalizarMotivo } from './analisis';
import { fechaDeClave, sumarDias } from './fechas';
import { ocurrencias } from './recurrencia';
import type { EntradaMovimiento, Movimiento } from './tipos';

/** Cuántos días hacia atrás (pendientes) y hacia adelante (próximos) se miran los cobros. */
export const DIAS_COBROS = 30;
/** Un cobro cuenta como registrado si hay una copia a esta distancia (en días) de su fecha. */
export const TOLERANCIA_REGISTRO_DIAS = 7;
/** Cuántos cobros omitidos se recuerdan (los más recientes). */
export const MAX_COBROS_OMITIDOS = 50;

export type EstadoCobro = 'pendiente' | 'proximo';

export interface Cobro {
  /** El movimiento recurrente que se repite. */
  movimiento: Movimiento;
  /** Día del cobro (`YYYY-MM-DD`). */
  fecha: string;
  /** `pendiente`: ya llegó su fecha y no se anotó. `proximo`: llega en los próximos 30 días. */
  estado: EstadoCobro;
}

/** Identifica un cobro concreto (`id|fecha`) para poder omitirlo. */
export const claveCobro = (cobro: Pick<Cobro, 'movimiento' | 'fecha'>) => `${cobro.movimiento.id}|${cobro.fecha}`;

/**
 * Si ese cobro ya se anotó: hay otro movimiento no recurrente, del mismo tipo y motivo (sin distinguir mayúsculas,
 * tildes ni espacios), a ±7 días de `fecha`. La tolerancia cubre los cobros que llegan un poco antes o después.
 */
export function estaRegistrado(
  movimientos: readonly Movimiento[],
  recurrente: Movimiento,
  fecha: string,
): boolean {
  const motivo = normalizarMotivo(recurrente.motivo);
  const desde = sumarDias(fecha, -TOLERANCIA_REGISTRO_DIAS);
  const hasta = sumarDias(fecha, TOLERANCIA_REGISTRO_DIAS);
  return movimientos.some(
    (m) =>
      m.id !== recurrente.id &&
      !m.eliminado &&
      !m.recurrente &&
      m.tipo === recurrente.tipo &&
      m.fecha >= desde &&
      m.fecha <= hasta &&
      normalizarMotivo(m.motivo) === motivo,
  );
}

/**
 * Los cobros de los movimientos recurrentes alrededor de `hoy`, ordenados por fecha. Por cada recurrente, como mucho:
 * - un **pendiente**: su último cobro que ya llegó (hoy incluido), posterior al propio movimiento, de los últimos
 *   30 días y que no se anotó todavía;
 * - un **próximo**: su siguiente cobro, dentro de los próximos 30 días.
 *
 * No sabe de los cobros que el usuario omitió: los filtra quien los muestra.
 */
export function cobrosDe(movimientos: readonly Movimiento[], hoy: string): Cobro[] {
  const desde = sumarDias(hoy, -DIAS_COBROS);
  const manana = sumarDias(hoy, 1);
  const limite = sumarDias(hoy, DIAS_COBROS);
  const cobros: Cobro[] = [];

  for (const m of movimientos) {
    if (m.eliminado || !m.recurrente) continue;

    // Con la ventana de 30 días hay como mucho dos fechas (mensual); la última es la más reciente que ya llegó.
    const pasadas = ocurrencias(m, desde, hoy);
    const ultima = pasadas[pasadas.length - 1];
    if (ultima !== undefined && ultima > m.fecha && !estaRegistrado(movimientos, m, ultima)) {
      cobros.push({ movimiento: m, fecha: ultima, estado: 'pendiente' });
    }

    const [siguiente] = ocurrencias(m, manana, limite, 1);
    if (siguiente !== undefined) cobros.push({ movimiento: m, fecha: siguiente, estado: 'proximo' });
  }

  return cobros.sort(
    (a, b) =>
      (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
      a.movimiento.motivo.localeCompare(b.movimiento.motivo),
  );
}

/** Lo que se guarda al anotar un cobro: una copia simple (no recurrente, para no duplicar avisos) en su fecha. */
export function entradaDeCobro(movimiento: Movimiento, fecha: string): EntradaMovimiento {
  return {
    tipo: movimiento.tipo,
    monto: movimiento.monto,
    motivo: movimiento.motivo,
    fecha,
    recurrente: false,
    periodo: null,
    frecuencia: null,
  };
}

/** Quita los pendientes que el usuario decidió no anotar (`omitidos`, claves `id|fecha`). Los próximos se quedan. */
export function quitarOmitidos(cobros: readonly Cobro[], omitidos: readonly string[] | undefined): Cobro[] {
  if (!omitidos?.length) return [...cobros];
  const conjunto = new Set(omitidos);
  return cobros.filter((c) => c.estado !== 'pendiente' || !conjunto.has(claveCobro(c)));
}

/** Días que pasaron desde el cobro hasta `hoy` (0 = hoy). */
export function diasDesde(fecha: string, hoy: string): number {
  return Math.round((fechaDeClave(hoy).getTime() - fechaDeClave(fecha).getTime()) / 86_400_000);
}
