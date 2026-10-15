import type { Movimiento } from './tipos';

const MAX_ITERACIONES = 1200;

const dosDigitos = (n: number) => String(n).padStart(2, '0');

const diasDelMes = (anio: number, mes0: number) => new Date(anio, mes0 + 1, 0).getDate();

type MovimientoRecurrente = Pick<Movimiento, 'fecha' | 'recurrente' | 'periodo' | 'frecuencia'>;

/**
 * Fechas de cobro de un movimiento recurrente dentro de `[desde, hasta]` (claves `YYYY-MM-DD`),
 * de la más próxima a la más lejana, hasta `tope` fechas.
 *
 * La primera es la `fecha` del propio movimiento y las siguientes se repiten cada `frecuencia` meses
 * (mensual) o años (anual). Si el día no existe en el mes (31 en febrero), se usa el último día del mes,
 * sin arrastrar el recorte: 31 ene → 28 feb → 31 mar.
 */
export function ocurrencias(
  movimiento: MovimientoRecurrente,
  desde: string,
  hasta: string,
  tope = 24,
): string[] {
  if (!movimiento.recurrente || !movimiento.periodo) return [];

  const [anioBase, mesBase, diaBase] = movimiento.fecha.split('-').map(Number);
  const mesesPorPaso = (movimiento.periodo === 'mensual' ? 1 : 12) * (movimiento.frecuencia ?? 1);
  if (!(mesesPorPaso >= 1)) return [];

  const resultado: string[] = [];
  for (let k = 0; k < MAX_ITERACIONES && resultado.length < tope; k += 1) {
    const indiceMes = mesBase - 1 + k * mesesPorPaso;
    const anio = anioBase + Math.floor(indiceMes / 12);
    const mes0 = ((indiceMes % 12) + 12) % 12;
    const dia = Math.min(diaBase, diasDelMes(anio, mes0));
    const clave = `${anio}-${dosDigitos(mes0 + 1)}-${dosDigitos(dia)}`;
    if (clave > hasta) break;
    if (clave >= desde) resultado.push(clave);
  }
  return resultado;
}
