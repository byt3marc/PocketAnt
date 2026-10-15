import type { Movimiento } from '@/dominio/tipos';

export interface ResumenFusion {
  /** Movimientos que no existían (o que se restauraron). */
  nuevos: number;
  actualizados: number;
  eliminados: number;
  sinCambios: number;
}

export interface PlanFusion extends ResumenFusion {
  /** Registros que hay que escribir en la base de datos. */
  aplicar: Movimiento[];
}

const instante = (m: Movimiento) => Date.parse(m.actualizadoEn);

/**
 * Decide qué hacer al combinar los movimientos locales con los de un archivo (o de la nube):
 * se empareja por `id` y gana el de `actualizadoEn` más reciente. En un empate se queda el local.
 * Nunca borra: los borrados viajan como `eliminado: true`.
 */
export function planificarFusion(
  locales: readonly Movimiento[],
  entrantes: readonly Movimiento[],
): PlanFusion {
  const porId = new Map(locales.map((m) => [m.id, m] as const));

  // Si el archivo trae el mismo id dos veces, vale la versión más reciente.
  const ultimos = new Map<string, Movimiento>();
  for (const m of entrantes) {
    const previo = ultimos.get(m.id);
    if (!previo || instante(m) > instante(previo)) ultimos.set(m.id, m);
  }

  const plan: PlanFusion = { aplicar: [], nuevos: 0, actualizados: 0, eliminados: 0, sinCambios: 0 };

  for (const entrante of ultimos.values()) {
    const local = porId.get(entrante.id);

    if (!local) {
      plan.aplicar.push(entrante);
      if (entrante.eliminado) plan.sinCambios += 1;
      else plan.nuevos += 1;
      continue;
    }

    if (!(instante(entrante) > instante(local))) {
      plan.sinCambios += 1;
      continue;
    }

    plan.aplicar.push(entrante);
    if (entrante.eliminado && local.eliminado) plan.sinCambios += 1;
    else if (entrante.eliminado) plan.eliminados += 1;
    else if (local.eliminado) plan.nuevos += 1;
    else plan.actualizados += 1;
  }

  return plan;
}

export function resumirPlan({ aplicar: _aplicar, ...resumen }: PlanFusion): ResumenFusion {
  return resumen;
}
