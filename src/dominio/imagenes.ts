export const MAX_IMAGENES = 5;
/** Lado mayor de la imagen ya comprimida. */
export const MAX_LADO_IMAGEN = 1600;
export const MAX_BYTES_IMAGEN = 2 * 1024 * 1024;

/** Calidades que se prueban, de mayor a menor, hasta que el JPEG baje de `MAX_BYTES_IMAGEN`. */
export const CALIDADES_JPEG = [0.8, 0.6, 0.4] as const;
/** Lados por los que se reduce, de mayor a menor, si las calidades no bastan para cumplir `MAX_BYTES_IMAGEN`. */
export const LADOS_REDUCCION_FINAL = [1200, 900, 640] as const;

/** Una imagen mientras se edita el movimiento: su URI local y si todavía hay que moverla al guardar. */
export interface ImagenBorrador {
  id: string;
  uri: string;
  ancho: number;
  alto: number;
  /** `true` si vive en la caché (recién elegida) y hay que pasarla a su carpeta definitiva. */
  nueva: boolean;
}

/** Reduce el lado mayor a `maxLado`, sin ampliar ni deformar. */
export function medidasComprimidas(ancho: number, alto: number, maxLado = MAX_LADO_IMAGEN): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto);
  if (mayor <= maxLado) return { ancho, alto };
  const escala = maxLado / mayor;
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}
