import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import Analisis from '@/app/analisis';
import Inicio from '@/app/index';
import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { hoy, sumarDias } from '@/dominio/fechas';
import type { Movimiento } from '@/dominio/tipos';
import { AvisoProvider } from '@/componentes/AvisoProvider';
import { DialogoProvider } from '@/componentes/DialogoProvider';
import { IAProvider } from '@/ia/IAProvider';
import { crearServicioFalso } from '@/pruebas/servicioIAFalso';

const mockPush = jest.fn();
let mockMovimientos: Movimiento[] = [];

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => true }));
jest.mock('react-native-safe-area-context', () => {
  const { createContext } = jest.requireActual('react');
  const margenes = { top: 0, bottom: 0, left: 0, right: 0 };
  return { useSafeAreaInsets: () => margenes, SafeAreaInsetsContext: createContext(margenes) };
});
jest.mock('@/datos/DatosProvider', () => ({
  useDatos: () => ({
    movimientos: mockMovimientos,
    totales: { ingresos: 0, gastos: 0, saldo: 0 },
  }),
}));
// Las gráficas y la vista previa animada no son lo que se prueba aquí.
jest.mock('@/componentes/BloqueGrafica', () => ({ BloqueGrafica: () => null }));
jest.mock('@/componentes/VistaPreviaHistorial', () => ({ VistaPreviaHistorial: () => null }));
jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

jest.useFakeTimers();

let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `s${contador}`,
    tipo: 'gasto',
    monto: 10,
    motivo: 'Algo',
    fecha: hoy(),
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-10-10T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};

const avanzar = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

const conProveedores = (ui: ReactElement, servicio = crearServicioFalso({ pasoMs: 10 })) => (
  <AjustesProvider>
    <DialogoProvider>
      <AvisoProvider>
        <IAProvider servicio={servicio}>{ui}</IAProvider>
      </AvisoProvider>
    </DialogoProvider>
  </AjustesProvider>
);

beforeEach(() => {
  mockPush.mockClear();
  mockMovimientos = [];
});

describe('Inicio: botones del encabezado', () => {
  it('tiene Análisis a la izquierda de Ajustes y cada uno navega a su pantalla', async () => {
    await render(conProveedores(<Inicio />));
    const analisis = screen.getByRole('button', { name: 'Análisis de gastos' });
    const ajustes = screen.getByRole('button', { name: 'Ajustes' });

    const botones = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(botones.indexOf('Análisis de gastos')).toBeLessThan(botones.indexOf('Ajustes'));
    expect(botones.indexOf('Análisis de gastos')).toBe(botones.indexOf('Ajustes') - 1);

    await fireEvent.press(analisis);
    expect(mockPush).toHaveBeenLastCalledWith('/analisis');
    await fireEvent.press(ajustes);
    expect(mockPush).toHaveBeenLastCalledWith('/ajustes');
  });
});

describe('Pantalla de Análisis', () => {
  it('con movimientos muestra la tarjeta de IA y el análisis por reglas', async () => {
    mockMovimientos = [
      mov({ tipo: 'ingreso', motivo: 'Sueldo', monto: 1000, fecha: sumarDias(hoy(), -3) }),
      mov({ motivo: 'Renta', monto: 300, fecha: sumarDias(hoy(), -2) }),
    ];
    await render(conProveedores(<Analisis />));
    await avanzar(50);

    expect(screen.getByText('Análisis con IA en tu teléfono')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descargar modelo' })).toBeTruthy();
    expect(screen.getByText('Últimos 30 días')).toBeTruthy();
    expect(screen.getByText('En qué gastas más')).toBeTruthy();
    expect(screen.getByText('Renta')).toBeTruthy();
    expect(screen.queryByText('Aún no hay datos para analizar')).toBeNull();
  });

  it('sin movimientos muestra el estado vacío (y la tarjeta de IA sigue disponible)', async () => {
    await render(conProveedores(<Analisis />));
    await avanzar(50);
    expect(screen.getByText('Aún no hay datos para analizar')).toBeTruthy();
    expect(screen.getByText('Análisis con IA en tu teléfono')).toBeTruthy();
    expect(screen.queryByText('En qué gastas más')).toBeNull();
  });

  it('al entrar consulta el teléfono y al salir libera la memoria del modelo', async () => {
    const servicio = crearServicioFalso({ pasoMs: 10 });
    const evaluar = jest.spyOn(servicio, 'evaluar');
    const liberar = jest.spyOn(servicio, 'liberar');
    const { unmount } = await render(conProveedores(<Analisis />, servicio));
    await avanzar(50);
    expect(evaluar).toHaveBeenCalledTimes(1);
    expect(liberar).not.toHaveBeenCalled();

    await unmount();
    await avanzar(50);
    expect(liberar).toHaveBeenCalledTimes(1);
  });
});
