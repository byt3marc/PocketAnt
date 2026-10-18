import {
  aErrorDescarga,
  crearDescarga,
  ErrorDescarga,
  type ArchivosModelo,
  type EspecModelo,
  type ResultadoDescarga,
  type TareaDescarga,
} from '../descargaModelo';

const ESPEC: EspecModelo = { url: 'https://ejemplo.test/modelo.litertlm', tamanoBytes: 1000, md5: 'abc123' };

type Modo = 'completa' | 'falla' | 'ensenia-corte' | 'espera';

interface Disco {
  parcial: number;
  md5: string | null;
  promovido: boolean;
  borrados: number;
  llamadas: { url: string; desde: number }[];
  cancelaciones: number;
  pausas: number;
  /** Termina la tarea que quedó esperando (modo `espera`), como si se hubiera pausado. */
  soltarPausada: () => void;
  /** Hace fallar la tarea que quedó esperando (la red se cae). */
  soltarConFallo: (error: Error) => void;
}

/** Un disco y un descargador falsos: cada tarea escribe bytes en el parcial según el `modo`. */
function crear(inicial: Partial<Pick<Disco, 'parcial' | 'md5'>> = {}, modo: Modo = 'completa') {
  const disco: Disco = {
    parcial: inicial.parcial ?? 0,
    md5: inicial.md5 === undefined ? ESPEC.md5 : inicial.md5,
    promovido: false,
    borrados: 0,
    llamadas: [],
    cancelaciones: 0,
    pausas: 0,
    soltarPausada: () => {},
    soltarConFallo: () => {},
  };
  let modoActual = modo;

  const archivos: ArchivosModelo = {
    tamanoParcial: () => disco.parcial,
    tamanoDefinitivo: () => (disco.promovido ? ESPEC.tamanoBytes : 0),
    borrarParcial: () => {
      disco.parcial = 0;
      disco.borrados += 1;
    },
    md5Parcial: async () => disco.md5,
    promoverParcial: () => {
      disco.promovido = true;
      disco.parcial = 0;
    },
    crearTarea(url, desde, onBytes): TareaDescarga {
      disco.llamadas.push({ url, desde });
      return {
        ejecutar: () =>
          new Promise<ResultadoDescarga>((resolver, rechazar) => {
            if (modoActual === 'completa') {
              disco.parcial = ESPEC.tamanoBytes;
              onBytes(disco.parcial);
              resolver('completa');
            } else if (modoActual === 'falla') {
              disco.parcial = desde + 400; // alcanzó a bajar algo antes de cortarse
              rechazar(new Error('Software caused connection abort'));
            } else if (modoActual === 'ensenia-corte') {
              disco.parcial = desde + 300; // termina «bien» pero con menos bytes de los debidos
              resolver('completa');
            } else {
              disco.parcial = desde + 250;
              onBytes(disco.parcial);
              disco.soltarPausada = () => resolver('pausada');
              disco.soltarConFallo = (error) => rechazar(error);
            }
          }),
        pausar: async () => {
          disco.pausas += 1;
          disco.soltarPausada();
        },
        cancelar: () => {
          disco.cancelaciones += 1;
          disco.soltarConFallo(new Error('Download cancelled'));
        },
      };
    },
  };

  return { archivos, disco, cambiarModo: (nuevo: Modo) => (modoActual = nuevo) };
}

const sinEspera = () => Promise.resolve();

