import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { vibrar } from '@/animacion/haptica';
import PantallaMovimiento from '@/app/movimiento';
import { AvisoProvider } from '@/componentes/AvisoProvider';
import { DialogoProvider } from '@/componentes/DialogoProvider';
import { formatearDia, hoy, sumarDias } from '@/dominio/fechas';
import type { EntradaMovimiento, Movimiento } from '@/dominio/tipos';
import { crearI18n } from '@/i18n/traducir';

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
let mockParametros: Record<string, string | undefined> = {};
let mockMovimientos: Movimiento[] = [];
const mockGuardar = jest.fn<Promise<string>, [EntradaMovimiento, string?, unknown?]>(async () => 'nuevo-id');

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParametros,
  // La cabecera nativa no existe en las pruebas: se dibuja su botón derecho junto al formulario.
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: (props: object) => ReactNode } }) =>
      options?.headerRight ? options.headerRight({}) : null,
  },
}));
jest.mock('react-native-safe-area-context', () => {
  const { createContext } = jest.requireActual('react');
  const margenes = { top: 0, bottom: 0, left: 0, right: 0 };
  return { useSafeAreaInsets: () => margenes, SafeAreaInsetsContext: createContext(margenes) };
});
jest.mock('@/datos/DatosProvider', () => ({
  useDatos: () => ({
    movimientos: mockMovimientos,
    guardarMovimiento: mockGuardar,
    eliminarMovimiento: jest.fn(async () => {}),
    almacen: { uriDe: () => 'file://foto.jpg', borrarTemporal: jest.fn() },
  }),
}));
jest.mock('@/notificaciones/NotificacionesProvider', () => ({
  useNotificaciones: () => ({ ofrecerAvisosDeCobros: jest.fn() }),
}));
jest.mock('@/animacion/haptica', () => ({ vibrar: jest.fn() }));
jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

jest.useFakeTimers();

