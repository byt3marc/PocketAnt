import { StyleSheet, Switch, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';

import { Texto } from './Texto';

interface Props {
  titulo: string;
  descripcion?: string;
  valor: boolean;
  onCambio: (valor: boolean) => void;
  /** Color del interruptor encendido. Por defecto, el color primario. */
  colorActivo?: string;
}

/** Fila de ajustes con un interruptor a la derecha. */
export function FilaInterruptor({ titulo, descripcion, valor, onCambio, colorActivo }: Props) {
  const { colores } = useAjustes();
  return (
    <View style={estilos.fila}>
      <View style={estilos.texto}>
        <Texto variante="cuerpo" negrita>
          {titulo}
        </Texto>
        {descripcion ? <Texto variante="pequeno">{descripcion}</Texto> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={onCambio}
        accessibilityLabel={titulo}
        trackColor={{ false: colores.borde, true: colorActivo ?? colores.primario }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  texto: { flex: 1, gap: 2 },
});
