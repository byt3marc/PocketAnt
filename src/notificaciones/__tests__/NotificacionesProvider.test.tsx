import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AjustesProvider, useAjustes } from '@/ajustes/AjustesProvider';
import { Boton } from '@/componentes/Boton';
import { DialogoProvider } from '@/componentes/DialogoProvider';
import type { Movimiento } from '@/dominio/tipos';

import { NotificacionesProvider, useNotificaciones } from '../NotificacionesProvider';
import { leerPermiso, solicitarPermiso, type EstadoPermiso } from '../permiso';

jest.mock('../permiso', () => ({ leerPermiso: jest.fn(), solicitarPermiso: jest.fn() }));
jest.mock('../programador', () => ({ aplicarPlan: jest.fn(async () => {}) }));
jest.mock('../canal', () => ({ asegurarCanal: jest.fn(async () => {}) }));
/** Lo que la app recibe al tocar una notificación con estos datos. */
type Respuesta = { notification: { request: { content: { data: unknown } } } };
let mockAlTocar: ((respuesta: Respuesta) => void) | undefined;
jest.mock('expo-notifications', () => ({
  getLastNotificationResponse: () => null,
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: (escucha: (respuesta: Respuesta) => void) => {
    mockAlTocar = escucha;
    return { remove: jest.fn() };
  },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
let mockMovimientos: Movimiento[] = [];
jest.mock('@/datos/DatosProvider', () => ({ useDatos: () => ({ movimientos: mockMovimientos, cargando: false }) }));
// Una instalación nueva: sin nada guardado, con los valores por defecto.
jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ ...jest.requireActual('@/ajustes/normalizar').AJUSTES_POR_DEFECTO, idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

jest.useFakeTimers();

const leer = jest.mocked(leerPermiso);
const solicitar = jest.mocked(solicitarPermiso);

/** Expone lo que el resto de la app usa del proveedor. */
function Sonda() {
  const { permiso, pedirPermisoSiHaceFalta, ofrecerAvisosDeCobros } = useNotificaciones();
  const { ajustes } = useAjustes();
  return (
    <>
      <Text testID="permiso">{String(permiso)}</Text>
      <Text testID="preguntado">{String(ajustes.notificaciones.permisoPreguntado)}</Text>
      <Text testID="recordatorio">{String(ajustes.notificaciones.recordatorio.activo)}</Text>
      <Boton titulo="encender aviso" onPress={() => void pedirPermisoSiHaceFalta()} />
      <Boton titulo="guardar gasto recurrente" onPress={ofrecerAvisosDeCobros} />
    </>
  );
}

const montar = async (permiso: EstadoPermiso = 'pendiente') => {
  leer.mockResolvedValue(permiso);
  solicitar.mockResolvedValue('concedido');
  await render(
    <AjustesProvider>
      <DialogoProvider>
        <NotificacionesProvider>
          <Sonda />
        </NotificacionesProvider>
      </DialogoProvider>
    </AjustesProvider>,
  );
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
};

const valor = (id: string) => screen.getByTestId(id).props.children;
const pulsar = async (nombre: string) => {
  await fireEvent.press(screen.getByRole('button', { name: nombre }));
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
};

beforeEach(() => {
  leer.mockReset();
  solicitar.mockReset();
  mockPush.mockReset();
  mockMovimientos = [];
  mockAlTocar = undefined;
});

describe('NotificacionesProvider: permiso en contexto', () => {
  it('no pide el permiso al abrir la app, y el recordatorio viene apagado', async () => {
    await montar();
    expect(valor('permiso')).toBe('pendiente');
    expect(solicitar).not.toHaveBeenCalled();
    expect(valor('recordatorio')).toBe('false');
  });

  it('al encender un aviso pide el permiso del sistema, solo si todavía se puede preguntar', async () => {
    await montar();
    await pulsar('encender aviso');
    expect(solicitar).toHaveBeenCalledTimes(1);
    expect(valor('permiso')).toBe('concedido');
    expect(valor('preguntado')).toBe('true');

    // Ya concedido: no vuelve a pedirlo.
    await pulsar('encender aviso');
    expect(solicitar).toHaveBeenCalledTimes(1);
  });

  it('tras el primer gasto recurrente ofrece los avisos con un diálogo propio, y «Activar avisos» pide el permiso', async () => {
    await montar();
    await pulsar('guardar gasto recurrente');
    expect(screen.getByText('¿Te aviso antes de cada cobro?')).toBeTruthy();
    expect(solicitar).not.toHaveBeenCalled();

    await pulsar('Activar avisos');
    expect(solicitar).toHaveBeenCalledTimes(1);
    expect(valor('permiso')).toBe('concedido');
  });

  it('si dice «Ahora no», no se vuelve a ofrecer en el siguiente gasto recurrente', async () => {
    await montar();
    await pulsar('guardar gasto recurrente');
    await pulsar('Ahora no');
    expect(solicitar).not.toHaveBeenCalled();
    expect(valor('preguntado')).toBe('true');

    await pulsar('guardar gasto recurrente');
    expect(screen.queryByText('¿Te aviso antes de cada cobro?')).toBeNull();
  });

  it('con el permiso ya concedido o denegado no ofrece nada', async () => {
    await montar('concedido');
    await pulsar('guardar gasto recurrente');
    expect(screen.queryByText('¿Te aviso antes de cada cobro?')).toBeNull();
  });
});

describe('NotificacionesProvider: tocar un aviso', () => {
  const movimiento = (parcial: Partial<Movimiento>): Movimiento => ({
    id: 'netflix',
    tipo: 'gasto',
    monto: 40,
    motivo: 'Netflix',
    fecha: '2026-08-08',
    recurrente: true,
    periodo: 'mensual',
    frecuencia: 1,
    actualizadoEn: '2026-08-08T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  });
  const tocar = async (data: unknown) => {
    await act(async () => {
      mockAlTocar!({ notification: { request: { content: { data } } } });
    });
  };

  it('el recordatorio abre el formulario de gasto', async () => {
    await montar('concedido');
    await tocar({ tipo: 'recordatorio' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/movimiento', params: { tipo: 'gasto' } });
  });

  it('un cobro sin anotar abre el formulario con la copia en el día del cobro', async () => {
    mockMovimientos = [movimiento({})];
    await montar('concedido');
    await tocar({ tipo: 'cobro', id: 'netflix', fecha: '2026-11-08' });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/movimiento',
      params: { desde: 'netflix', fecha: '2026-11-08' },
    });
  });

  it('un cobro ya anotado, un aviso viejo sin fecha o un movimiento borrado abren el original', async () => {
    mockMovimientos = [movimiento({}), movimiento({ id: 'copia', recurrente: false, periodo: null, fecha: '2026-11-07' })];
    await montar('concedido');
    await tocar({ tipo: 'cobro', id: 'netflix', fecha: '2026-11-08' });
    await tocar({ tipo: 'cobro', id: 'netflix' });
    await tocar({ tipo: 'cobro', id: 'otro', fecha: '2026-11-08' });
    expect(mockPush.mock.calls.map(([destino]) => destino)).toEqual([
      { pathname: '/movimiento', params: { id: 'netflix' } },
      { pathname: '/movimiento', params: { id: 'netflix' } },
      { pathname: '/movimiento', params: { id: 'otro' } },
    ]);
  });

  it('el primer cobro es el propio movimiento: abre el original, no una copia que lo contaría dos veces', async () => {
    mockMovimientos = [movimiento({ fecha: '2026-11-20' })];
    await montar('concedido');
    await tocar({ tipo: 'cobro', id: 'netflix', fecha: '2026-11-20' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/movimiento', params: { id: 'netflix' } });
  });

  it('si el movimiento dejó de ser recurrente, un aviso que ya estaba en la bandeja abre el original', async () => {
    mockMovimientos = [movimiento({ recurrente: false, periodo: null, frecuencia: null })];
    await montar('concedido');
    await tocar({ tipo: 'cobro', id: 'netflix', fecha: '2026-11-08' });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/movimiento', params: { id: 'netflix' } });
  });
});