describe('crearDescarga', () => {
  it('descarga desde cero, verifica el archivo y lo deja en su sitio', async () => {
    const { archivos, disco } = crear();
    const progreso: number[] = [];
    const alVerificar = jest.fn();
    const resultado = await crearDescarga(archivos, ESPEC, sinEspera).iniciar((f) => progreso.push(f), alVerificar);

    expect(resultado).toBe('completa');
    expect(disco.llamadas).toEqual([{ url: ESPEC.url, desde: 0 }]);
    expect(progreso[0]).toBe(0);
    expect(progreso[progreso.length - 1]).toBe(1);
    expect(alVerificar).toHaveBeenCalledTimes(1);
    expect(disco.promovido).toBe(true);
  });

  it('continúa desde lo que ya hay en lugar de empezar de nuevo', async () => {
    const { archivos, disco } = crear({ parcial: 640 });
    const progreso: number[] = [];
    const resultado = await crearDescarga(archivos, ESPEC, sinEspera).iniciar((f) => progreso.push(f));

    expect(resultado).toBe('completa');
    expect(disco.llamadas).toEqual([{ url: ESPEC.url, desde: 640 }]);
    expect(progreso[0]).toBe(0.64);
    expect(disco.promovido).toBe(true);
  });

  it('si el parcial ya está completo (la app se cerró al verificar), solo verifica', async () => {
    const { archivos, disco } = crear({ parcial: ESPEC.tamanoBytes });
    expect(await crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {})).toBe('completa');
    expect(disco.llamadas).toEqual([]);
    expect(disco.promovido).toBe(true);
  });

  it('un parcial más grande de lo debido no sirve: se borra y se empieza de cero', async () => {
    const { archivos, disco } = crear({ parcial: ESPEC.tamanoBytes + 5 });
    await crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {});
    expect(disco.borrados).toBe(1);
    expect(disco.llamadas).toEqual([{ url: ESPEC.url, desde: 0 }]);
    expect(disco.promovido).toBe(true);
  });

  it('si la red se corta, conserva lo descargado y no deja el modelo a medias', async () => {
    const { archivos, disco } = crear({}, 'falla');
    await expect(crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {})).rejects.toMatchObject({
      code: 'DOWNLOAD_FAILED',
    });
    expect(disco.parcial).toBe(400);
    expect(disco.borrados).toBe(0);
    expect(disco.promovido).toBe(false);
  });

  it('tras un corte, el siguiente intento continúa donde quedó y termina', async () => {
    const { archivos, disco, cambiarModo } = crear({}, 'falla');
    await expect(crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {})).rejects.toBeInstanceOf(ErrorDescarga);
    cambiarModo('completa');
    expect(await crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {})).toBe('completa');
    expect(disco.llamadas).toEqual([
      { url: ESPEC.url, desde: 0 },
      { url: ESPEC.url, desde: 400 },
    ]);
    expect(disco.promovido).toBe(true);
  });

  it('si la transferencia acaba sin error pero con bytes de menos, se puede continuar (no se borra)', async () => {
    const { archivos, disco } = crear({}, 'ensenia-corte');
    await expect(crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {})).rejects.toMatchObject({
      code: 'DOWNLOAD_FAILED',
    });
    expect(disco.parcial).toBe(300);
    expect(disco.borrados).toBe(0);
    expect(disco.promovido).toBe(false);
  });

  it('si el MD5 no coincide, el archivo se descarta y nunca llega a su sitio', async () => {
    const { archivos, disco } = crear({ md5: 'otro-hash' });
    await expect(crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {})).rejects.toMatchObject({
      code: 'DOWNLOAD_CORRUPT',
    });
    expect(disco.borrados).toBe(1);
    expect(disco.parcial).toBe(0);
    expect(disco.promovido).toBe(false);
  });

  it('si no se pudo calcular el MD5, tampoco se da por bueno', async () => {
    const { archivos, disco } = crear({ md5: null });
    await expect(crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {})).rejects.toMatchObject({
      code: 'DOWNLOAD_CORRUPT',
    });
    expect(disco.promovido).toBe(false);
  });

  it('el MD5 se compara sin importar mayúsculas', async () => {
    const { archivos, disco } = crear({ md5: 'ABC123' });
    expect(await crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {})).toBe('completa');
    expect(disco.promovido).toBe(true);
  });

  it('avisa de que está verificando antes de calcular el MD5 y cede un paso para repintar', async () => {
    const orden: string[] = [];
    const { archivos } = crear();
    const original = archivos.md5Parcial;
    archivos.md5Parcial = async () => {
      orden.push('md5');
      return original();
    };
    const cederPaso = async () => {
      orden.push('ceder');
    };
    await crearDescarga(archivos, ESPEC, cederPaso).iniciar(
      () => {},
      () => orden.push('verificando'),
    );
    expect(orden).toEqual(['verificando', 'ceder', 'md5']);
  });

  describe('pausa y descarte', () => {
    it('pausar detiene la descarga conservando lo descargado, y se continúa desde ahí', async () => {
      const { archivos, disco, cambiarModo } = crear({}, 'espera');
      const descarga = crearDescarga(archivos, ESPEC, sinEspera);
      const promesa = descarga.iniciar(() => {});
      await Promise.resolve();
      await descarga.pausar();
      expect(await promesa).toBe('pausada');
      expect(disco.pausas).toBe(1);
      expect(disco.parcial).toBe(250);
      expect(disco.promovido).toBe(false);

      cambiarModo('completa');
      expect(await crearDescarga(archivos, ESPEC, sinEspera).iniciar(() => {})).toBe('completa');
      expect(disco.llamadas[1]).toEqual({ url: ESPEC.url, desde: 250 });
    });

    it('descartar en plena descarga la cancela y borra lo descargado', async () => {
      const { archivos, disco } = crear({}, 'espera');
      const descarga = crearDescarga(archivos, ESPEC, sinEspera);
      const promesa = descarga.iniciar(() => {});
      await Promise.resolve();
      descarga.descartar();
      await expect(promesa).rejects.toMatchObject({ code: 'DOWNLOAD_CANCELLED' });
      expect(disco.cancelaciones).toBe(1);
      expect(disco.parcial).toBe(0);
      expect(disco.promovido).toBe(false);
    });

    it('descartar sin nada en curso (descarga pausada) borra el parcial', () => {
      const { archivos, disco } = crear({ parcial: 500 });
      crearDescarga(archivos, ESPEC, sinEspera).descartar();
      expect(disco.parcial).toBe(0);
      expect(disco.borrados).toBe(1);
    });

    it('una caída de red no se confunde con un descarte', async () => {
      const { archivos, disco } = crear({}, 'espera');
      const descarga = crearDescarga(archivos, ESPEC, sinEspera);
      const promesa = descarga.iniciar(() => {});
      await Promise.resolve();
      disco.soltarConFallo(new Error('timeout'));
      await expect(promesa).rejects.toMatchObject({ code: 'DOWNLOAD_FAILED' });
      expect(disco.parcial).toBe(250);
    });
  });
});

describe('aErrorDescarga', () => {
  it('deja pasar los errores que ya tienen código', () => {
    const original = new ErrorDescarga('DOWNLOAD_CORRUPT');
    expect(aErrorDescarga(original)).toBe(original);
  });

  it('reconoce la falta de espacio', () => {
    expect(aErrorDescarga(new Error('write failed: ENOSPC (No space left on device)')).code).toBe(
      'DOWNLOAD_STORAGE_FULL',
    );
  });

  it('cualquier otro fallo es un corte de descarga', () => {
    expect(aErrorDescarga(new Error('HTTP 503')).code).toBe('DOWNLOAD_FAILED');
    expect(aErrorDescarga('texto').code).toBe('DOWNLOAD_FAILED');
  });
});
