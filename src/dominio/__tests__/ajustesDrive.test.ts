import { DRIVE_POR_DEFECTO, normalizarDrive } from '../ajustesDrive';

describe('normalizarDrive', () => {
  it('sin nada guardado: desconectado y con sincronización automática', () => {
    expect(normalizarDrive(undefined)).toEqual(DRIVE_POR_DEFECTO);
    expect(DRIVE_POR_DEFECTO).toEqual({ conectado: false, email: null, auto: true, ultimaSync: null });
  });

  it('respeta una conexión válida', () => {
    const guardado = {
      conectado: true,
      email: 'ana@example.com',
      auto: false,
      ultimaSync: '2026-10-13T20:00:00.000Z',
    };
    expect(normalizarDrive(guardado)).toEqual(guardado);
  });

  it('sin correo no hay cuenta conectada', () => {
    expect(normalizarDrive({ conectado: true, email: '', ultimaSync: '2026-10-13T20:00:00.000Z' })).toEqual({
      ...DRIVE_POR_DEFECTO,
    });
    expect(normalizarDrive({ conectado: true })).toEqual(DRIVE_POR_DEFECTO);
  });

  it('descarta fechas inválidas y valores de tipo equivocado', () => {
    const resultado = normalizarDrive({ conectado: true, email: 'a@b.c', auto: 'sí', ultimaSync: 'ayer' });
    expect(resultado).toEqual({ conectado: true, email: 'a@b.c', auto: true, ultimaSync: null });
  });

  it('al estar desconectado no conserva correo ni última sincronización', () => {
    expect(
      normalizarDrive({ conectado: false, email: 'a@b.c', ultimaSync: '2026-10-13T20:00:00.000Z', auto: false }),
    ).toEqual({ conectado: false, email: null, auto: false, ultimaSync: null });
  });
});
