import type { Movimiento } from '@/dominio/tipos';

import { crearRepositorioMemoria } from '@/pruebas/repositorioMemoria';
import {
  analizarArchivo,
  crearArchivo,
  ErrorArchivoInvalido,
  serializarArchivo,
  type ArchivoDatos,
} from '../sincronizacion/formatoArchivo';
import { crearClienteDrive, NOMBRE_ARCHIVO_DRIVE, type ClienteDrive } from '../sincronizacion/google/driveApi';
import { ErrorDrive } from '../sincronizacion/google/errores';
import { crearProveedorDrive } from '../sincronizacion/google/proveedorDrive';
import type { ProveedorSync } from '../sincronizacion/proveedor';
import { sincronizar } from '../sincronizacion/servicio';

function mov(id: string, parcial: Partial<Movimiento> = {}): Movimiento {
  return {
    id,
    tipo: 'gasto',
    monto: 10,
    motivo: 'Prueba',
    fecha: '2026-10-12',
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-10-12T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
}

// — Cliente REST con `fetch` simulado —

interface Llamada {
  url: string;
  init: RequestInit;
}

function respuesta(status: number, cuerpo: unknown = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => cuerpo,
    text: async () => (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)),
  } as unknown as Response;
}

function crearCliente(respuestas: (Response | Error)[], tokens: string[] = ['token-1', 'token-2']) {
  const llamadas: Llamada[] = [];
  const descartados: string[] = [];
  let siguienteToken = 0;
  const cliente = crearClienteDrive({
    obtenerToken: async () => tokens[Math.min(siguienteToken++, tokens.length - 1)],
    descartarToken: async (token) => {
      descartados.push(token);
    },
    fetchFn: (async (url: string, init: RequestInit) => {
      llamadas.push({ url, init });
      const siguiente = respuestas.shift();
      if (!siguiente) throw new Error('sin más respuestas simuladas');
      if (siguiente instanceof Error) throw siguiente;
      return siguiente;
    }) as unknown as typeof fetch,
  });
  return { cliente, llamadas, descartados };
}

describe('cliente de Drive', () => {
  it('busca el archivo solo en la carpeta oculta de la app y con el token de acceso', async () => {
    const { cliente, llamadas } = crearCliente([respuesta(200, { files: [{ id: 'abc', modifiedTime: '2026-10-12T00:00:00Z' }] })]);
    const archivo = await cliente.buscar();
    expect(archivo).toEqual({ id: 'abc', modificadoEn: '2026-10-12T00:00:00Z' });

    const { url, init } = llamadas[0];
    expect(url).toContain('https://www.googleapis.com/drive/v3/files?');
    expect(url).toContain('spaces=appDataFolder');
    expect(decodeURIComponent(url)).toContain(`name = '${NOMBRE_ARCHIVO_DRIVE}'`);
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('devuelve null si todavía no hay archivo', async () => {
    const { cliente } = crearCliente([respuesta(200, { files: [] })]);
    expect(await cliente.buscar()).toBeNull();
    const { cliente: otro } = crearCliente([respuesta(200, {})]);
    expect(await otro.buscar()).toBeNull();
  });

  it('descarga el contenido del archivo', async () => {
    const { cliente, llamadas } = crearCliente([respuesta(200, '{"version":1}')]);
    expect(await cliente.leer('abc')).toBe('{"version":1}');
    expect(llamadas[0].url).toBe('https://www.googleapis.com/drive/v3/files/abc?alt=media');
  });

  it('crea el archivo dentro de appDataFolder con una subida multipart', async () => {
    const { cliente, llamadas } = crearCliente([respuesta(200, { id: 'nuevo' })]);
    const id = await cliente.crear('{"hola":"mundo"}');
    expect(id).toBe('nuevo');

    const { url, init } = llamadas[0];
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id');
    expect(init.method).toBe('POST');
    const encabezado = (init.headers as Record<string, string>)['Content-Type'];
    expect(encabezado).toMatch(/^multipart\/related; boundary=/);
    const limite = encabezado.split('boundary=')[1];
    const cuerpo = init.body as string;
    expect(cuerpo.startsWith(`--${limite}\r\n`)).toBe(true);
    expect(cuerpo.endsWith(`--${limite}--`)).toBe(true);
    expect(cuerpo).toContain('"parents":["appDataFolder"]');
    expect(cuerpo).toContain(`"name":"${NOMBRE_ARCHIVO_DRIVE}"`);
    expect(cuerpo).toContain('{"hola":"mundo"}');
  });

  it('actualiza el contenido del archivo existente', async () => {
    const { cliente, llamadas } = crearCliente([respuesta(200, { id: 'abc' })]);
    await cliente.actualizar('abc', '{"x":1}');
    const { url, init } = llamadas[0];
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files/abc?uploadType=media&fields=id');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"x":1}');
  });

  it('ante un 401 descarta el token, pide otro y reintenta una vez', async () => {
    const { cliente, llamadas, descartados } = crearCliente([
      respuesta(401),
      respuesta(200, { files: [{ id: 'abc' }] }),
    ]);
    expect(await cliente.buscar()).toEqual({ id: 'abc', modificadoEn: undefined });
    expect(descartados).toEqual(['token-1']);
    expect(llamadas).toHaveLength(2);
    expect((llamadas[1].init.headers as Record<string, string>).Authorization).toBe('Bearer token-2');
  });

  it('si el reintento también falla por permisos, pide reconectar la cuenta', async () => {
    const { cliente } = crearCliente([respuesta(401), respuesta(401)]);
    const error = await cliente.buscar().catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDrive);
    expect(error.clave).toBe('error.drive.permiso');
    expect(error.requiereReconectar).toBe(true);
  });

  it('un 403 también se trata como falta de permiso', async () => {
    const { cliente } = crearCliente([respuesta(403)]);
    const error = await cliente.leer('abc').catch((e) => e);
    expect(error.clave).toBe('error.drive.permiso');
  });

  it('un error del servicio lleva el código y no pide reconectar', async () => {
    const { cliente } = crearCliente([respuesta(500)]);
    const error = await cliente.buscar().catch((e) => e);
    expect(error.clave).toBe('error.drive.servicio');
    expect(error.parametros).toEqual({ codigo: 500 });
    expect(error.requiereReconectar).toBe(false);
  });

  it('sin conexión (fetch rechaza) da un error de red', async () => {
    const { cliente } = crearCliente([new TypeError('Network request failed')]);
    const error = await cliente.buscar().catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDrive);
    expect(error.clave).toBe('error.drive.red');
  });

  it('si Google no contesta en 30 s, se rinde con un error de red (no se queda colgado)', async () => {
    jest.useFakeTimers();
    try {
      // Una red que nunca responde: solo el aborto por tiempo corta la espera.
      const cliente = crearClienteDrive({
        obtenerToken: async () => 'token',
        descartarToken: async () => {},
        fetchFn: ((_url: string, init: RequestInit) =>
          new Promise((_resolver, rechazar) => {
            init.signal?.addEventListener('abort', () => rechazar(new Error('abortado')));
          })) as unknown as typeof fetch,
      });
      const busqueda = cliente.buscar().catch((e) => e);
      await jest.advanceTimersByTimeAsync(29_000);
      let terminada = false;
      void busqueda.then(() => (terminada = true));
      await Promise.resolve();
      expect(terminada).toBe(false);
      await jest.advanceTimersByTimeAsync(1_000);
      const error = await busqueda;
      expect(error).toBeInstanceOf(ErrorDrive);
      expect(error.clave).toBe('error.drive.red');
    } finally {
      jest.useRealTimers();
    }
  });
});

