import type { Idioma } from '@/i18n/traducir';

import datos from './privacidad.json';

/**
 * La política de privacidad sale de una sola fuente, `privacidad.json`: la pantalla de la app la muestra y
 * `scripts/politica-html.mjs` genera con ella la página web que se publica (Google Play pide las dos cosas). Si cambia
 * algo que hace la app con los datos, se cambia ahí, se actualiza la fecha y se vuelve a generar la página.
 */
export interface SeccionPolitica {
  titulo: string;
  parrafos: string[];
}

export interface PoliticaPrivacidad {
  titulo: string;
  fecha: string;
  intro: string;
  secciones: SeccionPolitica[];
  /** «Contacto: correo», o `null` mientras no haya un correo puesto en el JSON. */
  contacto: string | null;
}

export function politicaDePrivacidad(idioma: Idioma): PoliticaPrivacidad {
  const texto = datos[idioma];
  const correo = datos.contacto.trim();
  return {
    titulo: texto.titulo,
    fecha: texto.fecha,
    intro: texto.intro,
    secciones: texto.secciones,
    contacto: correo ? texto.contacto.replace('{correo}', correo) : null,
  };
}
