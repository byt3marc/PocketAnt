import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { vibrar } from '../haptica';

jest.mock('expo-haptics', () => ({
  AndroidHaptics: {
    Segment_Tick: 'segment-tick',
    Clock_Tick: 'clock-tick',
    Confirm: 'confirm',
    Virtual_Key: 'virtual-key',
    Reject: 'reject',
    Long_Press: 'long-press',
  },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

const android = jest.mocked(Haptics.performAndroidHapticsAsync);
const seleccion = jest.mocked(Haptics.selectionAsync);
const notificacion = jest.mocked(Haptics.notificationAsync);

const plataformaOriginal = Platform.OS;
const usarPlataforma = (os: typeof Platform.OS) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
/** Deja correr las promesas pendientes (el respaldo se lanza en un `catch`). */
const vaciar = () => new Promise<void>((resolver) => setImmediate(() => resolver()));

afterEach(() => {
  usarPlataforma(plataformaOriginal);
  jest.clearAllMocks();
});

describe('vibrar', () => {
  it('en Android usa el motor háptico del sistema', async () => {
    usarPlataforma('android');
    vibrar('seleccion');
    vibrar('exito');
    await vaciar();
    expect(android.mock.calls.map(([tipo]) => tipo)).toEqual(['segment-tick', 'confirm']);
  });

  it('en un Android viejo sin la constante nueva cae a una que existe siempre', async () => {
    usarPlataforma('android');
    android.mockImplementationOnce(() => Promise.reject(new Error('no soportada')));
    vibrar('exito');
    await vaciar();
    expect(android.mock.calls.map(([tipo]) => tipo)).toEqual(['confirm', 'virtual-key']);
  });

  it('en iOS usa selección y notificaciones', async () => {
    usarPlataforma('ios');
    vibrar('seleccion');
    vibrar('error');
    await vaciar();
    expect(seleccion).toHaveBeenCalledTimes(1);
    expect(notificacion).toHaveBeenCalledWith('error');
  });

  it('en la web no hace nada', async () => {
    usarPlataforma('web');
    vibrar('exito');
    await vaciar();
    expect(android).not.toHaveBeenCalled();
    expect(notificacion).not.toHaveBeenCalled();
  });

  it('nunca lanza, aunque el módulo falle del todo', async () => {
    usarPlataforma('android');
    android.mockImplementation(() => {
      throw new Error('sin módulo nativo');
    });
    expect(() => vibrar('aviso')).not.toThrow();
    android.mockImplementation(() => Promise.reject(new Error('rechazo')));
    expect(() => vibrar('aviso')).not.toThrow();
    await vaciar();
    android.mockImplementation(() => Promise.resolve());
  });
});