// — Proveedor y sincronización —

/** "Drive" falso: un archivo en memoria con las mismas operaciones que el cliente real. */
function crearClienteEnMemoria(inicial: string | null = null) {
  let contenido = inicial;
  const registro = { buscar: 0, crear: 0, actualizar: 0, leer: 0 };
  const cliente: ClienteDrive = {
    async buscar() {
      registro.buscar += 1;
      return contenido === null ? null : { id: 'archivo-1' };
    },
    async leer() {
      registro.leer += 1;
      return contenido ?? '';
    },
    async crear(texto) {
      registro.crear += 1;
      contenido = texto;
      return 'archivo-1';
    },
    async actualizar(_id, texto) {
      registro.actualizar += 1;
      contenido = texto;
    },
  };
  return { cliente, registro, contenido: () => contenido };
}

describe('proveedor de Drive', () => {
  it('descargar devuelve null si todavía no hay copia en la nube', async () => {
    const { cliente } = crearClienteEnMemoria();
    expect(await crearProveedorDrive(cliente).descargar()).toBeNull();
  });

  it('la primera subida crea el archivo y las siguientes lo actualizan sin volver a buscarlo', async () => {
    const { cliente, registro } = crearClienteEnMemoria();
    const proveedor = crearProveedorDrive(cliente);
    await proveedor.subir(crearArchivo([mov('a')]));
    await proveedor.subir(crearArchivo([mov('a'), mov('b')]));
    expect(registro).toMatchObject({ crear: 1, actualizar: 1 });
    expect(registro.buscar).toBe(1); // solo la búsqueda de la primera subida
  });

  it('lo subido se puede volver a descargar tal cual', async () => {
    const { cliente } = crearClienteEnMemoria();
    const proveedor = crearProveedorDrive(cliente);
    const subido = [mov('a'), mov('b', { eliminado: true })];
    await proveedor.subir(crearArchivo(subido));
    const recibido = await proveedor.descargar();
    expect(recibido?.archivo.movimientos).toEqual(subido);
  });

  it('un archivo remoto dañado falla con un error claro', async () => {
    const { cliente } = crearClienteEnMemoria('esto no es json');
    await expect(crearProveedorDrive(cliente).descargar()).rejects.toBeInstanceOf(ErrorArchivoInvalido);
  });
});

