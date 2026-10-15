import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { ENTRADAS, MAX_ESCALONES } from '@/animacion/constantes';
import { paletaClara } from '@/tema/paleta';

import { Contador } from '../Contador';
import { Entrada } from '../Entrada';
import { PresionableEscala } from '../PresionableEscala';
import { Revelar } from '../Revelar';
import { anchoDeSegmento, SelectorSegmentado } from '../SelectorSegmentado';
import { Tarjeta } from '../Tarjeta';
import { Texto } from '../Texto';

// Los ajustes persisten en SQLite; en las pruebas se usan valores fijos en memoria.
jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

const conAjustes = (ui: ReactElement) => <AjustesProvider>{ui}</AjustesProvider>;

// Reanimated va con su mock oficial (jest.setup.js): no hay hilo de interfaz y las animaciones terminan al instante.
// Estas pruebas comprueban lo que sí se puede ver desde JavaScript: qué se pinta, en qué estado y con qué cuentas.
const movimientoReducido = jest.mocked(useReducedMotion);
afterEach(() => {
  movimientoReducido.mockReturnValue(false);
});

describe('PresionableEscala', () => {
  const tocable = (alPulsar = jest.fn()) => (
    <PresionableEscala accessibilityRole="button" accessibilityLabel="Tocar" onPress={alPulsar}>
      <Text>Hola</Text>
    </PresionableEscala>
  );

  it('se encoge un 3 % al poner el dedo y vuelve al soltarlo', async () => {
    await render(tocable());
    const boton = screen.getByRole('button', { name: 'Tocar' });
    expect(boton).toHaveStyle({ transform: [{ scale: 1 }] });

    await fireEvent(boton, 'pressIn');
    expect(boton).toHaveStyle({ transform: [{ scale: 0.97 }] });

    await fireEvent(boton, 'pressOut');
    expect(boton).toHaveStyle({ transform: [{ scale: 1 }] });
  });

  it('con «reducir animaciones» no se mueve', async () => {
    movimientoReducido.mockReturnValue(true);
    await render(tocable());
    const boton = screen.getByRole('button', { name: 'Tocar' });
    await fireEvent(boton, 'pressIn');
    expect(boton).toHaveStyle({ transform: [{ scale: 1 }] });
  });

  it('sigue avisando de los toques y de poner/quitar el dedo', async () => {
    const alPulsar = jest.fn();
    const alPonerDedo = jest.fn();
    await render(
      <PresionableEscala accessibilityRole="button" accessibilityLabel="Tocar" onPress={alPulsar} onPressIn={alPonerDedo}>
        <Text>Hola</Text>
      </PresionableEscala>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Tocar' }));
    expect(alPulsar).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByRole('button', { name: 'Tocar' }), 'pressIn');
    expect(alPonerDedo).toHaveBeenCalledTimes(1);
  });
});

describe('Entrada y Revelar', () => {
  it('Entrada muestra su contenido, también con «reducir animaciones»', async () => {
    const { rerender } = await render(
      <Entrada indice={2}>
        <Text>Tarjeta</Text>
      </Entrada>,
    );
    expect(screen.getByText('Tarjeta')).toBeTruthy();

    movimientoReducido.mockReturnValue(true);
    await rerender(
      <Entrada indice={9} deslizar>
        <Text>Tarjeta</Text>
      </Entrada>,
    );
    expect(screen.getByText('Tarjeta')).toBeTruthy();
  });

  it('hay un turno de entrada por escalón y los de más allá del último comparten el suyo', () => {
    expect(ENTRADAS).toHaveLength(MAX_ESCALONES + 1);
  });

  it('Revelar monta y desmonta su contenido', async () => {
    const { rerender } = await render(<Revelar>{null}</Revelar>);
    expect(screen.queryByText('Horas')).toBeNull();

    await rerender(
      <Revelar>
        <Text>Horas</Text>
      </Revelar>,
    );
    expect(screen.getByText('Horas')).toBeTruthy();

    await rerender(<Revelar>{null}</Revelar>);
    expect(screen.queryByText('Horas')).toBeNull();
  });
});

