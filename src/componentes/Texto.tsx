import { Text, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { TRANSICION_TEXTO } from '@/animacion/constantes';
import { useAjustes } from '@/ajustes/AjustesProvider';
import { estiloDeFuente, type FuenteApp, type PesoFuente } from '@/tema/fuentes';
import type { Paleta } from '@/tema/paleta';

export type VarianteTexto =
  | 'monto'
  | 'titulo'
  | 'subtitulo'
  | 'cuerpo'
  | 'secundario'
  | 'pequeno'
  | 'etiqueta';

// El peso no va aquí: depende de la fuente elegida (ver `estiloDeFuente`).
const estilos = StyleSheet.create({
  monto: { fontSize: 38, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  titulo: { fontSize: 26, letterSpacing: -0.4 },
  subtitulo: { fontSize: 18 },
  cuerpo: { fontSize: 16 },
  secundario: { fontSize: 14 },
  pequeno: { fontSize: 12 },
  etiqueta: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
});

const PESO_POR_DEFECTO: Record<VarianteTexto, PesoFuente> = {
  monto: 'negrita',
  titulo: 'negrita',
  subtitulo: 'seminegrita',
  cuerpo: 'normal',
  secundario: 'normal',
  pequeno: 'normal',
  etiqueta: 'seminegrita',
};

const COLOR_POR_DEFECTO: Record<VarianteTexto, keyof Paleta> = {
  monto: 'texto',
  titulo: 'texto',
  subtitulo: 'texto',
  cuerpo: 'texto',
  secundario: 'textoSecundario',
  pequeno: 'textoTenue',
  etiqueta: 'textoSecundario',
};

interface Props extends TextProps {
  variante?: VarianteTexto;
  color?: keyof Paleta;
  negrita?: boolean;
  /** Fuerza una fuente (para mostrar muestras); por defecto, la que se eligió en Ajustes. */
  fuente?: FuenteApp;
  /**
   * El color cambia con una transición suave (150 ms) en vez de saltar: para textos que alternan entre «elegido» y «sin
   * elegir». Solo se pide donde hace falta: el resto de textos (cientos, en listas) siguen siendo un `Text` normal.
   */
  animado?: boolean;
}

export function Texto({ variante = 'cuerpo', color, negrita, fuente, animado, style, ...resto }: Props) {
  const { colores, ajustes } = useAjustes();
  const estiloColor: TextStyle = { color: colores[color ?? COLOR_POR_DEFECTO[variante]] };
  const estiloFuente = estiloDeFuente(fuente ?? ajustes.fuente, negrita ? 'negrita' : PESO_POR_DEFECTO[variante]);
  const estilo = [estilos[variante], estiloFuente, estiloColor, style];
  if (animado) return <Animated.Text {...resto} style={[...estilo, TRANSICION_TEXTO]} />;
  return <Text {...resto} style={estilo} />;
}