const i18n = crearI18n('es');
let contador = 0;
const mov = (parcial: Partial<Movimiento> = {}): Movimiento => {
  contador += 1;
  return {
    id: `m${contador}`,
    tipo: 'gasto',
    monto: 4.5,
    motivo: 'Café',
    fecha: sumarDias(hoy(), -1),
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-11-01T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};

const montar = () =>
  render(
    <AjustesProvider>
      <DialogoProvider>
        <AvisoProvider>
          <PantallaMovimiento />
        </AvisoProvider>
      </DialogoProvider>
    </AjustesProvider>,
  );

const campo = (nombre: string) => screen.getByLabelText(nombre);
const guardadoCon = () => mockGuardar.mock.calls[mockGuardar.mock.calls.length - 1];

beforeEach(() => {
  mockParametros = { tipo: 'gasto' };
  mockMovimientos = [];
  jest.clearAllMocks();
});

describe('Formulario de movimiento', () => {
  it('un chip de motivo frecuente rellena el motivo y su monto habitual', async () => {
    mockMovimientos = [mov({ motivo: 'Café', monto: 4.5 }), mov({ motivo: 'Pasaje', monto: 1.2 })];
    await montar();
    await fireEvent.press(screen.getByRole('button', { name: /^Café, \$4\.50/ }));
    expect(campo('Motivo').props.value).toBe('Café');
    expect(campo('Monto').props.value).toBe('4.5');
    expect(vibrar).toHaveBeenCalledWith('seleccion');
  });

  it('el chip no pisa un monto ya escrito y solo sugiere del tipo elegido', async () => {
    mockMovimientos = [mov({ motivo: 'Café', monto: 4.5 }), mov({ tipo: 'ingreso', motivo: 'Sueldo', monto: 900 })];
    await montar();
    expect(screen.queryByRole('button', { name: /^Sueldo/ })).toBeNull();
    await fireEvent.changeText(campo('Monto'), '7');
    await fireEvent.press(screen.getByRole('button', { name: /^Café/ }));
    expect(campo('Monto').props.value).toBe('7');
  });

  it('se puede cambiar a ingreso dentro del formulario y se guarda como ingreso', async () => {
    await montar();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    await fireEvent.changeText(campo('Monto'), '100');
    await fireEvent.changeText(campo('Motivo'), 'Venta');
    expect(screen.getAllByRole('button', { name: 'Agregar ingreso' }).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('guardar-cabecera'));
    expect(guardadoCon()[0]).toMatchObject({ tipo: 'ingreso', monto: 100, motivo: 'Venta' });
  });

  it('guarda desde la cabecera, vuelve y confirma con un aviso que permite editar', async () => {
    await montar();
    await fireEvent.changeText(campo('Monto'), '5');
    await fireEvent.changeText(campo('Motivo'), 'Pan');
    await fireEvent.press(screen.getByTestId('guardar-cabecera'));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(vibrar).toHaveBeenCalledWith('exito');
    expect(screen.getByText('Gasto registrado · −$5.00')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Editar' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/movimiento', params: { id: 'nuevo-id' } });
  });

  it('«Listo» en el teclado del motivo guarda', async () => {
    await montar();
    await fireEvent.changeText(campo('Monto'), '3');
    await fireEvent.changeText(campo('Motivo'), 'Agua');
    await fireEvent(campo('Motivo'), 'submitEditing');
    expect(mockGuardar).toHaveBeenCalledTimes(1);
  });

  it('con datos inválidos no guarda: muestra los errores y vibra', async () => {
    await montar();
    await fireEvent.press(screen.getByTestId('guardar-cabecera'));
    expect(mockGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('Ingresa un monto mayor a 0.')).toBeTruthy();
    expect(vibrar).toHaveBeenCalledWith('error');
  });

  it('las flechas mueven la fecha un día', async () => {
    await montar();
    await fireEvent.press(screen.getByRole('button', { name: 'Día anterior' }));
    expect(screen.getByText(formatearDia(sumarDias(hoy(), -1), i18n))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Día siguiente' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Día siguiente' }));
    expect(screen.getByText(formatearDia(sumarDias(hoy(), 1), i18n))).toBeTruthy();
  });

  it('al editar ofrece duplicar, que abre uno nuevo a partir del guardado', async () => {
    const original = mov({ motivo: 'Netflix', recurrente: true, periodo: 'mensual', frecuencia: 1 });
    mockMovimientos = [original];
    mockParametros = { id: original.id };
    await montar();
    await fireEvent.press(screen.getByRole('button', { name: 'Duplicar' }));
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/movimiento', params: { desde: original.id } });
  });

  it('un duplicado copia tipo, monto y motivo, con fecha de hoy y sin recurrencia', async () => {
    const original = mov({
      tipo: 'ingreso',
      monto: 250,
      motivo: 'Freelance',
      recurrente: true,
      periodo: 'mensual',
      frecuencia: 1,
      imagenes: [{ id: 'f1', ancho: 10, alto: 10, orden: 0 }],
    });
    mockMovimientos = [original];
    mockParametros = { desde: original.id };
    await montar();
    expect(campo('Monto').props.value).toBe('250');
    expect(campo('Motivo').props.value).toBe('Freelance');
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull();
    await fireEvent.press(screen.getByTestId('guardar-cabecera'));
    const [entrada, id, imagenes] = guardadoCon();
    expect(entrada).toMatchObject({ tipo: 'ingreso', monto: 250, fecha: hoy(), recurrente: false, periodo: null });
    expect(id).toBeUndefined();
    expect(imagenes).toEqual([]);
  });

  it('acepta una fecha de partida válida e ignora una inválida', async () => {
    const ayer = sumarDias(hoy(), -3);
    mockParametros = { tipo: 'gasto', fecha: ayer };
    const { unmount } = await montar();
    expect(screen.getByText(formatearDia(ayer, i18n))).toBeTruthy();
    await act(async () => unmount());

    mockParametros = { tipo: 'gasto', fecha: '2026-02-31' };
    await montar();
    expect(screen.getByText('Hoy')).toBeTruthy();
  });
});