describe('Tarjeta', () => {
  it('con «deslizar» recorta lo que se sale mientras crece, y sin él se queda como siempre', async () => {
    await render(
      conAjustes(
        <>
          <Tarjeta testID="fija">
            <Text>A</Text>
          </Tarjeta>
          <Tarjeta testID="desliza" deslizar>
            <Text>B</Text>
          </Tarjeta>
        </>,
      ),
    );
    expect(screen.getByTestId('desliza')).toHaveStyle({ overflow: 'hidden', backgroundColor: paletaClara.superficie });
    expect(screen.getByTestId('fija')).not.toHaveStyle({ overflow: 'hidden' });
  });
});

describe('Texto animado', () => {
  it('conserva el color de siempre: la transición solo suaviza el cambio', async () => {
    await render(
      conAjustes(
        <>
          <Texto color="primario" animado>
            Elegido
          </Texto>
          <Texto color="primario">Normal</Texto>
        </>,
      ),
    );
    expect(screen.getByText('Elegido')).toHaveStyle({ color: paletaClara.primario });
    expect(screen.getByText('Normal')).toHaveStyle({ color: paletaClara.primario });
  });
});

describe('SelectorSegmentado: píldora', () => {
  const opciones = [
    { valor: 'a', etiqueta: 'Uno' },
    { valor: 'b', etiqueta: 'Dos' },
    { valor: 'c', etiqueta: 'Tres' },
  ] as const;

  const selector = (valor: 'a' | 'b' | 'c') => (
    <SelectorSegmentado opciones={opciones} valor={valor} onCambio={() => {}} etiquetaAccesible="Prueba" />
  );
  /** Mide el selector como lo haría el teléfono. */
  const medir = (ancho: number) =>
    fireEvent(screen.getByLabelText('Prueba'), 'layout', { nativeEvent: { layout: { width: ancho, height: 44 } } });

  it('cada segmento mide lo mismo: el ancho menos el relleno de los lados, entre las opciones', () => {
    expect(anchoDeSegmento(306, 3)).toBe(100);
    expect(anchoDeSegmento(206, 2)).toBe(100);
    // Antes de medir (ancho 0) no hay ancho negativo.
    expect(anchoDeSegmento(0, 3)).toBe(0);
  });

  it('sigue la opción elegida y tiene la píldora aunque se mida o cambie de tamaño', async () => {
    const { rerender } = await render(conAjustes(selector('a')));
    expect(screen.getByTestId('pildora-selector')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Uno' })).toBeSelected();

    await medir(306);
    await medir(206);
    await rerender(conAjustes(selector('c')));
    expect(screen.getByRole('radio', { name: 'Tres' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Uno' })).not.toBeSelected();
  });

  it('con una opción que no existe se queda en la primera, sin romperse', async () => {
    await render(conAjustes(selector('zzz' as 'a')));
    expect(screen.getByRole('radio', { name: 'Uno' })).not.toBeSelected();
    expect(screen.getByTestId('pildora-selector')).toBeTruthy();
  });
});

describe('Contador', () => {
  const contador = (valor: number, alCambiar = jest.fn()) =>
    conAjustes(
      <Contador valor={valor} min={1} max={3} onCambio={alCambiar} etiquetaMenos="Menos" etiquetaMas="Más" />,
    );

  it('sube y baja de uno en uno, sin pasar de sus límites', async () => {
    const alCambiar = jest.fn();
    const { rerender } = await render(contador(2, alCambiar));
    await fireEvent.press(screen.getByRole('button', { name: 'Más' }));
    expect(alCambiar).toHaveBeenLastCalledWith(3);
    await fireEvent.press(screen.getByRole('button', { name: 'Menos' }));
    expect(alCambiar).toHaveBeenLastCalledWith(1);

    await rerender(contador(3, alCambiar));
    expect(screen.getByRole('button', { name: 'Más' })).toBeDisabled();
    await rerender(contador(1, alCambiar));
    expect(screen.getByRole('button', { name: 'Menos' })).toBeDisabled();
  });

  it('muestra el valor nuevo al cambiar, con y sin «reducir animaciones»', async () => {
    const { rerender } = await render(contador(1));
    expect(screen.getByText('1')).toBeTruthy();
    await rerender(contador(2));
    expect(screen.getByText('2')).toBeTruthy();

    movimientoReducido.mockReturnValue(true);
    await rerender(contador(3));
    expect(screen.getByText('3')).toBeTruthy();
  });
});
