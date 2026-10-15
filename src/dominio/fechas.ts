import { DIAS_CORTOS, DIAS_INICIALES, MESES_CORTOS } from '@/i18n/calendario';
import type { I18n, Idioma } from '@/i18n/traducir';

const MS_POR_DIA = 86_400_000;

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Los días se manejan como claves `YYYY-MM-DD` en hora local, sin zona horaria. */
export function claveDeFecha(fecha: Date): string {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

export function hoy(ahora: Date = new Date()): string {
  return claveDeFecha(ahora);
}

export function fechaDeClave(clave: string): Date {
  const [anio, mes, dia] = clave.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

export function esClaveValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  // Ida y vuelta: descarta fechas imposibles como 2026-02-31.
  return claveDeFecha(fechaDeClave(valor)) === valor;
}

export function sumarDias(clave: string, dias: number): string {
  const fecha = fechaDeClave(clave);
  fecha.setDate(fecha.getDate() + dias);
  return claveDeFecha(fecha);
}

export function diasEntre(desde: string, hasta: string): number {
  const a = fechaDeClave(desde);
  const b = fechaDeClave(hasta);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / MS_POR_DIA);
}

/** Las `dias` claves que terminan en `diaFinal` (inclusive), de la más antigua a la más reciente. */
export function ventanaDeDias(diaFinal: string, dias: number): string[] {
  return Array.from({ length: dias }, (_, i) => sumarDias(diaFinal, i - (dias - 1)));
}

/** "Lun" / "Mon". */
export function nombreDiaCorto(clave: string, idioma: Idioma): string {
  return DIAS_CORTOS[idioma][fechaDeClave(clave).getDay()];
}

/** "L" / "M": para los ejes de las gráficas compactas. */
export function inicialDia(clave: string, idioma: Idioma): string {
  return DIAS_INICIALES[idioma][fechaDeClave(clave).getDay()];
}

export function numeroDia(clave: string): number {
  return fechaDeClave(clave).getDate();
}

/** "Hoy", "Ayer", "Vie 9 oct" / "Fri Oct 9" o, si es de otro año, con el año. */
export function formatearDia(clave: string, i18n: I18n, referencia: string = hoy()): string {
  if (clave === referencia) return i18n.t('fecha.hoy');
  if (clave === sumarDias(referencia, -1)) return i18n.t('fecha.ayer');
  const fecha = fechaDeClave(clave);
  const partes = {
    dia: DIAS_CORTOS[i18n.idioma][fecha.getDay()],
    num: fecha.getDate(),
    mes: MESES_CORTOS[i18n.idioma][fecha.getMonth()],
  };
  return fecha.getFullYear() === fechaDeClave(referencia).getFullYear()
    ? i18n.t('fecha.formato_dia', partes)
    : i18n.t('fecha.formato_dia_anio', { ...partes, anio: fecha.getFullYear() });
}

/** "Mié 14 oct" / "Wed 14 Oct": siempre la fecha, sin «Hoy» ni «Ayer» ni el año. */
export function formatearFechaCorta(clave: string, i18n: I18n): string {
  const fecha = fechaDeClave(clave);
  return i18n.t('fecha.formato_dia', {
    dia: DIAS_CORTOS[i18n.idioma][fecha.getDay()],
    num: fecha.getDate(),
    mes: MESES_CORTOS[i18n.idioma][fecha.getMonth()],
  });
}

/** "6 – 12 oct", "28 sep – 4 oct" o, si cruza de año, con el año en ambos extremos. */
export function formatearRango(inicio: string, fin: string, i18n: I18n): string {
  const a = fechaDeClave(inicio);
  const b = fechaDeClave(fin);
  const meses = MESES_CORTOS[i18n.idioma];
  if (a.getFullYear() !== b.getFullYear()) {
    return i18n.t('fecha.rango_anios', {
      d1: a.getDate(),
      m1: meses[a.getMonth()],
      a1: a.getFullYear(),
      d2: b.getDate(),
      m2: meses[b.getMonth()],
      a2: b.getFullYear(),
    });
  }
  if (a.getMonth() === b.getMonth()) {
    return i18n.t('fecha.rango_mismo_mes', { d1: a.getDate(), d2: b.getDate(), mes: meses[b.getMonth()] });
  }
  return i18n.t('fecha.rango_distinto_mes', {
    d1: a.getDate(),
    m1: meses[a.getMonth()],
    d2: b.getDate(),
    m2: meses[b.getMonth()],
  });
}
