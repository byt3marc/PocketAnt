import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { TipoGrafica } from '@/ajustes/normalizar';
import { calcularEscala } from '@/dominio/escala';
import { inicialDia, nombreDiaCorto, numeroDia } from '@/dominio/fechas';
import { formatearCompacto } from '@/dominio/formato';
import type { PuntoDia } from '@/dominio/series';
import { RADIO_PUNTERO, posicionTooltip, topLibreria } from '@/dominio/tooltip';
import type { Idioma } from '@/i18n/traducir';
import { estiloDeFuente } from '@/tema/fuentes';

import { Icono } from './Icono';
import { Texto } from './Texto';
import { TooltipDia } from './TooltipDia';

export type ModoEtiquetas = 'semana' | 'mes';

const MARGEN_DERECHO = 6;
const ANCHO_TOOLTIP = 156;
const ALTO_TOOLTIP = 96;
const HUECO_ENTRE_BARRAS = 1;
const ALTO_EXTRA = 44; // eje X y etiquetas, que la librería dibuja debajo de la altura pedida
/** A partir de aquí se ocultan los puntos y el tooltip vuelve al sitio de la librería. */
const MAX_DIAS_CON_PUNTOS = 14;

/** Medidas de la gráfica normal (pantalla de detalle) y de la compacta (Home, en dos columnas). */
const MEDIDAS = {
  normal: { anchoEjeY: 38, margenLateral: 10, fuente: 11, grosor: 2.5, anchoMinEtiqueta: 36 },
  compacto: { anchoEjeY: 28, margenLateral: 6, fuente: 10, grosor: 2, anchoMinEtiqueta: 22 },
} as const;

type Medidas = (typeof MEDIDAS)[keyof typeof MEDIDAS];

/** Cada cuántos días lleva número el eje X del modo «mes». */
const PASO_MES = 5;

/**
 * Semana: "Lun", "Mar"… (iniciales en compacto). Mes: el número de día cada 5 días contando desde hoy.
 */
function etiquetaEjeX(
  punto: PuntoDia,
  indice: number,
  total: number,
  modo: ModoEtiquetas,
  idioma: Idioma,
  compacto: boolean,
): string {
  if (modo === 'semana') {
    return compacto ? inicialDia(punto.clave, idioma) : nombreDiaCorto(punto.clave, idioma);
  }
  return (total - 1 - indice) % PASO_MES === 0 ? String(numeroDia(punto.clave)) : '';
}

function valorMaximo(serie: readonly PuntoDia[]): number {
  let maximo = 0;
  for (const p of serie) maximo = Math.max(maximo, p.ingresos, p.gastos);
  return maximo;
}

interface PropsEtiqueta {
  texto: string;
  /** Distancia entre puntos: el texto se centra sobre su punto aunque sea más ancho. */
  espaciado: number;
  medidas: Medidas;
}

function EtiquetaEjeX({ texto, espaciado, medidas }: PropsEtiqueta) {
  const { colores } = useAjustes();
  const ancho = Math.max(espaciado, medidas.anchoMinEtiqueta);
  return (
    <View style={{ width: ancho, marginLeft: (espaciado - ancho) / 2, alignItems: 'center' }}>
      <Texto
        variante="pequeno"
        numberOfLines={1}
        allowFontScaling={false}
        style={{ color: colores.textoTenue, fontSize: medidas.fuente }}
      >
        {texto}
      </Texto>
    </View>
  );
}

interface PropsInternas {
  serie: readonly PuntoDia[];
  ancho: number;
  alto: number;
  modoEtiquetas: ModoEtiquetas;
  compacto: boolean;
}

