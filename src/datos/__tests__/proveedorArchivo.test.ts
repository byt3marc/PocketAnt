import { ErrorArchivoInvalido, MAX_BYTES_ARCHIVO } from '../sincronizacion/formatoArchivo';
import { proveedorArchivoJson } from '../sincronizacion/proveedorArchivo';

const mockEstado = { size: 0, texto: '', leido: false };

jest.mock('expo-file-system', () => ({
  File: class {
    readonly uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return mockEstado.size;
    }
    async text() {
      mockEstado.leido = true;
      return mockEstado.texto;
    }
  },
  Paths: { cache: '' },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///x.json' }] }),
}));

describe('importar archivo JSON', () => {
  it('rechaza un archivo por encima del límite sin llegar a leerlo', async () => {
    mockEstado.size = MAX_BYTES_ARCHIVO + 1;
    mockEstado.texto = '{}';
    mockEstado.leido = false;

    let error: unknown;
    try {
      await proveedorArchivoJson.descargar();
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ErrorArchivoInvalido);
    expect((error as ErrorArchivoInvalido).clave).toBe('error.archivo.demasiado_grande');
    expect(mockEstado.leido).toBe(false);
  });

  it('acepta un archivo exactamente en el límite', async () => {
    mockEstado.size = MAX_BYTES_ARCHIVO;
    mockEstado.texto = JSON.stringify({ version: 2, exportadoEn: '2026-10-24T12:00:00.000Z', movimientos: [] });

    expect(await proveedorArchivoJson.descargar()).toMatchObject({ descartados: 0 });
  });
});
