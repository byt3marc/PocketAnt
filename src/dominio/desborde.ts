/** Cuánto puede sobrar el contenido (dp) sin que cuente como desborde: redondeos de la medida. */
export const TOLERANCIA_DESBORDE = 1;

export interface ResultadoDesborde {
  /** `true` si, tal como está, el contenido no cabe en la ventana (hace falta scroll). */
  desborda: boolean;
  /** Cuánto hay que quitarle en total a la parte comprimible para que quepa, sin pasar del máximo. */
  reduccion: number;
}

/**
 * Decide si una pantalla debe hacer scroll. Si el contenido sobrepasa la ventana, lo que sobra se resta a la
 * parte comprimible (`reduccion`, hasta `reduccionMaxima`); si aun así no cabe, queda el scroll.
 * `ventana` en 0 significa «todavía sin medir»: no se decide nada.
 */
export function evaluarDesborde(
  ventana: number,
  contenido: number,
  reduccion: number,
  reduccionMaxima: number,
): ResultadoDesborde {
  if (ventana <= 0) return { desborda: false, reduccion };
  const exceso = contenido - ventana;
  if (exceso <= TOLERANCIA_DESBORDE) return { desborda: false, reduccion };
  return { desborda: true, reduccion: Math.min(reduccion + Math.ceil(exceso), reduccionMaxima) };
}
