import { useCalendars } from 'expo-localization';
import { useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import {
  ANIO_MAXIMO,
  ANIO_MINIMO,
  cambiarMes,
  mesDeClave,
  ordenarSemana,
  semanasDelMes,
} from '@/dominio/calendario';
import { fechaDeClave, formatearDia, formatearFechaCorta } from '@/dominio/fechas';
import { useHoy } from '@/hooks/useHoy';
import { DIAS_CORTOS, DIAS_INICIALES, MESES_CORTOS, MESES_LARGOS } from '@/i18n/calendario';
import type { I18n } from '@/i18n/traducir';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { FlechaPeriodo } from './FlechaPeriodo';
import { Icono } from './Icono';
import { ESCALA_ICONO, PresionableEscala } from './PresionableEscala';
import { Texto } from './Texto';

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "Mié 14 oct 2026": la fecha completa para lectores de pantalla. */
function fechaAccesible(clave: string, i18n: I18n): string {
  const fecha = fechaDeClave(clave);
  return i18n.t('fecha.formato_dia_anio', {
    dia: DIAS_CORTOS[i18n.idioma][fecha.getDay()],
    num: fecha.getDate(),
    mes: MESES_CORTOS[i18n.idioma][fecha.getMonth()],
    anio: fecha.getFullYear(),
  });
}

function BotonTexto({ titulo, onPress }: { titulo: string; onPress: () => void }) {
  const estilos = useEstilos(crearEstilos);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [estilos.botonTexto, pressed && { opacity: 0.6 }]}
    >
      <Texto variante="cuerpo" negrita color="primario">
        {titulo}
      </Texto>
    </Pressable>
  );
}

interface PropsDialogo {
  fecha: string;
  primerDia: number;
  onAceptar: (fecha: string) => void;
  onCerrar: () => void;
}

/** Calendario en un modal. Elegir un día solo lo marca; «Aceptar» lo confirma. */
function DialogoCalendario({ fecha, primerDia, onAceptar, onCerrar }: PropsDialogo) {
  const estilos = useEstilos(crearEstilos);
  const { i18n } = useAjustes();
  const hoy = useHoy();
  const [elegida, setElegida] = useState(fecha);
  const [mostrado, setMostrado] = useState(() => mesDeClave(fecha));
  const [vista, setVista] = useState<'dias' | 'meses'>('dias');

  const inicialesDeSemana = ordenarSemana(DIAS_INICIALES[i18n.idioma], primerDia);
  const semanas = semanasDelMes(mostrado.anio, mostrado.mes, primerDia);
  const anioElegido = fechaDeClave(elegida).getFullYear();

  const irA = (delta: number) => setMostrado(cambiarMes(mostrado.anio, mostrado.mes, delta));
  const puedeRetroceder = mostrado.anio > ANIO_MINIMO || mostrado.mes > 0;
  const puedeAvanzar = mostrado.anio < ANIO_MAXIMO || mostrado.mes < 11;
  const irAHoy = () => {
    setElegida(hoy);
    setMostrado(mesDeClave(hoy));
    setVista('dias');
  };

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onCerrar}>
      <View style={estilos.fondo}>
        {/* Tocar fuera cancela. Va detrás de la tarjeta, que queda encima y recibe sus propios toques. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCerrar}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('comun.cancelar')}
        />

        <View
          style={estilos.tarjeta}
          accessibilityViewIsModal
          accessibilityLabel={i18n.t('calendario.elegir_fecha')}
        >
          <View style={estilos.encabezado}>
            <Texto variante="secundario">{anioElegido}</Texto>
            <Texto variante="titulo">{formatearFechaCorta(elegida, i18n)}</Texto>
          </View>

          {vista === 'dias' ? (
            <>
              <View style={estilos.barraMes}>
                <FlechaPeriodo
                  sentido="atras"
                  habilitada={puedeRetroceder}
                  onPress={() => irA(-1)}
                  etiqueta={i18n.t('calendario.mes_anterior')}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t('calendario.elegir_mes')}
                  onPress={() => setVista('meses')}
                  style={estilos.tituloMes}
                >
                  <Texto variante="cuerpo" negrita>
                    {capitalizar(MESES_LARGOS[i18n.idioma][mostrado.mes])} {mostrado.anio}
                  </Texto>
                  <Icono nombre="chevron-down" tamano={16} color="textoSecundario" />
                </Pressable>
                <FlechaPeriodo
                  sentido="adelante"
                  habilitada={puedeAvanzar}
                  onPress={() => irA(1)}
                  etiqueta={i18n.t('calendario.mes_siguiente')}
                />
              </View>

              <View style={estilos.fila}>
                {inicialesDeSemana.map((inicial, i) => (
                  <View key={i} style={estilos.celdaInicial}>
                    <Texto variante="pequeno" maxFontSizeMultiplier={MAX_ESCALA_LETRA}>
                      {inicial}
                    </Texto>
                  </View>
                ))}
              </View>

              {semanas.map((semana, fila) => (
                <View key={fila} style={estilos.fila}>
                  {semana.map((clave, columna) => {
                    if (clave === null) return <View key={columna} style={estilos.celda} />;
                    const esElegida = clave === elegida;
                    const esHoy = clave === hoy;
                    return (
                      <View key={columna} style={estilos.celda}>
                        <PresionableEscala
                          accessibilityRole="button"
                          accessibilityLabel={fechaAccesible(clave, i18n)}
                          accessibilityState={{ selected: esElegida }}
                          onPress={() => setElegida(clave)}
                          escala={ESCALA_ICONO}
                          style={[
                            estilos.dia,
                            esHoy && !esElegida && estilos.diaHoy,
                            esElegida && estilos.diaElegido,
                          ]}
                        >
                          <Texto
                            variante="secundario"
                            negrita={esElegida}
                            color={esElegida ? 'sobrePrimario' : 'texto'}
                            maxFontSizeMultiplier={MAX_ESCALA_LETRA}
                          >
                            {fechaDeClave(clave).getDate()}
                          </Texto>
                        </PresionableEscala>
                      </View>
                    );
                  })}
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={estilos.barraMes}>
                <FlechaPeriodo
                  sentido="atras"
                  habilitada={mostrado.anio > ANIO_MINIMO}
                  onPress={() => setMostrado({ ...mostrado, anio: mostrado.anio - 1 })}
                  etiqueta={i18n.t('calendario.anio_anterior')}
                />
                <Texto variante="cuerpo" negrita>
                  {mostrado.anio}
                </Texto>
                <FlechaPeriodo
                  sentido="adelante"
                  habilitada={mostrado.anio < ANIO_MAXIMO}
                  onPress={() => setMostrado({ ...mostrado, anio: mostrado.anio + 1 })}
                  etiqueta={i18n.t('calendario.anio_siguiente')}
                />
              </View>

              {[0, 1, 2, 3].map((fila) => (
                <View key={fila} style={estilos.filaMeses}>
                  {[0, 1, 2].map((columna) => {
                    const mes = fila * 3 + columna;
                    const esMostrado = mes === mostrado.mes;
                    return (
                      <PresionableEscala
                        key={mes}
                        accessibilityRole="button"
                        accessibilityLabel={`${capitalizar(MESES_LARGOS[i18n.idioma][mes])} ${mostrado.anio}`}
                        accessibilityState={{ selected: esMostrado }}
                        onPress={() => {
                          setMostrado({ ...mostrado, mes });
                          setVista('dias');
                        }}
                        style={[estilos.mes, esMostrado && estilos.mesElegido]}
                      >
                        <Texto
                          variante="cuerpo"
                          negrita={esMostrado}
                          color={esMostrado ? 'sobrePrimario' : 'texto'}
                          maxFontSizeMultiplier={MAX_ESCALA_LETRA}
                        >
                          {capitalizar(MESES_CORTOS[i18n.idioma][mes])}
                        </Texto>
                      </PresionableEscala>
                    );
                  })}
                </View>
              ))}
            </>
          )}

          <View style={estilos.acciones}>
            <BotonTexto titulo={i18n.t('fecha.hoy')} onPress={irAHoy} />
            <View style={estilos.accionesDerecha}>
              <BotonTexto titulo={i18n.t('comun.cancelar')} onPress={onCerrar} />
              <BotonTexto titulo={i18n.t('calendario.aceptar')} onPress={() => onAceptar(elegida)} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface Props {
  /** Día elegido, `YYYY-MM-DD`. */
  fecha: string;
  onCambio: (fecha: string) => void;
  /** Con qué día empieza la semana (0 = domingo … 6 = sábado). Por defecto, el del dispositivo. */
  primerDia?: number;
}

