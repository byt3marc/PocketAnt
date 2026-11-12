import { Image } from 'expo-image';
import { useContext, useState } from 'react';
import { FlatList, Modal, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { DURACION, EASE_OUT } from '@/animacion/constantes';
import { useAjustes } from '@/ajustes/AjustesProvider';

import { Icono } from './Icono';
import { ESCALA_ICONO, PresionableEscala } from './PresionableEscala';
import { Texto } from './Texto';

/** Cuánto se puede ampliar con los dedos, y a cuánto salta con doble toque. */
const ESCALA_MAXIMA = 4;
const ESCALA_DOBLE_TOQUE = 2.5;
/** Por debajo de esto la foto se considera «sin ampliar» (vuelve a su sitio y deja pasar de una foto a otra). */
const UMBRAL_AMPLIADA = 1.02;

export interface ImagenVisor {
  id: string;
  uri: string;
}

interface PropsAmpliable {
  uri: string;
  ancho: number;
  alto: number;
  etiqueta: string;
  /** Avisa si la foto queda ampliada: mientras lo está, deslizar mueve la foto en vez de pasar a la siguiente. */
  onAmpliada: (ampliada: boolean) => void;
}

const acotar = (valor: number, limite: number) => {
  'worklet';
  return Math.min(limite, Math.max(-limite, valor));
};

/** Una foto que se amplía con dos dedos o con doble toque y, ampliada, se mueve con un dedo. */
function ImagenAmpliable({ uri, ancho, alto, etiqueta, onAmpliada }: PropsAmpliable) {
  const [ampliada, setAmpliada] = useState(false);
  const escala = useSharedValue(1);
  const escalaInicial = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const xInicial = useSharedValue(0);
  const yInicial = useSharedValue(0);

  const avisar = (valor: boolean) => {
    setAmpliada(valor);
    onAmpliada(valor);
  };

  const animacion = { duration: DURACION.control, easing: EASE_OUT };

  const pellizco = Gesture.Pinch()
    .onStart(() => {
      escalaInicial.set(escala.get());
    })
    .onUpdate((evento) => {
      escala.set(Math.min(ESCALA_MAXIMA, Math.max(1, escalaInicial.get() * evento.scale)));
    })
    .onEnd(() => {
      const sigue = escala.get() > UMBRAL_AMPLIADA;
      if (!sigue) {
        escala.set(withTiming(1, animacion));
        x.set(withTiming(0, animacion));
        y.set(withTiming(0, animacion));
      } else {
        // Al alejar, lo desplazado puede quedar fuera de la foto: se recoloca dentro de los bordes.
        const limiteX = (ancho * (escala.get() - 1)) / 2;
        const limiteY = (alto * (escala.get() - 1)) / 2;
        x.set(withTiming(acotar(x.get(), limiteX), animacion));
        y.set(withTiming(acotar(y.get(), limiteY), animacion));
      }
      scheduleOnRN(avisar, sigue);
    });

  const arrastre = Gesture.Pan()
    .enabled(ampliada)
    .averageTouches(true)
    .onStart(() => {
      xInicial.set(x.get());
      yInicial.set(y.get());
    })
    .onUpdate((evento) => {
      const limiteX = (ancho * (escala.get() - 1)) / 2;
      const limiteY = (alto * (escala.get() - 1)) / 2;
      x.set(acotar(xInicial.get() + evento.translationX, limiteX));
      y.set(acotar(yInicial.get() + evento.translationY, limiteY));
    });

  const dobleToque = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const ampliar = escala.get() <= UMBRAL_AMPLIADA;
      escala.set(withTiming(ampliar ? ESCALA_DOBLE_TOQUE : 1, animacion));
      x.set(withTiming(0, animacion));
      y.set(withTiming(0, animacion));
      scheduleOnRN(avisar, ampliar);
    });

  const gesto = Gesture.Race(dobleToque, Gesture.Simultaneous(pellizco, arrastre));

  const estiloFoto = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: escala.get() }],
  }));

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View style={[{ width: ancho, height: alto }, estiloFoto]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessibilityLabel={etiqueta}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </GestureDetector>
  );
}

