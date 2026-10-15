import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { DESLIZAR, ENTRADA_REDUCIDA, ENTRADAS, MAX_ESCALONES } from '@/animacion/constantes';

interface Props {
  /** Posición de la tarjeta en la pantalla (0 = la primera): cada una entra 40 ms después de la anterior. */
  indice?: number;
  /**
   * Si lo de dentro cambia de alto (aparecen o desaparecen bloques), la tarjeta cambia de alto con animación y lo que
   * queda debajo se desliza hasta su sitio en vez de saltar.
   */
  deslizar?: boolean;
  /** Estilo del contenido (p. ej. el `gap` entre sus hijos). */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Una tarjeta que entra al abrir la pantalla: se desvanece y sube un poco, una tras otra. Solo suena cuando se monta:
 * al volver a la pantalla o al hacer scroll no se repite. No usar en filas de listas virtualizadas (se reciclan y la
 * animación se dispararía cada vez que una fila vuelve a verse).
 *
 * Son dos capas a propósito: la de fuera solo desliza (`layout`) y la de dentro solo entra (`entering`), para que las dos
 * animaciones nunca compartan vista.
 */
export function Entrada({ indice = 0, deslizar, style, children }: Props) {
  const reducir = useReducedMotion();
  const entrada = reducir ? ENTRADA_REDUCIDA : ENTRADAS[Math.min(indice, MAX_ESCALONES)];
  return (
    <Animated.View layout={deslizar ? DESLIZAR : undefined}>
      <Animated.View entering={entrada} style={style}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
