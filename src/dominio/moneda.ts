import type { ClaveTexto, I18n } from '@/i18n/traducir';

export interface Moneda {
  codigo: string;
  simbolo: string;
}

/** Valor del ajuste que significa "detectar según la región del dispositivo". */
export const MONEDA_AUTOMATICA = 'auto';

export const MONEDA_POR_DEFECTO: Moneda = { codigo: 'USD', simbolo: '$' };

export const MONEDAS: readonly Moneda[] = [
  MONEDA_POR_DEFECTO,
  { codigo: 'EUR', simbolo: '€' },
  { codigo: 'GBP', simbolo: '£' },
  { codigo: 'PEN', simbolo: 'S/' },
  { codigo: 'MXN', simbolo: '$' },
  { codigo: 'COP', simbolo: '$' },
  { codigo: 'ARS', simbolo: '$' },
  { codigo: 'CLP', simbolo: '$' },
  { codigo: 'UYU', simbolo: '$U' },
  { codigo: 'BOB', simbolo: 'Bs' },
  { codigo: 'BRL', simbolo: 'R$' },
  { codigo: 'PYG', simbolo: '₲' },
  { codigo: 'DOP', simbolo: 'RD$' },
  { codigo: 'GTQ', simbolo: 'Q' },
  { codigo: 'CRC', simbolo: '₡' },
  { codigo: 'CAD', simbolo: '$' },
  { codigo: 'CHF', simbolo: 'CHF' },
  { codigo: 'JPY', simbolo: '¥' },
  { codigo: 'CNY', simbolo: '¥' },
  { codigo: 'INR', simbolo: '₹' },
];

export function buscarMoneda(codigo: string): Moneda | undefined {
  return MONEDAS.find((m) => m.codigo === codigo);
}

/** Nombre de la moneda en el idioma activo; si no está en la lista (p. ej. SEK) se usa el código. */
export function nombreDeMoneda(moneda: Moneda, i18n: I18n): string {
  return buscarMoneda(moneda.codigo) ? i18n.t(`divisa.${moneda.codigo}` as ClaveTexto) : moneda.codigo;
}

export function esAjusteDeMonedaValido(valor: unknown): valor is string {
  return valor === MONEDA_AUTOMATICA || (typeof valor === 'string' && buscarMoneda(valor) !== undefined);
}

export interface MonedaDelDispositivo {
  currencyCode: string | null;
  currencySymbol: string | null;
}

/**
 * Convierte el ajuste del usuario en una moneda concreta.
 * En modo automático usa la región del dispositivo; si no se puede detectar, `$`.
 */
export function resolverMoneda(ajuste: string, dispositivo?: MonedaDelDispositivo | null): Moneda {
  if (ajuste !== MONEDA_AUTOMATICA) {
    return buscarMoneda(ajuste) ?? MONEDA_POR_DEFECTO;
  }
  const codigo = dispositivo?.currencyCode;
  if (!codigo) return MONEDA_POR_DEFECTO;
  const conocida = buscarMoneda(codigo);
  if (conocida) return conocida;
  return { codigo, simbolo: dispositivo?.currencySymbol || codigo };
}
