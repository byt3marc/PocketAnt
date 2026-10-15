import { StyleSheet, View, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { DESLIZAR } from '@/animacion/constantes';
import { useEstilos } from '@/tema/useEstilos';
import { radios, type Paleta } from '@/tema/paleta';

interface Props extends ViewProps {
  /**
   * La tarjeta cambia de alto con animación (200 ms) cuando le aparece o le desaparece contenido, en vez de saltar.
   * Recorta lo que se salga mientras crece. Solo para tarjetas con contenido que aparece y desaparece.
   */
  deslizar?: boolean;
}

export function Tarjeta({ style, deslizar, ...resto }: Props) {
  const estilos = useEstilos(crearEstilos);
  if (deslizar) {
    return <Animated.View {...resto} layout={DESLIZAR} style={[estilos.tarjeta, estilos.recortada, style]} />;
  }
  return <View {...resto} style={[estilos.tarjeta, style]} />;
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    tarjeta: {
      backgroundColor: c.superficie,
      borderRadius: radios.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borde,
      padding: 16,
    },
    recortada: { overflow: 'hidden' },
  });
