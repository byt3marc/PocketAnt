import { crearArchivosModelo } from '../archivosModeloExpo';

// `expo-file-system` es nativo: se reemplaza por un falso que anota qué rutas y qué llamadas se hacen.
const mockRegistro: {
  archivos: Map<string, { exists: boolean; size: number; md5: string | null; borrados: number; movidoA: string | null }>;
  tareas: { tipo: 'nueva' | 'savable'; url: string; destino: string; resumeData?: string; opciones: unknown }[];
  carpetasCreadas: string[];
  /** Hace que las tareas terminen como si se hubieran pausado (`null`). */
  pausadas: boolean;
} = { archivos: new Map(), tareas: [], carpetasCreadas: [], pausadas: false };

jest.mock('expo-file-system', () => {
  const unir = (partes: unknown[]) =>
    partes.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');

  class Directory {
    uri: string;
    constructor(...partes: unknown[]) {
      this.uri = unir(partes);
    }
    create(opciones: unknown) {
      mockRegistro.carpetasCreadas.push(`${this.uri}|${JSON.stringify(opciones)}`);
    }
  }

  const estadoDe = (uri: string) => {
    if (!mockRegistro.archivos.has(uri)) {
      mockRegistro.archivos.set(uri, { exists: false, size: 0, md5: null, borrados: 0, movidoA: null });
    }
    return mockRegistro.archivos.get(uri)!;
  };

  class File {
    uri: string;
    constructor(...partes: unknown[]) {
      this.uri = unir(partes);
    }
    get exists() {
      return estadoDe(this.uri).exists;
    }
    get size() {
      return estadoDe(this.uri).size;
    }
    get md5() {
      return estadoDe(this.uri).md5;
    }
    delete() {
      const e = estadoDe(this.uri);
      e.exists = false;
      e.size = 0;
      e.borrados += 1;
    }
    moveSync(destino: { uri: string }) {
      const origen = estadoDe(this.uri);
      origen.movidoA = destino.uri;
      Object.assign(estadoDe(destino.uri), { exists: true, size: origen.size });
      origen.exists = false;
      origen.size = 0;
    }
    static createDownloadTask(url: string, destino: { uri: string }, opciones: unknown) {
      mockRegistro.tareas.push({ tipo: 'nueva', url, destino: destino.uri, opciones });
      return {
        downloadAsync: async () => (mockRegistro.pausadas ? null : { uri: destino.uri }),
        resumeAsync: async () => null,
        pauseAsync: async () => {},
        cancel: () => {},
      };
    }
  }

  const DownloadTask = {
    fromSavable(estado: { url: string; fileUri: string; isDirectory: boolean; resumeData: string }, opciones: unknown) {
      mockRegistro.tareas.push({
        tipo: 'savable',
        url: estado.url,
        destino: estado.fileUri,
        resumeData: estado.resumeData,
        opciones,
      });
      expect(estado.isDirectory).toBe(false);
      return {
        downloadAsync: async () => null,
        resumeAsync: async () => (mockRegistro.pausadas ? null : { uri: estado.fileUri }),
        pauseAsync: async () => {},
        cancel: () => {},
      };
    },
  };

  return { Directory, File, DownloadTask, Paths: { document: new Directory('file:///data/user/0/app/files') } };
});

const CARPETA = 'file:///data/user/0/app/files/models';
const PARCIAL = `${CARPETA}/gemma-e2b.litertlm.tmp`;
const DEFINITIVO = `${CARPETA}/gemma-e2b.litertlm`;

const poner = (uri: string, valores: Partial<{ exists: boolean; size: number; md5: string | null }>) => {
  mockRegistro.archivos.set(uri, { exists: false, size: 0, md5: null, borrados: 0, movidoA: null, ...valores });
};

beforeEach(() => {
  mockRegistro.archivos.clear();
  mockRegistro.tareas.length = 0;
  mockRegistro.carpetasCreadas.length = 0;
  mockRegistro.pausadas = false;
});