/** Un "Drive" compartido por varios dispositivos de prueba. */
function crearNube() {
  let archivo: ArchivoDatos | null = null;
  const subidas: ArchivoDatos[] = [];
  const proveedor: ProveedorSync = {
    id: 'nube-falsa',
    nombre: 'Nube falsa',
    async descargar() {
      return archivo ? analizarArchivo(serializarArchivo(archivo)) : null;
    },
    async subir(nuevo) {
      archivo = nuevo;
      subidas.push(nuevo);
    },
  };
  return { proveedor, subidas, ids: () => archivo?.movimientos.map((m) => m.id).sort() ?? [] };
}

describe('sincronizar', () => {
  it('la primera vez, sin copia en la nube, sube todo lo local', async () => {
    const nube = crearNube();
    const repo = crearRepositorioMemoria([mov('a'), mov('b')]);
    const resultado = await sincronizar(repo, nube.proveedor);
    expect(resultado).toMatchObject({ subido: true, nuevos: 0 });
    expect(nube.ids()).toEqual(['a', 'b']);
  });

  it('trae lo que hay en la nube y, si no falta nada, no sube nada', async () => {
    const nube = crearNube();
    await sincronizar(crearRepositorioMemoria([mov('a')]), nube.proveedor);

    const otro = crearRepositorioMemoria();
    const resultado = await sincronizar(otro, nube.proveedor);
    expect(resultado).toMatchObject({ nuevos: 1, subido: false });
    expect((await otro.listarActivos()).map((m) => m.id)).toEqual(['a']);
    expect(nube.subidas).toHaveLength(1);
  });

  it('dos dispositivos con datos distintos terminan con la unión de los dos', async () => {
    const nube = crearNube();
    const celular = crearRepositorioMemoria([mov('a')]);
    const tablet = crearRepositorioMemoria([mov('b')]);

    await sincronizar(celular, nube.proveedor); // nube: a
    await sincronizar(tablet, nube.proveedor); // tablet trae a, sube a+b
    await sincronizar(celular, nube.proveedor); // celular trae b

    const ids = async (repo: ReturnType<typeof crearRepositorioMemoria>) =>
      (await repo.listarActivos()).map((m) => m.id).sort();
    expect(await ids(celular)).toEqual(['a', 'b']);
    expect(await ids(tablet)).toEqual(['a', 'b']);
    expect(nube.ids()).toEqual(['a', 'b']);
  });

  it('un cambio posterior en un dispositivo gana en el otro', async () => {
    const nube = crearNube();
    const celular = crearRepositorioMemoria([mov('a', { monto: 10 })]);
    const tablet = crearRepositorioMemoria();
    await sincronizar(celular, nube.proveedor);
    await sincronizar(tablet, nube.proveedor);

    await tablet.guardar(mov('a', { monto: 99, actualizadoEn: '2026-10-13T10:00:00.000Z' }));
    await sincronizar(tablet, nube.proveedor);
    await sincronizar(celular, nube.proveedor);

    expect((await celular.listarActivos())[0].monto).toBe(99);
  });

  it('un borrado en un dispositivo se propaga al otro', async () => {
    const nube = crearNube();
    const celular = crearRepositorioMemoria([mov('a'), mov('b')]);
    const tablet = crearRepositorioMemoria();
    await sincronizar(celular, nube.proveedor);
    await sincronizar(tablet, nube.proveedor);

    await celular.eliminar('a', new Date('2026-10-14T00:00:00.000Z'));
    await sincronizar(celular, nube.proveedor);
    const resultado = await sincronizar(tablet, nube.proveedor);

    expect(resultado.eliminados).toBe(1);
    expect((await tablet.listarActivos()).map((m) => m.id)).toEqual(['b']);
  });

  it('es idempotente: sincronizar dos veces seguidas no vuelve a subir ni cambiar nada', async () => {
    const nube = crearNube();
    const repo = crearRepositorioMemoria([mov('a')]);
    await sincronizar(repo, nube.proveedor);
    const segunda = await sincronizar(repo, nube.proveedor);
    expect(segunda).toMatchObject({ subido: false, nuevos: 0, actualizados: 0, eliminados: 0 });
    expect(nube.subidas).toHaveLength(1);
  });

  it('si la copia de la nube está dañada falla sin sobrescribirla ni tocar lo local', async () => {
    const subir = jest.fn();
    const danada: ProveedorSync = {
      id: 'x',
      nombre: 'x',
      descargar: async () => {
        throw new ErrorArchivoInvalido('error.archivo.no_json');
      },
      subir,
    };
    const repo = crearRepositorioMemoria([mov('a')]);
    await expect(sincronizar(repo, danada)).rejects.toBeInstanceOf(ErrorArchivoInvalido);
    expect(subir).not.toHaveBeenCalled();
    expect(await repo.listarActivos()).toHaveLength(1);
  });

  it('si no hay red, falla y lo local queda intacto', async () => {
    const sinRed: ProveedorSync = {
      id: 'x',
      nombre: 'x',
      descargar: async () => {
        throw new ErrorDrive('error.drive.red');
      },
      subir: async () => {},
    };
    const repo = crearRepositorioMemoria([mov('a')]);
    await expect(sincronizar(repo, sinRed)).rejects.toMatchObject({ clave: 'error.drive.red' });
    expect(await repo.listarTodos()).toHaveLength(1);
  });
});
