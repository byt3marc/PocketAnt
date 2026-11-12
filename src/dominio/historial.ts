import { normalizarMotivo } from './analisis';
import { aCentavos, deCentavos } from './saldo';
import type { Movimiento, TipoMovimiento } from './tipos';

export type FiltroTipo = 'todos' | TipoMovimiento;

export interface CriterioHistorial {
  tipo: FiltroTipo;
  /** Parte del motivo; sin distinguir mayúsculas, tildes ni espacios de más. Vacío = sin filtrar. */
  texto: string;
}

/** Una fila de la lista del historial: la cabecera de un día o un movimiento de ese día. */
export type FilaHistorial =
  | { tipo: 'dia'; clave: string; /** Ingresos menos gastos del día (de lo que se muestra). */ neto: number }
  | { tipo: 'movimiento'; movimiento: Movimiento };

/** Los movimientos que pasan el filtro de tipo y la búsqueda, en el mismo orden. */
export function filtrarMovimientos(movimientos: readonly Movimiento[], criterio: CriterioHistorial): Movimiento[] {
  const buscado = normalizarMotivo(criterio.texto);
  return movimientos.filter(
    (m) =>
      (criterio.tipo === 'todos' || m.tipo === criterio.tipo) &&
      (!buscado || normalizarMotivo(m.motivo).includes(buscado)),
  );
}

/**
 * Convierte la lista (del más reciente al más antiguo, como la entrega `useDatos`) en filas para una lista
 * virtualizada: antes del primer movimiento de cada día, su cabecera con el neto del día. Conserva el orden de entrada.
 */
export function agruparPorDia(movimientos: readonly Movimiento[]): FilaHistorial[] {
  const filas: FilaHistorial[] = [];
  let cabecera: Extract<FilaHistorial, { tipo: 'dia' }> | null = null;
  let netoCentavos = 0;

  const cerrar = () => {
    if (cabecera) cabecera.neto = deCentavos(netoCentavos);
  };

  for (const m of movimientos) {
    if (!cabecera || cabecera.clave !== m.fecha) {
      cerrar();
      cabecera = { tipo: 'dia', clave: m.fecha, neto: 0 };
      netoCentavos = 0;
      filas.push(cabecera);
    }
    netoCentavos += m.tipo === 'ingreso' ? aCentavos(m.monto) : -aCentavos(m.monto);
    filas.push({ tipo: 'movimiento', movimiento: m });
  }
  cerrar();
  return filas;
}
