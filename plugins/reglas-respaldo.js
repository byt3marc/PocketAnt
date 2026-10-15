// Copia de seguridad de Android solo con los datos del usuario.
//
// La copia automática de Android guarda hasta 25 MB por app; si los archivos pasan de ahí, no respalda NADA. El modelo
// de IA (~2.6 GB en `files/models/`, lo pone ahí expo-ai-kit) lo superaría y, con él descargado, se perderían también
// los movimientos y los ajustes. Estas reglas lo dejan fuera; el resto (la base `files/SQLite/` con los movimientos y
// los ajustes) se sigue respaldando. El modelo se puede volver a descargar.
const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

/** Carpetas de `files/` (`Context.getFilesDir()`) que no se respaldan. */
const EXCLUIDAS = ['models'];

const COMENTARIO = '<!-- Generado por plugins/reglas-respaldo.js: no se respalda el modelo de IA. -->';
const exclusiones = (sangria) =>
  EXCLUIDAS.map((ruta) => `${sangria}<exclude domain="file" path="${ruta}" />`).join('\n');

/** Android 11 o anterior (`android:fullBackupContent`). */
const REGLAS_RESPALDO = [
  '<?xml version="1.0" encoding="utf-8"?>',
  COMENTARIO,
  '<full-backup-content>',
  exclusiones('  '),
  '</full-backup-content>',
  '',
].join('\n');

/** Android 12 o posterior (`android:dataExtractionRules`): copia en la nube y paso directo a otro teléfono. */
const REGLAS_EXTRACCION = [
  '<?xml version="1.0" encoding="utf-8"?>',
  COMENTARIO,
  '<data-extraction-rules>',
  '  <cloud-backup>',
  exclusiones('    '),
  '  </cloud-backup>',
  '  <device-transfer>',
  exclusiones('    '),
  '  </device-transfer>',
  '</data-extraction-rules>',
  '',
].join('\n');

function conReglasDeRespaldo(config) {
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const carpeta = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(carpeta, { recursive: true });
      fs.writeFileSync(path.join(carpeta, 'reglas_respaldo.xml'), REGLAS_RESPALDO);
      fs.writeFileSync(path.join(carpeta, 'reglas_extraccion.xml'), REGLAS_EXTRACCION);
      return config;
    },
  ]);
  return withAndroidManifest(config, (config) => {
    const aplicacion = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    aplicacion.$['android:fullBackupContent'] = '@xml/reglas_respaldo';
    aplicacion.$['android:dataExtractionRules'] = '@xml/reglas_extraccion';
    return config;
  });
}

module.exports = conReglasDeRespaldo;