/** Botón con la fecha que abre un calendario propio (con los colores de la app) para cambiarla. */
export function SelectorFecha({ fecha, onCambio, primerDia }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { i18n } = useAjustes();
  const calendarios = useCalendars();
  const [abierto, setAbierto] = useState(false);

  // `firstWeekday` va de 1 (domingo) a 7 (sábado); si el dispositivo no lo dice, la semana empieza el lunes.
  const inicio = primerDia ?? (calendarios[0]?.firstWeekday ?? 2) - 1;
  const etiqueta = formatearDia(fecha, i18n);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={i18n.t('mov.fecha_accesible', { fecha: etiqueta })}
        onPress={() => {
          Keyboard.dismiss(); // el teclado taparía parte del calendario
          setAbierto(true);
        }}
        style={estilos.botonFecha}
      >
        <Texto variante="cuerpo">{etiqueta}</Texto>
        <Icono nombre="calendar-outline" tamano={18} color="textoSecundario" />
      </Pressable>

      {/* Se monta solo al abrirlo: así siempre arranca en la fecha actual del formulario. */}
      {abierto ? (
        <DialogoCalendario
          fecha={fecha}
          primerDia={inicio}
          onAceptar={(nueva) => {
            setAbierto(false);
            onCambio(nueva);
          }}
          onCerrar={() => setAbierto(false)}
        />
      ) : null}
    </>
  );
}

const TAMANO_DIA = 44;
/**
 * Las celdas del calendario tienen tamaño fijo (7 por fila): con la letra del sistema al doble, «28» ya no cabe. Se deja
 * crecer hasta un 30 % (el resto de la app escala sin límite).
 */
const MAX_ESCALA_LETRA = 1.3;

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    botonFecha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.superficieAlta,
      borderRadius: radios.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    fondo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.velo },
    tarjeta: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: c.superficie,
      borderRadius: radios.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borde,
      padding: 16,
      gap: 6,
    },
    encabezado: { gap: 2, paddingHorizontal: 4, paddingBottom: 6 },
    barraMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    tituloMes: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
    fila: { flexDirection: 'row' },
    celda: { flex: 1, maxHeight: TAMANO_DIA, aspectRatio: 1, padding: 2 },
    celdaInicial: { flex: 1, height: 28, alignItems: 'center', justifyContent: 'center' },
    dia: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radios.pildora },
    diaHoy: { borderWidth: 1.5, borderColor: c.primario },
    diaElegido: { backgroundColor: c.primario },
    filaMeses: { flexDirection: 'row', gap: 8 },
    mes: {
      flex: 1,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radios.md,
      backgroundColor: c.superficieAlta,
    },
    mesElegido: { backgroundColor: c.primario },
    acciones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 },
    accionesDerecha: { flexDirection: 'row', alignItems: 'center' },
    botonTexto: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  });
