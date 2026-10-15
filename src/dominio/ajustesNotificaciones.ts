/** Cada cuántas horas se puede repetir el recordatorio. */
export const OPCIONES_INTERVALO_HORAS = [1, 2, 3, 4, 6, 12] as const;
export const MAX_DIAS_ANTES = 14;

export interface AjustesNotificaciones {
  /** Recordatorio periódico para registrar gastos al momento. */
  recordatorio: {
    activo: boolean;
    cadaHoras: number;
    /** Primera hora del día (0–23) en que puede sonar. */
    desde: number;
    /** Última hora del día (0–23) en que puede sonar. */
    hasta: number;
  };
  /** Aviso antes de que se cobre un gasto recurrente. */
  cobros: {
    activo: boolean;
    /** Días de anticipación (0 = el mismo día del cobro). */
    diasAntes: number;
  };
  /** Ya se mostró el permiso del sistema una vez (no se vuelve a pedir solo). */
  permisoPreguntado: boolean;
}

export const NOTIFICACIONES_POR_DEFECTO: AjustesNotificaciones = {
  recordatorio: { activo: true, cadaHoras: 1, desde: 8, hasta: 22 },
  cobros: { activo: true, diasAntes: 3 },
  permisoPreguntado: false,
};

const esEnteroEnRango = (valor: unknown, min: number, max: number): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max;

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** Convierte lo guardado (posiblemente incompleto o de una versión vieja) en ajustes válidos. */
export function normalizarNotificaciones(crudo: unknown): AjustesNotificaciones {
  const por = NOTIFICACIONES_POR_DEFECTO;
  const datos = esObjeto(crudo) ? crudo : {};
  const recordatorio = esObjeto(datos.recordatorio) ? datos.recordatorio : {};
  const cobros = esObjeto(datos.cobros) ? datos.cobros : {};

  let desde = esEnteroEnRango(recordatorio.desde, 0, 23) ? recordatorio.desde : por.recordatorio.desde;
  let hasta = esEnteroEnRango(recordatorio.hasta, 0, 23) ? recordatorio.hasta : por.recordatorio.hasta;
  // Un horario al revés no tiene sentido: se vuelve al horario por defecto.
  if (desde > hasta) {
    desde = por.recordatorio.desde;
    hasta = por.recordatorio.hasta;
  }

  const cadaHoras = (OPCIONES_INTERVALO_HORAS as readonly number[]).includes(recordatorio.cadaHoras as number)
    ? (recordatorio.cadaHoras as number)
    : por.recordatorio.cadaHoras;

  return {
    recordatorio: {
      activo: typeof recordatorio.activo === 'boolean' ? recordatorio.activo : por.recordatorio.activo,
      cadaHoras,
      desde,
      hasta,
    },
    cobros: {
      activo: typeof cobros.activo === 'boolean' ? cobros.activo : por.cobros.activo,
      diasAntes: esEnteroEnRango(cobros.diasAntes, 0, MAX_DIAS_ANTES) ? cobros.diasAntes : por.cobros.diasAntes,
    },
    permisoPreguntado:
      typeof datos.permisoPreguntado === 'boolean' ? datos.permisoPreguntado : por.permisoPreguntado,
  };
}
