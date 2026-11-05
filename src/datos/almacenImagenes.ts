import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef, type ImageResult } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';

import {
  CALIDADES_JPEG,
  LADOS_REDUCCION_FINAL,
  MAX_BYTES_IMAGEN,
  medidasComprimidas,
  type ImagenBorrador,
} from '@/dominio/imagenes';
import type { ImagenMovimiento } from '@/dominio/tipos';
import { ErrorTraducible } from '@/i18n/errores';

const CARPETA = 'imagenes';

/** Todo lo que la app necesita del disco para las fotos de los movimientos. */
export interface AlmacenImagenes {
  /** Abre la galería; devuelve las imágenes ya comprimidas (aún en la caché). */
  elegirDeGaleria(limite: number): Promise<ImagenBorrador[]>;
  /** Abre la cámara; `null` si el usuario cancela. */
  tomarFoto(): Promise<ImagenBorrador | null>;
  /** Pasa las imágenes nuevas a su carpeta definitiva y devuelve sus metadatos en orden. */
  guardar(movimientoId: string, imagenes: readonly ImagenBorrador[]): Promise<ImagenMovimiento[]>;
  /** Borra los archivos que ya no están en la lista (al editar un movimiento). */
  conservar(movimientoId: string, imagenes: readonly ImagenMovimiento[]): void;
  /** Escribe en disco las imágenes que vienen dentro de un archivo importado. */
  importar(movimientoId: string, imagenes: readonly ImagenMovimiento[]): Promise<void>;
  /** URI absoluta para mostrar una imagen guardada. */
  uriDe(movimientoId: string, imagen: ImagenMovimiento): string;
  /** JPEG en Base64, o `null` si el archivo ya no está. */
  leerBase64(movimientoId: string, imagen: ImagenMovimiento): Promise<string | null>;
  /** Borra un archivo temporal de la caché (imagen quitada antes de guardar). */
  borrarTemporal(uri: string): void;
  eliminarDeMovimiento(movimientoId: string): void;
  limpiarTodo(): void;
}

/** El id de un movimiento importado no está validado: se escapa para que no pueda salir de `imagenes/`. */
const carpetaDe = (movimientoId: string) =>
  new Directory(Paths.document, CARPETA, encodeURIComponent(movimientoId));
const archivoDe = (movimientoId: string, imagenId: string) =>
  new File(carpetaDe(movimientoId), `${imagenId}.jpg`);

/** Renderiza `uri` reduciéndola a `medidas` si es necesario. */
async function renderizar(
  uri: string,
  ancho: number,
  alto: number,
  medidas: { ancho: number; alto: number },
): Promise<ImageRef> {
  const contexto = ImageManipulator.manipulate(uri);
  if (medidas.ancho !== ancho || medidas.alto !== alto) {
    contexto.resize({ width: medidas.ancho, height: medidas.alto });
  }
  return contexto.renderAsync();
}

/** Borra un JPEG temporal de la caché; si no se puede, lo limpiará el sistema. */
function borrarDeCache(uri: string): void {
  try {
    if (!uri.startsWith(Paths.cache.uri)) return;
    const archivo = new File(uri);
    if (archivo.exists) archivo.delete();
  } catch {
    // Un temporal que no se puede borrar no debe impedir comprimir la foto.
  }
}

/** El JPEG ya cumple el tope de tamaño. */
const cabeEnTope = (resultado: ImageResult): boolean =>
  new File(resultado.uri).size <= MAX_BYTES_IMAGEN;

/** Guarda un intento y borra el anterior: solo el definitivo debe quedar en la caché. */
async function guardarIntento(
  imagen: ImageRef,
  calidad: number,
  anterior: ImageResult | null,
): Promise<ImageResult> {
  const resultado = await imagen.saveAsync({ compress: calidad, format: SaveFormat.JPEG });
  if (anterior && anterior.uri !== resultado.uri) borrarDeCache(anterior.uri);
  return resultado;
}

/** Convierte y reduce una foto elegida; si no se puede, lanza un error traducible. */
async function comprimir(asset: ImagePickerAsset): Promise<Omit<ImagenBorrador, 'id' | 'nueva'>> {
  const medidas = medidasComprimidas(asset.width, asset.height);
  let resultado: ImageResult | null = null;
  try {
    const original = await renderizar(asset.uri, asset.width, asset.height, medidas);

    for (const calidad of CALIDADES_JPEG) {
      resultado = await guardarIntento(original, calidad, resultado);
      if (cabeEnTope(resultado)) break;
    }
    if (!resultado) throw new Error('sin imagen');

    // Solo si ni la calidad más baja bastó se reduce el lado, por último, hasta cumplir el tope.
    const calidadMinima = CALIDADES_JPEG[CALIDADES_JPEG.length - 1];
    for (const lado of LADOS_REDUCCION_FINAL) {
      if (cabeEnTope(resultado)) break;
      const reducidas = medidasComprimidas(resultado.width, resultado.height, lado);
      if (reducidas.ancho === resultado.width && reducidas.alto === resultado.height) continue;
      const reescala = await renderizar(resultado.uri, resultado.width, resultado.height, reducidas);
      resultado = await guardarIntento(reescala, calidadMinima, resultado);
    }

    // Garantía real: nunca se guarda una foto por encima del tope (al importarla se descartaría).
    if (!cabeEnTope(resultado)) throw new Error('supera el tope');

    return { uri: resultado.uri, ancho: resultado.width, alto: resultado.height };
  } catch {
    if (resultado) borrarDeCache(resultado.uri);
    throw new ErrorTraducible('error.imagen_procesar');
  }
}