describe('crearArchivosModelo', () => {
  it('usa los mismos nombres y carpeta que expo-ai-kit: models/<id>.litertlm y .litertlm.tmp', async () => {
    const archivos = crearArchivosModelo('gemma-e2b');
    archivos.crearTarea('https://x.test/m', 0, () => {});
    expect(mockRegistro.tareas[0].destino).toBe(PARCIAL);
    poner(PARCIAL, { exists: true, size: 10 });
    archivos.promoverParcial();
    expect(mockRegistro.archivos.get(PARCIAL)!.movidoA).toBe(DEFINITIVO);
  });

  it('el tamaño del parcial es 0 si no existe y los bytes que tiene si existe', () => {
    const archivos = crearArchivosModelo('gemma-e2b');
    expect(archivos.tamanoParcial()).toBe(0);
    poner(PARCIAL, { exists: true, size: 640 });
    expect(archivos.tamanoParcial()).toBe(640);
  });

  it('borrar el parcial solo borra si existe', () => {
    const archivos = crearArchivosModelo('gemma-e2b');
    archivos.borrarParcial();
    expect(mockRegistro.archivos.get(PARCIAL)!.borrados).toBe(0);
    poner(PARCIAL, { exists: true, size: 1 });
    archivos.borrarParcial();
    expect(mockRegistro.archivos.get(PARCIAL)!.borrados).toBe(1);
  });

  it('el MD5 sale del archivo parcial', () => {
    poner(PARCIAL, { exists: true, size: 1, md5: 'abc' });
    expect(crearArchivosModelo('gemma-e2b').md5Parcial()).toBe('abc');
  });

  it('al promover reemplaza un modelo viejo que hubiera en su sitio', () => {
    poner(DEFINITIVO, { exists: true, size: 5 });
    poner(PARCIAL, { exists: true, size: 9 });
    crearArchivosModelo('gemma-e2b').promoverParcial();
    expect(mockRegistro.archivos.get(DEFINITIVO)!.borrados).toBe(1);
    expect(mockRegistro.archivos.get(DEFINITIVO)!.exists).toBe(true);
    expect(mockRegistro.archivos.get(DEFINITIVO)!.size).toBe(9);
  });

  describe('crearTarea', () => {
    it('desde cero crea una descarga nueva y avisa los bytes escritos', async () => {
      const bytes: number[] = [];
      const tarea = crearArchivosModelo('gemma-e2b').crearTarea('https://x.test/m', 0, (b) => bytes.push(b));
      expect(mockRegistro.carpetasCreadas[0]).toContain(CARPETA);
      expect(mockRegistro.carpetasCreadas[0]).toContain('"intermediates":true');
      expect(mockRegistro.tareas[0]).toMatchObject({ tipo: 'nueva', url: 'https://x.test/m' });
      expect(await tarea.ejecutar()).toBe('completa');

      const { onProgress } = mockRegistro.tareas[0].opciones as { onProgress: (d: { bytesWritten: number }) => void };
      onProgress({ bytesWritten: 123 });
      expect(bytes).toEqual([123]);
    });

    it('con bytes ya descargados continúa pidiendo desde ese byte', async () => {
      const tarea = crearArchivosModelo('gemma-e2b').crearTarea('https://x.test/m', 640, () => {});
      expect(mockRegistro.tareas[0]).toMatchObject({
        tipo: 'savable',
        url: 'https://x.test/m',
        destino: PARCIAL,
        resumeData: '640',
      });
      expect(await tarea.ejecutar()).toBe('completa');
    });

    it('una tarea que termina en null quedó pausada (tanto nueva como al continuar)', async () => {
      mockRegistro.pausadas = true;
      const nueva = crearArchivosModelo('gemma-e2b').crearTarea('https://x.test/m', 0, () => {});
      expect(await nueva.ejecutar()).toBe('pausada');
      const continuada = crearArchivosModelo('gemma-e2b').crearTarea('https://x.test/m', 500, () => {});
      expect(await continuada.ejecutar()).toBe('pausada');
    });
  });
});
