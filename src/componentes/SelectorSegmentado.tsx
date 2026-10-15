import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { DURACION, EASE_IN_OUT } from '@/animacion/constantes';
import { useEstilos } from '@/tema/useEstilos';
import { radios, type Paleta } from '@/tema/paleta';

import { Texto } from './Texto';

export interface OpcionSegmento<T extends string> {
  valor: T;
  etiqueta: string;
}

interface Props<T extends string> {
  opciones: readonly OpcionSegmento<T>[];
  valor: T;
  onCambio: (valor: T) => void;
  /** Descripción para lectores de pantalla, p. ej. "Tipo de gráfica". */
  etiquetaAccesible: string;
}

/** Separación entre el borde del selector y la píldora. */
const RELLENO = 3;

/** Ancho de cada segmento (y de la píldora) dentro de un selector de `anchoTotal` con `cantidad` opciones. */
export function anchoDeSegmento(anchoTotal: number, cantidad: number): number {
  return Math.max(0, (anchoTotal - RELLENO * 2) / cantidad);
}

/**
 * Selector de varias opciones. La opción elegida es una «píldora» que se desliza de una a otra (200 ms) en vez de
 * saltar; el texto cambia de color a la vez.
 */
export function SelectorSegmentado<T extends string>({
  opciones,
  valor,
  onCambio,
  etiquetaAccesible,
}: Props<T>) {
  const estilos = useEstilos(crearEstilos);
  const reducir = useReducedMotion();
  const indice = Math.max(
    0,
    opciones.findIndex((opcion) => opcion.valor === valor),
  );
  // Posición de la píldora medida en «segmentos» (0, 1, 2…): como arranca ya en su sitio, al abrir la pantalla no se desliza.
  const posicion = useSharedValue(indice);
  const anchoSegmento = useSharedValue(0);

  useEffect(() => {
    posicion.set(reducir ? indice : withTiming(indice, { duration: DURACION.control, easing: EASE_IN_OUT }));
  }, [indice, reducir, posicion]);

  // Se mide una sola vez (y si cambia el ancho, p. ej. al girar): luego solo se mueve con `transform`.
  const alMedir = (evento: LayoutChangeEvent) => {
    anchoSegmento.set(anchoDeSegmento(evento.nativeEvent.layout.width, opciones.length));
  };

  const ultimo = opciones.length - 1;
  const estiloPildora = useAnimatedStyle(() => ({
    width: anchoSegmento.get(),
    // Acotada a los extremos: un fotograma de más no la saca del selector.
    transform: [{ translateX: Math.min(ultimo, Math.max(0, posicion.get())) * anchoSegmento.get() }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={etiquetaAccesible}
      onLayout={alMedir}
      style={estilos.contenedor}
    >
      <Animated.View testID="pildora-selector" pointerEvents="none" style={[estilos.pildora, estiloPildora]} />
      {opciones.map((opcion) => {
        const seleccionado = opcion.valor === valor;
        return (
          <Pressable
            key={opcion.valor}
            accessibilityRole="radio"
            accessibilityState={{ selected: seleccionado }}
            onPress={() => onCambio(opcion.valor)}
            style={estilos.segmento}
          >
            <Texto
              variante="secundario"
              color={seleccionado ? 'texto' : 'textoSecundario'}
              negrita={seleccionado}
              animado
            >
              {opcion.etiqueta}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    contenedor: {
      flexDirection: 'row',
      backgroundColor: c.superficieAlta,
      borderRadius: radios.md,
      padding: RELLENO,
    },
    // Sin hijos y fuera del flujo: animar su ancho y su posición no obliga a recalcular nada más.
    pildora: {
      position: 'absolute',
      top: RELLENO,
      bottom: RELLENO,
      left: RELLENO,
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borde,
      borderRadius: radios.md - RELLENO,
    },
    segmento: {
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radios.md - RELLENO,
    },
  });
