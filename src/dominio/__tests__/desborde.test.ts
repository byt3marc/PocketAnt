import { evaluarDesborde } from '../desborde';

describe('evaluarDesborde', () => {
  it('no decide nada mientras no se haya medido la ventana', () => {
    expect(evaluarDesborde(0, 900, 0, 46)).toEqual({ desborda: false, reduccion: 0 });
  });

  it('si el contenido cabe (o iguala la ventana) no hay scroll ni se comprime', () => {
    expect(evaluarDesborde(800, 700, 0, 46)).toEqual({ desborda: false, reduccion: 0 });
    expect(evaluarDesborde(800, 800, 12, 46)).toEqual({ desborda: false, reduccion: 12 });
  });

  it('ignora diferencias de 1 dp (redondeos de la medida)', () => {
    expect(evaluarDesborde(800, 801, 0, 46)).toEqual({ desborda: false, reduccion: 0 });
  });

  it('si se pasa, resta lo que sobra a la parte comprimible', () => {
    expect(evaluarDesborde(780, 809, 0, 46)).toEqual({ desborda: true, reduccion: 29 });
  });

  it('redondea hacia arriba y acumula sobre lo ya reducido', () => {
    expect(evaluarDesborde(780, 784.2, 10, 46)).toEqual({ desborda: true, reduccion: 15 });
  });

  it('no comprime más del máximo: el resto se resuelve con scroll', () => {
    expect(evaluarDesborde(640, 715, 0, 46)).toEqual({ desborda: true, reduccion: 46 });
    expect(evaluarDesborde(640, 700, 46, 46)).toEqual({ desborda: true, reduccion: 46 });
  });
});
