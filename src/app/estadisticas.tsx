import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { TipoGrafica, VistaEstadisticas } from '@/ajustes/normalizar';
import { BloqueDia } from '@/componentes/BloqueDia';
import { BloqueGrafica } from '@/componentes/BloqueGrafica';
import { Entrada } from '@/componentes/Entrada';
import { HistorialMovimientos } from '@/componentes/HistorialMovimientos';
import { SelectorSegmentado, type OpcionSegmento } from '@/componentes/SelectorSegmentado';
import { Texto } from '@/componentes/Texto';
import { useDatos } from '@/datos/DatosProvider';
import type { Movimiento } from '@/dominio/tipos';
import { useHoy } from '@/hooks/useHoy';
import { useRelleno } from '@/hooks/useRelleno';

/**
 * Gráficas e Historial. Un selector fijo arriba cambia entre las gráficas (diaria, semanal y mensual) y el historial
 * completo, que así ocupa toda la pantalla en vez de quedar debajo de las gráficas. Se abre en la última vista elegida.
 */
export default function Estadisticas() {
  const router = useRouter();
  const relleno = useRelleno(true);
  const hoy = useHoy();
  const { movimientos } = useDatos();
  const { ajustes, cambiarTipoGrafica, cambiarVistaEstadisticas, i18n } = useAjustes();
  const vista: VistaEstadisticas = ajustes.vistaEstadisticas ?? 'graficas';

  const vistas: readonly OpcionSegmento<VistaEstadisticas>[] = [
    { valor: 'graficas', etiqueta: i18n.t('est.vista_graficas') },
    { valor: 'historial', etiqueta: i18n.t('est.historial') },
  ];
  const tiposDeGrafica: readonly OpcionSegmento<TipoGrafica>[] = [
    { valor: 'linea', etiqueta: i18n.t('est.linea') },
    { valor: 'area', etiqueta: i18n.t('est.area') },
    { valor: 'barras', etiqueta: i18n.t('est.barras') },
  ];

  const editar = (movimiento: Movimiento) =>
    router.push({ pathname: '/movimiento', params: { id: movimiento.id } });

  const lateral = { paddingLeft: relleno.paddingLeft, paddingRight: relleno.paddingRight };
  const inferior = { ...lateral, paddingBottom: relleno.paddingBottom };

  return (
    <View style={estilos.pantalla}>
      <View style={[estilos.barra, lateral, { paddingTop: relleno.paddingTop }]}>
        <SelectorSegmentado
          opciones={vistas}
          valor={vista}
          onCambio={cambiarVistaEstadisticas}
          etiquetaAccesible={i18n.t('est.vista_accesible')}
        />
      </View>

      {vista === 'historial' ? (
        <HistorialMovimientos
          movimientos={movimientos}
          hoy={hoy}
          onAbrir={editar}
          relleno={inferior}
          rellenoLateral={lateral}
        />
      ) : (
        <ScrollView contentContainerStyle={[estilos.graficas, inferior]} showsVerticalScrollIndicator={false}>
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
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  barra: { paddingBottom: 4 },
  graficas: { gap: 16, paddingTop: 12 },
  grupo: { gap: 8 },
});
