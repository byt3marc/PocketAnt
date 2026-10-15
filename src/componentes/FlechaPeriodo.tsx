import { StyleSheet } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono } from './Icono';
import { ESCALA_ICONO, PresionableEscala } from './PresionableEscala';

interface Props {
  sentido: 'atras' | 'adelante';
  habilitada: boolean;
  onPress: () => void;
  /** Texto para lectores de pantalla. Por defecto, «Periodo anterior» / «Periodo siguiente». */
  etiqueta?: string;
}

/** Botón redondo ◀ / ▶ para moverse entre periodos (días o ventanas de una gráfica). */
export function FlechaPeriodo({ sentido, habilitada, onPress, etiqueta }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { i18n } = useAjustes();
  return (
    <PresionableEscala
      accessibilityRole="button"
      accessibilityLabel={
        etiqueta ?? i18n.t(sentido === 'atras' ? 'grafica.periodo_anterior' : 'grafica.periodo_siguiente')
      }
      accessibilityState={{ disabled: !habilitada }}
      disabled={!habilitada}
      onPress={onPress}
      hitSlop={8}
      escala={ESCALA_ICONO}
      style={[estilos.flecha, !habilitada && { opacity: 0.3 }]}
    >
      <Icono nombre={sentido === 'atras' ? 'chevron-back' : 'chevron-forward'} tamano={18} />
    </PresionableEscala>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    flecha: {
      width: 32,
      height: 32,
      borderRadius: radios.pildora,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.superficieAlta,
    },
  });