function GraficaLineas({
  serie,
  ancho,
  alto,
  modoEtiquetas,
  compacto,
  conArea,
}: PropsInternas & { conArea: boolean }) {
  const { ajustes, colores, i18n } = useAjustes();
  const m = compacto ? MEDIDAS.compacto : MEDIDAS.normal;
  const total = serie.length;
  const hayPuntos = total <= MAX_DIAS_CON_PUNTOS;
  const anchoGrafica = ancho - m.anchoEjeY - MARGEN_DERECHO;
  const espaciado = total > 1 ? (anchoGrafica - 2 * m.margenLateral) / (total - 1) : 0;
  const escala = calcularEscala(valorMaximo(serie));
  const etiquetasY = Array.from({ length: escala.secciones + 1 }, (_, i) =>
    formatearCompacto(i * escala.paso),
  );

  const crearDatos = (clave: 'ingresos' | 'gastos', conEtiquetas: boolean) =>
    serie.map((punto, i) => {
      const texto = conEtiquetas
        ? etiquetaEjeX(punto, i, total, modoEtiquetas, i18n.idioma, compacto)
        : '';
      return {
        value: punto[clave],
        ...(texto
          ? { labelComponent: () => <EtiquetaEjeX texto={texto} espaciado={espaciado} medidas={m} /> }
          : {}),
      };
    });

  return (
    <LineChart
      allowFontScaling={false}
      data={crearDatos('ingresos', true)}
      data2={crearDatos('gastos', false)}
      width={anchoGrafica}
      height={alto}
      spacing={espaciado}
      initialSpacing={m.margenLateral}
      endSpacing={m.margenLateral}
      disableScroll
      isAnimated={false}
      backgroundColor="transparent"
      color1={colores.ingreso}
      color2={colores.gasto}
      thickness1={m.grosor}
      thickness2={m.grosor}
      hideDataPoints1={!hayPuntos}
      hideDataPoints2={!hayPuntos}
      dataPointsRadius1={compacto ? 2.5 : 3.5}
      dataPointsRadius2={compacto ? 2.5 : 3.5}
      dataPointsColor1={colores.ingreso}
      dataPointsColor2={colores.gasto}
      areaChart={conArea}
      startFillColor1={colores.ingreso}
      endFillColor1={colores.ingreso}
      startFillColor2={colores.gasto}
      endFillColor2={colores.gasto}
      startOpacity1={0.3}
      endOpacity1={0.02}
      startOpacity2={0.3}
      endOpacity2={0.02}
      maxValue={escala.maximo}
      noOfSections={escala.secciones}
      yAxisLabelTexts={etiquetasY}
      yAxisLabelWidth={m.anchoEjeY}
      yAxisThickness={0}
      yAxisTextStyle={{ color: colores.textoTenue, fontSize: m.fuente, ...estiloDeFuente(ajustes.fuente) }}
      xAxisThickness={1}
      xAxisColor={colores.borde}
      rulesColor={colores.borde}
      rulesType="solid"
      // La versión compacta (Home) es de solo lectura: el globo de 156 dp no cabe en media pantalla.
      pointerConfig={
        compacto
          ? undefined
          : {
              pointerStripHeight: alto,
              pointerStripColor: colores.textoTenue,
              pointerStripWidth: 1.5,
              pointer1Color: colores.ingreso,
              pointer2Color: colores.gasto,
              // El radio lo usa también el delta del tooltip (ver `@/dominio/tooltip`): no cambiarlo sin revisar ahí.
              radius: RADIO_PUNTERO,
              activatePointersInstantlyOnTouch: true,
              pointerVanishDelay: 2500,
              pointerLabelWidth: ANCHO_TOOLTIP,
              pointerLabelHeight: ALTO_TOOLTIP,
              autoAdjustPointerLabelPosition: true,
              stripOverPointer: true,
              // Se invoca como función (no como componente): sin hooks dentro.
              pointerLabelComponent: (_items: unknown, _secundarios: unknown, indice: number) => {
                const punto = serie[indice];
                if (!punto) return null;
                // Mismo Y que la librería para el centro de cada punto: `getY(v) = alto + 10 − (v / maximo) · alto`.
                const getY = (valor: number) => alto + 10 - (valor * alto) / escala.maximo;
                // La librería ancla la caja al puntero más alto (5 dp por encima del centro); el delta
                // mueve la caja a donde no tape ninguno de los dos puntos. Sin puntos en pantalla
                // (`hideDataPoints`) no hay nada que proteger: se deja el sitio de la librería.
                const yL = Math.min(getY(punto.ingresos), getY(punto.gastos)) - RADIO_PUNTERO;
                const topLibreriaDelDia = topLibreria(yL, ALTO_TOOLTIP);
                const objetivo = hayPuntos
                  ? posicionTooltip(getY(punto.ingresos), getY(punto.gastos), alto, ALTO_TOOLTIP)
                  : null;
                const deltaY = Math.round((objetivo ?? topLibreriaDelDia) - topLibreriaDelDia);
                return (
                  <View pointerEvents="none" style={{ transform: [{ translateY: deltaY }] }}>
                    <TooltipDia punto={punto} ancho={ANCHO_TOOLTIP} />
                  </View>
                );
              },
            }
      }
    />
  );
}

