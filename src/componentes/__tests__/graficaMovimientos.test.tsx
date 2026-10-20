import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import type { PuntoDia } from '@/dominio/series';

import { GraficaMovimientos } from '../GraficaMovimientos';

// La gráfica real necesita SVG y gestos nativos: aquí solo importa qué `pointerConfig` monta.
interface PropsEtiqueta {
  style?: { transform?: { translateY?: number }[] };
}

interface PropsLineaCapturada {
  pointerConfig?: {
    pointerLabelComponent?: (items: unknown, secundarios: unknown, indice: number) => ReactElement<PropsEtiqueta>;
  };
}
const mockLineas: PropsLineaCapturada[] = [];

jest.mock('react-native-gifted-charts', () => ({
  LineChart: (props: PropsLineaCapturada) => {
    mockLineas.push(props);
    return null;
  },
  BarChart: () => null,
}));

jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

const punto = (clave: string, ingresos = 0, gastos = 0): PuntoDia => ({
  clave,
  ingresos,
  gastos,
  movimientos: [],
});

/** Monta la gráfica de líneas (de 190 dp, como en la pantalla de detalle) y devuelve su `pointerLabelComponent`. */
async function montarEtiqueta(serie: PuntoDia[]) {
  mockLineas.length = 0;
  const { root } = await render(
    <AjustesProvider>
      <GraficaMovimientos serie={serie} tipo="linea" alto={190} modoEtiquetas="semana" />
    </AjustesProvider>,
  );
  if (!root) throw new Error('no hay elemento raíz que medir');
  // `root` es el View que mide su propio ancho: sin esta medida la gráfica no se pinta.
  await fireEvent.layout(root, { x: 0, y: 0, width: 360, height: 234 });
  const etiqueta = mockLineas[mockLineas.length - 1]?.pointerConfig?.pointerLabelComponent;
  if (!etiqueta) throw new Error('la gráfica no definió pointerLabelComponent');
  return etiqueta;
}

const translateYDe = (nodo: ReactElement<PropsEtiqueta>): number => nodo.props.style?.transform?.[0]?.translateY ?? 0;

describe('GraficaMovimientos · tooltip', () => {
  it('con ambos valores altos desplaza la caja debajo de los dos puntos', async () => {
    const serie = [
      punto('2026-10-12', 5),
      punto('2026-10-13', 4),
      punto('2026-10-14', 8),
      punto('2026-10-15', 6),
      punto('2026-10-16', 20, 18), // viernes: centros en 10 y 29 → ni arriba (−101) ni entre (29 < 136) caben
      punto('2026-10-17', 9),
      punto('2026-10-18', 7),
    ];
    const etiqueta = await montarEtiqueta(serie);
    // Maximo de la escala 20. Debajo: top 44; la librería lo habría dejado en 15 → delta 29.
    expect(translateYDe(etiqueta(null, null, 4))).toBe(29);
  });

  it('sin puntos en pantalla (modo mes) se queda donde la pone la librería', async () => {
    const serie = Array.from({ length: 15 }, (_, i) => punto(`2026-10-${String(i + 1).padStart(2, '0')}`, 10, 5));
    const etiqueta = await montarEtiqueta(serie);
    expect(translateYDe(etiqueta(null, null, 7))).toBe(0);
  });

  it('si ninguna posición cabe tampoco se desplaza', async () => {
    // Centros en 81.25 y 105: arriba faltan dp, entre son 34 < 136 y debajo pasarían de 200.
    const serie = Array.from({ length: 7 }, (_, i) => punto(`2026-10-${String(i + 12).padStart(2, '0')}`, 50, 40));
    const etiqueta = await montarEtiqueta(serie);
    expect(translateYDe(etiqueta(null, null, 3))).toBe(0);
  });
});
