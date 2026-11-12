import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { DURACION, EASE_OUT } from '@/animacion/constantes';
import { vibrar } from '@/animacion/haptica';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono } from './Icono';
import { PresionableEscala } from './PresionableEscala';
import { Texto } from './Texto';

/** Cuánto «viaja» el número al cambiar: sube al aumentar y baja al disminuir. */
const RECORRIDO = 8;
const OPACIDAD_INICIAL = 0.4;

interface Props {
  valor: number;
  min: number;
  max: number;
  onCambio: (valor: number) => void;
  /** Cómo se muestra el valor (p. ej. "08:00"). Por defecto, el número. */
  formato?: (valor: number) => string;
  /** Texto después del valor (p. ej. "meses"). */
  sufijo?: string;
  etiquetaMenos: string;
  etiquetaMas: string;
  /** Ancho mínimo del valor, para que el contador no "baile" al cambiar de dígitos. */
  anchoValor?: number;
}

/** Al mantener pulsado − o +, cada cuánto da un paso más. */
const PASO_REPETIDO_MS = 80;
/** Cuánto hay que mantener pulsado para que empiece a repetir. */
const ESPERA_REPETIR_MS = 350;

/**
 * Selector numérico con botones − y +. Al cambiar, el número llega desde el lado del cambio y se asienta (140 ms).
 * Mantener pulsado un botón repite el paso hasta soltarlo o llegar al límite (útil para recorrer horas o hasta 99).
 */
export function Contador({
  valor,
  min,
  max,
  onCambio,
  formato,
  sufijo,
  etiquetaMenos,
  etiquetaMas,
  anchoValor = 28,
}: Props) {
  const estilos = useEstilos(crearEstilos);
  const reducir = useReducedMotion();
  // Una sola animación de 0 a 1; de ella salen el desplazamiento y la opacidad. `sentido`: 1 = el número llega desde abajo
  // (al subir), -1 = desde arriba (al bajar).
  const avance = useSharedValue(1);
  const sentido = useSharedValue(1);
  const anterior = useRef(valor);

  // El repetidor corre fuera del render: lee siempre lo último (valor, límites y a quién avisar) desde aquí.
  const ultimos = useRef({ valor, min, max, onCambio });
  useEffect(() => {
    ultimos.current = { valor, min, max, onCambio };
  }, [valor, min, max, onCambio]);
  const repetidor = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Último valor emitido mientras se mantiene pulsado: los pasos seguidos no esperan a que el padre vuelva a dibujar. */
  const emitido = useRef<number | null>(null);
  const detener = () => {
    if (repetidor.current !== null) clearInterval(repetidor.current);
    repetidor.current = null;
    emitido.current = null;
  };
  useEffect(() => detener, []);

  /**
   * Un paso de `delta`; `false` si ya estaba en el límite (y entonces deja de repetir). Un toque suelto parte del valor
   * que dio el padre (si no lo acepta, el contador no se adelanta por su cuenta); al repetir, del último emitido.
   */
  const paso = (delta: number, repitiendo: boolean): boolean => {
    const actual = ultimos.current;
    const base = repitiendo && emitido.current !== null ? emitido.current : actual.valor;
    const siguiente = Math.min(actual.max, Math.max(actual.min, base + delta));
    if (siguiente === base) {
      detener();
      return false;
    }
    emitido.current = siguiente;
    actual.onCambio(siguiente);
    vibrar('seleccion');
    return true;
  };
  const repetir = (delta: number) => {
    detener();
    if (paso(delta, false)) repetidor.current = setInterval(() => paso(delta, true), PASO_REPETIDO_MS);
  };

  // Solo reacciona a un cambio de `valor`: al montar no hay nada que animar. Un valor compartido, no `setState`.
  useEffect(() => {
    const cambio = valor - anterior.current;
    anterior.current = valor;
    if (cambio === 0 || reducir) return;
    sentido.set(cambio > 0 ? 1 : -1);
    avance.set(0);
    avance.set(withTiming(1, { duration: DURACION.contador, easing: EASE_OUT }));
  }, [valor, reducir, avance, sentido]);

  const estiloValor = useAnimatedStyle(() => {
    // Acotado a [0, 1]: la curva de frenada fuerte, en el primer fotograma, puede pasarse un poco por debajo de 0.
    const p = Math.min(1, Math.max(0, avance.get()));
    return {
      opacity: OPACIDAD_INICIAL + (1 - OPACIDAD_INICIAL) * p,
      transform: [{ translateY: sentido.get() * RECORRIDO * (1 - p) }],
    };
  });

  return (
    <View style={estilos.contador}>
      <PresionableEscala
        accessibilityRole="button"
        accessibilityLabel={etiquetaMenos}
        disabled={valor <= min}
        hitSlop={4}
        onPress={() => paso(-1, false)}
        onLongPress={() => repetir(-1)}
        delayLongPress={ESPERA_REPETIR_MS}
        onPressOut={detener}
        style={[estilos.boton, valor <= min && estilos.inactivo]}
      >
        <Icono nombre="remove" tamano={18} />
      </PresionableEscala>
      <Animated.View style={[estilos.cajaValor, { minWidth: anchoValor }, estiloValor]}>
        <Texto variante="cuerpo" negrita style={estilos.valor}>
          {formato ? formato(valor) : valor}
        </Texto>
      </Animated.View>
      <PresionableEscala
        accessibilityRole="button"
        accessibilityLabel={etiquetaMas}
        disabled={valor >= max}
        hitSlop={4}
        onPress={() => paso(1, false)}
        onLongPress={() => repetir(1)}
        delayLongPress={ESPERA_REPETIR_MS}
        onPressOut={detener}
        style={[estilos.boton, valor >= max && estilos.inactivo]}
      >
        <Icono nombre="add" tamano={18} />
      </PresionableEscala>
      {sufijo ? (
        <Texto variante="cuerpo" style={estilos.sufijo}>
          {sufijo}
        </Texto>
      ) : null}
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    contador: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    boton: {
      width: 36,
      height: 36,
      borderRadius: radios.pildora,
      backgroundColor: c.superficieAlta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inactivo: { opacity: 0.35 },
    cajaValor: { alignItems: 'center' },
    valor: { textAlign: 'center', fontVariant: ['tabular-nums'] },
    sufijo: { minWidth: 48 },
  });
