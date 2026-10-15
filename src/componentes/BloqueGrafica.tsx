import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { TipoGrafica } from '@/ajustes/normalizar';
import { formatearRango, sumarDias } from '@/dominio/fechas';
import { construirSerie, fechaMasAntigua, resumirSerie } from '@/dominio/series';
import type { Movimiento } from '@/dominio/tipos';
import { useHoy } from '@/hooks/useHoy';
import { type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { FlechaPeriodo } from './FlechaPeriodo';
import { GraficaMovimientos, type ModoEtiquetas } from './GraficaMovimientos';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

interface Props {
  titulo: string;
  dias: number;
  tipo: TipoGrafica;
  modoEtiquetas: ModoEtiquetas;
  movimientos: readonly Movimiento[];
  alto: number;
  /** Muestra flechas para ver periodos anteriores. */
  navegable?: boolean;
  /** Tarjeta angosta para el Home en dos columnas: solo montos (sin rótulos), ejes más chicos y sin interacción. */
  compacto?: boolean;
  /** `false` con otra pantalla encima: el esqueleto (sin datos) deja de latir. */
  animar?: boolean;
}

/** Tarjeta con título, rango de fechas, totales (que además hacen de leyenda) y la gráfica. */
export function BloqueGrafica({
  titulo,
  dias,
  tipo,
  modoEtiquetas,
  movimientos,
  alto,
  navegable,
  compacto = false,
  animar = true,
}: Props) {
  const estilos = useEstilos(crearEstilos);
  const { formatear, i18n } = useAjustes();
  const dia = useHoy();
  // Cuántas ventanas hacia atrás respecto a hoy (0 = el periodo actual).
  const [desfase, setDesfase] = useState(0);

  const diaFinal = sumarDias(dia, -desfase * dias);
  const serie = construirSerie(movimientos, diaFinal, dias);
  const resumen = resumirSerie(serie);
  const inicio = serie[0].clave;

  const masAntigua = fechaMasAntigua(movimientos);
  const puedeRetroceder = !!navegable && masAntigua !== null && masAntigua < inicio;
  const puedeAvanzar = !!navegable && desfase > 0;

  const hayDatosEnApp = movimientos.length > 0;
  const rango = formatearRango(inicio, diaFinal, i18n);

  return (
    <Tarjeta style={[estilos.tarjeta, compacto && estilos.tarjetaCompacta]}>
      <View style={estilos.encabezado}>
        <View style={estilos.titulos}>
          <Texto variante={compacto ? 'cuerpo' : 'subtitulo'} negrita={compacto} numberOfLines={1}>
            {titulo}
          </Texto>
          {!navegable ? (
            <Texto variante="pequeno" numberOfLines={1}>
              {rango}
            </Texto>
          ) : null}
        </View>
        {navegable ? (
          <View style={estilos.navegacion}>
            <FlechaPeriodo sentido="atras" habilitada={puedeRetroceder} onPress={() => setDesfase(desfase + 1)} />
            <Texto variante="secundario" style={estilos.rango} numberOfLines={1}>
              {desfase === 0 ? i18n.t('grafica.hoy_rango', { rango }) : rango}
            </Texto>
            <FlechaPeriodo sentido="adelante" habilitada={puedeAvanzar} onPress={() => setDesfase(desfase - 1)} />
          </View>
        ) : null}
      </View>

      {compacto ? (
        // En una columna angosta caben solo los montos: el punto de color hace de leyenda.
        <View style={estilos.totalesCompactos}>
          <View style={estilos.total}>
            <View style={[estilos.punto, estilos.puntoIngreso]} />
            <Texto variante="secundario" color="ingreso" negrita style={estilos.numero} numberOfLines={1}>
              {formatear(resumen.ingresos)}
            </Texto>
          </View>
          <View style={estilos.total}>
            <View style={[estilos.punto, estilos.puntoGasto]} />
            <Texto variante="secundario" color="gasto" negrita style={estilos.numero} numberOfLines={1}>
              {formatear(resumen.gastos)}
            </Texto>
          </View>
        </View>
      ) : (
        <View style={estilos.totales}>
          <View style={estilos.total}>
            <View style={[estilos.punto, estilos.puntoIngreso]} />
            <View>
              <Texto variante="pequeno">{i18n.t('comun.ingresos')}</Texto>
              <Texto variante="secundario" color="ingreso" negrita style={estilos.numero}>
                {formatear(resumen.ingresos)}
              </Texto>
            </View>
          </View>
          <View style={estilos.total}>
            <View style={[estilos.punto, estilos.puntoGasto]} />
            <View>
              <Texto variante="pequeno">{i18n.t('comun.gastos')}</Texto>
              <Texto variante="secundario" color="gasto" negrita style={estilos.numero}>
                {formatear(resumen.gastos)}
              </Texto>
            </View>
          </View>
        </View>
      )}

      <GraficaMovimientos
        serie={serie}
        tipo={tipo}
        alto={alto}
        modoEtiquetas={modoEtiquetas}
        esqueleto={!hayDatosEnApp}
        compacto={compacto}
        animar={animar}
      />

      {hayDatosEnApp && !resumen.hayMovimientos && !compacto ? (
        <Texto variante="pequeno" style={estilos.aviso}>
          {i18n.t('grafica.sin_movimientos_periodo')}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    tarjeta: { gap: 12, paddingBottom: 12 },
    tarjetaCompacta: { gap: 6, padding: 12, paddingBottom: 6 },
    totalesCompactos: { gap: 2 },
    encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    titulos: { flexShrink: 1 },
    navegacion: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 2 },
    rango: { flexShrink: 1, textAlign: 'center' },
    totales: { flexDirection: 'row', gap: 24 },
    total: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    punto: { width: 10, height: 10, borderRadius: 5 },
    puntoIngreso: { backgroundColor: c.ingreso },
    puntoGasto: { backgroundColor: c.gasto },
    numero: { fontVariant: ['tabular-nums'] },
    aviso: { textAlign: 'center', marginTop: -4 },
  });
