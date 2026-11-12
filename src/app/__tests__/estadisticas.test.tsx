import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { guardarAjustes } from '@/ajustes/almacen';
import Estadisticas from '@/app/estadisticas';
import { hoy, sumarDias } from '@/dominio/fechas';
import type { Movimiento } from '@/dominio/tipos';

const mockPush = jest.fn();
let mockMovimientos: Movimiento[] = [];

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/datos/DatosProvider', () => ({ useDatos: () => ({ movimientos: mockMovimientos }) }));
jest.mock('@/componentes/BloqueGrafica', () => ({ BloqueGrafica: () => null }));
jest.mock('@/animacion/haptica', () => ({ vibrar: jest.fn() }));
jest.mock('@/ajustes/almacen', () => ({
  // Los ajustes se leen una sola vez, al cargar el módulo: la vista de partida es siempre la de por defecto.
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `m${contador}`,
    tipo: 'gasto',
    monto: 10,
    motivo: 'Algo',
    fecha: hoy(),
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-11-10T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};

const montar = () =>
  render(
    <AjustesProvider>
      <Estadisticas />
    </AjustesProvider>,
  );

const montarEnHistorial = async () => {
  await montar();
  await fireEvent.press(screen.getByRole('radio', { name: 'Historial' }));
};

beforeEach(() => {
  mockPush.mockClear();
  jest.mocked(guardarAjustes).mockClear();
  mockMovimientos = [
    mov({ motivo: 'Café con leche', monto: 4 }),
    mov({ tipo: 'ingreso', motivo: 'Sueldo', monto: 900 }),
    mov({ motivo: 'Pasaje', monto: 2, fecha: sumarDias(hoy(), -2) }),
  ];
});

describe('Gráficas e Historial', () => {
  it('abre en las gráficas y el selector lleva al historial, que se recuerda', async () => {
    await montar();
    expect(screen.getByText('Tipo de gráfica')).toBeTruthy();
    expect(screen.queryByLabelText('Buscar en el historial')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Historial' }));
    expect(screen.getByLabelText('Buscar en el historial')).toBeTruthy();
    expect(screen.queryByText('Tipo de gráfica')).toBeNull();
    expect(jest.mocked(guardarAjustes)).toHaveBeenLastCalledWith(
      expect.objectContaining({ vistaEstadisticas: 'historial' }),
    );
  });

  it('el historial agrupa por día con el neto de cada día', async () => {
    await montarEnHistorial();
    const lista = screen.getByTestId('lista-historial');
    expect(within(lista).getByText('Hoy')).toBeTruthy();
    expect(within(lista).getByText('+$896.00')).toBeTruthy();
    // Un día con un solo gasto: el neto de la cabecera y el monto de la fila coinciden.
    expect(within(lista).getAllByText('−$2.00')).toHaveLength(2);
    expect(within(lista).getByText('Pasaje')).toBeTruthy();
  });

  it('busca por motivo y combina con el filtro de tipo', async () => {
    await montarEnHistorial();
    await fireEvent.changeText(screen.getByLabelText('Buscar en el historial'), 'cafe');
    expect(screen.getByText('Café con leche')).toBeTruthy();
    expect(screen.queryByText('Sueldo')).toBeNull();
    expect(screen.queryByText('Pasaje')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Ingresos' }));
    expect(screen.getByText('Sin resultados para «cafe»')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Limpiar búsqueda' })[0]);
    expect(screen.getByText('Sueldo')).toBeTruthy();
    expect(screen.queryByText('Café con leche')).toBeNull();
  });

  it('tocar un movimiento lo abre para editarlo', async () => {
    await montarEnHistorial();
    await fireEvent.press(screen.getByText('Pasaje'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/movimiento', params: { id: mockMovimientos[2].id } });
  });

  it('sin movimientos muestra el estado vacío de siempre', async () => {
    mockMovimientos = [];
    await montarEnHistorial();
    expect(screen.getByText('Aún no hay movimientos')).toBeTruthy();
  });
});
