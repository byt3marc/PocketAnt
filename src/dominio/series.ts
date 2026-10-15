import { ventanaDeDias } from './fechas';
import { aCentavos, deCentavos } from './saldo';
import type { Movimiento } from './tipos';

export interface PuntoDia {
  clave: string;
  ingresos: number;
  gastos: number;
  movimientos: Movimiento[];
}

/**
 * Totales por día de las `dias` jornadas que terminan en `diaFinal`.
 * Cada punto es lo del día (no un acumulado): verde = ingresos, rojo = gastos.
 */
export function construirSerie(
  movimientos: readonly Movimiento[],
  diaFinal: string,
  dias: number,
): PuntoDia[] {
  const claves = ventanaDeDias(diaFinal, dias);
  const indice = new Map(claves.map((clave, i) => [clave, i] as const));
  const ingresos = new Array<number>(dias).fill(0);
  const gastos = new Array<number>(dias).fill(0);
  const delDia = claves.map((): Movimiento[] => []);

  for (const m of movimientos) {
    if (m.eliminado) continue;
    const i = indice.get(m.fecha);
    if (i === undefined) continue;
    if (m.tipo === 'ingreso') ingresos[i] += aCentavos(m.monto);
    else gastos[i] += aCentavos(m.monto);
    delDia[i].push(m);
  }

  return claves.map((clave, i) => ({
    clave,
    ingresos: deCentavos(ingresos[i]),
    gastos: deCentavos(gastos[i]),
    movimientos: delDia[i],
  }));
}

/** Día del movimiento más antiguo (`YYYY-MM-DD`), o `null` si no hay ninguno. */
export function fechaMasAntigua(movimientos: readonly Movimiento[]): string | null {
  let masAntigua: string | null = null;
  for (const m of movimientos) {
    if (masAntigua === null || m.fecha < masAntigua) masAntigua = m.fecha;
  }
  return masAntigua;
}

export interface ResumenDia {
  dia: PuntoDia;
  anterior: PuntoDia;
  /** Gastos del día menos los del día anterior: negativo = se gastó menos. */
  difGastos: number;
}

/** Un día frente al anterior, para la gráfica diaria. */
export function resumirDia(movimientos: readonly Movimiento[], dia: string): ResumenDia {
  const [anterior, actual] = construirSerie(movimientos, dia, 2);
  return {
    dia: actual,
    anterior,
    difGastos: deCentavos(aCentavos(actual.gastos) - aCentavos(anterior.gastos)),
  };
}

export interface ResumenSerie {
  ingresos: number;
  gastos: number;
  neto: number;
  hayMovimientos: boolean;
}

export function resumirSerie(serie: readonly PuntoDia[]): ResumenSerie {
  let ingresos = 0;
  let gastos = 0;
  let hayMovimientos = false;
  for (const punto of serie) {
    ingresos += aCentavos(punto.ingresos);
    gastos += aCentavos(punto.gastos);
    if (punto.movimientos.length > 0) hayMovimientos = true;
  }
  return {
    ingresos: deCentavos(ingresos),
    gastos: deCentavos(gastos),
    neto: deCentavos(ingresos - gastos),
    hayMovimientos,
  };
}
