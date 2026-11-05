import { recognizeText, type Text, type TextLine } from '@infinitered/react-native-mlkit-text-recognition';
import { Platform } from 'react-native';

/**
 * OCR local (Google ML Kit) con la misma restricción de plataforma que la IA: solo Android. La primera
 * versión del plan es Android-first; en otras plataformas la pantalla de importación lo comunica.
 */
export function soportaOcrLocal(): boolean {
  return Platform.OS === 'android';
}

const centroY = (l: TextLine) => (l.frame.top + l.frame.bottom) / 2;

/**
 * Lee el texto de una imagen del dispositivo y lo devuelve agrupado por filas visuales: líneas cuyo
 * centro vertical cae dentro de la media altura de la primera línea de la fila se unen de izquierda a derecha.
 * Así «NETFLIX … -15,99» queda en una sola fila aunque ML Kit las devuelva en bloques/columnas distintos.
 */
export async function reconocerTextoImagen(uri: string): Promise<string> {
  if (!/^(file|content):\/\//i.test(uri) || uri.includes('..') || /%2e/i.test(uri)) {
    throw new Error('URI de imagen no permitida.');
  }
  const texto: Text = await recognizeText(uri);
  const lineas = texto.blocks
    .flatMap((bloque) => bloque.lines)
    .filter((l) => l.text.trim() !== '')
    .sort((a, b) => centroY(a) - centroY(b) || a.frame.left - b.frame.left);

  const filas: TextLine[][] = [];
  for (const linea of lineas) {
    const fila = filas[filas.length - 1];
    const ref = fila?.[0];
    if (fila && ref && Math.abs(centroY(linea) - centroY(ref)) <= (ref.frame.bottom - ref.frame.top) / 2) {
      fila.push(linea);
    } else {
      filas.push([linea]);
    }
  }
  return filas
    .map((fila) => [...fila].sort((a, b) => a.frame.left - b.frame.left).map((l) => l.text).join('   '))
    .join('\n')
    .trim();
}