function GraficaBarras({ serie, ancho, alto, modoEtiquetas }: PropsInternas) {
  const { ajustes, colores, i18n } = useAjustes();
  const m = MEDIDAS.normal; // las barras solo se usan en la pantalla de detalle
  const total = serie.length;
  const anchoGrafica = ancho - m.anchoEjeY - MARGEN_DERECHO;
  const porGrupo = (anchoGrafica - 2 * m.margenLateral) / total;

  // Siempre caben todos los días en pantalla (sin desplazamiento horizontal): el par de barras
  // ocupa ~78 % de su espacio y el resto es separación entre días.
  const anchoBarra = Math.max(2, Math.min(14, Math.round((porGrupo * 0.78 - HUECO_ENTRE_BARRAS) / 2)));
  const anchoPar = 2 * anchoBarra + HUECO_ENTRE_BARRAS;
  const separacion = Math.max(1, porGrupo - anchoPar);

  const escala = calcularEscala(valorMaximo(serie));
  const etiquetasY = Array.from({ length: escala.secciones + 1 }, (_, i) =>
    formatearCompacto(i * escala.paso),
  );

  // Cada día son dos barras seguidas: ingreso (verde) y gasto (rojo).
  const datos = serie.flatMap((punto, i) => {
    const texto = etiquetaEjeX(punto, i, total, modoEtiquetas, i18n.idioma, false);
    return [
      {
        value: punto.ingresos,
        frontColor: colores.ingreso,
        spacing: HUECO_ENTRE_BARRAS,
        labelWidth: anchoPar,
        ...(texto
          ? { labelComponent: () => <EtiquetaEjeX texto={texto} espaciado={anchoPar} medidas={m} /> }
          : {}),
      },
      { value: punto.gastos, frontColor: colores.gasto, spacing: separacion },
    ];
  });

  // La librería calcula qué barra toca el dedo con un espaciado uniforme (`spacing` global), pero aquí
  // el hueco dentro del par y entre días es distinto. Con el paso medio por barra (la mitad del ancho
  // de un día) el índice cae siempre en el par correcto; el día es `Math.floor(indice / 2)`.
  const espaciadoUniforme = Math.max(0, porGrupo / 2 - anchoBarra);

  return (
    <BarChart
      allowFontScaling={false}
      data={datos}
      width={anchoGrafica}
      height={alto}
      barWidth={anchoBarra}
      spacing={espaciadoUniforme}
      initialSpacing={m.margenLateral}
      endSpacing={m.margenLateral}
      minHeight={2}
      barBorderTopLeftRadius={3}
      barBorderTopRightRadius={3}
      disableScroll
      isAnimated={false}
      backgroundColor="transparent"
      maxValue={escala.maximo}
      noOfSections={escala.secciones}
      yAxisLabelTexts={etiquetasY}
      yAxisLabelWidth={m.anchoEjeY}
      yAxisThickness={0}
      yAxisTextStyle={{ color: colores.textoTenue, fontSize: m.fuente, ...estiloDeFuente(ajustes.fuente) }}
      xAxisThickness={1}
      xAxisColor={colores.borde}
      xAxisLabelTextStyle={{ color: colores.textoTenue, fontSize: m.fuente, ...estiloDeFuente(ajustes.fuente) }}
      rulesColor={colores.borde}
      rulesType="solid"
      pointerConfig={{
        pointerStripHeight: alto,
        pointerStripColor: colores.textoTenue,
        pointerStripWidth: 1.5,
        radius: 0,
        pointerLabelWidth: ANCHO_TOOLTIP,
        pointerLabelHeight: ALTO_TOOLTIP,
        autoAdjustPointerLabelPosition: true,
        activatePointersInstantlyOnTouch: true,
        pointerVanishDelay: 2500,
        pointerLabelComponent: (_items: unknown, _secundarios: unknown, indice: number) => (
          <TooltipDia punto={serie[Math.floor(indice / 2)]} ancho={ANCHO_TOOLTIP} />
        ),
      }}
    />
  );
}

/** Curva decorativa para el esqueleto: ondas suaves, sin relación con datos reales. */
const ondaDecorativa = (total: number, base: number, amplitud: number, fase: number) =>
  Array.from({ length: total }, (_, i) => ({
    value: base + amplitud * Math.sin((i / Math.max(total - 1, 1)) * Math.PI * 2.2 + fase),
  }));

