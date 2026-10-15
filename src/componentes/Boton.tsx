import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { radios } from '@/tema/paleta';

import { Icono, type NombreIcono } from './Icono';
import { PresionableEscala } from './PresionableEscala';
import { Texto } from './Texto';

export type VarianteBoton = 'ingreso' | 'gasto' | 'primario' | 'neutro' | 'peligro';

interface Props {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBoton;
  icono?: NombreIcono;
  deshabilitado?: boolean;
  estilo?: StyleProp<ViewStyle>;
}

export function Boton({ titulo, onPress, variante = 'primario', icono, deshabilitado, estilo }: Props) {
  const { colores } = useAjustes();

  const apariencia = {
    ingreso: { fondo: colores.ingreso, texto: 'sobreIngreso', borde: colores.ingreso },
    gasto: { fondo: colores.gasto, texto: 'sobreGasto', borde: colores.gasto },
    primario: { fondo: colores.primario, texto: 'sobrePrimario', borde: colores.primario },
    neutro: { fondo: colores.superficieAlta, texto: 'texto', borde: colores.borde },
    peligro: { fondo: 'transparent', texto: 'gasto', borde: colores.gasto },
  } as const;
  const { fondo, texto, borde } = apariencia[variante];

  return (
    <PresionableEscala
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: !!deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
      style={[estilos.base, { backgroundColor: fondo, borderColor: borde }, deshabilitado && { opacity: 0.45 }, estilo]}
    >
      <View style={estilos.contenido}>
        {icono ? <Icono nombre={icono} tamano={22} color={texto} /> : null}
        <Texto variante="cuerpo" color={texto} negrita>
          {titulo}
        </Texto>
      </View>
    </PresionableEscala>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radios.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
