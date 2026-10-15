import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { TipoGrafica } from '@/ajustes/normalizar';
import { BloqueDia } from '@/componentes/BloqueDia';
import { BloqueGrafica } from '@/componentes/BloqueGrafica';
import { Entrada } from '@/componentes/Entrada';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { ItemMovimiento } from '@/componentes/ItemMovimiento';
import { SelectorSegmentado, type OpcionSegmento } from '@/componentes/SelectorSegmentado';
import { Texto } from '@/componentes/Texto';
import { useDatos } from '@/datos/DatosProvider';
import type { Movimiento } from '@/dominio/tipos';
import { useHoy } from '@/hooks/useHoy';
import { useRelleno } from '@/hooks/useRelleno';
import type { Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

type Filtro = 'todos' | 'ingreso' | 'gasto';

export default function Estadisticas() {
  const router = useRouter();
  const estilos = useEstilos(crearEstilos);
  const relleno = useRelleno(true);
  const hoy = useHoy();
  const { movimientos } = useDatos();
  const { ajustes, cambiarTipoGrafica, i18n } = useAjustes();
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const tiposDeGrafica: readonly OpcionSegmento<TipoGrafica>[] = [
    { valor: 'linea', etiqueta: i18n.t('est.linea') },
    { valor: 'area', etiqueta: i18n.t('est.area') },
    { valor: 'barras', etiqueta: i18n.t('est.barras') },
  ];
  const filtros: readonly OpcionSegmento<Filtro>[] = [
    { valor: 'todos', etiqueta: i18n.t('comun.todos') },
    { valor: 'ingreso', etiqueta: i18n.t('comun.ingresos') },
    { valor: 'gasto', etiqueta: i18n.t('comun.gastos') },
  ];

  const visibles = filtro === 'todos' ? movimientos : movimientos.filter((m) => m.tipo === filtro);

  const editar = (movimiento: Movimiento) =>
    router.push({ pathname: '/movimiento', params: { id: movimiento.id } });

  const cabecera = (
    <View style={estilos.cabecera}>
      {/* La diaria son siempre barras: el selector de tipo solo aplica a la semanal y la mensual. */}
      <Entrada indice={0}>
        <BloqueDia movimientos={movimientos} navegable />
      </Entrada>

      <Entrada indice={1} style={estilos.grupo}>
        <Texto variante="etiqueta">{i18n.t('est.tipo_grafica')}</Texto>
        <SelectorSegmentado
          opciones={tiposDeGrafica}
          valor={ajustes.tipoGrafica}
          onCambio={cambiarTipoGrafica}
          etiquetaAccesible={i18n.t('est.tipo_grafica')}
        />
      </Entrada>

      <Entrada indice={2}>
        <BloqueGrafica
          titulo={i18n.t('est.semanal')}
          dias={7}
          tipo={ajustes.tipoGrafica}
          modoEtiquetas="semana"
          movimientos={movimientos}
          alto={190}
          navegable
        />
      </Entrada>
      <Entrada indice={3}>
        <BloqueGrafica
          titulo={i18n.t('est.mensual')}
          dias={30}
          tipo={ajustes.tipoGrafica}
          modoEtiquetas="mes"
          movimientos={movimientos}
          alto={190}
          navegable
        />
      </Entrada>

      <Entrada indice={4} style={estilos.grupo}>
        <Texto variante="subtitulo">{i18n.t('est.historial')}</Texto>
        <SelectorSegmentado
          opciones={filtros}
          valor={filtro}
          onCambio={setFiltro}
          etiquetaAccesible={i18n.t('est.filtro_accesible')}
        />
      </Entrada>
    </View>
  );

  const sinNingunMovimiento = movimientos.length === 0;

  return (
    <FlatList
      data={visibles}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <ItemMovimiento movimiento={item} hoy={hoy} onPress={editar} />}
      ItemSeparatorComponent={() => <View style={estilos.separador} />}
      ListHeaderComponent={cabecera}
      ListEmptyComponent={
        <EstadoVacio
          icono="receipt-outline"
          titulo={i18n.t(sinNingunMovimiento ? 'est.vacio_titulo' : 'est.filtro_vacio_titulo')}
          descripcion={i18n.t(sinNingunMovimiento ? 'est.vacio_desc' : 'est.filtro_vacio_desc')}
        />
      }
      contentContainerStyle={relleno}
      initialNumToRender={12}
      windowSize={9}
      showsVerticalScrollIndicator={false}
    />
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    cabecera: { gap: 16, marginBottom: 8 },
    grupo: { gap: 8 },
    separador: { height: StyleSheet.hairlineWidth, backgroundColor: c.borde },
  });
