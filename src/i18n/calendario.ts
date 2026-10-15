import type { Idioma } from './traducir';

export const DIAS_CORTOS: Record<Idioma, readonly string[]> = {
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

/** En plural y minúscula (en español) para frases como «Los sábados concentran…». */
export const DIAS_PLURALES: Record<Idioma, readonly string[]> = {
  es: ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'],
  en: ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'],
};

/** Iniciales para los ejes de las gráficas compactas. */
export const DIAS_INICIALES: Record<Idioma, readonly string[]> = {
  es: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};

export const MESES_LARGOS: Record<Idioma, readonly string[]> = {
  es: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

export const MESES_CORTOS: Record<Idioma, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
