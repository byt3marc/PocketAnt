import { en } from './en';
import { es, type ClaveTexto } from './es';

export type { ClaveTexto } from './es';

export type Idioma = 'es' | 'en';
export type PreferenciaIdioma = 'sistema' | Idioma;
export type Parametros = Record<string, string | number>;

export type TFn = (clave: ClaveTexto, parametros?: Parametros) => string;

/** Claves base que tienen variantes `_uno` / `_otros`. */
export type ClavePlural = {
  [K in ClaveTexto]: K extends `${infer Base}_uno` ? Base : never;
}[ClaveTexto];
export type PluralFn = (base: ClavePlural, n: number, parametros?: Parametros) => string;

export interface I18n {
  idioma: Idioma;
  /** Traduce una clave, sustituyendo los `{marcadores}`. */
  t: TFn;
  /** Elige `<base>_uno` si `n === 1` y `<base>_otros` en cualquier otro caso; `{n}` ya viene incluido. */
  plural: PluralFn;
}

const diccionarios: Record<Idioma, Record<ClaveTexto, string>> = { es, en };

function interpolar(texto: string, parametros?: Parametros): string {
  if (!parametros) return texto;
  return texto.replace(/\{(\w+)\}/g, (marcador, nombre: string) =>
    nombre in parametros ? String(parametros[nombre]) : marcador,
  );
}

export function crearI18n(idioma: Idioma): I18n {
  const diccionario = diccionarios[idioma];
  const t: TFn = (clave, parametros) => interpolar(diccionario[clave], parametros);
  const plural: PluralFn = (base, n, parametros) =>
    t(`${base}_${n === 1 ? 'uno' : 'otros'}` as ClaveTexto, { n, ...parametros });
  return { idioma, t, plural };
}

export const IDIOMA_POR_DEFECTO: Idioma = 'en';

/** Idioma de la app según el ajuste del usuario y el idioma del dispositivo (`languageCode`, p. ej. "es"). */
export function resolverIdioma(preferencia: PreferenciaIdioma, codigoDelSistema?: string | null): Idioma {
  if (preferencia !== 'sistema') return preferencia;
  if (codigoDelSistema === 'es' || codigoDelSistema === 'en') return codigoDelSistema;
  return IDIOMA_POR_DEFECTO;
}

export function esPreferenciaDeIdioma(valor: unknown): valor is PreferenciaIdioma {
  return valor === 'sistema' || valor === 'es' || valor === 'en';
}
