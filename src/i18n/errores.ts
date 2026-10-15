import type { ClaveTexto, I18n, Parametros } from './traducir';

/** Error cuyo mensaje se traduce en la interfaz (las capas de datos y dominio no conocen el idioma). */
export class ErrorTraducible extends Error {
  readonly clave: ClaveTexto;
  readonly parametros?: Parametros;

  constructor(clave: ClaveTexto, parametros?: Parametros) {
    super(clave);
    this.name = 'ErrorTraducible';
    this.clave = clave;
    this.parametros = parametros;
  }
}

/** Mensaje para mostrar al usuario: traduce los `ErrorTraducible` y usa un texto genérico para el resto. */
export function mensajeDeError(error: unknown, i18n: I18n): string {
  if (error instanceof ErrorTraducible) return i18n.t(error.clave, error.parametros);
  return i18n.t('error.inesperado');
}
