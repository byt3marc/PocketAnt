export type TipoMovimiento = 'ingreso' | 'gasto';
export type PeriodoRecurrencia = 'mensual' | 'anual';

/** Un ingreso o un gasto. `monto` es siempre positivo; el signo lo da `tipo`. */
export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  monto: number;
  motivo: string;
  /** Día del movimiento en hora local, formato `YYYY-MM-DD`. */
  fecha: string;
  recurrente: boolean;
  periodo: PeriodoRecurrencia | null;
  /** Cada cuántos periodos se factura (1 = cada mes / cada año). */
  frecuencia: number | null;
  /** Última modificación (ISO UTC). Decide quién gana al fusionar datos. */
  actualizadoEn: string;
  /** Borrado lógico: el registro se conserva para propagar el borrado al importar o sincronizar. */
  eliminado: boolean;
}

/** Lo que el usuario captura; el resto (id, fechas de control) lo agrega la app. */
export interface EntradaMovimiento {
  tipo: TipoMovimiento;
  monto: number;
  motivo: string;
  fecha: string;
  recurrente: boolean;
  periodo: PeriodoRecurrencia | null;
  frecuencia: number | null;
}
