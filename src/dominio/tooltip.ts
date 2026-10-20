/**
 * Radio del puntero que la gráfica pinta sobre cada punto al tocarla. Debe ser igual a `radius`
 * de su `pointerConfig`: si cambia, estas fórmulas se descuadran.
 */
export const RADIO_PUNTERO = 5;

/** Hueco mínimo entre la caja del tooltip y los puntos que protege. */
const HUECO_POR_DEFECTO = 10;

/**
 * Top con el que `react-native-gifted-charts` deja la caja por defecto: 10 dp bajo el puntero si hay
 * hueco, o pegada encima si no. Referencia (dist): gifted-charts-core/components/common/StripAndLabel.js.
 * Un upgrade de la librería puede cambiarlo; la prueba visual lo delata.
 */
export function topLibreria(yPuntero: number, altoTooltip: number): number {
  return yPuntero < altoTooltip - 10 ? yPuntero + 10 : yPuntero - altoTooltip;
}

/**
 * Top donde conviene poner la caja para que no tape ninguno de los dos puntos del día:
 *
 * - Arriba de ambos si cabe (con un mínimo de 2 dp desde el borde).
 * - Entre ambos si hay hueco para la caja más `hueco` a cada lado. La banda libre entre los
 *   bordes interiores mide `yBot − yTop − 4·RADIO_PUNTERO`.
 * - Debajo del más bajo si sigue dentro del plot (`0`…`altoPlot + 10`, la librería dibuja
 *   entre `10` y `altoPlot + 10`).
 *
 * Recibe los centros de los puntos (el Y de `getY`, no el del puntero) y aplica `RADIO_PUNTERO`
 * sola: el puntero está 5 dp arriba del centro. `null` si nada cabe o no hay puntos que proteger
 * (los dos valores en 0 dejan sus puntos sobre la línea base).
 */
export function posicionTooltip(
  yg: number,
  yr: number,
  altoPlot: number,
  altoTooltip: number,
  hueco = HUECO_POR_DEFECTO,
): number | null {
  const yTop = Math.min(yg, yr) - RADIO_PUNTERO;
  const yBot = Math.max(yg, yr) + RADIO_PUNTERO;
  if (yg === altoPlot + 10 && yr === altoPlot + 10) return null; // ambos valores en 0
  if (yTop - hueco - altoTooltip >= 2) return yTop - hueco - altoTooltip;
  // Los bordes exteriores de los puntos se comen `4·RADIO_PUNTERO` de la banda libre.
  if (yBot - yTop >= altoTooltip + 2 * hueco + 4 * RADIO_PUNTERO) {
    return yTop + 2 * RADIO_PUNTERO + hueco;
  }
  if (yBot + hueco + altoTooltip <= altoPlot + 10) return yBot + hueco;
  return null;
}
