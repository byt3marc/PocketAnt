import { act, fireEvent, render, screen } from '@testing-library/react-native';

import Ajustes from '@/app/ajustes';
import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { AvisoProvider } from '@/componentes/AvisoProvider';
import { DialogoProvider } from '@/componentes/DialogoProvider';
import { IAProvider } from '@/ia/IAProvider';
import { crearServicioFalso } from '@/pruebas/servicioIAFalso';
import type { EvaluacionIA } from '@/ia/tipos';

const mockPush = jest.fn();
const mockPedirPermisoSiHaceFalta = jest.fn();
const mockLimpiarDatos = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));
jest.mock('react-native-safe-area-context', () => {
  const { createContext } = jest.requireActual('react');
  const margenes = { top: 0, bottom: 0, left: 0, right: 0 };
  return { useSafeAreaInsets: () => margenes, SafeAreaInsetsContext: createContext(margenes) };
});
jest.mock('@/datos/DatosProvider', () => ({
  useDatos: () => ({
    exportar: jest.fn(),
    importar: jest.fn(),
    movimientos: [],
    limpiarDatos: mockLimpiarDatos,
  }),
}));
jest.mock('@/notificaciones/NotificacionesProvider', () => ({
  useNotificaciones: () => ({
    permiso: 'concedido',
    pedirPermiso: jest.fn(),
    pedirPermisoSiHaceFalta: mockPedirPermisoSiHaceFalta,
    abrirAjustesDelSistema: jest.fn(),
  }),
}));
jest.mock('@/componentes/BloqueDrive', () => ({ BloqueDrive: () => null }));
jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({
    tema: 'claro',
    moneda: 'USD',
    tipoGrafica: 'linea',
    idioma: 'es',
    notificaciones: {
      recordatorio: { activo: false, cadaHoras: 1, desde: 8, hasta: 22 },
      cobros: { activo: false, diasAntes: 1 },
      permisoPreguntado: true,
    },
  }),
  guardarAjustes: jest.fn(),
}));

jest.useFakeTimers();

const compatible = (parcial: Partial<Extract<EvaluacionIA, { compatible: true }>> = {}): EvaluacionIA => ({
  compatible: true,
  descargado: false,
  parcialBytes: 0,
  cargado: false,
  ramBytes: 17_179_869_184,
  ramJusta: false,
  discoLibreBytes: 50_000_000_000,
  ...parcial,
});

const avanzar = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

const montar = async (evaluacion: EvaluacionIA) => {
  const servicio = crearServicioFalso({ pasoMs: 10, evaluacion });
  await render(
    <AjustesProvider>
      <DialogoProvider>
        <AvisoProvider>
          <IAProvider servicio={servicio}>
            <Ajustes />
          </IAProvider>
        </AvisoProvider>
      </DialogoProvider>
    </AjustesProvider>,
  );
  await avanzar(50);
  return servicio;
};


