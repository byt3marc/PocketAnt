import { Platform } from 'react-native';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';

import { reconocerTextoImagen, soportaOcrLocal } from '../ocrTexto';

jest.mock('@infinitered/react-native-mlkit-text-recognition', () => ({
  recognizeText: jest.fn(),
}));

describe('ocrTexto', () => {
  it('soportaOcrLocal es true solo en android', () => {
    Platform.OS = 'android';
    expect(soportaOcrLocal()).toBe(true);
    Platform.OS = 'ios';
    expect(soportaOcrLocal()).toBe(false);
    Platform.OS = 'android';
  });

  it('reconstruye filas visuales asociando columnas separadas por su centro vertical', async () => {
    // Simula ML Kit devolviendo descripciones en el bloque 0 y montos en el bloque 1 (común en apps bancarias)
    (recognizeText as jest.Mock).mockResolvedValueOnce({
      text: 'NETFLIX\nUBER\n-15.99\n-8.50',
      blocks: [
        {
          text: 'NETFLIX\nUBER',
          frame: { left: 10, top: 100, right: 150, bottom: 200 },
          recognizedLanguages: ['es'],
          lines: [
            {
              text: 'NETFLIX',
              frame: { left: 10, top: 100, right: 150, bottom: 140 },
              recognizedLanguages: ['es'],
              elements: [],
            },
            {
              text: 'UBER',
              frame: { left: 10, top: 160, right: 100, bottom: 200 },
              recognizedLanguages: ['es'],
              elements: [],
            },
          ],
        },
        {
          text: '-15.99\n-8.50',
          frame: { left: 300, top: 102, right: 400, bottom: 202 },
          recognizedLanguages: ['es'],
          lines: [
            {
              text: '-15.99',
              frame: { left: 300, top: 102, right: 400, bottom: 142 },
              recognizedLanguages: ['es'],
              elements: [],
            },
            {
              text: '-8.50',
              frame: { left: 300, top: 162, right: 380, bottom: 202 },
              recognizedLanguages: ['es'],
              elements: [],
            },
          ],
        },
      ],
    });

    const resultado = await reconocerTextoImagen('file:///captura.png');
    // Las líneas de la misma fila deben aparecer juntas de izquierda a derecha
    expect(resultado).toBe('NETFLIX   -15.99\nUBER   -8.50');
  });

  it('rechaza URIs remotas o con traversal antes de llamar a ML Kit', async () => {
    (recognizeText as jest.Mock).mockClear();
    await expect(reconocerTextoImagen('https://malicioso.example/recibo.png')).rejects.toThrow();
    await expect(reconocerTextoImagen('file:///cache/../secret.db')).rejects.toThrow();
    await expect(reconocerTextoImagen('content://media/%2e%2e/secret')).rejects.toThrow();
    expect(recognizeText).not.toHaveBeenCalled();
  });
});
