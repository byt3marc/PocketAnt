export interface Escala {
  maximo: number;
  paso: number;
  secciones: number;
}

const MULTIPLOS = [1, 2, 2.5, 5, 10];

/** Escala "bonita" (1, 2, 2.5, 5 × 10ⁿ) para que el eje Y muestre valores redondos. */
export function calcularEscala(valorMaximo: number, secciones = 4): Escala {
  if (!(valorMaximo > 0)) {
    return { maximo: 100, paso: 100 / secciones, secciones };
  }
  const crudo = valorMaximo / secciones;
  const base = 10 ** Math.floor(Math.log10(crudo));
  const multiplo = MULTIPLOS.find((m) => m * base >= crudo - 1e-9) ?? 10;
  const paso = Number((multiplo * base).toPrecision(12));
  return { maximo: Number((paso * secciones).toPrecision(12)), paso, secciones };
}