function GraficaEsqueleto({
  serie,
  ancho,
  alto,
  modoEtiquetas,
  compacto,
  mensaje,
  animar,
}: PropsInternas & { mensaje: string; animar: boolean }) {
  const { colores, i18n } = useAjustes();
  const m = compacto ? MEDIDAS.compacto : MEDIDAS.normal;
  const [opacidad] = useState(() => new Animated.Value(0.55));
  const total = serie.length;
  const anchoGrafica = ancho - m.anchoEjeY - MARGEN_DERECHO;
  const espaciado = total > 1 ? (anchoGrafica - 2 * m.margenLateral) / (total - 1) : 0;

  useEffect(() => {
    if (!animar) return;
    let vigente = true;
    let animacion: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (!vigente || reducir) return;
      animacion = Animated.loop(
        Animated.sequence([
          Animated.timing(opacidad, { toValue: 1, duration: 1100, useNativeDriver: true }),
          Animated.timing(opacidad, { toValue: 0.55, duration: 1100, useNativeDriver: true }),
        ]),
      );
      animacion.start();
    });
    return () => {
      vigente = false;
      animacion?.stop();
    };
  }, [opacidad, animar]);

  const ingresos = ondaDecorativa(total, 55, 28, 0.4).map((punto, i) => {
    const texto = etiquetaEjeX(serie[i], i, total, modoEtiquetas, i18n.idioma, compacto);
    return texto
      ? {
          ...punto,
          labelComponent: () => <EtiquetaEjeX texto={texto} espaciado={espaciado} medidas={m} />,
        }
      : punto;
  });
  const gastos = ondaDecorativa(total, 35, 20, 2.4);

  return (
    <View>
      <Animated.View style={{ opacity: opacidad }} pointerEvents="none">
        <LineChart
          allowFontScaling={false}
          data={ingresos}
          data2={gastos}
          width={anchoGrafica}
          height={alto}
          spacing={espaciado}
          initialSpacing={m.margenLateral}
          endSpacing={m.margenLateral}
          disableScroll
          isAnimated={false}
          backgroundColor="transparent"
          curved
          color1={colores.esqueleto}
          color2={colores.esqueleto}
          thickness1={m.grosor + 0.5}
          thickness2={m.grosor + 0.5}
          strokeDashArray2={[6, 6]}
          hideDataPoints1
          hideDataPoints2
          areaChart1
          startFillColor1={colores.esqueleto}
          endFillColor1={colores.esqueleto}
          startOpacity1={0.5}
          endOpacity1={0.02}
          maxValue={100}
          noOfSections={4}
          hideYAxisText
          yAxisLabelWidth={m.anchoEjeY}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colores.borde}
          rulesColor={colores.borde}
          rulesType="solid"
        />
      </Animated.View>
      <View
        style={[estilos.superposicion, { left: m.anchoEjeY, paddingHorizontal: compacto ? 6 : 0 }]}
        pointerEvents="none"
      >
        {compacto ? null : <Icono nombre="analytics-outline" tamano={26} color="textoTenue" />}
        <Texto
          variante={compacto ? 'pequeno' : 'secundario'}
          color="textoSecundario"
          negrita
          style={estilos.mensaje}
        >
          {mensaje}
        </Texto>
      </View>
    </View>
  );
}

interface Props {
  serie: readonly PuntoDia[];
  tipo: TipoGrafica;
  alto: number;
  modoEtiquetas: ModoEtiquetas;
  /** No hay ningún movimiento en la app: se dibuja un esqueleto decorativo. */
  esqueleto?: boolean;
  /** Versión para el Home en dos columnas: ejes y etiquetas más chicos, sin interacción (solo líneas y área). */
  compacto?: boolean;
  /** `false` con otra pantalla encima: el esqueleto deja de latir (no gasta batería sin que nadie lo vea). */
  animar?: boolean;
}

/** Ingresos (verde) y gastos (rojo) por día. Al tocar o deslizar muestra el resumen del día (salvo en compacto). */
export function GraficaMovimientos({
  serie,
  tipo,
  alto,
  modoEtiquetas,
  esqueleto = false,
  compacto = false,
  animar = true,
}: Props) {
  const { i18n } = useAjustes();
  const [ancho, setAncho] = useState(0);
  const alMedir = (evento: LayoutChangeEvent) => setAncho(Math.floor(evento.nativeEvent.layout.width));

  const comunes = { serie, ancho, alto, modoEtiquetas, compacto };

  return (
    <View onLayout={alMedir} style={{ minHeight: alto + ALTO_EXTRA }}>
      {ancho === 0 ? null : esqueleto ? (
        <GraficaEsqueleto {...comunes} mensaje={i18n.t('grafica.esqueleto')} animar={animar} />
      ) : tipo === 'barras' ? (
        <GraficaBarras {...comunes} />
      ) : (
        <GraficaLineas {...comunes} conArea={tipo === 'area'} />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  superposicion: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: ALTO_EXTRA - 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mensaje: { textAlign: 'center' },
});
