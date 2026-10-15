import { esClaveValida } from '@/dominio/fechas';
import { MAX_FRECUENCIA, MAX_MONTO } from '@/dominio/movimiento';
import type { Movimiento, PeriodoRecurrencia, TipoMovimiento } from '@/dominio/tipos';
import { ErrorTraducible } from '@/i18n/errores';
import type { ClaveTexto } from '@/i18n/traducir';

/** Versión del formato del archivo. Subirla cuando cambie la estructura. */
export const VERSION_ARCHIVO = 1;

const LIMITE_MOTIVO_IMPORTADO = 200;
const FECHA_MUY_ANTIGUA = '1970-01-01T00:00:00.000Z';

/** Contenido de `datos.json`. Es el mismo que se subirá a Google Drive en la V2. */
export interface ArchivoDatos {
  version: number;
  exportadoEn: string;
  movimientos: Movimiento[];
}

/** El archivo no se puede usar. `clave` es el mensaje (traducible) para el usuario. */
export class ErrorArchivoInvalido extends ErrorTraducible {
  constructor(clave: Extract<ClaveTexto, `error.archivo.${string}`>) {
    super(clave);
    this.name = 'ErrorArchivoInvalido';
  }
}

export function crearArchivo(movimientos: readonly Movimiento[], ahora: Date = new Date()): ArchivoDatos {
  return {
    version: VERSION_ARCHIVO,
    exportadoEn: ahora.toISOString(),
    movimientos: [...movimientos],
  };
}

export function serializarArchivo(archivo: ArchivoDatos): string {
  return JSON.stringify(archivo, null, 2);
}

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

function normalizarFechaHora(valor: unknown): string {
  if (typeof valor !== 'string') return FECHA_MUY_ANTIGUA;
  const ms = Date.parse(valor);
  return Number.isNaN(ms) ? FECHA_MUY_ANTIGUA : new Date(ms).toISOString();
}

/**
 * Valida y limpia un movimiento que viene de un archivo (que puede venir de otra app
 * o estar editado a mano). Devuelve `null` si no se puede aprovechar.
 */
export function normalizarMovimiento(crudo: unknown): Movimiento | null {
  if (!esObjeto(crudo)) return null;

  const { id, tipo, monto, motivo, fecha } = crudo;
  if (typeof id !== 'string' || id.trim() === '' || id.length > 100) return null;
  if (tipo !== 'ingreso' && tipo !== 'gasto') return null;
  if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0 || monto > MAX_MONTO) return null;
  if (typeof motivo !== 'string' || motivo.trim() === '') return null;
  if (!esClaveValida(fecha)) return null;

  const periodoCrudo = crudo.periodo;
  const frecuenciaCruda = crudo.frecuencia;
  const recurrente = crudo.recurrente === true;
  const periodo: PeriodoRecurrencia | null = recurrente
    ? periodoCrudo === 'anual'
      ? 'anual'
      : 'mensual'
    : null;
  const frecuencia =
    recurrente &&
    typeof frecuenciaCruda === 'number' &&
    Number.isInteger(frecuenciaCruda) &&
    frecuenciaCruda >= 1 &&
    frecuenciaCruda <= MAX_FRECUENCIA
      ? frecuenciaCruda
      : recurrente
        ? 1
        : null;

  return {
    id,
    tipo: tipo as TipoMovimiento,
    monto: Math.round(monto * 100) / 100,
    motivo: motivo.trim().slice(0, LIMITE_MOTIVO_IMPORTADO),
    fecha,
    recurrente,
    periodo,
    frecuencia,
    actualizadoEn: normalizarFechaHora(crudo.actualizadoEn),
    eliminado: crudo.eliminado === true,
  };
}

export interface ArchivoAnalizado {
  archivo: ArchivoDatos;
  /** Movimientos del archivo que no se pudieron aprovechar. */
  descartados: number;
}

/** Texto del archivo → datos validados. Lanza `ErrorArchivoInvalido` con un mensaje para el usuario. */
export function analizarArchivo(texto: string): ArchivoAnalizado {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new ErrorArchivoInvalido('error.archivo.no_json');
  }

  if (!esObjeto(crudo) || !Array.isArray(crudo.movimientos)) {
    throw new ErrorArchivoInvalido('error.archivo.formato');
  }

  const version = crudo.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ErrorArchivoInvalido('error.archivo.version_invalida');
  }
  if (version > VERSION_ARCHIVO) {
    throw new ErrorArchivoInvalido('error.archivo.version_nueva');
  }

  const movimientos: Movimiento[] = [];
  let descartados = 0;
  for (const item of crudo.movimientos) {
    const movimiento = normalizarMovimiento(item);
    if (movimiento) movimientos.push(movimiento);
    else descartados += 1;
  }

  return {
    archivo: {
      version,
      exportadoEn: normalizarFechaHora(crudo.exportadoEn),
      movimientos,
    },
    descartados,
  };
}
