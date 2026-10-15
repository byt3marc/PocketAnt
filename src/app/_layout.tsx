import { useFonts } from 'expo-font';
import { getLocales } from 'expo-localization';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AjustesProvider, useAjustes } from '@/ajustes/AjustesProvider';
import { AvisoProvider } from '@/componentes/AvisoProvider';
import { DialogoProvider } from '@/componentes/DialogoProvider';
import { fuentesDeIconos } from '@/componentes/Icono';
import { DatosProvider, useDatos } from '@/datos/DatosProvider';
import { migrarBaseDeDatos } from '@/datos/migraciones';
import { crearRepositorioSqlite } from '@/datos/repositorioSqlite';
import { proveedorArchivoJson } from '@/datos/sincronizacion/proveedorArchivo';
import { SincronizacionProvider } from '@/datos/sincronizacion/SincronizacionProvider';
import { crearI18n, resolverIdioma } from '@/i18n/traducir';
import { IAProvider } from '@/ia/IAProvider';
import { configurarManejadorDeNotificaciones } from '@/notificaciones/manejador';
import { NotificacionesProvider } from '@/notificaciones/NotificacionesProvider';
import { fuentesDeTexto } from '@/tema/archivosDeFuentes';
import { estiloDeFuente } from '@/tema/fuentes';
import { paletaClara, paletaOscura } from '@/tema/paleta';

// La pantalla de carga se queda visible hasta tener fuentes y datos listos.
SplashScreen.preventAutoHideAsync();
// Debe quedar registrado antes de que llegue cualquier notificación.
configurarManejadorDeNotificaciones();

const NOMBRE_BASE_DE_DATOS = 'gastos-hormiga.db';

/**
 * Cómo entra cada pantalla. En Android, la del sistema (`default`, 450 ms en Android 13+) se siente lenta: se usa un
 * fundido con una subida del 8 % de ~0.25 s que frena al final. En iOS se deja el empujón nativo (con su gesto de volver).
 * Con «reducir animaciones», solo un fundido.
 */
function animacionDePantalla(reducir: boolean) {
  if (reducir) return 'fade';
  return Platform.OS === 'android' ? 'fade_from_bottom' : 'default';
}

/** Pantalla de error de último recurso (se muestra si falla la base de datos al abrir). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const oscuro = useColorScheme() === 'dark';
  const paleta = oscuro ? paletaOscura : paletaClara;
  // Fuera de los proveedores no hay ajustes: se usa el idioma del dispositivo.
  const i18n = crearI18n(resolverIdioma('sistema', getLocales()[0]?.languageCode));
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={[estilosError.contenedor, { backgroundColor: paleta.fondo }]}>
      <Text style={[estilosError.titulo, { color: paleta.texto }]}>{i18n.t('error.algo_salio_mal')}</Text>
      <Text style={[estilosError.detalle, { color: paleta.textoSecundario }]}>{error.message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={[estilosError.boton, { backgroundColor: paleta.primario }]}
      >
        <Text style={{ color: paleta.sobrePrimario, fontWeight: '700' }}>{i18n.t('comun.reintentar')}</Text>
      </Pressable>
    </View>
  );
}

const estilosError = StyleSheet.create({
  contenedor: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  titulo: { fontSize: 22, fontWeight: '700' },
  detalle: { fontSize: 14, textAlign: 'center' },
  boton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
});

function DatosSqlite({ children }: { children: ReactNode }) {
  const baseDeDatos = useSQLiteContext();
  const repositorio = useMemo(() => crearRepositorioSqlite(baseDeDatos), [baseDeDatos]);
  return (
    <DatosProvider repositorio={repositorio} proveedorSync={proveedorArchivoJson}>
      {children}
    </DatosProvider>
  );
}

function Navegacion() {
  const { ajustes, colores, esquema, i18n } = useAjustes();
  const { cargando } = useDatos();
  const reducirMovimiento = useReducedMotion();

  useEffect(() => {
    if (!cargando) SplashScreen.hideAsync();
  }, [cargando]);

  const temaDeNavegacion = useMemo(() => {
    const base = esquema === 'oscuro' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colores.primario,
        background: colores.fondo,
        card: colores.fondo,
        text: colores.texto,
        border: colores.borde,
      },
    };
  }, [esquema, colores]);

  if (cargando) return null;

  return (
    <ThemeProvider value={temaDeNavegacion}>
      <StatusBar style="auto" />
      <SincronizacionProvider>
        <NotificacionesProvider>
          <Stack
            screenOptions={{
              animation: animacionDePantalla(reducirMovimiento),
              headerStyle: { backgroundColor: colores.fondo },
              headerTintColor: colores.texto,
              headerShadowVisible: false,
              headerTitleStyle: estiloDeFuente(ajustes.fuente, 'seminegrita'),
              contentStyle: { backgroundColor: colores.fondo },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="estadisticas" options={{ title: i18n.t('nav.estadisticas') }} />
            <Stack.Screen name="analisis" options={{ title: i18n.t('nav.analisis') }} />
            <Stack.Screen
              name="movimiento"
              options={{ presentation: 'modal', title: i18n.t('nav.movimiento') }}
            />
            <Stack.Screen name="ajustes" options={{ title: i18n.t('nav.ajustes') }} />
            <Stack.Screen name="moneda" options={{ title: i18n.t('nav.moneda') }} />
          </Stack>
        </NotificacionesProvider>
      </SincronizacionProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fuentesListas, errorDeFuentes] = useFonts({ ...fuentesDeIconos, ...fuentesDeTexto });
  if (!fuentesListas && !errorDeFuentes) return null;

  return (
    <SQLiteProvider databaseName={NOMBRE_BASE_DE_DATOS} onInit={migrarBaseDeDatos}>
      <AjustesProvider>
        <DialogoProvider>
          <AvisoProvider>
            <IAProvider>
              <DatosSqlite>
                <Navegacion />
              </DatosSqlite>
            </IAProvider>
          </AvisoProvider>
        </DialogoProvider>
      </AjustesProvider>
    </SQLiteProvider>
  );
}
