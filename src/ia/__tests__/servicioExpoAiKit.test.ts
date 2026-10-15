import { Platform } from 'react-native';

import { crearServicioExpoAiKit } from '../servicioExpoAiKit';
import type { ArchivosModelo } from '../descargaModelo';

// `expo-ai-kit` y el disco son nativos: se simulan para probar cómo los usa el servicio.
const mockKit = {
  getDownloadableModels: jest.fn(),
  setModel: jest.fn(),
  deleteModel: jest.fn(),
  unloadModel: jest.fn(),
  streamMessage: jest.fn(),
};
jest.mock('expo-ai-kit', () => mockKit);

let mockRam: number | null = 17_179_869_184;
jest.mock('expo-device', () => ({
  get totalMemory() {
    return mockRam;
  },
}));
jest.mock('expo-file-system', () => ({ Paths: { availableDiskSpace: 50_000_000_000 } }));

const mockArchivos: ArchivosModelo = {
  tamanoParcial: jest.fn(() => 0),
  borrarParcial: jest.fn(),
  md5Parcial: jest.fn(() => '1b8446203a216cfd31f6a2a22f75e5e5'),
  promoverParcial: jest.fn(),
  crearTarea: jest.fn(),
};
jest.mock('../archivosModeloExpo', () => ({ crearArchivosModelo: () => mockArchivos }));

const modelo = (estado: string, cumple = true) => ({ id: 'gemma-e2b', status: estado, meetsRequirements: cumple });

beforeEach(() => {
  jest.clearAllMocks();
  mockRam = 17_179_869_184;
  jest.replaceProperty(Platform, 'OS', 'android');
  mockKit.getDownloadableModels.mockResolvedValue([modelo('not-downloaded')]);
  (mockArchivos.tamanoParcial as jest.Mock).mockReturnValue(0);
});

afterEach(() => jest.restoreAllMocks());

describe('crearServicioExpoAiKit: carga y generación', () => {
  it('carga el modelo SIEMPRE en CPU (la GPU falla en la primera generación en muchos teléfonos)', async () => {
    await crearServicioExpoAiKit().cargar();
    expect(mockKit.setModel).toHaveBeenCalledTimes(1);
    const [id, opciones] = mockKit.setModel.mock.calls[0];
    expect(id).toBe('gemma-e2b');
    expect(opciones.backend).toBe('cpu');
    expect(opciones.generation).toEqual({ temperature: 0.3, topK: 40, topP: 0.9 });
  });

  it('genera por streaming y devuelve el texto', async () => {
    const detener = jest.fn();
    mockKit.streamMessage.mockImplementation((_mensajes, alToken) => {
      alToken({ accumulatedText: 'Hola' });
      alToken({ accumulatedText: 'Hola mundo' });
      return { promise: Promise.resolve({ text: 'Hola mundo' }), stop: detener };
    });
    const textos: string[] = [];
    const flujo = crearServicioExpoAiKit().generar([{ role: 'user', content: 'x' }], (t) => textos.push(t));
    expect(await flujo.promesa).toBe('Hola mundo');
    expect(textos).toEqual(['Hola', 'Hola mundo']);
  });

  it('si el motor falla, el error llega tal cual, con su código y su motivo', async () => {
    const error = Object.assign(new Error('Can not find OpenCL library'), { code: 'INFERENCE_FAILED' });
    // La promesa rechazada se crea al llamar al motor, no antes (si no, nadie la atiende a tiempo).
    mockKit.streamMessage.mockImplementation(() => ({ promise: Promise.reject(error), stop: jest.fn() }));
    const flujo = crearServicioExpoAiKit().generar([{ role: 'user', content: 'x' }], () => {});
    await expect(flujo.promesa).rejects.toMatchObject({ code: 'INFERENCE_FAILED', message: 'Can not find OpenCL library' });
  });

  it('detener antes de que el motor arranque lo detiene en cuanto arranca', async () => {
    const parar = jest.fn();
    mockKit.streamMessage.mockReturnValue({ promise: Promise.resolve({ text: '' }), stop: parar });
    const flujo = crearServicioExpoAiKit().generar([{ role: 'user', content: 'x' }], () => {});
    flujo.detener();
    await flujo.promesa;
    expect(parar).toHaveBeenCalled();
  });

  it('liberar y eliminar usan la librería (eliminar también borra el parcial)', async () => {
    const servicio = crearServicioExpoAiKit();
    await servicio.liberar();
    expect(mockKit.unloadModel).toHaveBeenCalledTimes(1);
    await servicio.eliminar();
    expect(mockKit.deleteModel).toHaveBeenCalledWith('gemma-e2b');
    expect(mockArchivos.borrarParcial).toHaveBeenCalled();
  });
});

describe('crearServicioExpoAiKit: compatibilidad', () => {
  it('fuera de Android no es compatible', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    expect(await crearServicioExpoAiKit().evaluar()).toMatchObject({ compatible: false, motivo: 'plataforma' });
  });

  it('con poca RAM no ofrece el modelo y dice cuánta hay', async () => {
    mockRam = 3_000_000_000;
    expect(await crearServicioExpoAiKit().evaluar()).toEqual({ compatible: false, motivo: 'ram', ramBytes: 3_000_000_000 });
  });

  it('un teléfono de 16 GB: compatible, sin avisos de RAM justa', async () => {
    expect(await crearServicioExpoAiKit().evaluar()).toMatchObject({
      compatible: true,
      descargado: false,
      cargado: false,
      parcialBytes: 0,
      ramJusta: false,
    });
  });

  it('entre 4 y 6 GB avisa de que va justo', async () => {
    mockRam = 5_000_000_000;
    expect(await crearServicioExpoAiKit().evaluar()).toMatchObject({ compatible: true, ramJusta: true });
  });

  it('lee el estado del modelo: descargado, cargado o con una descarga a medias', async () => {
    mockKit.getDownloadableModels.mockResolvedValue([modelo('downloaded')]);
    expect(await crearServicioExpoAiKit().evaluar()).toMatchObject({ descargado: true, cargado: false, parcialBytes: 0 });
    mockKit.getDownloadableModels.mockResolvedValue([modelo('ready')]);
    expect(await crearServicioExpoAiKit().evaluar()).toMatchObject({ descargado: true, cargado: true });
    mockKit.getDownloadableModels.mockResolvedValue([modelo('not-downloaded')]);
    (mockArchivos.tamanoParcial as jest.Mock).mockReturnValue(1_035_259_085);
    expect(await crearServicioExpoAiKit().evaluar()).toMatchObject({ descargado: false, parcialBytes: 1_035_259_085 });
  });

  it('si la librería dice que el teléfono no cumple los requisitos, no es compatible', async () => {
    mockKit.getDownloadableModels.mockResolvedValue([modelo('not-downloaded', false)]);
    expect(await crearServicioExpoAiKit().evaluar()).toMatchObject({ compatible: false, motivo: 'ram' });
  });

  it('sin el módulo nativo (build sin `llm`), queda solo el análisis por reglas', async () => {
    mockKit.getDownloadableModels.mockRejectedValue(new Error('LLM_NOT_ENABLED'));
    expect(await crearServicioExpoAiKit().evaluar()).toMatchObject({ compatible: false, motivo: 'generico' });
  });
});
