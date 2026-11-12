import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { formatearDia } from '@/dominio/fechas';
import { describirRecurrencia } from '@/dominio/movimiento';
import type { Movimiento } from '@/dominio/tipos';
import { ONDA, radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono } from './Icono';
import { Texto } from './Texto';

interface Props {
  movimiento: Movimiento;
  /** Día actual, para mostrar "Hoy" y "Ayer". */
  hoy: string;
  onPress: (movimiento: Movimiento) => void;
  /** No escribe la fecha bajo el motivo: ya la da la cabecera del día (el lector de pantalla la sigue leyendo). */
  ocultarFecha?: boolean;
}

/** Fila del historial: motivo, fecha, si es recurrente y el monto con su signo. Tocarla abre la edición. */
function ItemMovimientoBase({ movimiento, hoy, onPress, ocultarFecha = false }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { formatear, i18n } = useAjustes();
  const esIngreso = movimiento.tipo === 'ingreso';
  const recurrencia = describirRecurrencia(movimiento, i18n);
  const fotos = movimiento.imagenes?.length ?? 0;
  const detalles = [
    recurrencia,
    fotos > 0 ? i18n.plural('item.fotos', fotos) : null,
  ].filter((texto): texto is string => texto !== null);
  const monto = formatear(esIngreso ? movimiento.monto : -movimiento.monto, { conSigno: true });
  const fecha = formatearDia(movimiento.fecha, i18n, hoy);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={i18n.t('item.accesible', {
        tipo: i18n.t(esIngreso ? 'tipo.ingreso' : 'tipo.gasto'),
        motivo: movimiento.motivo,
        monto,
        fecha,
        recurrencia: detalles.map((texto) => `, ${texto}`).join(''),
      })}
      onPress={() => onPress(movimiento)}
      android_ripple={ONDA}
      style={({ pressed }) => [estilos.fila, pressed && { opacity: 0.7 }]}
    >
      <View style={[estilos.icono, esIngreso ? estilos.iconoIngreso : estilos.iconoGasto]}>
        <Icono nombre={esIngreso ? 'arrow-up' : 'arrow-down'} tamano={18} color={esIngreso ? 'ingreso' : 'gasto'} />
      </View>

      <View style={estilos.centro}>
        <Texto variante="cuerpo" numberOfLines={1} negrita>
          {movimiento.motivo}
        </Texto>
        {ocultarFecha && detalles.length === 0 ? null : (
        <View style={estilos.detalle}>
          {ocultarFecha ? null : <Texto variante="pequeno">{fecha}</Texto>}
          {recurrencia ? (
            <View style={estilos.etiquetaRecurrente}>
              <Icono nombre="repeat" tamano={11} color="primario" />
              <Texto variante="pequeno" color="primario" numberOfLines={1}>
                {recurrencia}
              </Texto>
            </View>
          ) : null}
          {fotos > 0 ? (
            <View style={estilos.etiquetaRecurrente}>
              <Icono nombre="camera" tamano={11} color="textoSecundario" />
              <Texto variante="pequeno" color="textoSecundario">
                {fotos}
              </Texto>
            </View>
          ) : null}
        </View>
        )}
      </View>

      <Texto
        variante="cuerpo"
        color={esIngreso ? 'ingreso' : 'gasto'}
        negrita
        style={estilos.monto}
        numberOfLines={1}
      >
        {monto}
      </Texto>
    </Pressable>
  );
}

export const ItemMovimiento = memo(ItemMovimientoBase);

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
    icono: { width: 38, height: 38, borderRadius: radios.pildora, alignItems: 'center', justifyContent: 'center' },
    iconoIngreso: { backgroundColor: c.ingresoSuave },
    iconoGasto: { backgroundColor: c.gastoSuave },
    centro: { flex: 1, gap: 2 },
    detalle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    etiquetaRecurrente: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
    monto: { fontVariant: ['tabular-nums'], maxWidth: '40%' },
  });
