import { act, fireEvent, render, screen } from '@testing-library/react-native';

import Moneda from '@/app/moneda';
import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { guardarAjustes } from '@/ajustes/almacen';
import { DURACION } from '@/animacion/constantes';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => {
  const margenes = { top: 0, bottom: 0, left: 0, right: 0 };
  return { useSafeAreaInsets: () => margenes };
});
jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

jest.useFakeTimers();

const avanzar = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

const montar = () =>
  render(
    <AjustesProvider>
      <Moneda />
    </AjustesProvider>,
  );

beforeEach(() => {
  mockBack.mockClear();
});

describe('Moneda: elegir y volver', () => {
  it('al elegir una moneda se guarda y se vuelve a Ajustes cuando ya se vio el cambio, no antes', async () => {
    await montar();
    // «Automática» también nombra la moneda detectada (USD): se distingue por el « · $» de la fila de la moneda.
    expect(screen.getByRole('radio', { name: /USD · \$/ })).toBeSelected();

    await fireEvent.press(screen.getByRole('radio', { name: /EUR/ }));
    expect(guardarAjustes).toHaveBeenLastCalledWith(expect.objectContaining({ moneda: 'EUR' }));
    // El check ya pasó a la fila nueva, pero todavía no se vuelve.
    expect(screen.getByRole('radio', { name: /EUR/ })).toBeSelected();
    expect(mockBack).not.toHaveBeenCalled();

    await avanzar(DURACION.eleccion - 1);
    expect(mockBack).not.toHaveBeenCalled();
    await avanzar(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('un segundo toque mientras se espera no vuelve atrás dos veces ni cambia la elección', async () => {
    await montar();
    await fireEvent.press(screen.getByRole('radio', { name: /EUR/ }));
    await fireEvent.press(screen.getByRole('radio', { name: /GBP/ }));
    await avanzar(DURACION.eleccion * 3);

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', { name: /EUR/ })).toBeSelected();
  });

  it('si se sale antes de tiempo (botón atrás del sistema) no se vuelve una vez más', async () => {
    const { unmount } = await montar();
    await fireEvent.press(screen.getByRole('radio', { name: /EUR/ }));
    await unmount();
    await avanzar(DURACION.eleccion * 3);
    expect(mockBack).not.toHaveBeenCalled();
  });
});