describe('Ajustes: IA local', () => {
  it('muestra el estado del modelo y lleva a Análisis', async () => {
    await montar(compatible());
    expect(screen.getByText('IA local')).toBeTruthy();
    expect(screen.getByText('Modelo no descargado')).toBeTruthy();
    expect(screen.queryByText('Eliminar modelo')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /Análisis/ }));
    expect(mockPush).toHaveBeenLastCalledWith('/analisis');
  });

  it('avisa si el teléfono no es compatible', async () => {
    await montar({ compatible: false, motivo: 'ram', ramBytes: 3_000_000_000 });
    expect(screen.getByText('No compatible con este teléfono')).toBeTruthy();
    expect(screen.queryByText('Eliminar modelo')).toBeNull();
  });

  it('con una descarga a medias la muestra pausada y deja descartarla', async () => {
    const servicio = await montar(compatible({ parcialBytes: 1_035_259_085 }));
    expect(screen.getByText('Pausada · 40%')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Eliminar modelo/ })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /Descartar descarga/ }));
    await avanzar(50);
    expect(servicio.parcialBytes).toBe(0);
    expect(screen.getByText('Modelo no descargado')).toBeTruthy();
  });

  it('el nombre del modelo sale igual en inglés', async () => {
    await montar(compatible());
    expect(screen.getByText('Gemma 4 E2B, dentro de tu teléfono.')).toBeTruthy();
  });

  it('con el modelo descargado deja eliminarlo, pidiendo confirmación', async () => {
    const servicio = await montar(compatible({ descargado: true }));
    expect(screen.getByText('Descargado · 2.6 GB')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /Eliminar modelo/ }));
    expect(screen.getByText('¿Eliminar el modelo?')).toBeTruthy();
    // Aún no se borró nada: hay que confirmar.
    expect(servicio.descargado).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar' }));
    await avanzar(50);
    expect(servicio.descargado).toBe(false);
    expect(screen.getByText('Modelo no descargado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Eliminar modelo/ })).toBeNull();
  });

  it('si el usuario cancela la confirmación, el modelo se queda', async () => {
    const servicio = await montar(compatible({ descargado: true }));
    await fireEvent.press(screen.getByRole('button', { name: /Eliminar modelo/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await avanzar(50);
    expect(screen.queryByText('¿Eliminar el modelo?')).toBeNull();
    expect(servicio.descargado).toBe(true);
    expect(screen.getByText('Descargado · 2.6 GB')).toBeTruthy();
  });

  it('las licencias del modelo y del motor están en «Acerca de»', async () => {
    await montar(compatible());
    expect(screen.getByText(/Gemma 4 de Google \(licencia Apache 2\.0\)/)).toBeTruthy();
  });

  it('«Acerca de» lleva a la política de privacidad', async () => {
    await montar(compatible());
    mockPush.mockClear();
    await fireEvent.press(screen.getByRole('button', { name: /Política de privacidad/ }));
    expect(mockPush).toHaveBeenCalledWith('/privacidad');
  });
});

describe('Ajustes: bloques que aparecen y desaparecen', () => {
  it('al activar el recordatorio aparecen sus horas, y al apagarlo se van', async () => {
    await montar(compatible());
    expect(screen.queryByText('Repetir cada')).toBeNull();
    expect(screen.queryByText('Desde')).toBeNull();

    await fireEvent(screen.getByRole('switch', { name: 'Recordatorio de registro' }), 'valueChange', true);
    expect(screen.getByText('Repetir cada')).toBeTruthy();
    expect(screen.getByText('Desde')).toBeTruthy();
    expect(screen.getByText('Hasta')).toBeTruthy();

    await fireEvent(screen.getByRole('switch', { name: 'Recordatorio de registro' }), 'valueChange', false);
    expect(screen.queryByText('Repetir cada')).toBeNull();
  });

  it('el permiso de notificaciones se pide al encender un aviso, no al apagarlo', async () => {
    await montar(compatible());
    mockPedirPermisoSiHaceFalta.mockClear();
    await fireEvent(screen.getByRole('switch', { name: 'Recordatorio de registro' }), 'valueChange', true);
    expect(mockPedirPermisoSiHaceFalta).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByRole('switch', { name: 'Recordatorio de registro' }), 'valueChange', false);
    await fireEvent(screen.getByRole('switch', { name: 'Aviso de cobros recurrentes' }), 'valueChange', true);
    expect(mockPedirPermisoSiHaceFalta).toHaveBeenCalledTimes(2);
  });

  it('al activar los avisos de cobros aparece cuántos días antes, y al apagarlos se va', async () => {
    await montar(compatible());
    expect(screen.queryByText('Avisar')).toBeNull();

    await fireEvent(screen.getByRole('switch', { name: 'Aviso de cobros recurrentes' }), 'valueChange', true);
    expect(screen.getByText('Avisar')).toBeTruthy();

    await fireEvent(screen.getByRole('switch', { name: 'Aviso de cobros recurrentes' }), 'valueChange', false);
    expect(screen.queryByText('Avisar')).toBeNull();
  });
});

describe('Ajustes: borrar datos', () => {
  it('pedir borrar abre la confirmación, y cancelar no borra nada', async () => {
    await montar(compatible());
    mockLimpiarDatos.mockClear();

    expect(screen.queryByText('¿Borrar todos los datos?')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Borrar datos/ }));
    expect(screen.getByText('¿Borrar todos los datos?')).toBeTruthy();
    // Aún no se borró nada: hay que confirmar.
    expect(mockLimpiarDatos).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await avanzar(50);
    expect(screen.queryByText('¿Borrar todos los datos?')).toBeNull();
    expect(mockLimpiarDatos).not.toHaveBeenCalled();
  });

  it('al confirmar la confirmación, borra todos los datos', async () => {
    await montar(compatible());
    mockLimpiarDatos.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: /Borrar datos/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar' }));
    await avanzar(50);
    expect(mockLimpiarDatos).toHaveBeenCalledTimes(1);
  });
});
