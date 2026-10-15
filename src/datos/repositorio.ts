import type { Movimiento } from '@/dominio/tipos';

import type { ResumenFusion } from './sincronizacion/fusion';

/**
 * Única puerta de acceso a los datos. La interfaz de usuario nunca habla con SQLite
 * directamente, así el origen de datos se puede ampliar (nube) sin tocar las pantallas.
 */
export interface RepositorioMovimientos {
  /** Movimientos visibles, del más reciente al más antiguo. */
  listarActivos(): Promise<Movimiento[]>;
  /** Todos, incluidos los borrados lógicamente (para exportar y sincronizar). */
  listarTodos(): Promise<Movimiento[]>;
  /** Inserta o reemplaza por `id`. */
  guardar(movimiento: Movimiento): Promise<void>;
  /** Borrado lógico: conserva el registro para que el borrado se propague. */
  eliminar(id: string, ahora: Date): Promise<void>;
  /** Combina movimientos externos con los locales (gana el más reciente por `id`). */
  fusionar(entrantes: readonly Movimiento[]): Promise<ResumenFusion>;
}
