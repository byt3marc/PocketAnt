import type { Movimiento } from '@/dominio/tipos';

import type { AlmacenImagenes } from '../almacenImagenes';
import type { RepositorioMovimientos } from '../repositorio';

import { crearArchivo, type ArchivoDatos } from './formatoArchivo';
import { planificarFusion, type ResumenFusion } from './fusion';
import type { ProveedorSync } from './proveedor';
import { movimientoConImagenes } from './serializadorArchivo';

export interface ResultadoExportacion {
  /** Movimientos activos incluidos en el archivo. */
  total: number;
}

export interface ResultadoImportacion extends ResumenFusion {
  /** Movimientos del archivo que no tenían un formato aprovechable. */
  descartados: number;
}

/**
 * El archivo con las fotos incluidas en Base64, para los proveedores que no exportan en streaming.
 * Sin almacén —pruebas y proveedores que no tocan disco— se exporta solo lo que ya traigan los
 * movimientos. Las fotos se leen en serie (movimiento a movimiento) para que el pico de memoria no
 * dependa del historial.
 */
async function crearArchivoConImagenes(
  movimientos: readonly Movimiento[],
  almacen?: AlmacenImagenes,
  ahora?: Date,
): Promise<ArchivoDatos> {
  if (!almacen) return crearArchivo(movimientos, ahora);

  const conImagenes: Movimiento[] = [];
  for (const movimiento of movimientos) {
    conImagenes.push(
      await movimientoConImagenes(movimiento, (id, imagen) => almacen.leerBase64(id, imagen)),
    );
  }

  return crearArchivo(conImagenes, ahora);
}

/** Sube todos los datos: en streaming si el proveedor lo soporta (y hay almacén), y no todo en memoria. */
async function subirTodo(
  proveedor: ProveedorSync,
  movimientos: readonly Movimiento[],
  almacen?: AlmacenImagenes,
): Promise<void> {
  if (almacen && proveedor.subirConImagenes) {
    await proveedor.subirConImagenes(movimientos, almacen);
    return;
  }
  await proveedor.subir(await crearArchivoConImagenes(movimientos, almacen));
}

/** Escribe en disco las fotos de los movimientos que van a ganar la fusión. */
async function escribirImagenes(
  almacen: AlmacenImagenes,
  movimientos: readonly Movimiento[],
): Promise<void> {
  for (const movimiento of movimientos) {
    if (movimiento.eliminado || movimiento.imagenes === undefined) continue;
    await almacen.importar(movimiento.id, movimiento.imagenes);
  }
}

/** Después de fusionar, borra los archivos locales que la versión ganadora ya no referencia. */
function conservarImagenes(almacen: AlmacenImagenes, movimientos: readonly Movimiento[]): void {
  for (const movimiento of movimientos) {
    if (movimiento.imagenes === undefined) continue;
    almacen.conservar(movimiento.id, movimiento.eliminado ? [] : movimiento.imagenes);
  }
}

/** Escribe fotos, fusiona y limpia. Solo toca las imágenes de los movimientos que realmente se aplican. */
async function aplicarRemoto(
  repositorio: RepositorioMovimientos,
  almacen: AlmacenImagenes | undefined,
  remoto: ArchivoDatos,
): Promise<ResumenFusion> {
  if (!almacen) return repositorio.fusionar(remoto.movimientos);

  const locales = await repositorio.listarTodos();
  const plan = planificarFusion(locales, remoto.movimientos);
  await escribirImagenes(almacen, plan.aplicar);
  const resumen = await repositorio.fusionar(remoto.movimientos);
  conservarImagenes(almacen, plan.aplicar);
  return resumen;
}

/** Envía todos los datos (incluidos los borrados lógicos) al proveedor. */
export async function exportarDatos(
  repositorio: RepositorioMovimientos,
  proveedor: ProveedorSync,
  almacen?: AlmacenImagenes,
): Promise<ResultadoExportacion> {
  const todos = await repositorio.listarTodos();
  await subirTodo(proveedor, todos, almacen);
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
  almacen?: AlmacenImagenes,
): Promise<ResultadoSincronizacion> {
  const remoto = await proveedor.descargar(); // `null` = todavía no hay copia en la nube
  const resumen = remoto
    ? await aplicarRemoto(repositorio, almacen, remoto.archivo)
    : { nuevos: 0, actualizados: 0, eliminados: 0, sinCambios: 0 };

  const todos = await repositorio.listarTodos();
  const hayQueSubir = !remoto || planificarFusion(remoto.archivo.movimientos, todos).aplicar.length > 0;
  if (hayQueSubir) await subirTodo(proveedor, todos, almacen);

  return { ...resumen, subido: hayQueSubir, descartados: remoto?.descartados ?? 0 };
}

/** Trae datos del proveedor y los fusiona con los locales. `null` si el usuario canceló. */
export async function importarDatos(
  repositorio: RepositorioMovimientos,
  proveedor: ProveedorSync,
  almacen?: AlmacenImagenes,
): Promise<ResultadoImportacion | null> {
  const recibido = await proveedor.descargar();
  if (!recibido) return null;
  const resumen = await aplicarRemoto(repositorio, almacen, recibido.archivo);
  return { ...resumen, descartados: recibido.descartados };
}