interface Props {
  imagenes: readonly ImagenVisor[];
  /** Foto con la que se abre; `null` = cerrado. */
  indiceInicial: number | null;
  onCerrar: () => void;
}

/**
 * Las fotos de un movimiento a pantalla completa: se pasa de una a otra deslizando y se amplían con dos dedos o con
 * doble toque. Se cierra con la ✕ o con «atrás».
 */
export function VisorImagenes({ imagenes, indiceInicial, onCerrar }: Props) {
  const { colores, i18n } = useAjustes();
  const { width: ancho, height: alto } = useWindowDimensions();
  // Sin `SafeAreaProvider` (pruebas) no hay márgenes: el contexto devuelve `null`.
  const margenes = useContext(SafeAreaInsetsContext);
  const [actual, setActual] = useState(indiceInicial ?? 0);
  const [ampliada, setAmpliada] = useState(false);
  const [abiertoEn, setAbiertoEn] = useState(indiceInicial);

  // Al abrir en otra foto, el contador arranca en ella (se ajusta durante el render, sin efecto).
  if (indiceInicial !== abiertoEn) {
    setAbiertoEn(indiceInicial);
    if (indiceInicial !== null) setActual(indiceInicial);
    setAmpliada(false);
  }

  const visible = indiceInicial !== null && imagenes.length > 0;
  const total = imagenes.length;

  const alTerminarDeslizar = (evento: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pagina = Math.round(evento.nativeEvent.contentOffset.x / Math.max(1, ancho));
    setActual(Math.min(total - 1, Math.max(0, pagina)));
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCerrar}
      testID="visor-imagenes"
    >
      {/* Un `Modal` es otra raíz nativa en Android: los gestos de dentro necesitan su propia raíz. */}
      <GestureHandlerRootView style={[estilos.fondo, { backgroundColor: colores.fondoVisor }]}>
        {visible ? (
          <FlatList
            data={imagenes}
            keyExtractor={(imagen) => imagen.id}
            horizontal
            pagingEnabled
            scrollEnabled={!ampliada}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(indiceInicial ?? 0, total - 1)}
            getItemLayout={(_datos, indice) => ({ length: ancho, offset: ancho * indice, index: indice })}
            onMomentumScrollEnd={alTerminarDeslizar}
            renderItem={({ item, index }) => (
              <View style={[estilos.pagina, { width: ancho, height: alto }]}>
                <ImagenAmpliable
                  uri={item.uri}
                  ancho={ancho}
                  alto={alto}
                  etiqueta={i18n.t('mov.imagen_accesible', { n: index + 1, total })}
                  onAmpliada={setAmpliada}
                />
              </View>
            )}
          />
        ) : null}

        <View
          pointerEvents="box-none"
          style={[estilos.barra, { paddingTop: (margenes?.top ?? 0) + 8, paddingLeft: (margenes?.left ?? 0) + 16, paddingRight: (margenes?.right ?? 0) + 8 }]}
        >
          <Texto variante="cuerpo" negrita color="sobreVisor" accessibilityLiveRegion="polite">
            {total > 1 ? i18n.t('mov.imagenes_cuenta', { n: actual + 1, max: total }) : ''}
          </Texto>
          <PresionableEscala
            accessibilityRole="button"
            accessibilityLabel={i18n.t('mov.visor_cerrar')}
            onPress={onCerrar}
            hitSlop={8}
            escala={ESCALA_ICONO}
            style={[estilos.cerrar, { backgroundColor: colores.velo }]}
          >
            <Icono nombre="close" tamano={26} color="sobreVisor" />
          </PresionableEscala>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1 },
  pagina: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  barra: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cerrar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
