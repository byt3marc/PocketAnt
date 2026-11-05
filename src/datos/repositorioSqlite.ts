import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  ImagenMovimiento,
  Movimiento,
  PeriodoRecurrencia,
  TipoMovimiento,
} from '@/dominio/tipos';

import type { RepositorioMovimientos } from './repositorio';
import { planificarFusion, resumirPlan } from './sincronizacion/fusion';

interface Fila {
  id: string;
  tipo: string;
  monto: number;
  motivo: string;
  fecha: string;
  recurrente: number;
  periodo: string | null;
  frecuencia: number | null;
  actualizado_en: string;
  eliminado: number;
}

interface FilaImagen {
  id: string;
  movimiento_id: string;
  ancho: number;
  alto: number;
  orden: number;
}

const aMovimiento = (fila: Fila): Movimiento => ({
  id: fila.id,
  tipo: fila.tipo as TipoMovimiento,
  monto: fila.monto,
  motivo: fila.motivo,
  fecha: fila.fecha,
  recurrente: fila.recurrente === 1,
  periodo: fila.periodo as PeriodoRecurrencia | null,
  frecuencia: fila.frecuencia,
  actualizadoEn: fila.actualizado_en,
  eliminado: fila.eliminado === 1,
});

const aImagen = (fila: FilaImagen): ImagenMovimiento => ({
  id: fila.id,
  ancho: fila.ancho,
  alto: fila.alto,
  orden: fila.orden,
});

const SQL_GUARDAR = `
  INSERT INTO movimientos
    (id, tipo, monto, motivo, fecha, recurrente, periodo, frecuencia, actualizado_en, eliminado)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    tipo = excluded.tipo,
    monto = excluded.monto,
    motivo = excluded.motivo,
    fecha = excluded.fecha,
    recurrente = excluded.recurrente,
    periodo = excluded.periodo,
    frecuencia = excluded.frecuencia,
    actualizado_en = excluded.actualizado_en,
    eliminado = excluded.eliminado
`;

const SQL_GUARDAR_IMAGEN = `
  INSERT INTO imagenes (id, movimiento_id, ancho, alto, orden)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    movimiento_id = excluded.movimiento_id,
    ancho = excluded.ancho,
    alto = excluded.alto,
    orden = excluded.orden
`;

const SQL_BORRAR_IMAGENES = 'DELETE FROM imagenes WHERE movimiento_id = ?';

const parametros = (m: Movimiento) => [
  m.id,
  m.tipo,
  m.monto,
  m.motivo,
  m.fecha,
  m.recurrente ? 1 : 0,
  m.periodo,
  m.frecuencia,
  m.actualizadoEn,
  m.eliminado ? 1 : 0,
];

const parametrosImagen = (movimientoId: string, imagen: ImagenMovimiento, orden: number) => [
  imagen.id,
  movimientoId,
  imagen.ancho,
  imagen.alto,
  orden,
];

const ORDEN = 'ORDER BY fecha DESC, rowid DESC';

/** Reemplaza las filas de imágenes solo si el movimiento las trae (`undefined` = no tocarlas). */
async function reemplazarImagenes(db: SQLiteDatabase, movimiento: Movimiento): Promise<void> {
  if (movimiento.imagenes === undefined) return;
  await db.runAsync(SQL_BORRAR_IMAGENES, movimiento.id);
  for (const [orden, imagen] of movimiento.imagenes.entries()) {
    await db.runAsync(SQL_GUARDAR_IMAGEN, parametrosImagen(movimiento.id, imagen, orden));
  }
}

/** Agrega a cada movimiento sus imágenes, en orden. Las que no tienen fotos quedan sin el campo. */
async function conSusImagenes(
  db: SQLiteDatabase,
  movimientos: Movimiento[],
): Promise<Movimiento[]> {
  if (movimientos.length === 0) return movimientos;

  const filas = await db.getAllAsync<FilaImagen>(
    'SELECT * FROM imagenes ORDER BY movimiento_id, orden, rowid',
  );
  if (filas.length === 0) return movimientos;

  const porMovimiento = new Map<string, ImagenMovimiento[]>();
  for (const fila of filas) {
    const imagenes = porMovimiento.get(fila.movimiento_id);
    if (imagenes) imagenes.push(aImagen(fila));
    else porMovimiento.set(fila.movimiento_id, [aImagen(fila)]);
  }

  return movimientos.map((movimiento) => {
    const imagenes = porMovimiento.get(movimiento.id);
    return imagenes ? { ...movimiento, imagenes } : movimiento;
  });
}

