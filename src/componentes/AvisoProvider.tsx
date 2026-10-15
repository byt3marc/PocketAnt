import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useAjustes } from '@/ajustes/AjustesProvider';

import { Texto } from './Texto';

export interface OpcionesAviso {
  /** Qué pasó, en pocas palabras. */
  titulo: string;
  /** Qué hacer o cómo entenderlo. */
  mensaje?: string;
  /** El motivo técnico exacto (código y texto del motor): para saber por qué falló. */
  detalle?: string;
}

interface Aviso extends OpcionesAviso {
  id: number;
}

interface ContextoAviso {
  /** Muestra un aviso de error flotante abajo; uno nuevo reemplaza al anterior. */
  avisar: (opciones: OpcionesAviso) => void;
  ocultar: () => void;
}

const Contexto = createContext<ContextoAviso | null>(null);

/** Cuánto dura en pantalla antes de cerrarse solo (si lleva un motivo técnico, para dar tiempo a leerlo). */
const DURACION_MS = 12_000;
const COLOR_FONDO = 'rgba(185, 28, 28, 0.92)';
const COLOR_TEXTO = '#FFFFFF';

/**
 * Aviso de error tipo notificación: una tarjeta roja semitransparente abajo, sobre cualquier pantalla, que cuenta
 * qué falló y por qué. Se cierra con la ✕, tocándola para ver el motivo completo o al pasar unos segundos.
 */
export function AvisoProvider({ children }: { children: ReactNode }) {
  const { i18n } = useAjustes();
  // Sin `SafeAreaProvider` (pruebas) no hay márgenes: el contexto devuelve `null`.
  const insets = useContext(SafeAreaInsetsContext);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [completo, setCompleto] = useState(false);
  const [reducirMovimiento, setReducirMovimiento] = useState(false);
  const [entrada] = useState(() => new Animated.Value(0));
  const contador = useRef(0);

  const avisar = (opciones: OpcionesAviso) => {
    contador.current += 1;
    setCompleto(false);
    setAviso({ ...opciones, id: contador.current });
  };
  const ocultar = () => setAviso(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReducirMovimiento)
      .catch(() => {});
  }, []);

  // Entra deslizándose desde abajo y se cierra solo.
  const id = aviso?.id;
  useEffect(() => {
    if (id === undefined) return;
    entrada.setValue(reducirMovimiento ? 1 : 0);
    const animacion = reducirMovimiento
      ? null
      : Animated.timing(entrada, { toValue: 1, duration: 220, useNativeDriver: true });
    animacion?.start();
    const temporizador = setTimeout(() => setAviso(null), DURACION_MS);
    return () => {
      animacion?.stop();
      clearTimeout(temporizador);
    };
  }, [id, entrada, reducirMovimiento]);

  const margenInferior = (insets?.bottom ?? 0) + 12;

  return (
    <Contexto.Provider value={{ avisar, ocultar }}>
      {children}
      {aviso ? (
        <View pointerEvents="box-none" style={[estilos.capa, { paddingBottom: margenInferior }]}>
          <Animated.View
            testID="aviso"
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[
              estilos.tarjeta,
              { opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${aviso.titulo}. ${aviso.mensaje ?? ''}`}
              accessibilityHint={aviso.detalle ? i18n.t('aviso.ver_detalle') : undefined}
              disabled={!aviso.detalle}
              onPress={() => setCompleto((actual) => !actual)}
              style={estilos.contenido}
            >
              <Ionicons name="alert-circle" size={24} color={COLOR_TEXTO} style={estilos.icono} />
              <View style={estilos.textos}>
                <Texto variante="cuerpo" negrita style={estilos.texto}>
                  {aviso.titulo}
                </Texto>
                {aviso.mensaje ? (
                  <Texto variante="secundario" style={[estilos.texto, estilos.suave]}>
                    {aviso.mensaje}
                  </Texto>
                ) : null}
                {aviso.detalle ? (
                  <View style={estilos.detalle}>
                    <Texto variante="pequeno" negrita style={[estilos.texto, estilos.suave]}>
                      {i18n.t('aviso.motivo')}
                    </Texto>
                    <Texto
                      variante="pequeno"
                      selectable
                      numberOfLines={completo ? undefined : 3}
                      style={[estilos.texto, estilos.suave]}
                    >
                      {aviso.detalle}
                    </Texto>
                  </View>
                ) : null}
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t('aviso.cerrar')}
              onPress={ocultar}
              hitSlop={10}
              style={estilos.cerrar}
            >
              <Ionicons name="close" size={20} color={COLOR_TEXTO} />
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </Contexto.Provider>
  );
}

export function useAviso(): ContextoAviso {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAviso debe usarse dentro de <AvisoProvider>.');
  return contexto;
}

const estilos = StyleSheet.create({
  // Ocupa toda la pantalla pero deja pasar los toques (`box-none`): solo la tarjeta los recibe.
  capa: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', paddingHorizontal: 12 },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLOR_FONDO,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  contenido: { flex: 1, flexDirection: 'row', gap: 10 },
  icono: { marginTop: 1 },
  textos: { flex: 1, gap: 4 },
  texto: { color: COLOR_TEXTO },
  suave: { opacity: 0.92 },
  detalle: { gap: 2, marginTop: 2 },
  cerrar: { padding: 4, marginLeft: 4 },
});