async function desdeAsset(asset: ImagePickerAsset): Promise<ImagenBorrador> {
  const comprimida = await comprimir(asset);
  return { id: Crypto.randomUUID(), nueva: true, ...comprimida };
}

export function crearAlmacenImagenes(): AlmacenImagenes {
  return {
    async elegirDeGaleria(limite) {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: limite > 1,
        selectionLimit: limite,
        quality: 1,
        exif: false,
      });
      if (resultado.canceled) return [];

      const imagenes: ImagenBorrador[] = [];
      for (const asset of resultado.assets.slice(0, limite)) {
        imagenes.push(await desdeAsset(asset));
      }
      return imagenes;
    },

    async tomarFoto() {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) throw new ErrorTraducible('error.imagen_permiso');

      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        exif: false,
      });
      if (resultado.canceled) return null;
      return desdeAsset(resultado.assets[0]);
    },

    async guardar(movimientoId, imagenes) {
      if (imagenes.length === 0) return [];

      const carpeta = carpetaDe(movimientoId);
      carpeta.create({ intermediates: true, idempotent: true });

      return imagenes.map((borrador, orden) => {
        if (borrador.nueva) {
          try {
            new File(borrador.uri).moveSync(archivoDe(movimientoId, borrador.id), { overwrite: true });
          } catch {
            throw new ErrorTraducible('error.imagen_guardar');
          }
        }
        return { id: borrador.id, ancho: borrador.ancho, alto: borrador.alto, orden };
      });
    },

    conservar(movimientoId, imagenes) {
      const carpeta = carpetaDe(movimientoId);
      if (!carpeta.exists) return;
      const conservadas = new Set(imagenes.map((imagen) => `${imagen.id}.jpg`));
      for (const entrada of carpeta.list()) {
        if (entrada instanceof File && !conservadas.has(entrada.name)) {
          try {
            entrada.delete();
          } catch {
            // Un archivo que no se puede borrar no debe impedir guardar el movimiento.
          }
        }
      }
    },

    async importar(movimientoId, imagenes) {
      const conDatos = imagenes.filter((imagen) => typeof imagen.base64 === 'string' && imagen.base64 !== '');
      if (conDatos.length === 0) return;

      const carpeta = carpetaDe(movimientoId);
      carpeta.create({ intermediates: true, idempotent: true });

      for (const imagen of conDatos) {
        const archivo = archivoDe(movimientoId, imagen.id);
        // Las imágenes son inmutables (un cambio crea otro id): si ya está, no hay nada que hacer.
        if (archivo.exists) continue;
        try {
          archivo.create({ overwrite: true });
          archivo.write(imagen.base64!, { encoding: 'base64' });
        } catch {
          // Una imagen dañada no debe impedir importar el resto del movimiento.
          if (archivo.exists) archivo.delete();
        }
      }
    },

    uriDe(movimientoId, imagen) {
      return archivoDe(movimientoId, imagen.id).uri;
    },

    async leerBase64(movimientoId, imagen) {
      const archivo = archivoDe(movimientoId, imagen.id);
      if (!archivo.exists) return null;
      try {
        return await archivo.base64();
      } catch {
        return null;
      }
    },

    borrarTemporal(uri) {
      try {
        if (uri.includes('..') || /%2e/i.test(uri)) return;
        const archivo = new File(uri);
        // Solo se tocan archivos de la caché: nunca una foto ya guardada.
        if (archivo.exists && archivo.uri.startsWith(Paths.cache.uri)) archivo.delete();
      } catch {
        // La caché la limpia el sistema; si falla, no es un problema.
      }
    },

    eliminarDeMovimiento(movimientoId) {
      try {
        const carpeta = carpetaDe(movimientoId);
        if (carpeta.exists) carpeta.delete();
      } catch {
        // Ídem: los archivos huérfanos no afectan a los datos.
      }
    },

    limpiarTodo() {
      try {
        const carpeta = new Directory(Paths.document, CARPETA);
        if (carpeta.exists) carpeta.delete();
      } catch {
        // Ídem.
      }
    },
  };
}