export function crearRepositorioSqlite(db: SQLiteDatabase): RepositorioMovimientos {
  return {
    async listarActivos() {
      const filas = await db.getAllAsync<Fila>(`SELECT * FROM movimientos WHERE eliminado = 0 ${ORDEN}`);
      return conSusImagenes(db, filas.map(aMovimiento));
    },

    async listarTodos() {
      const filas = await db.getAllAsync<Fila>(`SELECT * FROM movimientos ${ORDEN}`);
      return conSusImagenes(db, filas.map(aMovimiento));
    },

    async guardar(movimiento) {
      await db.withTransactionAsync(async () => {
        await db.runAsync(SQL_GUARDAR, parametros(movimiento));
        await reemplazarImagenes(db, movimiento);
      });
    },

    async guardarLote(movimientos) {
      if (movimientos.length === 0) return;
      // Una sola transacción para todo el lote: cualquier error revierte las inserciones anteriores.
      await db.withTransactionAsync(async () => {
        const sentencia = await db.prepareAsync(SQL_GUARDAR);
        const sentenciaImagen = await db.prepareAsync(SQL_GUARDAR_IMAGEN);
        try {
          for (const movimiento of movimientos) {
            await sentencia.executeAsync(parametros(movimiento));
            if (movimiento.imagenes !== undefined) {
              await db.runAsync(SQL_BORRAR_IMAGENES, movimiento.id);
              for (const [orden, imagen] of movimiento.imagenes.entries()) {
                await sentenciaImagen.executeAsync(parametrosImagen(movimiento.id, imagen, orden));
              }
            }
          }
        } finally {
          await sentencia.finalizeAsync();
          await sentenciaImagen.finalizeAsync();
        }
      });
    },

    async eliminar(id, ahora) {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'UPDATE movimientos SET eliminado = 1, actualizado_en = ? WHERE id = ?',
          ahora.toISOString(),
          id,
        );
        // Los archivos los borra quien llama; aquí basta con que dejen de viajar en el archivo.
        await db.runAsync(SQL_BORRAR_IMAGENES, id);
      });
    },

    async limpiarTodo(ahora) {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'UPDATE movimientos SET eliminado = 1, actualizado_en = ? WHERE eliminado = 0',
          ahora.toISOString(),
        );
        await db.runAsync('DELETE FROM imagenes');
      });
    },

    async fusionar(entrantes) {
      let resumen = { nuevos: 0, actualizados: 0, eliminados: 0, sinCambios: 0 };
      // No es exclusiva a propósito: con `withExclusiveTransactionAsync`, un guardado del usuario que coincida con una
      // sincronización fallaría con «database is locked».
      await db.withTransactionAsync(async () => {
        const locales = (await db.getAllAsync<Fila>('SELECT * FROM movimientos')).map(aMovimiento);
        const plan = planificarFusion(locales, entrantes);
        // Una sola sentencia preparada para todas las filas (una importación grande no la recompila por fila).
        const sentencia = await db.prepareAsync(SQL_GUARDAR);
        const sentenciaImagen = await db.prepareAsync(SQL_GUARDAR_IMAGEN);
        try {
          for (const movimiento of plan.aplicar) {
            await sentencia.executeAsync(parametros(movimiento));

            if (movimiento.imagenes !== undefined) {
              await db.runAsync(SQL_BORRAR_IMAGENES, movimiento.id);
              for (const [orden, imagen] of movimiento.imagenes.entries()) {
                await sentenciaImagen.executeAsync(parametrosImagen(movimiento.id, imagen, orden));
              }
            }
          }
        } finally {
          await sentencia.finalizeAsync();
          await sentenciaImagen.finalizeAsync();
        }
        resumen = resumirPlan(plan);
      });
      return resumen;
    },
  };
}
