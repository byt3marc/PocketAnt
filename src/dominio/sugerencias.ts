import { normalizarMotivo } from './analisis';
import { sumarDias } from './fechas';
import type { Movimiento, TipoMovimiento } from './tipos';

/** Cuántos días hacia atrás cuentan para saber qué motivos se usan más. */
export const DIAS_SUGERENCIAS = 90;
export const MAX_SUGERENCIAS = 6;

export interface SugerenciaMotivo {
  /** Tal como lo escribió el usuario la última vez. */
  motivo: string;
  /** El monto de la última vez. */
  monto: number;
}

interface Grupo {
  clave: string;
  usosRecientes: number;
  /** El movimiento más reciente del grupo: de él salen la grafía y el monto. */
  ultimo: Movimiento;
}

/** El más reciente por fecha; a igualdad de fecha, el último que se tocó. */
const masReciente = (a: Movimiento, b: Movimiento) =>
  a.fecha !== b.fecha ? a.fecha > b.fecha : a.actualizadoEn >= b.actualizadoEn;

/**
 * Motivos para registrar en un toque lo que se repite («Café», «Pasaje»…). Agrupa los movimientos del `tipo` por motivo
 * (sin distinguir mayúsculas, tildes ni espacios) y ordena por cuántas veces se usó en los últimos 90 días y, a igualdad,
 * por el más reciente. Con `texto`, deja solo los que lo contienen y quita el que ya está escrito tal cual.
 */
export function sugerirMotivos(
  movimientos: readonly Movimiento[],
  tipo: TipoMovimiento,
  texto: string,
  hoy: string,
  limite: number = MAX_SUGERENCIAS,
): SugerenciaMotivo[] {
  const desde = sumarDias(hoy, -(DIAS_SUGERENCIAS - 1));
  const grupos = new Map<string, Grupo>();

  for (const m of movimientos) {
    if (m.eliminado || m.tipo !== tipo) continue;
    const clave = normalizarMotivo(m.motivo);
    if (!clave) continue;
    const reciente = m.fecha >= desde ? 1 : 0;
    const grupo = grupos.get(clave);
    if (!grupo) {
      grupos.set(clave, { clave, usosRecientes: reciente, ultimo: m });
    } else {
      grupo.usosRecientes += reciente;
      if (masReciente(m, grupo.ultimo)) grupo.ultimo = m;
    }
  }

  const buscado = normalizarMotivo(texto);
  return [...grupos.values()]
    .filter((g) => !buscado || (g.clave.includes(buscado) && g.clave !== buscado))
    .sort(
      (a, b) =>
        b.usosRecientes - a.usosRecientes ||
        (a.ultimo.fecha !== b.ultimo.fecha ? (a.ultimo.fecha < b.ultimo.fecha ? 1 : -1) : 0) ||
        a.clave.localeCompare(b.clave),
    )
    .slice(0, limite)
    .map((g) => ({ motivo: g.ultimo.motivo.trim(), monto: g.ultimo.monto }));
}
