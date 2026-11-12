import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useAjustes } from '@/ajustes/AjustesProvider';

import { ESCALA_ICONO, PresionableEscala } from './PresionableEscala';
import { Texto } from './Texto';

export type TonoAviso = 'error' | 'exito';

export interface AccionAviso {
  /** Texto del botón, p. ej. «Editar». */
  titulo: string;
  /** Se ejecuta al tocarlo; después el aviso se cierra. */
  onPress: () => void;
}

export interface OpcionesAviso {
  /** Qué pasó, en pocas palabras. */
  titulo: string;
  /** Qué hacer o cómo entenderlo. */
  mensaje?: string;
  /** El motivo técnico exacto (código y texto del motor): para saber por qué falló. */
  detalle?: string;
  /** `error` (por defecto): tarjeta roja, 12 s. `exito`: confirmación discreta de algo que salió bien, 3.5 s. */
  tono?: TonoAviso;
  /** Un botón de texto a la derecha (p. ej. «Editar» lo recién guardado). */
  accion?: AccionAviso;
}

interface Aviso extends OpcionesAviso {
  id: number;
}

interface ContextoAviso {
  /** Muestra un aviso flotante abajo; uno nuevo reemplaza al anterior. */
  avisar: (opciones: OpcionesAviso) => void;
  ocultar: () => void;
}

const Contexto = createContext<ContextoAviso | null>(null);

/** Cuánto dura en pantalla antes de cerrarse solo (un error lleva un motivo técnico: hay que dar tiempo a leerlo). */
const DURACION_MS: Record<TonoAviso, number> = { error: 12_000, exito: 3_500 };
const COLOR_FONDO_ERROR = 'rgba(185, 28, 28, 0.92)';
const COLOR_TEXTO_ERROR = '#FFFFFF';

/**
 * Aviso tipo notificación: una tarjeta abajo, sobre cualquier pantalla. El de error es rojo y cuenta qué falló y por
 * qué; el de éxito confirma lo que se acaba de hacer y puede ofrecer una acción. Se cierra con la ✕, con su acción o
 * al pasar unos segundos; el de error, además, se toca para ver el motivo completo.
 */
export function AvisoProvider({ children }: { children: ReactNode }) {
  const { colores, i18n } = useAjustes();
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
  const tono: TonoAviso = aviso?.tono ?? 'error';
  useEffect(() => {
    if (id === undefined) return;
    entrada.setValue(reducirMovimiento ? 1 : 0);
    const animacion = reducirMovimiento
      ? null
      : Animated.timing(entrada, { toValue: 1, duration: 220, useNativeDriver: true });
    animacion?.start();
    const temporizador = setTimeout(() => setAviso(null), DURACION_MS[tono]);
    return () => {
      animacion?.stop();
      clearTimeout(temporizador);
    };
  }, [id, tono, entrada, reducirMovimiento]);

  const margenInferior = (insets?.bottom ?? 0) + 12;
  const esError = tono === 'error';
  const colorTexto = esError ? COLOR_TEXTO_ERROR : colores.texto;
  const apariencia = esError
    ? { backgroundColor: COLOR_FONDO_ERROR, borderColor: 'rgba(255,255,255,0.25)' }
    : { backgroundColor: colores.superficie, borderColor: colores.borde };

  return (
    <Contexto.Provider value={{ avisar, ocultar }}>
      {children}
      {aviso ? (
        <View pointerEvents="box-none" style={[estilos.capa, { paddingBottom: margenInferior }]}>
          <Animated.View
            testID="aviso"
            // Un error interrumpe al lector de pantalla; una confirmación espera a que termine lo que está leyendo.
            accessibilityRole={esError ? 'alert' : undefined}
            accessibilityLiveRegion={esError ? 'assertive' : 'polite'}
            style={[
              estilos.tarjeta,
              apariencia,
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
              <Ionicons
                name={esError ? 'alert-circle' : 'checkmark-circle'}
                size={24}
                color={esError ? COLOR_TEXTO_ERROR : colores.ingreso}
                style={estilos.icono}
              />
              <View style={estilos.textos}>
                <Texto variante="cuerpo" negrita style={{ color: colorTexto }}>
                  {aviso.titulo}
                </Texto>
                {aviso.mensaje ? (
                  <Texto variante="secundario" style={[{ color: colorTexto }, estilos.suave]}>
                    {aviso.mensaje}
                  </Texto>
                ) : null}
                {aviso.detalle ? (
                  <View style={estilos.detalle}>
                    <Texto variante="pequeno" negrita style={[{ color: colorTexto }, estilos.suave]}>
                      {i18n.t('aviso.motivo')}
                    </Texto>
                    <Texto
                      variante="pequeno"
                      selectable
                      numberOfLines={completo ? undefined : 3}
                      style={[{ color: colorTexto }, estilos.suave]}
                    >
                      {aviso.detalle}
                    </Texto>
                  </View>
                ) : null}
              </View>
            </Pressable>
            {aviso.accion ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={aviso.accion.titulo}
                onPress={() => {
                  const { onPress } = aviso.accion!;
                  ocultar();
                  onPress();
                }}
                hitSlop={8}
                style={({ pressed }) => [estilos.accion, pressed && { opacity: 0.6 }]}
              >
                <Texto variante="secundario" negrita style={{ color: esError ? COLOR_TEXTO_ERROR : colores.primario }}>
                  {aviso.accion.titulo}
                </Texto>
              </Pressable>
            ) : null}
            <PresionableEscala
              accessibilityRole="button"
              accessibilityLabel={i18n.t('aviso.cerrar')}
              onPress={ocultar}
              hitSlop={10}
              escala={ESCALA_ICONO}
              style={estilos.cerrar}
            >
              <Ionicons name="close" size={20} color={esError ? COLOR_TEXTO_ERROR : colores.textoSecundario} />
            </PresionableEscala>
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
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
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
  suave: { opacity: 0.92 },
  detalle: { gap: 2, marginTop: 2 },
  accion: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 6, minHeight: 36, justifyContent: 'center' },
  cerrar: { padding: 4, marginLeft: 4 },
});
