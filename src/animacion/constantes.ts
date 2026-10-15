import { Platform } from 'react-native';
import {
  cubicBezier,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  Keyframe,
  LinearTransition,
  ReduceMotion,
  type CSSTransitionProperties,
} from 'react-native-reanimated';

// Curvas, duraciones y animaciones de toda la app, en un solo sitio. Reglas: nada pasa de ~250 ms (salvo la barra de
// progreso, que sigue a un dato real), nada empieza lento (sin `ease-in`) y solo se mueven `transform`, `opacity` y
// colores, que no obligan a recalcular el diseño.

/** Frena fuerte al final: lo que entra, el color y la escala. Para las transiciones CSS (`transitionTimingFunction`). */
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
/** La misma curva para `withTiming` y los constructores de animación de entrada. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** Algo que se mueve dentro de la pantalla: la píldora del selector. */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export const DURACION = {
  /** Pulsar un botón: casi imperceptible, pero se nota que responde. */
  presion: 120,
  /** Cambio de color de una opción (elegida / no elegida). */
  color: 150,
  /** Mover la píldora del selector de una opción a otra. */
  control: 200,
  /** El número del contador al subir o bajar. */
  contador: 140,
  revelar: 180,
  ocultar: 120,
  /** Entrada de una tarjeta al abrir la pantalla. */
  entrada: 220,
  /** Retraso entre una tarjeta y la siguiente. */
  escalon: 40,
  /** Tiempo que se ve la elección en «Moneda» antes de volver atrás. */
  eleccion: 180,
} as const;

/** Cuántos escalones distintos hay: las tarjetas de más allá entran con el mismo retraso que la última (200 ms). */
export const MAX_ESCALONES = 5;
/** Cuánto sube cada tarjeta al aparecer. */
const SUBIDA_ENTRADA = 12;

function entradaDeTarjeta(escalon: number) {
  const retraso = escalon * DURACION.escalon;
  // La vista previa web (solo para desarrollo) deja fijadas en `position: absolute` las vistas con una animación de
  // entrada `Keyframe` propia: las tarjetas se apilan. Allí se usa la predefinida (sube 25 dp en vez de 12). En el teléfono
  // sí se usa la propia.
  if (Platform.OS === 'web') return FadeInDown.duration(DURACION.entrada).delay(retraso).easing(EASE_OUT);
  return new Keyframe({
    from: { opacity: 0, transform: [{ translateY: SUBIDA_ENTRADA }] },
    to: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
  })
    .duration(DURACION.entrada)
    .delay(retraso);
}

/** Entrada de la tarjeta n-ésima (0 a 5): se desvanece y sube un poco. Se crean una vez, fuera de los componentes. */
export const ENTRADAS = Array.from({ length: MAX_ESCALONES + 1 }, (_, escalon) => entradaDeTarjeta(escalon));

/** Con «reducir animaciones»: solo un fundido corto, sin desplazamiento. `Never` porque el fundido sí se mantiene. */
export const ENTRADA_REDUCIDA = FadeIn.duration(DURACION.color).reduceMotion(ReduceMotion.Never);

/** Un bloque que aparece (p. ej. las horas del recordatorio al activarlo) y uno que se va. */
export const REVELAR_ENTRADA = FadeIn.duration(DURACION.revelar).easing(EASE_OUT).reduceMotion(ReduceMotion.Never);
export const REVELAR_SALIDA = FadeOut.duration(DURACION.ocultar).easing(EASE_OUT).reduceMotion(ReduceMotion.Never);

/** Lo que queda debajo de un bloque que aparece o se va se desliza hasta su sitio en vez de saltar. */
export const DESLIZAR = LinearTransition.duration(DURACION.control).easing(EASE_OUT);

type Transicion = Pick<
  CSSTransitionProperties,
  'transitionProperty' | 'transitionDuration' | 'transitionTimingFunction'
>;

/** Transición CSS de Reanimated: los cambios de esas propiedades se animan solos, sin código en el componente. */
function transicion(propiedades: string[], duracion: number): Transicion {
  return {
    transitionProperty: propiedades as Transicion['transitionProperty'],
    transitionDuration: duracion,
    transitionTimingFunction: CSS_EASE_OUT,
  };
}

/** El texto cambia de color (opción elegida / sin elegir). */
export const TRANSICION_TEXTO = transicion(['color'], DURACION.color);
/** Una tarjeta de opción cambia de fondo y de borde. */
export const TRANSICION_TARJETA = transicion(['backgroundColor', 'borderColor'], DURACION.control);
/** Pulsar: se encoge un poco y vuelve. */
export const TRANSICION_PRESION = transicion(['transform'], DURACION.presion);
/** Algo que se enciende o se apaga. */
export const TRANSICION_OPACIDAD = transicion(['opacity'], DURACION.color);
/**
 * La barra de progreso sigue a un dato real que llega ~1 vez por segundo: entre un dato y el siguiente avanza a velocidad
 * constante (por eso `linear` y no la curva de frenada) para que no se vea a saltos.
 */
export const TRANSICION_PROGRESO: Transicion = {
  transitionProperty: ['width'] as Transicion['transitionProperty'],
  transitionDuration: 900,
  transitionTimingFunction: 'linear',
};
