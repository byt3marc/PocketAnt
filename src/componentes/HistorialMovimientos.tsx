import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { formatearDia } from '@/dominio/fechas';
import { agruparPorDia, filtrarMovimientos, type FilaHistorial, type FiltroTipo } from '@/dominio/historial';
import type { Movimiento } from '@/dominio/tipos';
import { estiloDeFuente } from '@/tema/fuentes';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Boton } from './Boton';
import { EstadoVacio } from './EstadoVacio';
import { Icono } from './Icono';
import { ItemMovimiento } from './ItemMovimiento';
import { SelectorSegmentado, type OpcionSegmento } from './SelectorSegmentado';
import { Texto } from './Texto';

interface Props {
  movimientos: readonly Movimiento[];
  hoy: string;
  onAbrir: (movimiento: Movimiento) => void;
  /** Márgenes laterales e inferior de la pantalla (los de `useRelleno`). */
  relleno: StyleProp<ViewStyle>;
  /** Márgenes laterales para la barra de búsqueda (fija, fuera de la lista). */
  rellenoLateral: StyleProp<ViewStyle>;
}

/**
 * Historial completo: búsqueda por motivo y filtro por tipo fijos arriba y, debajo, los movimientos agrupados por día
 * con el neto de cada día. La lista es virtualizada: aguanta años de movimientos.
 */
export function HistorialMovimientos({ movimientos, hoy, onAbrir, relleno, rellenoLateral }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { ajustes, colores, formatear, i18n } = useAjustes();
  const [filtro, setFiltro] = useState<FiltroTipo>('todos');
  const [texto, setTexto] = useState('');

  const filtros: readonly OpcionSegmento<FiltroTipo>[] = [
    { valor: 'todos', etiqueta: i18n.t('comun.todos') },
    { valor: 'ingreso', etiqueta: i18n.t('comun.ingresos') },
    { valor: 'gasto', etiqueta: i18n.t('comun.gastos') },
  ];

  const filas = agruparPorDia(filtrarMovimientos(movimientos, { tipo: filtro, texto }));
  const buscando = texto.trim().length > 0;

  const renderizar = ({ item, index }: { item: FilaHistorial; index: number }) => {
    if (item.tipo === 'dia') {
      const color = item.neto > 0 ? 'ingreso' : item.neto < 0 ? 'gasto' : 'textoTenue';
      return (
        <View style={estilos.cabeceraDia} accessibilityRole="header">
          <Texto variante="etiqueta">{formatearDia(item.clave, i18n, hoy)}</Texto>
          <Texto variante="pequeno" color={color} negrita style={estilos.numero}>
            {formatear(item.neto, { conSigno: true })}
          </Texto>
        </View>
      );
    }
    const anterior = filas[index - 1];
    return (
      <View>
        {anterior?.tipo === 'movimiento' ? <View style={estilos.separador} /> : null}
        <ItemMovimiento movimiento={item.movimiento} hoy={hoy} onPress={onAbrir} ocultarFecha />
      </View>
    );
  };

  const vacio =
    movimientos.length === 0 ? (
      <EstadoVacio icono="receipt-outline" titulo={i18n.t('est.vacio_titulo')} descripcion={i18n.t('est.vacio_desc')} />
    ) : buscando ? (
      <View style={estilos.vacioBusqueda}>
        <EstadoVacio
          icono="search-outline"
          titulo={i18n.t('est.busqueda_vacia_titulo', { texto: texto.trim() })}
          descripcion={i18n.t('est.busqueda_vacia_desc')}
        />
        <Boton titulo={i18n.t('est.limpiar_busqueda')} variante="neutro" icono="close" onPress={() => setTexto('')} />
      </View>
    ) : (
      <EstadoVacio
        icono="receipt-outline"
        titulo={i18n.t('est.filtro_vacio_titulo')}
        descripcion={i18n.t('est.filtro_vacio_desc')}
      />
    );

  return (
    <View style={estilos.contenedor}>
      <View style={[estilos.barra, rellenoLateral]}>
        <View style={estilos.buscador}>
          <Icono nombre="search" tamano={18} color="textoTenue" />
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={i18n.t('est.buscar')}
            placeholderTextColor={colores.textoTenue}
            accessibilityLabel={i18n.t('est.buscar_accesible')}
            returnKeyType="search"
            autoCorrect={false}
            style={[estilos.campo, estiloDeFuente(ajustes.fuente)]}
          />
          {texto ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t('est.limpiar_busqueda')}
              onPress={() => setTexto('')}
              hitSlop={10}
            >
              <Icono nombre="close-circle" tamano={18} color="textoTenue" />
            </Pressable>
          ) : null}
        </View>
        <SelectorSegmentado
          opciones={filtros}
          valor={filtro}
          onCambio={setFiltro}
          etiquetaAccesible={i18n.t('est.filtro_accesible')}
        />
      </View>

      <FlatList
        data={filas}
        keyExtractor={(fila) => (fila.tipo === 'dia' ? `dia-${fila.clave}` : fila.movimiento.id)}
        renderItem={renderizar}
        ListEmptyComponent={vacio}
        contentContainerStyle={[estilos.lista, relleno]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={16}
        windowSize={9}
        showsVerticalScrollIndicator={false}
        testID="lista-historial"
      />
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    contenedor: { flex: 1 },
    barra: { gap: 10, paddingTop: 12, paddingBottom: 4 },
    buscador: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.superficieAlta,
      borderRadius: radios.md,
      paddingHorizontal: 12,
    },
    campo: { flex: 1, fontSize: 16, color: c.texto, paddingVertical: 10 },
    lista: { flexGrow: 1 },
    cabeceraDia: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingTop: 18,
      paddingBottom: 4,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borde,
    },
    numero: { fontVariant: ['tabular-nums'] },
    separador: { height: StyleSheet.hairlineWidth, backgroundColor: c.borde },
    vacioBusqueda: { gap: 4, alignItems: 'center' },
  });
