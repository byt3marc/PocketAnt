import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { claveDeFecha } from '@/dominio/fechas';
import { ErrorTraducible } from '@/i18n/errores';
import { NOMBRE_APP } from '@/marca';

import { analizarArchivo, ErrorArchivoInvalido, serializarArchivo } from './formatoArchivo';
import type { ProveedorSync } from './proveedor';

/** Proveedor de la build de prueba: exporta con el menú de compartir e importa con el selector de archivos. */
export const proveedorArchivoJson: ProveedorSync = {
  id: 'archivo-json',
  nombre: 'Archivo JSON',

  async subir(archivo) {
    if (!(await Sharing.isAvailableAsync())) {
      throw new ErrorTraducible('error.compartir_no_disponible');
    }
    const archivoTemporal = new File(
      Paths.cache,
      `${NOMBRE_APP.toLowerCase()}-${claveDeFecha(new Date())}.json`,
    );
    archivoTemporal.create({ overwrite: true });
    archivoTemporal.write(serializarArchivo(archivo));
    await Sharing.shareAsync(archivoTemporal.uri, {
      mimeType: 'application/json',
      dialogTitle: `Exportar datos de ${NOMBRE_APP}`,
      UTI: 'public.json',
    });
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

    const texto = await new File(resultado.assets[0].uri).text();
    if (texto.trim() === '') throw new ErrorArchivoInvalido('error.archivo.vacio');
    return analizarArchivo(texto);
  },
};
