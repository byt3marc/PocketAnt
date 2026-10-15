import { FORMAS_LOGO, GROSOR_TRAZO_LOGO, LIENZO_LOGO, LIMITES_LOGO } from '../logo';

/** Extremos (x e y mínimos y máximos) del dibujo, contando el grosor del trazo. */
function cajaDelDibujo() {
  const caja = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const incluir = (x: number, y: number, margen: number) => {
    caja.x0 = Math.min(caja.x0, x - margen);
    caja.y0 = Math.min(caja.y0, y - margen);
    caja.x1 = Math.max(caja.x1, x + margen);
    caja.y1 = Math.max(caja.y1, y + margen);
  };
  for (const forma of FORMAS_LOGO) {
    if (forma.tipo === 'circulo') {
      incluir(forma.cx, forma.cy, forma.r);
    } else if (forma.tipo === 'anillo') {
      incluir(forma.cx, forma.cy, forma.r + GROSOR_TRAZO_LOGO / 2);
    } else {
      const numeros = forma.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      for (let i = 0; i < numeros.length; i += 2) incluir(numeros[i], numeros[i + 1], GROSOR_TRAZO_LOGO / 2);
    }
  }
  return caja;
}

describe('logo', () => {
  it('el dibujo cabe en el recuadro declarado (el Logo de la app lo recorta con él)', () => {
    const caja = cajaDelDibujo();
    expect(caja.x0).toBeGreaterThanOrEqual(LIMITES_LOGO.x);
    expect(caja.y0).toBeGreaterThanOrEqual(LIMITES_LOGO.y);
    expect(caja.x1).toBeLessThanOrEqual(LIMITES_LOGO.x + LIMITES_LOGO.ancho);
    expect(caja.y1).toBeLessThanOrEqual(LIMITES_LOGO.y + LIMITES_LOGO.alto);
  });

  it('el recuadro no deja mucho aire alrededor del dibujo', () => {
    const caja = cajaDelDibujo();
    expect(caja.x0 - LIMITES_LOGO.x).toBeLessThan(4);
    expect(caja.y0 - LIMITES_LOGO.y).toBeLessThan(4);
    expect(LIMITES_LOGO.x + LIMITES_LOGO.ancho - caja.x1).toBeLessThan(4);
    expect(LIMITES_LOGO.y + LIMITES_LOGO.alto - caja.y1).toBeLessThan(4);
  });

  it('el dibujo es simétrico respecto al eje vertical del lienzo', () => {
    const caja = cajaDelDibujo();
    expect(caja.x0 + caja.x1).toBeCloseTo(LIENZO_LOGO, 0);
  });
});
