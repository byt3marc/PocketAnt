import { StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { formatearDia } from '@/dominio/fechas';
import type { PuntoDia } from '@/dominio/series';
import type { I18n } from '@/i18n/traducir';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Texto } from './Texto';

/** "Café, Bus +1": los dos primeros motivos del día y cuántos más hay. */
export function resumirMotivos(punto: PuntoDia, i18n: I18n): string {
  const motivos = punto.movimientos.map((m) => m.motivo);
  if (motivos.length === 0) return i18n.t('tooltip.sin_movimientos');
  const visibles = motivos.slice(0, 2).join(', ');
  return motivos.length > 2 ? `${visibles} +${motivos.length - 2}` : visibles;
}

interface Props {
  punto: PuntoDia | undefined;
  ancho: number;
}

/** Resumen del día que aparece al tocar o deslizar el dedo sobre una gráfica. */
export function TooltipDia({ punto, ancho }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { formatear, i18n } = useAjustes();
  if (!punto) return null;

  return (
    <View style={[estilos.caja, { width: ancho }]}>
      <Texto variante="secundario" negrita>
        {formatearDia(punto.clave, i18n)}
      </Texto>
      <View style={estilos.fila}>
        <Texto variante="pequeno" color="ingreso" negrita>
          {i18n.t('tooltip.ingresos')}
        </Texto>
        <Texto variante="pequeno" color="ingreso" negrita style={estilos.numero}>
          {formatear(punto.ingresos, { conSigno: true })}
        </Texto>
      </View>
      <View style={estilos.fila}>
        <Texto variante="pequeno" color="gasto" negrita>
          {i18n.t('tooltip.gastos')}
        </Texto>
        <Texto variante="pequeno" color="gasto" negrita style={estilos.numero}>
          {formatear(-punto.gastos)}
        </Texto>
      </View>
      <Texto variante="pequeno" numberOfLines={1}>
        {resumirMotivos(punto, i18n)}
      </Texto>
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    caja: {
      backgroundColor: c.superficie,
      borderRadius: radios.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borde,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    numero: { fontVariant: ['tabular-nums'] },
  });
