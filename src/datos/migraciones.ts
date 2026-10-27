import type { SQLiteDatabase } from 'expo-sqlite';

export const VERSION_ESQUEMA = 2;

/** Crea o actualiza el esquema usando `PRAGMA user_version`. Para cambios futuros, agregar un bloque `if`. */
export async function migrarBaseDeDatos(db: SQLiteDatabase): Promise<void> {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const actual = fila?.user_version ?? 0;
  if (actual >= VERSION_ESQUEMA) return;

  if (actual < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE IF NOT EXISTS movimientos (
        id             TEXT    PRIMARY KEY NOT NULL,
        tipo           TEXT    NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
        monto          REAL    NOT NULL CHECK (monto > 0),
        motivo         TEXT    NOT NULL,
        fecha          TEXT    NOT NULL,
        recurrente     INTEGER NOT NULL DEFAULT 0,
        periodo        TEXT    CHECK (periodo IN ('mensual', 'anual')),
        frecuencia     INTEGER,
        actualizado_en TEXT    NOT NULL,
        eliminado      INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos (eliminado, fecha);
    `);
  }

  if (actual < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS imagenes (
        id            TEXT    PRIMARY KEY NOT NULL,
        movimiento_id TEXT    NOT NULL,
        ancho         INTEGER NOT NULL CHECK (ancho > 0),
        alto          INTEGER NOT NULL CHECK (alto > 0),
        orden         INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_imagenes_movimiento ON imagenes (movimiento_id, orden);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${VERSION_ESQUEMA}`);
}
