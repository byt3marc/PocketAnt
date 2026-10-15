import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { formatearDia, sumarDias } from '@/dominio/fechas';
import { fechaMasAntigua, resumirDia } from '@/dominio/series';
import type { Movimiento } from '@/dominio/tipos';
import { useHoy } from '@/hooks/useHoy';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { FlechaPeriodo } from './FlechaPeriodo';
import { Icono, type NombreIcono } from './Icono';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';
import { resumirMotivos } from './TooltipDia';

interface Props {
  movimientos: readonly Movimiento[];
  /** Tarjeta angosta para el Home en dos columnas: título «Hoy», sin flechas ni motivos. */
  compacto?: boolean;
  /** Flechas para ver días anteriores (pantalla de Gráficas e Historial). */
  navegable?: boolean;
}

interface PropsColumna {
  etiqueta: string;
  monto: string;
  /** Altura de la barra respecto al riel, de 0 a 1. */
  fraccion: number;
  color: 'ingreso' | 'gasto';
  compacto: boolean;
  testID: string;
}

/** Una barra vertical sobre su riel, con la etiqueta y el monto como leyenda debajo. */
function ColumnaBarra({ etiqueta, monto, fraccion, color, compacto, testID }: PropsColumna) {
  const estilos = useEstilos(crearEstilos);
  return (
    <View style={estilos.columna}>
      <View style={[estilos.riel, compacto ? estilos.rielCompacto : estilos.rielNormal]}>
        <View
          testID={testID}
          style={[
            estilos.barra,
            color === 'ingreso' ? estilos.barraIngreso : estilos.barraGasto,
            // El mínimo en dp evita que un valor chico (pero no cero) desaparezca sobre un riel alto.
            { height: `${Math.round(fraccion * 100)}%`, minHeight: fraccion > 0 ? 6 : 0 },
          ]}
        />
      </View>
      <View style={estilos.leyenda}>
        <Texto variante="pequeno" numberOfLines={1}>
          {etiqueta}
        </Texto>
        {/* Cada columna mide la mitad de la tarjeta: las cifras largas se encogen en vez de cortarse. */}
        <Texto
          variante="secundario"
          color={color}
          negrita
          style={estilos.numero}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {monto}
        </Texto>
      </View>
    </View>
  );
}

/**
 * Ingresos y gastos de un día en dos barras verticales y, debajo, el balance del día: «Vas $8.00 arriba hoy» en verde,
 * «abajo» en rojo o «a la par», con un icono que lo refuerza (el texto dice lo mismo: no depende solo del color).
 */
