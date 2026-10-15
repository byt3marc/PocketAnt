import type { SQLiteDatabase } from 'expo-sqlite';

import type { Movimiento, PeriodoRecurrencia, TipoMovimiento } from '@/dominio/tipos';

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

const ORDEN = 'ORDER BY fecha DESC, rowid DESC';

export function crearRepositorioSqlite(db: SQLiteDatabase): RepositorioMovimientos {
  return {
    async listarActivos() {
      const filas = await db.getAllAsync<Fila>(`SELECT * FROM movimientos WHERE eliminado = 0 ${ORDEN}`);
      return filas.map(aMovimiento);
    },

    async listarTodos() {
      const filas = await db.getAllAsync<Fila>(`SELECT * FROM movimientos ${ORDEN}`);
      return filas.map(aMovimiento);
    },

    async guardar(movimiento) {
      await db.runAsync(SQL_GUARDAR, parametros(movimiento));
    },

    async eliminar(id, ahora) {
      await db.runAsync(
        'UPDATE movimientos SET eliminado = 1, actualizado_en = ? WHERE id = ?',
        ahora.toISOString(),
        id,
      );
    },

    async fusionar(entrantes) {
      let resumen = { nuevos: 0, actualizados: 0, eliminados: 0, sinCambios: 0 };
      await db.withTransactionAsync(async () => {
        const locales = (await db.getAllAsync<Fila>('SELECT * FROM movimientos')).map(aMovimiento);
        const plan = planificarFusion(locales, entrantes);
        for (const movimiento of plan.aplicar) {
          await db.runAsync(SQL_GUARDAR, parametros(movimiento));
        }
        resumen = resumirPlan(plan);
      });
      return resumen;
    },
  };
}
