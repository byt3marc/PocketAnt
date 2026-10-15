import { claveDeFecha } from './fechas';

export const DIAS_POR_SEMANA = 7;
/** Seis filas bastan para cualquier mes y mantienen fijo el alto del calendario. */
export const FILAS_CALENDARIO = 6;
/** Rango de años que ofrece el calendario (cualquier clave `YYYY-MM-DD` válida cabe en él). */
export const ANIO_MINIMO = 2000;
export const ANIO_MAXIMO = 2100;

/**
 * Cuadrícula de un mes: 6 filas × 7 columnas con la clave `YYYY-MM-DD` de cada día o `null` en los huecos.
 * `mes` va de 0 (enero) a 11; `primerDia` es el día con que empieza la semana: 0 = domingo … 6 = sábado.
 */
export function semanasDelMes(anio: number, mes: number, primerDia: number): (string | null)[][] {
  const hueco = (new Date(anio, mes, 1).getDay() - primerDia + DIAS_POR_SEMANA) % DIAS_POR_SEMANA;
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();

  const celdas: (string | null)[] = Array.from({ length: hueco }, () => null);
  for (let dia = 1; dia <= diasDelMes; dia++) celdas.push(claveDeFecha(new Date(anio, mes, dia)));
  while (celdas.length < FILAS_CALENDARIO * DIAS_POR_SEMANA) celdas.push(null);

  return Array.from({ length: FILAS_CALENDARIO }, (_, fila) =>
    celdas.slice(fila * DIAS_POR_SEMANA, (fila + 1) * DIAS_POR_SEMANA),
  );
}

export interface MesAnio {
  anio: number;
  mes: number;
}

/** Mes `delta` meses después (o antes, si es negativo), cruzando de año si hace falta. */
export function cambiarMes(anio: number, mes: number, delta: number): MesAnio {
  const total = anio * 12 + mes + delta;
  return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
}

/** Reordena una lista indexada por día de la semana (0 = domingo) para que empiece en `primerDia`. */
export function ordenarSemana<T>(porDia: readonly T[], primerDia: number): T[] {
  return Array.from({ length: DIAS_POR_SEMANA }, (_, i) => porDia[(primerDia + i) % DIAS_POR_SEMANA]);
}

/** Año y mes de una clave `YYYY-MM-DD` (mes de 0 a 11). */
export function mesDeClave(clave: string): MesAnio {
  const [anio, mes] = clave.split('-').map(Number);
  return { anio, mes: mes - 1 };
}
