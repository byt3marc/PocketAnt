import type { ClaveTexto, I18n, Parametros } from '@/i18n/traducir';

import { esClaveValida } from './fechas';
import { parsearMonto } from './formato';
import type {
  EntradaMovimiento,
  Movimiento,
  PeriodoRecurrencia,
  TipoMovimiento,
} from './tipos';

export const MAX_MOTIVO = 60;
export const MAX_MONTO = 999_999_999.99;
export const MAX_FRECUENCIA = 99;

/** Estado crudo del formulario, tal como lo escribe el usuario. */
export interface BorradorMovimiento {
  tipo: TipoMovimiento;
  monto: string;
  motivo: string;
  fecha: string;
  recurrente: boolean;
  periodo: PeriodoRecurrencia;
  frecuencia: number;
}

/** Error de un campo: clave de traducción más sus parámetros (la interfaz lo traduce). */
export interface ErrorCampo {
  clave: ClaveTexto;
  parametros?: Parametros;
}

export interface ErroresBorrador {
  monto?: ErrorCampo;
  motivo?: ErrorCampo;
  fecha?: ErrorCampo;
  frecuencia?: ErrorCampo;
}

export interface ResultadoValidacion {
  entrada: EntradaMovimiento | null;
  errores: ErroresBorrador;
}

export function validarBorrador(borrador: BorradorMovimiento): ResultadoValidacion {
  const errores: ErroresBorrador = {};

  const monto = parsearMonto(borrador.monto);
  if (monto === null || monto <= 0) errores.monto = { clave: 'error.monto_requerido' };
  else if (monto > MAX_MONTO) errores.monto = { clave: 'error.monto_grande' };

  const motivo = borrador.motivo.trim();
  if (motivo === '') errores.motivo = { clave: 'error.motivo_vacio' };
  else if (motivo.length > MAX_MOTIVO) {
    errores.motivo = { clave: 'error.motivo_largo', parametros: { max: MAX_MOTIVO } };
  }

  if (!esClaveValida(borrador.fecha)) errores.fecha = { clave: 'error.fecha_invalida' };

  if (
    borrador.recurrente &&
    (!Number.isInteger(borrador.frecuencia) ||
      borrador.frecuencia < 1 ||
      borrador.frecuencia > MAX_FRECUENCIA)
  ) {
    errores.frecuencia = { clave: 'error.frecuencia', parametros: { max: MAX_FRECUENCIA } };
  }

  if (Object.keys(errores).length > 0 || monto === null) {
    return { entrada: null, errores };
  }

  return {
    errores,
    entrada: {
      tipo: borrador.tipo,
      monto,
      motivo,
      fecha: borrador.fecha,
      recurrente: borrador.recurrente,
      periodo: borrador.recurrente ? borrador.periodo : null,
      frecuencia: borrador.recurrente ? borrador.frecuencia : null,
    },
  };
}

export function crearMovimiento(entrada: EntradaMovimiento, id: string, ahora: Date): Movimiento {
  return { ...entrada, id, actualizadoEn: ahora.toISOString(), eliminado: false };
}

export function actualizarMovimiento(
  existente: Movimiento,
  entrada: EntradaMovimiento,
  ahora: Date,
): Movimiento {
  return { ...existente, ...entrada, actualizadoEn: ahora.toISOString() };
}

/** "Mensual · cada mes", "Anual · cada 2 años"; `null` si no es recurrente. */
export function describirRecurrencia(
  m: Pick<Movimiento, 'recurrente' | 'periodo' | 'frecuencia'>,
  i18n: I18n,
): string | null {
  if (!m.recurrente || !m.periodo) return null;
  const n = m.frecuencia ?? 1;
  const nombre = i18n.t(m.periodo === 'mensual' ? 'recurrencia.mensual' : 'recurrencia.anual');
  const cada = i18n.plural(m.periodo === 'mensual' ? 'recurrencia.cada_mes' : 'recurrencia.cada_anio', n);
  return `${nombre} · ${cada}`;
}

/** Unidad para el formulario: "mes" / "meses" / "año" / "años". */
export function unidadRecurrencia(periodo: PeriodoRecurrencia, cantidad: number, i18n: I18n): string {
  return i18n.plural(periodo === 'mensual' ? 'unidad.mes' : 'unidad.anio', cantidad);
}
