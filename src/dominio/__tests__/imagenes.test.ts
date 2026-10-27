import { MAX_LADO_IMAGEN, medidasComprimidas } from '../imagenes';

describe('medidasComprimidas', () => {
  it('no amplía las imágenes que ya son pequeñas', () => {
    expect(medidasComprimidas(800, 600)).toEqual({ ancho: 800, alto: 600 });
    expect(medidasComprimidas(1200, 1200)).toEqual({ ancho: 1200, alto: 1200 });
  });

  it('reduce el lado mayor conservando la proporción', () => {
    expect(medidasComprimidas(3200, 1600)).toEqual({ ancho: MAX_LADO_IMAGEN, alto: 800 });
    expect(medidasComprimidas(1200, 2400)).toEqual({ ancho: 800, alto: MAX_LADO_IMAGEN });
  });

  it('nunca deja un lado en cero', () => {
    expect(medidasComprimidas(20_000, 1)).toEqual({ ancho: MAX_LADO_IMAGEN, alto: 1 });
  });
});
