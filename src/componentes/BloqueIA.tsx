import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import { REVELAR_ENTRADA, TRANSICION_PROGRESO } from '@/animacion/constantes';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { HechosAnalisis } from '@/dominio/analisis';
import { formatearRam, formatearTamano } from '@/dominio/formato';
import { construirPrompt } from '@/dominio/promptIA';
import { CORREO_REPORTES, RAM_MINIMA_ETIQUETA } from '@/ia/config';
import { useIA } from '@/ia/IAProvider';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Boton } from './Boton';
import { useDialogo } from './DialogoProvider';
import { Icono } from './Icono';
import { Revelar } from './Revelar';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

/** Margen sobre el tamaño del modelo que debe quedar libre en el almacenamiento antes de descargar. */
const MARGEN_DISCO = 1.15;

function BarraProgreso({ fraccion, etiqueta }: { fraccion: number; etiqueta: string }) {
  const estilos = useEstilos(crearEstilos);
  // El ancho de la pista se mide una vez; el relleno mide `ancho × fracción` en puntos (no en %) para poder animarlo.
  const [ancho, setAncho] = useState(0);
  const acotada = Math.min(1, Math.max(0, fraccion));
  const porcentaje = Math.round(acotada * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min: 0, max: 100, now: porcentaje }}
      onLayout={(evento: LayoutChangeEvent) => setAncho(evento.nativeEvent.layout.width)}
      style={estilos.pista}
    >
      {/* El dato llega ~1 vez por segundo: entre uno y otro la barra avanza sola, a velocidad constante. */}
      <Animated.View style={[estilos.relleno, { width: ancho * acotada }, TRANSICION_PROGRESO]} />
    </View>
  );
}

/**
 * El marco de la tarjeta de IA. El encabezado se queda quieto; al cambiar de fase (sin descargar → descargando →
 * lista…) solo el contenido entra con un fundido, y la tarjeta cambia de alto con animación.
 */
function Marco({ clave, encabezado, children }: { clave: string; encabezado: ReactNode; children: ReactNode }) {
  const estilos = useEstilos(crearEstilos);
  return (
    <Tarjeta deslizar style={estilos.tarjeta}>
      {encabezado}
      <Animated.View key={clave} entering={REVELAR_ENTRADA} style={estilos.cuerpo}>
        {children}
      </Animated.View>
    </Tarjeta>
  );
}

/** Los párrafos del informe: el resumen y las viñetas «• …» van en líneas separadas. */
function TextoInforme({ texto }: { texto: string }) {
  const estilos = useEstilos(crearEstilos);
  const lineas = texto.split('\n').filter((linea) => linea.trim().length > 0);
  return (
    <View style={estilos.informe}>
      {lineas.map((linea, i) => (
        <Texto key={`${i}-${linea.slice(0, 12)}`} variante="cuerpo" style={estilos.lineaInforme}>
          {linea.trim()}
        </Texto>
      ))}
    </View>
  );
}

interface Props {
  hechos: HechosAnalisis;
}

