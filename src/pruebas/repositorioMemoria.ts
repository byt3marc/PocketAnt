import type { Movimiento } from '@/dominio/tipos';

import type { RepositorioMovimientos } from '@/datos/repositorio';
import { planificarFusion, resumirPlan } from '@/datos/sincronizacion/fusion';

/**
 * Repositorio en memoria con las mismas reglas que el de SQLite. Se usa en pruebas.
 * `fallarEn` es una ranura de prueba: si devuelve `true`, la inserción de ese movimiento falla dentro
 * del lote (simula un error de base de datos a mitad de transacción).
 */
export function crearRepositorioMemoria(
  inicial: readonly Movimiento[] = [],
  fallarEn?: (movimiento: Movimiento, indice: number) => boolean,
): RepositorioMovimientos {
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

    async guardarLote(movimientos) {
      if (movimientos.length === 0) return;
      // Se aplica primero a una copia: si algo falla, el original no se toca (misma garantía que la transacción).
      const copia = new Map(almacen);
      for (const [indice, m] of movimientos.entries()) {
        if (fallarEn?.(m, indice)) throw new Error('fallo de inserción simulado');
        copia.set(m.id, m);
      }
      almacen.clear();
      for (const [id, m] of copia) almacen.set(id, m);
    },
    async eliminar(id, ahora) {
      const actual = almacen.get(id);
      if (actual) {
        almacen.set(id, {
          ...actual,
          eliminado: true,
          actualizadoEn: ahora.toISOString(),
          imagenes: undefined,
        });
      }
    },
    async limpiarTodo(ahora) {
      const marca = ahora.toISOString();
      for (const [id, m] of almacen) {
        if (!m.eliminado) almacen.set(id, { ...m, eliminado: true, actualizadoEn: marca, imagenes: undefined });
      }
    },
    async fusionar(entrantes) {
      const plan = planificarFusion([...almacen.values()], entrantes);
      for (const m of plan.aplicar) almacen.set(m.id, m);
      return resumirPlan(plan);
    },
  };
}
