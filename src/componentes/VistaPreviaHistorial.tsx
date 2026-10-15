import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { Movimiento } from '@/dominio/tipos';
import { useHoy } from '@/hooks/useHoy';
import type { Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { EstadoVacio } from './EstadoVacio';
import { ItemMovimiento } from './ItemMovimiento';
import { Tarjeta } from './Tarjeta';

/** Cuántos movimientos recientes se previsualizan (el resto está en Gráficas e Historial). */
export const MAX_FILAS_VISTA_PREVIA = 12;

const VELOCIDAD_DP_POR_SEGUNDO = 30;
const PAUSA_ARRIBA_MS = 1500;
const PAUSA_ABAJO_MS = 2000;
const VUELTA_MS = 600;
const ALTO_DESVANECIDO = 18;

interface Props {
  /** Del más reciente al más antiguo (como los entrega `useDatos`). */
  movimientos: readonly Movimiento[];
  /** Se llama al tocar cualquier fila: lleva a Gráficas e Historial. */
  onAbrir: () => void;
  /** `false` con otra pantalla encima: el desplazamiento se detiene (vuelve a empezar al volver). */
  animar?: boolean;
}

/**
 * Vista previa del historial que se desplaza sola: baja despacio por los últimos movimientos, se detiene en el último,
 * vuelve arriba y repite. Rellena el alto que le dé su contenedor. No anima si todo cabe, con otra pantalla encima ni
 * con «reducir animaciones» activado. Para ver más está la tarjeta «Gráficas e Historial», justo encima.
 */
export function VistaPreviaHistorial({ movimientos, onAbrir, animar = true }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { colores, i18n } = useAjustes();
  const hoy = useHoy();
  const [desplazamiento] = useState(() => new Animated.Value(0));
  const [altoVentana, setAltoVentana] = useState(0);
  const [altoContenido, setAltoContenido] = useState(0);

  const recientes = movimientos.slice(0, MAX_FILAS_VISTA_PREVIA);
  const distancia = Math.max(0, altoContenido - altoVentana);

  useEffect(() => {
    desplazamiento.setValue(0);
    if (distancia <= 0 || !animar) return;

    let vigente = true;
    let animacion: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (!vigente || reducir) return;
      animacion = Animated.loop(
        Animated.sequence([
          Animated.delay(PAUSA_ARRIBA_MS),
          Animated.timing(desplazamiento, {
            toValue: -distancia,
            duration: (distancia / VELOCIDAD_DP_POR_SEGUNDO) * 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.delay(PAUSA_ABAJO_MS),
          Animated.timing(desplazamiento, {
            toValue: 0,
            duration: VUELTA_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      );
      animacion.start();
    });
    return () => {
      vigente = false;
      animacion?.stop();
    };
  }, [desplazamiento, distancia, animar]);

  if (movimientos.length === 0) {
    return (
      <Tarjeta style={[estilos.tarjeta, estilos.vacio]}>
        <EstadoVacio
          icono="receipt-outline"
          titulo={i18n.t('est.vacio_titulo')}
          descripcion={i18n.t('est.vacio_desc')}
        />
      </Tarjeta>
    );
  }

  const alMedirVentana = (e: LayoutChangeEvent) => setAltoVentana(e.nativeEvent.layout.height);
  const alMedirContenido = (e: LayoutChangeEvent) => setAltoContenido(e.nativeEvent.layout.height);
  const abrir = () => onAbrir();
  // `transparent` degrada pasando por gris en iOS; el mismo color con alfa 0 no (la paleta usa #RRGGBB).
  const fondoSinOpacidad = `${colores.superficie}00`;

  return (
    <Tarjeta style={estilos.tarjeta}>
      <View style={estilos.ventana} onLayout={alMedirVentana}>
        <Animated.View
          style={[estilos.contenido, { transform: [{ translateY: desplazamiento }] }]}
          onLayout={alMedirContenido}
        >
          {recientes.map((movimiento, i) => (
            <View key={movimiento.id}>
              {i > 0 ? <View style={estilos.separador} /> : null}
              <ItemMovimiento movimiento={movimiento} hoy={hoy} onPress={abrir} />
            </View>
          ))}
        </Animated.View>

        <LinearGradient
          pointerEvents="none"
          colors={[colores.superficie, fondoSinOpacidad]}
          style={[estilos.desvanecido, estilos.desvanecidoArriba]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[fondoSinOpacidad, colores.superficie]}
          style={[estilos.desvanecido, estilos.desvanecidoAbajo]}
        />
      </View>
    </Tarjeta>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    // `flex: 1` rellena lo que queda de pantalla en el Home; `minHeight` evita que se aplaste en pantallas bajas
    // (como se desplaza sola, basta con que se vea una fila y media).
    tarjeta: { flex: 1, minHeight: 96, padding: 0, overflow: 'hidden' },
    vacio: { justifyContent: 'center' },
    ventana: { flex: 1, overflow: 'hidden' },
    // El relleno de abajo evita que el desvanecido inferior apague el último movimiento al llegar al tope.
    contenido: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 8,
    },
    separador: { height: StyleSheet.hairlineWidth, backgroundColor: c.borde },
    desvanecido: { position: 'absolute', left: 0, right: 0, height: ALTO_DESVANECIDO },
    desvanecidoArriba: { top: 0 },
    desvanecidoAbajo: { bottom: 0 },
  });
