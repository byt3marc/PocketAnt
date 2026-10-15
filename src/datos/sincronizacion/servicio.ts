import type { RepositorioMovimientos } from '../repositorio';

import { crearArchivo } from './formatoArchivo';
import { planificarFusion, type ResumenFusion } from './fusion';
import type { ProveedorSync } from './proveedor';

export interface ResultadoExportacion {
  /** Movimientos activos incluidos en el archivo. */
  total: number;
}

export interface ResultadoImportacion extends ResumenFusion {
  /** Movimientos del archivo que no tenían un formato aprovechable. */
  descartados: number;
}

/** Envía todos los datos (incluidos los borrados lógicos) al proveedor. */
export async function exportarDatos(
  repositorio: RepositorioMovimientos,
  proveedor: ProveedorSync,
): Promise<ResultadoExportacion> {
  const todos = await repositorio.listarTodos();
  await proveedor.subir(crearArchivo(todos));
  return { total: todos.filter((m) => !m.eliminado).length };
}

export interface ResultadoSincronizacion extends ResumenFusion {
  /** Se subió una copia nueva al proveedor (había cambios locales que la nube no tenía). */
  subido: boolean;
  descartados: number;
}

/**
 * Sincronización en dos sentidos: trae lo de la nube y lo fusiona con lo local (gana el más reciente por
 * `id`) y, solo si la nube no tiene algo de lo local, sube el conjunto completo. Nunca borra datos locales y
 * es segura de repetir. Si el archivo remoto está dañado falla sin sobrescribirlo.
 */
export async function sincronizar(
  repositorio: RepositorioMovimientos,
  proveedor: ProveedorSync,
): Promise<ResultadoSincronizacion> {
  const remoto = await proveedor.descargar(); // `null` = todavía no hay copia en la nube
  const resumen = remoto
    ? await repositorio.fusionar(remoto.archivo.movimientos)
    : { nuevos: 0, actualizados: 0, eliminados: 0, sinCambios: 0 };

  const todos = await repositorio.listarTodos();
  const hayQueSubir = !remoto || planificarFusion(remoto.archivo.movimientos, todos).aplicar.length > 0;
  if (hayQueSubir) await proveedor.subir(crearArchivo(todos));

  return { ...resumen, subido: hayQueSubir, descartados: remoto?.descartados ?? 0 };
}

/** Trae datos del proveedor y los fusiona con los locales. `null` si el usuario canceló. */
export async function importarDatos(
  repositorio: RepositorioMovimientos,
  proveedor: ProveedorSync,
): Promise<ResultadoImportacion | null> {
  const recibido = await proveedor.descargar();
  if (!recibido) return null;
  const resumen = await repositorio.fusionar(recibido.archivo.movimientos);
  return { ...resumen, descartados: recibido.descartados };
}
