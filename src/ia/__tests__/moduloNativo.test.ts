/**
 * El módulo nativo `descarga-segundo-plano` (Kotlin) no se puede compilar ni probar aquí: estas pruebas leen sus
 * archivos y comprueban los nombres y permisos que tienen que coincidir entre Kotlin, el manifiesto y JavaScript.
 * Un nombre mal escrito solo se descubriría en el teléfono.
 */

// Sin `@types/node` en el proyecto: se piden `fs` y `path` a Jest con el tipo mínimo que se usa.
const { readFileSync, existsSync } = jest.requireActual('fs') as {
  readFileSync: (ruta: string, codificacion: 'utf8') => string;
  existsSync: (ruta: string) => boolean;
};
const { join } = jest.requireActual('path') as { join: (...partes: string[]) => string };

const raiz = join(process.cwd(), 'modules', 'descarga-segundo-plano');
const leer = (...partes: string[]) => readFileSync(join(raiz, ...partes), 'utf8');
const kotlin = (archivo: string) => leer('android', 'src', 'main', 'java', 'expo', 'modules', 'descargasegundoplano', archivo);

describe('módulo nativo descarga-segundo-plano', () => {
  it('la configuración apunta a la clase Kotlin que existe', () => {
    const config = JSON.parse(leer('expo-module.config.json')) as {
      platforms: string[];
      android: { modules: string[] };
    };
    expect(config.platforms).toEqual(['android']);
    expect(config.android.modules).toEqual(['expo.modules.descargasegundoplano.DescargaSegundoPlanoModule']);
    expect(existsSync(join(raiz, 'android', 'src', 'main', 'java', 'expo', 'modules', 'descargasegundoplano', 'DescargaSegundoPlanoModule.kt'))).toBe(true);
    expect(kotlin('DescargaSegundoPlanoModule.kt')).toContain('class DescargaSegundoPlanoModule : Module()');
    expect(kotlin('DescargaSegundoPlanoModule.kt')).toContain('package expo.modules.descargasegundoplano');
  });

  it('el nombre del módulo y de su evento coinciden entre Kotlin y JavaScript', () => {
    expect(kotlin('DescargaSegundoPlanoModule.kt')).toContain('Name("DescargaSegundoPlano")');
    expect(kotlin('DescargaSegundoPlanoModule.kt')).toContain('Events("onAccion")');
    expect(kotlin('DescargaSegundoPlanoModule.kt')).toContain('sendEvent("onAccion"');
    const js = leer('index.ts');
    expect(js).toContain("requireOptionalNativeModule<ModuloNativo>('DescargaSegundoPlano')");
    expect(js).toContain("addListener('onAccion'");
  });

  it('cada función que llama JavaScript existe en Kotlin con los mismos argumentos', () => {
    const modulo = kotlin('DescargaSegundoPlanoModule.kt');
    expect(modulo).toMatch(/Function\("iniciar"\) \{ textos: Map<String, String> ->/);
    expect(modulo).toMatch(/Function\("actualizar"\) \{ fraccion: Double, texto: String ->/);
    expect(modulo).toMatch(/Function\("terminar"\) \{ titulo: String, texto: String, mostrarAviso: Boolean ->/);
    const js = leer('index.ts');
    expect(js).toContain('iniciar: (textos: TextosNotificacion) => void');
    expect(js).toContain('actualizar: (fraccion: number, texto: string) => void');
    expect(js).toContain('terminar: (titulo: string, texto: string, mostrarAviso: boolean) => void');
  });

  it('las claves de los textos son las mismas en JavaScript y en Kotlin', () => {
    const js = leer('index.ts');
    const modulo = kotlin('DescargaSegundoPlanoModule.kt');
    for (const clave of ['titulo', 'texto', 'pausar', 'cancelar', 'canalProgreso', 'canalResultado']) {
      expect(js).toContain(`${clave}: string;`);
      expect(modulo).toContain(`textos["${clave}"]`);
    }
  });

  it('el manifiesto declara el servicio en primer plano de tipo dataSync y sus permisos', () => {
    const manifiesto = leer('android', 'src', 'main', 'AndroidManifest.xml');
    expect(manifiesto).toContain('android:name="expo.modules.descargasegundoplano.DescargaService"');
    expect(manifiesto).toContain('android:foregroundServiceType="dataSync"');
    expect(manifiesto).toContain('android:exported="false"');
    expect(manifiesto).toContain('android.permission.FOREGROUND_SERVICE"');
    expect(manifiesto).toContain('android.permission.FOREGROUND_SERVICE_DATA_SYNC');
    expect(manifiesto).toContain('android.permission.WAKE_LOCK');
    expect(kotlin('DescargaService.kt')).toContain('class DescargaService : Service()');
  });

  it('el servicio arranca en primer plano con el tipo correcto y no revive solo', () => {
    const servicio = kotlin('DescargaService.kt');
    expect(servicio).toContain('ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC');
    expect(servicio).toContain('startForeground(ID_PROGRESO');
    expect(servicio).toContain('return START_NOT_STICKY');
    // Los botones de la notificación usan PendingIntent inmutables (obligatorio desde Android 12).
    expect(servicio).toContain('PendingIntent.FLAG_IMMUTABLE');
    expect(servicio).not.toMatch(/PendingIntent\.FLAG_MUTABLE/);
  });

  it('el módulo y el servicio usan las mismas acciones y claves de intent', () => {
    const modulo = kotlin('DescargaSegundoPlanoModule.kt');
    const servicio = kotlin('DescargaService.kt');
    for (const constante of [
      'ACCION_INICIAR',
      'EXTRA_TITULO',
      'EXTRA_TEXTO',
      'EXTRA_PAUSAR',
      'EXTRA_CANCELAR',
      'EXTRA_CANAL_PROGRESO',
      'EXTRA_CANAL_RESULTADO',
    ]) {
      expect(servicio).toContain(`const val ${constante}`);
      expect(modulo).toContain(`DescargaService.${constante}`);
    }
    // El servicio avisa «pausar» y «cancelar», que son los valores que JavaScript espera.
    expect(servicio).toContain('invoke("pausar")');
    expect(servicio).toContain('invoke("cancelar")');
    expect(leer('index.ts')).toContain("'pausar' | 'cancelar'");
  });

  it('el build.gradle usa el plugin de módulos de Expo y el mismo espacio de nombres', () => {
    const gradle = leer('android', 'build.gradle');
    expect(gradle).toContain("id 'com.android.library'");
    expect(gradle).toContain("id 'expo-module-gradle-plugin'");
    expect(gradle).toContain('namespace "expo.modules.descargasegundoplano"');
  });
});