export function BloqueDia({ movimientos, compacto = false, navegable = false }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { formatear, i18n } = useAjustes();
  const hoy = useHoy();
  // Cuántos días hacia atrás respecto a hoy (0 = hoy).
  const [desfase, setDesfase] = useState(0);

  const clave = sumarDias(hoy, -desfase);
  const esHoy = desfase === 0;
  const { dia, balance } = resumirDia(movimientos, clave);

  const masAntigua = fechaMasAntigua(movimientos);
  const puedeRetroceder = navegable && masAntigua !== null && masAntigua < clave;
  const puedeAvanzar = navegable && !esHoy;

  // Las dos barras comparten escala: la mayor ocupa todo el riel y la otra, su proporción (con un mínimo
  // visible si no es cero).
  const maximo = Math.max(dia.ingresos, dia.gastos);
  const fraccion = (valor: number) => (maximo > 0 && valor > 0 ? Math.max(valor / maximo, 0.04) : 0);

  const hayMovimientos = dia.movimientos.length > 0;
  let pie: string;
  let colorPie: 'ingreso' | 'gasto' | 'textoTenue' = 'textoTenue';
  let iconoPie: NombreIcono | null = null;
  if (movimientos.length === 0) {
    pie = i18n.t('grafica.esqueleto');
  } else if (!hayMovimientos) {
    pie = i18n.t(esHoy ? 'dia.sin_movimientos_hoy' : 'tooltip.sin_movimientos');
  } else if (balance > 0) {
    pie = i18n.t(esHoy ? 'dia.arriba_hoy' : 'dia.arriba', { monto: formatear(balance) });
    colorPie = 'ingreso';
    iconoPie = 'trending-up';
  } else if (balance < 0) {
    pie = i18n.t(esHoy ? 'dia.abajo_hoy' : 'dia.abajo', { monto: formatear(-balance) });
    colorPie = 'gasto';
    iconoPie = 'trending-down';
  } else {
    pie = i18n.t(esHoy ? 'dia.par_hoy' : 'dia.par');
    iconoPie = 'remove';
  }

  const titulo = navegable ? i18n.t('est.diaria') : i18n.t('fecha.hoy');

  return (
    <Tarjeta style={[estilos.tarjeta, compacto && estilos.tarjetaCompacta]}>
      <View style={estilos.encabezado}>
        <Texto variante={compacto ? 'cuerpo' : 'subtitulo'} negrita={compacto} numberOfLines={1} style={estilos.titulo}>
          {titulo}
        </Texto>
        {navegable ? (
          <View style={estilos.navegacion}>
            <FlechaPeriodo sentido="atras" habilitada={puedeRetroceder} onPress={() => setDesfase(desfase + 1)} />
            <Texto variante="secundario" style={estilos.etiquetaDia} numberOfLines={1}>
              {formatearDia(clave, i18n, hoy)}
            </Texto>
            <FlechaPeriodo sentido="adelante" habilitada={puedeAvanzar} onPress={() => setDesfase(desfase - 1)} />
          </View>
        ) : null}
      </View>

      {/* En el Home la tarjeta se estira al alto de su vecina: las barras ocupan el alto que sobra. */}
      <View style={[estilos.cuerpo, compacto && estilos.cuerpoCompacto]}>
        <View style={[estilos.barras, compacto && estilos.barrasCompactas]}>
          <ColumnaBarra
            etiqueta={i18n.t('comun.ingresos')}
            monto={formatear(dia.ingresos)}
            fraccion={fraccion(dia.ingresos)}
            color="ingreso"
            compacto={compacto}
            testID="barra-ingresos"
          />
          <ColumnaBarra
            etiqueta={i18n.t('comun.gastos')}
            monto={formatear(dia.gastos)}
            fraccion={fraccion(dia.gastos)}
            color="gasto"
            compacto={compacto}
            testID="barra-gastos"
          />
        </View>

        <View style={estilos.pie}>
          {navegable && hayMovimientos ? (
            <Texto variante="pequeno" numberOfLines={1}>
              {resumirMotivos(dia, i18n)}
            </Texto>
          ) : null}
          <View style={estilos.balance} testID={iconoPie ? `balance-${iconoPie}` : undefined}>
            {iconoPie ? (
              // Solo refuerza el texto: los lectores de pantalla leen la frase, no el icono.
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={estilos.iconoBalance}>
                <Icono nombre={iconoPie} tamano={16} color={colorPie} />
              </View>
            ) : null}
            <Texto
              variante="pequeno"
              color={colorPie}
              negrita={colorPie !== 'textoTenue'}
              numberOfLines={2}
              style={estilos.textoBalance}
            >
              {pie}
            </Texto>
          </View>
        </View>
      </View>
    </Tarjeta>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    tarjeta: { gap: 14 },
    // `flex: 1` iguala su alto al de la tarjeta vecina (la gráfica de 7 días) en la fila del Home.
    tarjetaCompacta: { flex: 1, gap: 10, padding: 12 },
    cuerpo: { gap: 10 },
    cuerpoCompacto: { flex: 1 },
    encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    titulo: { flexShrink: 1 },
    navegacion: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 2 },
    etiquetaDia: { flexShrink: 1, textAlign: 'center', minWidth: 72 },
    barras: { flexDirection: 'row', gap: 12 },
    // Más ancho para cada leyenda: el monto es lo que más espacio necesita.
    barrasCompactas: { flex: 1, gap: 8 },
    columna: { flex: 1, alignItems: 'center', gap: 8 },
    // El riel del Home se estira con la tarjeta; el de la pantalla de detalle tiene alto fijo.
    riel: { backgroundColor: c.superficieAlta, borderRadius: radios.md, overflow: 'hidden', justifyContent: 'flex-end' },
    rielCompacto: { flex: 1, minHeight: 64, width: 36 },
    rielNormal: { height: 120, width: 56 },
    barra: { width: '100%', borderRadius: radios.md },
    barraIngreso: { backgroundColor: c.ingreso },
    barraGasto: { backgroundColor: c.gasto },
    leyenda: { alignSelf: 'stretch', alignItems: 'center', gap: 1 },
    numero: { fontVariant: ['tabular-nums'] },
    pie: { gap: 2 },
    // Arriba, no centrado: si el texto ocupa dos líneas (tarjeta angosta), el icono acompaña a la primera.
    balance: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
    iconoBalance: { marginTop: -1 },
    textoBalance: { flexShrink: 1 },
  });
