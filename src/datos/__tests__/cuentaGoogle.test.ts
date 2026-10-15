import type { Autorizacion, ModuloAutorizacion } from '../../../modules/autorizacion-google';
import { SCOPE_DRIVE_APPDATA } from '../sincronizacion/google/config';
import { crearAccesoGoogle } from '../sincronizacion/google/cuenta';
import { ErrorDrive } from '../sincronizacion/google/errores';

/** Un error como los que lanza el módulo nativo (Expo pone el código en `code`). */
const errorNativo = (code: string) => Object.assign(new Error(code), { code });

const crearModulo = (): jest.Mocked<ModuloAutorizacion> => ({
  autorizar: jest.fn(
    async (_scopes: string[], _interactivo: boolean): Promise<Autorizacion | null> => ({
      token: 'tok-1',
      scopes: [SCOPE_DRIVE_APPDATA],
    }),
  ),
  limpiarToken: jest.fn(async (_token: string) => {}),
  revocar: jest.fn(async (_email: string, _scopes: string[]) => {}),
});

/** `about` de Drive: devuelve el correo de la cuenta. */
const fetchAcerca = (correo = 'ana@gmail.com') =>
  jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: { emailAddress: correo } }) }) as Response);

const esperarErrorDrive = async (promesa: Promise<unknown>, clave: string, requiereReconectar = false) => {
  const error = await promesa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ErrorDrive);
  expect((error as ErrorDrive).clave).toBe(clave);
  expect((error as ErrorDrive).requiereReconectar).toBe(requiereReconectar);
};

describe('crearAccesoGoogle (AuthorizationClient)', () => {
  it('conectar muestra la pantalla de Google y lee el correo de la cuenta con el mismo token', async () => {
    const modulo = crearModulo();
    const fetchFn = fetchAcerca();
    const acceso = crearAccesoGoogle(modulo, fetchFn as unknown as typeof fetch);

    expect(await acceso.conectarCuenta()).toEqual({ email: 'ana@gmail.com' });
    expect(modulo.autorizar).toHaveBeenCalledWith([SCOPE_DRIVE_APPDATA], true);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/drive/v3/about?fields=user(emailAddress)');
    expect(init.headers).toEqual({ Authorization: 'Bearer tok-1' });
  });

  it('si el usuario cierra la pantalla de Google, no conecta nada (sin error)', async () => {
    const modulo = crearModulo();
    modulo.autorizar.mockResolvedValueOnce(null);
    expect(await crearAccesoGoogle(modulo, fetchAcerca() as unknown as typeof fetch).conectarCuenta()).toBeNull();

    modulo.autorizar.mockRejectedValueOnce(errorNativo('CANCELADO'));
    expect(await crearAccesoGoogle(modulo, fetchAcerca() as unknown as typeof fetch).conectarCuenta()).toBeNull();
  });

  it('si Google no concede la carpeta de Drive, pide reconectar', async () => {
    const modulo = crearModulo();
    modulo.autorizar.mockResolvedValueOnce({ token: 't', scopes: [] });
    await esperarErrorDrive(crearAccesoGoogle(modulo).conectarCuenta(), 'error.drive.permiso', true);
  });

  it('una app sin registrar en Google Cloud (paquete o firma) lo explica', async () => {
    const modulo = crearModulo();
    modulo.autorizar.mockRejectedValueOnce(errorNativo('CONFIGURACION'));
    await esperarErrorDrive(crearAccesoGoogle(modulo).conectarCuenta(), 'error.drive.configuracion');
  });

  it('el token se renueva sin mostrar nada; si Google pide confirmar de nuevo, hay que reconectar', async () => {
    const modulo = crearModulo();
    const acceso = crearAccesoGoogle(modulo);
    expect(await acceso.obtenerTokenDeAcceso()).toBe('tok-1');
    expect(modulo.autorizar).toHaveBeenCalledWith([SCOPE_DRIVE_APPDATA], false);

    modulo.autorizar.mockRejectedValueOnce(errorNativo('NECESITA_PERMISO'));
    await esperarErrorDrive(acceso.obtenerTokenDeAcceso(), 'error.drive.sin_sesion', true);
  });

  it('sin conexión con Google, el error es de red (se reintenta más tarde)', async () => {
    const modulo = crearModulo();
    modulo.autorizar.mockRejectedValueOnce(errorNativo('RED'));
    await esperarErrorDrive(crearAccesoGoogle(modulo).obtenerTokenDeAcceso(), 'error.drive.red');

    const sinRed = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await esperarErrorDrive(
      crearAccesoGoogle(crearModulo(), sinRed as unknown as typeof fetch).conectarCuenta(),
      'error.drive.red',
    );
  });

  it('descartar un token lo quita de la caché de Google, y si falla no rompe nada', async () => {
    const modulo = crearModulo();
    const acceso = crearAccesoGoogle(modulo);
    await acceso.descartarToken('viejo');
    expect(modulo.limpiarToken).toHaveBeenCalledWith('viejo');
    modulo.limpiarToken.mockRejectedValueOnce(new Error('x'));
    await expect(acceso.descartarToken('viejo')).resolves.toBeUndefined();
  });

  it('desconectar retira el permiso de esa cuenta (así se puede elegir otra al reconectar)', async () => {
    const modulo = crearModulo();
    await crearAccesoGoogle(modulo).desconectarCuenta('ana@gmail.com');
    expect(modulo.revocar).toHaveBeenCalledWith('ana@gmail.com', [SCOPE_DRIVE_APPDATA]);
    await crearAccesoGoogle(modulo).desconectarCuenta(null);
    expect(modulo.revocar).toHaveBeenCalledTimes(1);
  });

  it('sin el módulo nativo (web, Jest, APK viejo) conectar falla con un mensaje y lo demás no rompe', async () => {
    const acceso = crearAccesoGoogle(null);
    await esperarErrorDrive(acceso.conectarCuenta(), 'error.drive.conectar');
    await expect(acceso.desconectarCuenta('ana@gmail.com')).resolves.toBeUndefined();
    await expect(acceso.descartarToken('t')).resolves.toBeUndefined();
  });
});
