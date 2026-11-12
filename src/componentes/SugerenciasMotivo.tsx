import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { SugerenciaMotivo } from '@/dominio/sugerencias';
import { ONDA, radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Texto } from './Texto';

interface Props {
  sugerencias: readonly SugerenciaMotivo[];
  onElegir: (sugerencia: SugerenciaMotivo) => void;
}

/**
 * Fila deslizable de motivos frecuentes bajo el campo «Motivo»: tocar uno lo escribe (y su monto habitual, si aún no hay
 * monto). Sin sugerencias no ocupa espacio.
 */
export function SugerenciasMotivo({ sugerencias, onElegir }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { formatear, i18n } = useAjustes();
  if (sugerencias.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Tocar un chip con el teclado abierto debe elegirlo, no solo cerrar el teclado.
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={estilos.fila}
      accessibilityLabel={i18n.t('mov.sugerencias_accesible')}
      testID="sugerencias-motivo"
    >
      {sugerencias.map((sugerencia) => {
        const monto = formatear(sugerencia.monto);
        return (
          <Pressable
            key={sugerencia.motivo}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('mov.sugerencia_accesible', { motivo: sugerencia.motivo, monto })}
            onPress={() => onElegir(sugerencia)}
            android_ripple={ONDA}
            style={({ pressed }) => [estilos.chip, pressed && { opacity: 0.7 }]}
          >
            <Texto variante="secundario" color="texto" numberOfLines={1} style={estilos.motivo}>
              {sugerencia.motivo}
            </Texto>
            <Texto variante="pequeno" numberOfLines={1}>
              {monto}
            </Texto>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    fila: { gap: 8, paddingVertical: 2 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: radios.pildora,
      backgroundColor: c.superficieAlta,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borde,
      overflow: 'hidden',
    },
    motivo: { maxWidth: 160 },
  });
