import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { generarConsejos, type HechosAnalisis } from '@/dominio/analisis';
import { DIAS_PLURALES } from '@/i18n/calendario';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Entrada } from './Entrada';
import { Icono, type NombreIcono } from './Icono';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

interface PropsSeccion {
  icono: NombreIcono;
  titulo: string;
  /** Turno de la tarjeta en la entrada escalonada de la pantalla. */
  indice: number;
  children: ReactNode;
}

function Seccion({ icono, titulo, indice, children }: PropsSeccion) {
  const estilos = useEstilos(crearEstilos);
  return (
    <Entrada indice={indice}>
      <Tarjeta style={estilos.tarjeta}>
        <View style={estilos.encabezado}>
          <View style={estilos.icono}>
            <Icono nombre={icono} tamano={18} color="primario" />
          </View>
          <Texto variante="subtitulo" style={estilos.titulo} numberOfLines={2}>
            {titulo}
          </Texto>
        </View>
        {children}
      </Tarjeta>
    </Entrada>
  );
}

interface Props {
  hechos: HechosAnalisis;
}

/** El análisis sin IA: cuentas simples sobre los gastos, al instante y sin descargar nada. */
export function AnalisisReglas({ hechos }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { formatear, i18n } = useAjustes();
  const { actual, tendencia, topMotivos, suscripciones, hormiga, diaMasCaro } = hechos;
  const consejos = generarConsejos(hechos, i18n, formatear);
  const mayor = topMotivos[0]?.total ?? 0;

  let textoTendencia: string;
  let colorTendencia: 'ingreso' | 'gasto' | 'textoSecundario' = 'textoSecundario';
  if (tendencia.porcentaje === null) {
    textoTendencia = i18n.t('analisis.tendencia_sin_base');
  } else if (Math.abs(tendencia.porcentaje) < 1) {
    textoTendencia = i18n.t('analisis.tendencia_igual');
  } else if (tendencia.porcentaje > 0) {
    textoTendencia = i18n.t('analisis.tendencia_sube', {
      porcentaje: Math.round(tendencia.porcentaje),
      diferencia: formatear(tendencia.diferencia, { conSigno: true }),
    });
    colorTendencia = 'gasto';
  } else {
    textoTendencia = i18n.t('analisis.tendencia_baja', {
      porcentaje: Math.round(Math.abs(tendencia.porcentaje)),
      diferencia: formatear(tendencia.diferencia, { conSigno: true }),
    });
    colorTendencia = 'ingreso';
  }

  return (
    <View style={estilos.contenedor}>
      <Entrada indice={1}>
        <Tarjeta style={estilos.tarjeta}>
          <Texto variante="etiqueta">{i18n.t('analisis.periodo', { n: hechos.dias })}</Texto>
          <View style={estilos.balance}>
            <Texto variante="pequeno">{i18n.t('analisis.balance')}</Texto>
            <Texto variante="monto" color={actual.neto < 0 ? 'gasto' : 'texto'} numberOfLines={1} adjustsFontSizeToFit>
              {formatear(actual.neto)}
            </Texto>
          </View>
          <View style={estilos.fila}>
            <View style={estilos.dato}>
              <Texto variante="pequeno">{i18n.t('comun.ingresos')}</Texto>
              <Texto variante="secundario" color="ingreso" negrita numberOfLines={1} adjustsFontSizeToFit>
                {formatear(actual.ingresos)}
              </Texto>
            </View>
            <View style={estilos.dato}>
              <Texto variante="pequeno">{i18n.t('comun.gastos')}</Texto>
              <Texto variante="secundario" color="gasto" negrita numberOfLines={1} adjustsFontSizeToFit>
                {formatear(actual.gastos)}
              </Texto>
            </View>
          </View>
          <View style={estilos.separador} />
          <Texto variante="secundario">
            {actual.tasaAhorro === null
              ? i18n.t('analisis.sin_ingresos')
              : `${i18n.t('analisis.ahorro')}: ${i18n.t('analisis.ahorro_valor', { porcentaje: Math.round(actual.tasaAhorro) })}`}
          </Texto>
          <Texto variante="pequeno">{i18n.t('analisis.tendencia', { n: hechos.dias })}</Texto>
          <Texto variante="secundario" color={colorTendencia} negrita={colorTendencia !== 'textoSecundario'}>
            {textoTendencia}
          </Texto>
          {diaMasCaro ? (
            <>
              <Texto variante="pequeno">{i18n.t('analisis.dia_caro')}</Texto>
              <Texto variante="secundario">
                {i18n.t('analisis.dia_caro_valor', {
                  dia: DIAS_PLURALES[i18n.idioma][diaMasCaro.diaSemana],
                  porcentaje: Math.round(diaMasCaro.porcentaje),
                })}
              </Texto>
            </>
          ) : null}
        </Tarjeta>
      </Entrada>

      {topMotivos.length > 0 ? (
        <Seccion indice={2} icono="pie-chart-outline" titulo={i18n.t('analisis.en_que_gastas')}>
          <View style={estilos.lista}>
            {topMotivos.map((grupo) => (
              <View key={grupo.motivo} style={estilos.motivo}>
                <View style={estilos.filaMotivo}>
                  <Texto variante="cuerpo" numberOfLines={1} style={estilos.nombreMotivo}>
                    {grupo.motivo}
                  </Texto>
                  <Texto variante="cuerpo" negrita style={estilos.numero}>
                    {formatear(grupo.total)}
                  </Texto>
                </View>
                <View style={estilos.pista}>
                  <View style={[estilos.barra, { width: `${mayor > 0 ? Math.max(4, (grupo.total / mayor) * 100) : 0}%` }]} />
                </View>
                <Texto variante="pequeno">
                  {Math.round(grupo.porcentaje)}% · {i18n.plural('analisis.veces', grupo.cantidad)}
                </Texto>
              </View>
            ))}
          </View>
        </Seccion>
      ) : null}

      <Seccion indice={3} icono="repeat-outline" titulo={i18n.t('analisis.suscripciones')}>
        {suscripciones.length === 0 ? (
          <Texto variante="secundario">{i18n.t('analisis.suscripciones_vacio')}</Texto>
        ) : (
          <>
            <Texto variante="cuerpo" negrita>
              {i18n.t('analisis.suscripciones_total', {
                mensual: formatear(hechos.totalSuscripcionesMensual),
                anual: formatear(hechos.totalSuscripcionesAnual),
              })}
            </Texto>
            <View style={estilos.lista}>
              {suscripciones.map((s) => (
                <View key={s.motivo} style={estilos.filaMotivo}>
                  <View style={estilos.nombreMotivo}>
                    <Texto variante="cuerpo" numberOfLines={1}>
                      {s.motivo}
                    </Texto>
                    <Texto variante="pequeno">
                      {i18n.t(s.origen === 'marcada' ? 'analisis.suscripcion_marcada' : 'analisis.suscripcion_detectada')}
                    </Texto>
                  </View>
                  <Texto variante="secundario" negrita style={estilos.numero}>
                    {i18n.t('analisis.suscripcion_mensual', { monto: formatear(s.mensual) })}
                  </Texto>
                </View>
              ))}
            </View>
          </>
        )}
      </Seccion>

      <Seccion indice={4} icono="cafe-outline" titulo={i18n.t('analisis.hormiga')}>
        {hormiga ? (
          <>
            <Texto variante="secundario">
              {i18n.t('analisis.hormiga_detalle', {
                n: hormiga.cantidad,
                umbral: formatear(hormiga.umbral),
                total: formatear(hormiga.total),
                porcentaje: Math.round(hormiga.porcentaje),
              })}
            </Texto>
            {hormiga.masFrecuente ? (
              <Texto variante="pequeno">
                {i18n.t('analisis.hormiga_frecuente', {
                  motivo: hormiga.masFrecuente.motivo,
                  n: hormiga.masFrecuente.cantidad,
                })}
              </Texto>
            ) : null}
          </>
        ) : (
          <Texto variante="secundario">{i18n.t('analisis.hormiga_vacio')}</Texto>
        )}
      </Seccion>

      {consejos.length > 0 ? (
        <Seccion indice={5} icono="bulb-outline" titulo={i18n.t('analisis.consejos')}>
          <View style={estilos.lista}>
            {consejos.map((consejo) => (
              <View key={consejo} style={estilos.consejo}>
                <Icono nombre="chevron-forward" tamano={16} color="primario" />
                <Texto variante="secundario" style={estilos.textoConsejo}>
                  {consejo}
                </Texto>
              </View>
            ))}
          </View>
        </Seccion>
      ) : null}
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    contenedor: { gap: 12 },
    tarjeta: { gap: 10 },
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    icono: {
      width: 32,
      height: 32,
      borderRadius: radios.md,
      backgroundColor: c.superficieAlta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titulo: { flex: 1 },
    balance: { gap: 2 },
    fila: { flexDirection: 'row', gap: 24 },
    dato: { flexShrink: 1, gap: 2 },
    separador: { height: StyleSheet.hairlineWidth, backgroundColor: c.borde },
    lista: { gap: 12 },
    motivo: { gap: 4 },
    filaMotivo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    nombreMotivo: { flex: 1, minWidth: 0 },
    numero: { fontVariant: ['tabular-nums'] },
    pista: { height: 6, borderRadius: radios.pildora, backgroundColor: c.superficieAlta, overflow: 'hidden' },
    barra: { height: '100%', borderRadius: radios.pildora, backgroundColor: c.primario },
    consejo: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    textoConsejo: { flex: 1, lineHeight: 20 },
  });
