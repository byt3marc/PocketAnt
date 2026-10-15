import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { Movimiento } from '@/dominio/tipos';
import { useHoy } from '@/hooks/useHoy';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { EstadoVacio } from './EstadoVacio';
import { Icono } from './Icono';
import { ItemMovimiento } from './ItemMovimiento';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

/** Cuántos movimientos recientes se previsualizan antes de la fila «Gráficas e Historial». */
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
}

/**
 * Vista previa del historial que se desplaza sola: baja despacio por los últimos movimientos, se detiene
 * en la fila «Gráficas e Historial», vuelve arriba y repite. Rellena el alto que le dé su contenedor.
 * No anima si todo cabe ni con «reducir animaciones» activado.
 */
export function VistaPreviaHistorial({ movimientos, onAbrir }: Props) {
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
    if (distancia <= 0) return;

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
  }, [desplazamiento, distancia]);

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
          {recientes.map((movimiento) => (
            <View key={movimiento.id}>
              <ItemMovimiento movimiento={movimiento} hoy={hoy} onPress={abrir} />
              <View style={estilos.separador} />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.t('inicio.enlace_accesible')}
            onPress={abrir}
            android_ripple={{ color: 'rgba(128,128,128,0.15)' }}
            style={({ pressed }) => [estilos.verMas, pressed && { opacity: 0.7 }]}
          >
            <View style={estilos.iconoVerMas}>
              <Icono nombre="stats-chart" tamano={18} color="primario" />
            </View>
            <View style={estilos.textoVerMas}>
              <Texto variante="cuerpo" negrita numberOfLines={1}>
                {i18n.t('inicio.enlace_titulo')}
              </Texto>
              <Texto variante="pequeno">{i18n.t('inicio.ver_mas')}</Texto>
            </View>
            <Icono nombre="chevron-forward" tamano={20} color="textoTenue" />
          </Pressable>
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
    // El relleno de abajo evita que el desvanecido inferior apague la fila final al llegar al tope.
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
    verMas: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
    iconoVerMas: {
      width: 38,
      height: 38,
      borderRadius: radios.pildora,
      backgroundColor: c.superficieAlta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textoVerMas: { flex: 1, gap: 2 },
    desvanecido: { position: 'absolute', left: 0, right: 0, height: ALTO_DESVANECIDO },
    desvanecidoArriba: { top: 0 },
    desvanecidoAbajo: { bottom: 0 },
  });
