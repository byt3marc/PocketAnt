import { posicionTooltip, topLibreria } from '../tooltip';

// Mismas medidas que la gráfica de detalle: plot de 190 dp y caja de 96 dp.
const ALTO_PLOT = 190;
const ALTO_TOOLTIP = 96;

/** Centro de un punto (el Y de `getY`): el plot va de 10 (máximo) a `ALTO_PLOT + 10` (cero). */
const centro = (valor: number, maximo = 300) => ALTO_PLOT + 10 - (valor * ALTO_PLOT) / maximo;

describe('topLibreria', () => {
  it('con hueco deja la caja 10 dp bajo el puntero', () => {
    expect(topLibreria(10, ALTO_TOOLTIP)).toBe(20);
    expect(topLibreria(85, ALTO_TOOLTIP)).toBe(95);
  });

  it('sin hueco la pega encima: el umbral es `altoTooltip − 10`', () => {
    expect(topLibreria(86, ALTO_TOOLTIP)).toBe(-10);
    expect(topLibreria(150, ALTO_TOOLTIP)).toBe(54);
  });
});

describe('posicionTooltip', () => {
  it('viernes con ambos valores altos: ni arriba ni entre caben, la caja va debajo', () => {
    // Centros en 10 y 48: arriba no hay 106 dp libres y entre (48) no llega a los 136 pedidos.
    // Top de la caja: 53 + 10 = 63 (el borde inferior queda en 159, dentro del plot).
    expect(posicionTooltip(centro(300), centro(240), ALTO_PLOT, ALTO_TOOLTIP)).toBe(63);
  });

  it('con un solo punto lo deja entre el punto y la línea base si cabe', () => {
    // Ingresos en 0: su punto está sobre la base (centro 200) y no se protege nada por debajo.
    // Entre ambos: top 43 + 2·5 + 10 = 63 (borde inferior 159, 36 dp sobre la base).
    expect(posicionTooltip(centro(240), centro(0), ALTO_PLOT, ALTO_TOOLTIP)).toBe(63);
  });

  it('con valores iguales y en la zona media, la caja va debajo de ambos', () => {
    const centroPunto = centro(200);
    expect(posicionTooltip(centroPunto, centroPunto, ALTO_PLOT, ALTO_TOOLTIP)).toBeCloseTo(
      centroPunto + 15,
      1,
    );
  });

  it('con uno en 0 y el otro bajo, la caja va arriba (entre no cabía)', () => {
    // Centro en 136.67: arriba sobran 25.67 dp de los 2 mínimos; entre pide 136 y solo hay 73.33.
    expect(posicionTooltip(centro(100), centro(0), ALTO_PLOT, ALTO_TOOLTIP)).toBeCloseTo(25.67, 1);
  });

  it('con ambos valores en 0 no hay puntos que proteger', () => {
    // Un valor 0 pinta su punto sobre la línea base: centro = `ALTO_PLOT + 10`.
    expect(posicionTooltip(ALTO_PLOT + 10, ALTO_PLOT + 10, ALTO_PLOT, ALTO_TOOLTIP)).toBeNull();
  });

  it('límite exacto de «entre»: con el hueco justo sí cabe', () => {
    // yBot − yTop = 141 − 5 = 136 = altoTooltip + 2·hueco + 4·RADIO_PUNTERO.
    expect(posicionTooltip(10, 136, ALTO_PLOT, ALTO_TOOLTIP)).toBe(25);
  });

  it('dos dp menos de «entre» y nada más cabe: null', () => {
    // yBot − yTop = 139 − 5 = 134; debajo, 139 + 106 = 245 > 200.
    expect(posicionTooltip(10, 134, ALTO_PLOT, ALTO_TOOLTIP)).toBeNull();
  });

  it('límite exacto de «arriba»: con los 2 dp mínimos sí cabe', () => {
    // yTop − hueco − altoTooltip = 108 − 10 − 96 = 2.
    expect(posicionTooltip(113, 113, ALTO_PLOT, ALTO_TOOLTIP)).toBe(2);
  });

  it('un dp menos de «arriba» y nada más cabe: null', () => {
    // yTop − hueco − altoTooltip = 1; el hueco es 0 y debajo, 117 + 106 = 223 > 200.
    expect(posicionTooltip(112, 112, ALTO_PLOT, ALTO_TOOLTIP)).toBeNull();
  });

  it('con ambos puntos en la zona media no hay sitio: null', () => {
    expect(posicionTooltip(100, 110, ALTO_PLOT, ALTO_TOOLTIP)).toBeNull();
  });
});
