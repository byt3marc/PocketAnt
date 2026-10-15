import type { Moneda } from './moneda';

const MENOS = '−';
const ESPACIO_FIJO = ' ';

const formateadores = new Map<string, Intl.NumberFormat>();

function formatearNumero(valor: number, locale?: string): string {
  try {
    const clave = locale ?? '';
    let formateador = formateadores.get(clave);
    if (!formateador) {
      formateador = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      formateadores.set(clave, formateador);
    }
    return formateador.format(valor);
  } catch {
    // Si el motor no soporta Intl o el locale no es válido: formato simple con comas.
    const [entera, decimal] = valor.toFixed(2).split('.');
    return `${entera.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimal}`;
  }
}

export interface OpcionesMonto {
  /** Muestra "+" en positivos (el "−" de los negativos siempre se muestra). */
  conSigno?: boolean;
  /** Etiqueta BCP 47 (p. ej. "es-PE") para separadores de miles y decimales. */
  locale?: string;
}

/** "$1,250.00", "S/ 1,250.00", "−$12.00", "+$50.00". */
export function formatearMonto(valor: number, moneda: Moneda, opciones: OpcionesMonto = {}): string {
  const redondeado = Math.round(valor * 100) / 100;
  const cuerpo = formatearNumero(Math.abs(redondeado), opciones.locale);
  const simbolo = moneda.simbolo.length > 1 ? `${moneda.simbolo}${ESPACIO_FIJO}` : moneda.simbolo;
  const signo = redondeado < 0 ? MENOS : opciones.conSigno && redondeado > 0 ? '+' : '';
  return `${signo}${simbolo}${cuerpo}`;
}

/** Para los ejes de las gráficas: 950, 1.2k, 3M. */
export function formatearCompacto(valor: number): string {
  const abs = Math.abs(valor);
  const recortar = (n: number, decimales: number) => String(Number(n.toFixed(decimales)));
  if (abs >= 1_000_000) return `${recortar(abs / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${recortar(abs / 1_000, 1)}k`;
  return recortar(abs, abs < 10 ? 2 : 0);
}

export const MAX_ENTEROS_MONTO = 9;

/**
 * Filtra lo que el usuario escribe en el campo de monto: solo dígitos y un separador
 * decimal (acepta "," o "."), con máximo 2 decimales. Devuelve el texto normalizado con ".".
 */
export function limpiarEntradaMonto(texto: string): string {
  const soloNumeros = texto.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [entera = '', ...resto] = soloNumeros.split('.');
  const enteraLimitada = entera.slice(0, MAX_ENTEROS_MONTO);
  if (resto.length === 0) return enteraLimitada;
  return `${enteraLimitada}.${resto.join('').slice(0, 2)}`;
}

/** Texto del campo de monto → número, o `null` si todavía no es un número. */
export function parsearMonto(texto: string): number | null {
  const limpio = limpiarEntradaMonto(texto);
  if (limpio === '' || limpio === '.') return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

/** Tamaño de un archivo en decimal, como lo muestran las tiendas: "2.6 GB", "475 MB". */
export function formatearTamano(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}

/** RAM del teléfono como la anuncia el fabricante (en GiB redondeados): 17 179 869 184 bytes → "16 GB". */
export function formatearRam(bytes: number): string {
  const gib = bytes / 2 ** 30;
  return `${gib >= 10 ? Math.round(gib) : Number(gib.toFixed(1))} GB`;
}
