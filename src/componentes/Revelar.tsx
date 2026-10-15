import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { REVELAR_ENTRADA, REVELAR_SALIDA } from '@/animacion/constantes';

interface Props {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Un bloque que aparece y desaparece con un fundido corto (p. ej. las horas del recordatorio al activarlo). Se usa
 * montándolo y desmontándolo: `{activo ? <Revelar>…</Revelar> : null}`. Lo que queda debajo se desliza con `DESLIZAR`
 * (en el contenedor que cambia de alto), para que no salte.
 */
export function Revelar({ style, children }: Props) {
  return (
    <Animated.View entering={REVELAR_ENTRADA} exiting={REVELAR_SALIDA} style={style}>
      {children}
    </Animated.View>
  );
}
