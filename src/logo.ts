/**
 * Geometría del logo (una hormiga de contorno: cabeza y tórax en punto, abdomen en anillo y patas curvas),
 * en un lienzo de 108 × 108 como las capas de los iconos adaptativos de Android. Está dibujada con el estilo
 * de los iconos temáticos de Google (Gmail, Calendar…): trazo grueso y uniforme, puntas redondeadas y aire
 * entre las formas. Es solo datos, sin imports: la usan el componente `Logo` y el script que genera los PNG
 * de `assets/images/`, así que no pueden diverger.
 */
export const LIENZO_LOGO = 108;
export const GROSOR_TRAZO_LOGO = 4.2;

/** Recuadro que contiene el dibujo (con margen para el trazo), para mostrarlo ajustado en la app. */
export const LIMITES_LOGO = { x: 30, y: 28, ancho: 48, alto: 52 } as const;

/** Colores de la paleta de Google (los de los iconos de Workspace). */
export const COLORES_LOGO = {
  azul: '#4285F4',
  rojo: '#EA4335',
  amarillo: '#FBBC04',
  verde: '#34A853',
} as const;

export type ColorLogo = keyof typeof COLORES_LOGO;

export type FormaLogo =
  | { tipo: 'circulo'; cx: number; cy: number; r: number; color: ColorLogo }
  /** Circunferencia sin relleno; `r` es el radio de la línea central del trazo. */
  | { tipo: 'anillo'; cx: number; cy: number; r: number; color: ColorLogo }
  /** Trazo grueso con puntas y uniones redondeadas (`M`, `L` y `Q` de SVG). */
  | { tipo: 'trazo'; d: string; color: ColorLogo };

export const FORMAS_LOGO: readonly FormaLogo[] = [
  // Antenas
  { tipo: 'trazo', d: 'M51.5 36 Q49 32.5 45.5 31.5', color: 'verde' },
  { tipo: 'trazo', d: 'M56.5 36 Q59 32.5 62.5 31.5', color: 'verde' },
  // Patas (tres pares)
  { tipo: 'trazo', d: 'M50.5 50 Q41 47 37.5 39', color: 'rojo' },
  { tipo: 'trazo', d: 'M57.5 50 Q67 47 70.5 39', color: 'rojo' },
  { tipo: 'trazo', d: 'M49.5 54 Q39 55 34 62', color: 'rojo' },
  { tipo: 'trazo', d: 'M58.5 54 Q69 55 74 62', color: 'rojo' },
  { tipo: 'trazo', d: 'M50.5 58 Q43 64 41.5 73', color: 'rojo' },
  { tipo: 'trazo', d: 'M57.5 58 Q65 64 66.5 73', color: 'rojo' },
  // Cuerpo: cabeza, tórax y abdomen
  { tipo: 'circulo', cx: 54, cy: 40, r: 4.8, color: 'verde' },
  { tipo: 'circulo', cx: 54, cy: 52, r: 4.4, color: 'amarillo' },
  { tipo: 'anillo', cx: 54, cy: 68.5, r: 7.9, color: 'azul' },
];
