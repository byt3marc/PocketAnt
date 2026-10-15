import { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { TRANSICION_PRESION } from '@/animacion/constantes';

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

/** Cuánto se encoge al pulsar: un 3 %, lo justo para que se sienta físico. */
const ESCALA_PRESIONADO = 0.97;

interface Props extends Omit<PressableProps, 'style'> {
  /** Solo estilo fijo (no admite la función `({ pressed }) => …` de `Pressable`: el efecto de pulsar ya lo da la escala). */
  style?: StyleProp<ViewStyle>;
}

/**
 * `Pressable` que se encoge un 3 % mientras se pulsa (120 ms) y vuelve al soltar: responde en cuanto el dedo toca, no al
 * terminar el toque. El texto y los iconos de dentro se encogen con él. Con «reducir animaciones» no se mueve.
 */
export function PresionableEscala({ style, onPressIn, onPressOut, disabled, pressRetentionOffset = 16, ...resto }: Props) {
  const [presionado, setPresionado] = useState(false);
  const reducir = useReducedMotion();
  const escala = presionado && !reducir && !disabled ? ESCALA_PRESIONADO : 1;

  return (
    <PressableAnimado
      {...resto}
      disabled={disabled}
      pressRetentionOffset={pressRetentionOffset}
      onPressIn={(evento) => {
        setPresionado(true);
        onPressIn?.(evento);
      }}
      onPressOut={(evento) => {
        setPresionado(false);
        onPressOut?.(evento);
      }}
      style={[style, { transform: [{ scale: escala }] }, TRANSICION_PRESION]}
    />
  );
}
