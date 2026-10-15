import type { Movimiento } from '@/dominio/tipos';

import type { RepositorioMovimientos } from './repositorio';
import { planificarFusion, resumirPlan } from './sincronizacion/fusion';

/** Repositorio en memoria con las mismas reglas que el de SQLite. Se usa en pruebas. */
export function crearRepositorioMemoria(inicial: readonly Movimiento[] = []): RepositorioMovimientos {
  // Se conserva el orden de inserción, igual que `rowid` en SQLite.
  const almacen = new Map<string, Movimiento>(inicial.map((m) => [m.id, m]));

  const ordenados = (soloActivos: boolean) =>
    [...almacen.values()]
      .map((m, orden) => ({ m, orden }))
      .filter(({ m }) => !soloActivos || !m.eliminado)
      .sort((a, b) => (a.m.fecha === b.m.fecha ? b.orden - a.orden : a.m.fecha < b.m.fecha ? 1 : -1))
      .map(({ m }) => m);

  return {
    async listarActivos() {
      return ordenados(true);
    },
    async listarTodos() {
      return ordenados(false);
    },
    async guardar(movimiento) {
      almacen.set(movimiento.id, movimiento);
    },
    async eliminar(id, ahora) {
      const actual = almacen.get(id);
      if (actual) almacen.set(id, { ...actual, eliminado: true, actualizadoEn: ahora.toISOString() });
    },
    async fusionar(entrantes) {
      const plan = planificarFusion([...almacen.values()], entrantes);
      for (const m of plan.aplicar) almacen.set(m.id, m);
      return resumirPlan(plan);
    },
  };
}
