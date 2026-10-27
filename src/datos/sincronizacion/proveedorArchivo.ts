import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { claveDeFecha } from '@/dominio/fechas';
import { ErrorTraducible } from '@/i18n/errores';
import { NOMBRE_APP } from '@/marca';

import { analizarArchivo, ErrorArchivoInvalido, MAX_BYTES_ARCHIVO, serializarArchivo } from './formatoArchivo';
import type { ProveedorSync } from './proveedor';
import { crearEscritorPorBloques, escribirJsonConImagenes } from './serializadorArchivo';

/** Crea el temporal en la caché (sobrescribiendo uno anterior del mismo día) o falla si no hay con qué compartir. */
async function nuevoTemporal(): Promise<File> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ErrorTraducible('error.compartir_no_disponible');
  }
  const temporal = new File(Paths.cache, `${NOMBRE_APP.toLowerCase()}-${claveDeFecha(new Date())}.json`);
  temporal.create({ overwrite: true });
  return temporal;
}

async function compartir(temporal: File): Promise<void> {
  await Sharing.shareAsync(temporal.uri, {
    mimeType: 'application/json',
    dialogTitle: `Exportar datos de ${NOMBRE_APP}`,
    UTI: 'public.json',
  });
}

/** Proveedor de la build de prueba: exporta con el menú de compartir e importa con el selector de archivos. */
export const proveedorArchivoJson: ProveedorSync = {
  id: 'archivo-json',
  nombre: 'Archivo JSON',

  async subir(archivo) {
    const temporal = await nuevoTemporal();
    temporal.write(serializarArchivo(archivo));
    await compartir(temporal);
  },

  async subirConImagenes(movimientos, almacen) {
    const temporal = await nuevoTemporal();
    // `File.write(append)` abre y cierra el archivo en cada llamada: se agrupa en bloques.
    const escritor = crearEscritorPorBloques((bloque) => {
      temporal.write(bloque, { append: true });
    });
    await escribirJsonConImagenes(
      movimientos,
      (id, imagen) => almacen.leerBase64(id, imagen),
      escritor.escribir,
    );
    await escritor.volcar();
    await compartir(temporal);
  },

  async descargar() {
    // '*/*' a propósito: algunos proveedores (Drive, WhatsApp…) entregan los .json con otro tipo MIME
    // y no aparecerían en el selector. El contenido se valida al leerlo.
    const resultado = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (resultado.canceled) return null;

    const archivo = new File(resultado.assets[0].uri);
    // Antes de cargar el texto completo: un archivo enorme agotaría la memoria en `JSON.parse`.
    if (archivo.size > MAX_BYTES_ARCHIVO) throw new ErrorArchivoInvalido('error.archivo.demasiado_grande');
    const texto = await archivo.text();
    if (texto.trim() === '') throw new ErrorArchivoInvalido('error.archivo.vacio');
    return analizarArchivo(texto);
  },
};
