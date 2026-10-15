import { Pressable, StyleSheet, View } from 'react-native';

import { ONDA, radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono, type NombreIcono } from './Icono';
import { Texto } from './Texto';

interface Props {
  icono: NombreIcono;
  titulo: string;
  /** Texto de apoyo debajo del título. */
  descripcion?: string;
  /** Valor actual a la derecha (p. ej. "Automática · S/"). */
  valor?: string;
  onPress?: () => void;
  /** Fila de acción destructiva: icono y título en rojo. */
  peligro?: boolean;
  deshabilitada?: boolean;
  cargando?: boolean;
}

export function FilaAjuste({ icono, titulo, descripcion, valor, onPress, peligro, deshabilitada, cargando }: Props) {
  const estilos = useEstilos(crearEstilos);
  const inactiva = deshabilitada || cargando || !onPress;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!deshabilitada, busy: !!cargando }}
      disabled={inactiva}
      onPress={onPress}
      android_ripple={ONDA}
      style={({ pressed }) => [estilos.fila, pressed && { opacity: 0.7 }, deshabilitada && { opacity: 0.55 }]}
    >
      <View style={[estilos.icono, peligro && estilos.iconoPeligro]}>
        <Icono nombre={icono} tamano={20} color={peligro ? 'gasto' : 'primario'} />
      </View>
      <View style={estilos.texto}>
        <Texto variante="cuerpo" negrita color={peligro ? 'gasto' : undefined}>
          {titulo}
        </Texto>
        {descripcion ? <Texto variante="pequeno">{descripcion}</Texto> : null}
      </View>
      {valor ? (
        <Texto variante="secundario" numberOfLines={1} style={estilos.valor}>
          {valor}
        </Texto>
      ) : null}
      {onPress && !deshabilitada ? (
        <Icono nombre={cargando ? 'hourglass-outline' : 'chevron-forward'} tamano={18} color="textoTenue" />
      ) : null}
    </Pressable>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
    icono: {
      width: 36,
      height: 36,
      borderRadius: radios.md,
      backgroundColor: c.superficieAlta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconoPeligro: { backgroundColor: c.gastoSuave },
    texto: { flex: 1, gap: 2 },
    valor: { maxWidth: '38%' },
  });