/** Tarjeta de la IA local: invita a descargar el modelo, muestra la descarga y genera el informe. */
export function BloqueIA({ hechos }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { formatear, i18n } = useAjustes();
  const { alerta } = useDialogo();
  const { modelo, estado, informe, descargar, pausarDescarga, cancelarDescarga, eliminar, generarInforme, detener, reportar } =
    useIA();

  const { evaluacion, fase, progreso, error } = estado;
  const tamano = formatearTamano(modelo.tamanoBytes);

  const pedirDescarga = () => {
    const libre = evaluacion?.compatible ? evaluacion.discoLibreBytes : null;
    if (libre !== null && libre < modelo.tamanoBytes * MARGEN_DISCO) {
      alerta(
        i18n.t('ia.titulo'),
        i18n.t('ia.sin_espacio', { tamano, libre: formatearTamano(libre) }),
      );
      return;
    }
    alerta(
      i18n.t('ia.confirmar_titulo'),
      i18n.t('ia.confirmar_mensaje', { tamano, libre: libre === null ? '—' : formatearTamano(libre) }),
      [
        { text: i18n.t('comun.cancelar'), style: 'cancel' },
        { text: i18n.t('ia.confirmar_si'), onPress: () => void descargar() },
      ],
    );
  };

  const pedirEliminacion = () => {
    alerta(i18n.t('ajustes.ia_eliminar_titulo'), i18n.t('ajustes.ia_eliminar_desc', { tamano }), [
      { text: i18n.t('comun.cancelar'), style: 'cancel' },
      { text: i18n.t('comun.eliminar'), style: 'destructive', onPress: () => void eliminar() },
    ]);
  };

  const pedirInforme = () => {
    void generarInforme(construirPrompt(hechos, i18n.idioma, formatear));
  };

  const pedirReporte = () => {
    alerta(i18n.t('ia.reportar_titulo'), i18n.t('ia.reportar_mensaje'), [
      { text: i18n.t('comun.cancelar'), style: 'cancel' },
      {
        text: i18n.t('ia.reportar_enviar'),
        onPress: () => {
          if (CORREO_REPORTES) {
            const asunto = encodeURIComponent('Pocketant: respuesta de la IA');
            const cuerpo = encodeURIComponent(informe.texto);
            void Linking.openURL(`mailto:${CORREO_REPORTES}?subject=${asunto}&body=${cuerpo}`).catch(() => {});
          }
          reportar();
        },
      },
    ]);
  };

  const encabezado = (
    <View style={estilos.encabezado}>
      <View style={estilos.icono}>
        <Icono nombre="sparkles" tamano={20} color="primario" />
      </View>
      <Texto variante="subtitulo" style={estilos.titulo}>
        {i18n.t('ia.titulo')}
      </Texto>
    </View>
  );

  if (fase === 'desconocido') {
    return (
      <Marco clave="desconocido" encabezado={encabezado}>
        <ActivityIndicator accessibilityLabel={i18n.t('ia.cargando')} />
      </Marco>
    );
  }

  if (fase === 'no-compatible') {
    const motivo = evaluacion && !evaluacion.compatible ? evaluacion.motivo : 'generico';
    const ram = evaluacion?.ramBytes ?? null;
    return (
      <Marco clave="no-compatible" encabezado={encabezado}>
        <Texto variante="secundario">
          {motivo === 'ram' && ram !== null
            ? i18n.t('ia.no_compatible_ram', { ram: formatearRam(ram), minimo: RAM_MINIMA_ETIQUETA })
            : motivo === 'plataforma'
              ? i18n.t('ia.no_compatible_plataforma')
              : i18n.t('ia.no_compatible_generico')}
        </Texto>
      </Marco>
    );
  }

  if (fase === 'sin-descargar') {
    const ram = evaluacion?.ramBytes ?? null;
    const justa = evaluacion?.compatible ? evaluacion.ramJusta : false;
    return (
      <Marco clave="sin-descargar" encabezado={encabezado}>
        <Texto variante="secundario">{i18n.t('ia.privado')}</Texto>
        <Texto variante="secundario">{i18n.t('ia.descripcion_descarga', { tamano })}</Texto>
        <Texto variante="pequeno">{i18n.t('ia.modelo', { nombre: modelo.nombre })}</Texto>
        {ram !== null ? (
          <Texto variante="pequeno" color={justa ? 'gasto' : 'textoTenue'}>
            {i18n.t('ia.telefono', { ram: formatearRam(ram) })}
            {justa ? ` · ${i18n.t('ia.aviso_ram_justa')}` : ' ✓'}
          </Texto>
        ) : null}
        {error ? (
          <Texto variante="secundario" color="gasto">
            {i18n.t(error)}
          </Texto>
        ) : null}
        <Boton titulo={i18n.t('ia.descargar')} icono="download-outline" onPress={pedirDescarga} />
      </Marco>
    );
  }

  if (fase === 'verificando') {
    return (
      <Marco clave="verificando" encabezado={encabezado}>
        <View style={estilos.cargando}>
          <ActivityIndicator />
          <Texto variante="secundario" style={estilos.textoCargando}>
            {i18n.t('ia.verificando')}
          </Texto>
        </View>
      </Marco>
    );
  }

  if (fase === 'descargando' || fase === 'pausada') {
    const pausada = fase === 'pausada';
    const porcentaje = Math.round(progreso * 100);
    const titulo = i18n.t(pausada ? 'ia.pausada' : 'ia.descargando', { porcentaje });
    return (
      <Marco clave="descarga" encabezado={encabezado}>
        <Texto variante="cuerpo" negrita>
          {titulo}
        </Texto>
        <BarraProgreso fraccion={progreso} etiqueta={titulo} />
        <Texto variante="pequeno">
          {i18n.t('ia.descargando_detalle', {
            hecho: formatearTamano(modelo.tamanoBytes * progreso),
            total: tamano,
          })}
        </Texto>
        {error ? (
          <Texto variante="secundario" color="gasto">
            {i18n.t(error)}
          </Texto>
        ) : null}
        {/* Tras un corte el mensaje de error ya dice que lo descargado se conserva. */}
        {pausada && error ? null : (
          <Texto variante="pequeno">{i18n.t(pausada ? 'ia.pausada_aviso' : 'ia.aviso_reinicio')}</Texto>
        )}
        <View style={estilos.acciones}>
          {pausada ? (
            <Boton titulo={i18n.t('ia.continuar')} icono="play" estilo={estilos.accion} onPress={() => void descargar()} />
          ) : (
            <Boton titulo={i18n.t('ia.pausar')} icono="pause" variante="neutro" estilo={estilos.accion} onPress={() => void pausarDescarga()} />
          )}
          <Boton
            titulo={i18n.t(pausada ? 'ia.descartar_corto' : 'ia.cancelar_corto')}
            variante="peligro"
            estilo={estilos.accion}
            onPress={() => void cancelarDescarga()}
          />
        </View>
      </Marco>
    );
  }

  // `descargado`, `cargando` y `listo`: el modelo está en el teléfono y se puede pedir el informe.
  const generando = informe.estado === 'generando';
  const cargando = fase === 'cargando';
  const hayInforme = informe.estado === 'listo' && informe.texto.length > 0;
  const errorInforme = informe.estado === 'error' ? informe.error : (error ?? null);

  return (
    <Marco clave="modelo" encabezado={encabezado}>
      {informe.reportado ? (
        <Revelar>
          <Texto variante="secundario">{i18n.t('ia.reportar_gracias')}</Texto>
        </Revelar>
      ) : null}

      {cargando ? (
        <Revelar style={estilos.cargando}>
          <ActivityIndicator />
          <Texto variante="secundario" style={estilos.textoCargando}>
            {i18n.t('ia.cargando')}
          </Texto>
        </Revelar>
      ) : null}

      {generando && informe.texto.length === 0 && !cargando ? (
        <Revelar style={estilos.cargando}>
          <ActivityIndicator />
          <Texto variante="secundario" style={estilos.textoCargando}>
            {i18n.t('ia.generando')}
          </Texto>
        </Revelar>
      ) : null}

      {informe.texto.length > 0 ? (
        <Revelar>
          <TextoInforme texto={informe.texto} />
        </Revelar>
      ) : null}

      {errorInforme ? (
        <Revelar>
          <Texto variante="secundario" color="gasto">
            {i18n.t(errorInforme)}
          </Texto>
        </Revelar>
      ) : null}

      {generando ? (
        <Boton titulo={i18n.t('ia.detener')} variante="neutro" icono="stop-circle-outline" onPress={detener} />
      ) : (
        <Boton
          titulo={i18n.t(hayInforme ? 'ia.actualizar' : 'ia.generar')}
          icono={hayInforme ? 'refresh' : 'sparkles'}
          deshabilitado={!hechos.hayDatos || cargando}
          onPress={pedirInforme}
        />
      )}

      {!generando && !cargando ? (
        <Revelar>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.t('ia.eliminar_modelo')}
            accessibilityHint={i18n.t('ia.eliminar_liberar', { tamano })}
            onPress={pedirEliminacion}
            hitSlop={6}
            style={({ pressed }) => [estilos.eliminar, pressed && { opacity: 0.6 }]}
          >
            <Icono nombre="trash-outline" tamano={16} color="textoSecundario" />
            <Texto variante="secundario" color="textoSecundario">
              {i18n.t('ia.eliminar_modelo')} · {i18n.t('ia.eliminar_liberar', { tamano })}
            </Texto>
          </Pressable>
        </Revelar>
      ) : null}

      {hayInforme ? (
        <Revelar style={estilos.pie}>
          <Texto variante="pequeno" style={estilos.textoPie}>
            {i18n.t('ia.pie')}
          </Texto>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.t('ia.reportar')}
            onPress={pedirReporte}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Texto variante="pequeno" color="textoSecundario" style={estilos.reportar}>
              {i18n.t('ia.reportar')}
            </Texto>
          </Pressable>
        </Revelar>
      ) : null}
    </Marco>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    tarjeta: { gap: 12 },
    cuerpo: { gap: 12 },
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    icono: {
      width: 36,
      height: 36,
      borderRadius: radios.md,
      backgroundColor: c.superficieAlta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titulo: { flex: 1 },
    pista: { height: 10, borderRadius: radios.pildora, backgroundColor: c.superficieAlta, overflow: 'hidden' },
    // Sin hijos y fuera del flujo: animar su ancho no obliga a recalcular nada más.
    relleno: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radios.pildora, backgroundColor: c.primario },
    cargando: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    eliminar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
    acciones: { flexDirection: 'row', gap: 10 },
    accion: { flex: 1 },
    textoCargando: { flex: 1 },
    informe: { gap: 8 },
    lineaInforme: { lineHeight: 22 },
    pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    textoPie: { flex: 1 },
    reportar: { textDecorationLine: 'underline' },
  });
