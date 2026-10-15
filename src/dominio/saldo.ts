import type { Movimiento } from './tipos';

/** Se suma en centavos enteros para no arrastrar errores de punto flotante (0.1 + 0.2). */
export const aCentavos = (monto: number) => Math.round(monto * 100);
export const deCentavos = (centavos: number) => centavos / 100;

export interface Totales {
  ingresos: number;
  gastos: number;
  saldo: number;
}

export function calcularTotales(movimientos: readonly Movimiento[]): Totales {
  let ingresos = 0;
  let gastos = 0;
  for (const m of movimientos) {
    if (m.eliminado) continue;
    if (m.tipo === 'ingreso') ingresos += aCentavos(m.monto);
    else gastos += aCentavos(m.monto);
  }
  return {
    ingresos: deCentavos(ingresos),
    gastos: deCentavos(gastos),
    saldo: deCentavos(ingresos - gastos),
  };
}
