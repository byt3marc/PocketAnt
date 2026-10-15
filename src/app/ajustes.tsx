import { useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DESLIZAR } from '@/animacion/constantes';
import { useAjustes } from '@/ajustes/AjustesProvider';
import type { PreferenciaTema } from '@/ajustes/normalizar';
import { BloqueDrive } from '@/componentes/BloqueDrive';
import { Contador } from '@/componentes/Contador';
import { useDialogo } from '@/componentes/DialogoProvider';
import { Entrada } from '@/componentes/Entrada';
import { FilaAjuste } from '@/componentes/FilaAjuste';
import { FilaInterruptor } from '@/componentes/FilaInterruptor';
import { Revelar } from '@/componentes/Revelar';
import { SelectorFuente } from '@/componentes/SelectorFuente';
import { SelectorSegmentado, type OpcionSegmento } from '@/componentes/SelectorSegmentado';
import { Tarjeta } from '@/componentes/Tarjeta';
import { Texto } from '@/componentes/Texto';
import { useDatos } from '@/datos/DatosProvider';
import { formatearHora } from '@/dominio/fechas';
import { formatearTamano } from '@/dominio/formato';
import { useIA, type EstadoIA } from '@/ia/IAProvider';
import type { ResultadoImportacion } from '@/datos/sincronizacion/servicio';
import { MAX_DIAS_ANTES, OPCIONES_INTERVALO_HORAS } from '@/dominio/ajustesNotificaciones';
import { MONEDA_AUTOMATICA } from '@/dominio/moneda';
import { useRelleno } from '@/hooks/useRelleno';
import { mensajeDeError } from '@/i18n/errores';
import type { I18n, PreferenciaIdioma } from '@/i18n/traducir';
import { NOMBRE_APP } from '@/marca';
import { useNotificaciones } from '@/notificaciones/NotificacionesProvider';
import type { Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

function resumirImportacion(r: ResultadoImportacion, i18n: I18n): string {
  const lineas = [
    r.nuevos > 0 && i18n.plural('importar.nuevos', r.nuevos),
    r.actualizados > 0 && i18n.plural('importar.actualizados', r.actualizados),
    r.eliminados > 0 && i18n.plural('importar.eliminados', r.eliminados),
    r.sinCambios > 0 && i18n.t('importar.sin_cambios', { n: r.sinCambios }),
    r.descartados > 0 && i18n.plural('importar.descartados', r.descartados),
  ].filter(Boolean);
  return lineas.length > 0 ? lineas.join('\n') : i18n.t('ajustes.importacion_vacia');
}

/** Lo que se ve a la derecha de la fila de la IA: el estado del modelo en pocas palabras. */
function textoEstadoIA(estado: EstadoIA, tamanoBytes: number, i18n: I18n): string {
  const porcentaje = Math.round(estado.progreso * 100);
  switch (estado.fase) {
    case 'no-compatible':
      return i18n.t('ajustes.ia_estado_no_compatible');
    case 'sin-descargar':
      return i18n.t('ajustes.ia_estado_sin');
    case 'descargando':
    case 'verificando':
      return i18n.t('ajustes.ia_estado_descargando', { porcentaje });
    case 'pausada':
      return i18n.t('ajustes.ia_estado_pausada', { porcentaje });
    default:
      return i18n.t('ajustes.ia_estado_descargado', { tamano: formatearTamano(tamanoBytes) });
  }
}

/**
 * Una sección de Ajustes. Entra al abrir la pantalla (`indice` = su turno en la cascada) y, si por dentro aparece o
 * desaparece algo (p. ej. las horas del recordatorio), su alto cambia con animación y las de abajo se deslizan.
 */
function Seccion({ titulo, indice, children }: { titulo: string; indice: number; children: ReactNode }) {
  const estilos = useEstilos(crearEstilos);
  return (
    <Entrada indice={indice} deslizar style={estilos.seccion}>
      <Texto variante="etiqueta" style={estilos.tituloSeccion}>
        {titulo}
      </Texto>
      <Tarjeta deslizar style={estilos.tarjeta}>
        {children}
      </Tarjeta>
    </Entrada>
  );
}

/** La línea fina entre filas: se desliza con lo demás cuando algo de arriba cambia de alto. */
function Separador() {
  const estilos = useEstilos(crearEstilos);
  return <Animated.View layout={DESLIZAR} style={estilos.separador} />;
}

/** Un bloque de la tarjeta cuyo alto cambia (aparecen o desaparecen controles dentro): lo de debajo se desliza. */
function Bloque({ children }: { children: ReactNode }) {
  const estilos = useEstilos(crearEstilos);
  return (
    <Animated.View layout={DESLIZAR} style={estilos.bloque}>
      {children}
    </Animated.View>
  );
}

export default function Ajustes() {
  const router = useRouter();
  const estilos = useEstilos(crearEstilos);
  const relleno = useRelleno(true);
  const { ajustes, moneda, cambiarTema, cambiarIdioma, cambiarNotificaciones, i18n } = useAjustes();
  const { exportar, importar, movimientos, limpiarDatos } = useDatos();
  const { permiso, pedirPermiso, pedirPermisoSiHaceFalta, abrirAjustesDelSistema } = useNotificaciones();
  const ia = useIA();
  const { alerta } = useDialogo();
  const alEntrar = useEffectEvent(() => void ia.refrescar());
  useEffect(() => {
    alEntrar();
  }, []);
  const [ocupado, setOcupado] = useState<'exportar' | 'importar' | 'borrar' | null>(null);
  const notif = ajustes.notificaciones;

  const intervalos: readonly OpcionSegmento<string>[] = OPCIONES_INTERVALO_HORAS.map((horas) => ({
    valor: String(horas),
    etiqueta: i18n.t('ajustes.notif_hora_abrev', { n: horas }),
  }));
  const formatoHora = (hora: number) => formatearHora(hora);
  const formatoAntelacion = (dias: number) =>
    dias === 0 ? i18n.t('ajustes.notif_antelacion_hoy') : i18n.plural('ajustes.notif_antelacion', dias);

  const temas: readonly OpcionSegmento<PreferenciaTema>[] = [
    { valor: 'sistema', etiqueta: i18n.t('tema.dispositivo') },
    { valor: 'claro', etiqueta: i18n.t('tema.claro') },
    { valor: 'oscuro', etiqueta: i18n.t('tema.oscuro') },
  ];
  const idiomas: readonly OpcionSegmento<PreferenciaIdioma>[] = [
    { valor: 'sistema', etiqueta: i18n.t('idioma.sistema') },
    { valor: 'es', etiqueta: i18n.t('idioma.es') },
    { valor: 'en', etiqueta: i18n.t('idioma.en') },
  ];

  const alExportar = async () => {
    setOcupado('exportar');
    try {
      await exportar();
    } catch (error) {
      alerta(i18n.t('ajustes.error_exportar'), mensajeDeError(error, i18n));
    } finally {
      setOcupado(null);
    }
  };

  const alImportar = async () => {
    setOcupado('importar');
    try {
      const resultado = await importar();
      if (resultado) {
        alerta(i18n.t('ajustes.importacion_completa'), resumirImportacion(resultado, i18n));
      }
    } catch (error) {
      alerta(i18n.t('ajustes.error_importar'), mensajeDeError(error, i18n));
    } finally {
      setOcupado(null);
    }
  };

  const alConfirmarBorrar = async () => {
    setOcupado('borrar');
    try {
      await limpiarDatos();
    } catch (error) {
      alerta(i18n.t('ajustes.error_borrar'), mensajeDeError(error, i18n));
    } finally {
      setOcupado(null);
    }
  };

  const alBorrar = () =>
    alerta(
      i18n.t('ajustes.borrar_titulo'),
      i18n.plural('ajustes.borrar_mensaje', movimientos.length),
      [
        { text: i18n.t('comun.cancelar'), style: 'cancel' },
        { text: i18n.t('comun.eliminar'), style: 'destructive', onPress: () => void alConfirmarBorrar() },
      ],
    );

  const valorMoneda =
    ajustes.moneda === MONEDA_AUTOMATICA
      ? i18n.t('ajustes.moneda_auto', { simbolo: moneda.simbolo })
      : `${moneda.codigo} · ${moneda.simbolo}`;

  return (
    <ScrollView contentContainerStyle={[estilos.contenido, relleno]} showsVerticalScrollIndicator={false}>
      <Seccion indice={0} titulo={i18n.t('ajustes.apariencia')}>
        <View style={estilos.bloque}>
          <Texto variante="cuerpo" negrita>
            {i18n.t('ajustes.tema')}
          </Texto>
          <SelectorSegmentado
            opciones={temas}
            valor={ajustes.tema}
            onCambio={cambiarTema}
            etiquetaAccesible={i18n.t('ajustes.tema_accesible')}
          />
          <Texto variante="pequeno">{i18n.t('ajustes.tema_ayuda')}</Texto>
        </View>
        <Separador />
        <View style={estilos.bloque}>
          <Texto variante="cuerpo" negrita>
            {i18n.t('ajustes.idioma')}
          </Texto>
          <SelectorSegmentado
            opciones={idiomas}
            valor={ajustes.idioma}
            onCambio={cambiarIdioma}
            etiquetaAccesible={i18n.t('ajustes.idioma_accesible')}
          />
          <Texto variante="pequeno">{i18n.t('ajustes.idioma_ayuda')}</Texto>
        </View>
        <Separador />
        <View style={estilos.bloque}>
          <Texto variante="cuerpo" negrita>
            {i18n.t('ajustes.fuente')}
          </Texto>
          <SelectorFuente />
          <Texto variante="pequeno">{i18n.t('ajustes.fuente_ayuda')}</Texto>
        </View>
        <Separador />
        <FilaAjuste
          icono="cash-outline"
          titulo={i18n.t('ajustes.moneda')}
          descripcion={i18n.t('ajustes.moneda_desc')}
          valor={valorMoneda}
          onPress={() => router.push('/moneda')}
        />
      </Seccion>

      <Seccion indice={1} titulo={i18n.t('ajustes.notif_seccion')}>
        {permiso === 'denegado' ? (
          <Revelar>
            <FilaAjuste
              icono="notifications-off-outline"
              titulo={i18n.t('ajustes.notif_denegado_titulo')}
              descripcion={i18n.t('ajustes.notif_denegado_desc')}
              onPress={abrirAjustesDelSistema}
            />
            <Separador />
          </Revelar>
        ) : permiso === 'pendiente' ? (
          <Revelar>
            <FilaAjuste
              icono="notifications-outline"
              titulo={i18n.t('ajustes.notif_pendiente_titulo')}
              descripcion={i18n.t('ajustes.notif_pendiente_desc')}
              onPress={pedirPermiso}
            />
            <Separador />
          </Revelar>
        ) : null}

        <Bloque>
          <FilaInterruptor
            titulo={i18n.t('ajustes.notif_recordatorio')}
            descripcion={i18n.t('ajustes.notif_recordatorio_desc')}
            valor={notif.recordatorio.activo}
            onCambio={(activo) => {
              cambiarNotificaciones({ recordatorio: { activo } });
              if (activo) void pedirPermisoSiHaceFalta();
            }}
          />
          {notif.recordatorio.activo ? (
            <Revelar style={estilos.detalle}>
              <Texto variante="etiqueta">{i18n.t('ajustes.notif_cada')}</Texto>
              <SelectorSegmentado
                opciones={intervalos}
                valor={String(notif.recordatorio.cadaHoras)}
                onCambio={(valor) => cambiarNotificaciones({ recordatorio: { cadaHoras: Number(valor) } })}
                etiquetaAccesible={i18n.t('ajustes.notif_cada_accesible')}
              />
              <View style={estilos.filaEntre}>
                <Texto variante="cuerpo">{i18n.t('ajustes.notif_desde')}</Texto>
                <Contador
                  valor={notif.recordatorio.desde}
                  min={0}
                  max={notif.recordatorio.hasta}
                  onCambio={(desde) => cambiarNotificaciones({ recordatorio: { desde } })}
                  formato={formatoHora}
                  anchoValor={56}
                  etiquetaMenos={i18n.t('mov.disminuir')}
                  etiquetaMas={i18n.t('mov.aumentar')}
                />
              </View>
              <View style={estilos.filaEntre}>
                <Texto variante="cuerpo">{i18n.t('ajustes.notif_hasta')}</Texto>
                <Contador
                  valor={notif.recordatorio.hasta}
                  min={notif.recordatorio.desde}
                  max={23}
                  onCambio={(hasta) => cambiarNotificaciones({ recordatorio: { hasta } })}
                  formato={formatoHora}
                  anchoValor={56}
                  etiquetaMenos={i18n.t('mov.disminuir')}
                  etiquetaMas={i18n.t('mov.aumentar')}
                />
              </View>
              <Texto variante="pequeno">{i18n.t('ajustes.notif_horario_ayuda')}</Texto>
            </Revelar>
          ) : null}
        </Bloque>
        <Separador />
        <Bloque>
          <FilaInterruptor
            titulo={i18n.t('ajustes.notif_cobros')}
            descripcion={i18n.t('ajustes.notif_cobros_desc')}
            valor={notif.cobros.activo}
            onCambio={(activo) => {
              cambiarNotificaciones({ cobros: { activo } });
              if (activo) void pedirPermisoSiHaceFalta();
            }}
          />
          {notif.cobros.activo ? (
            <Revelar style={estilos.filaEntre}>
              <Texto variante="cuerpo">{i18n.t('ajustes.notif_dias_antes')}</Texto>
              <Contador
                valor={notif.cobros.diasAntes}
                min={0}
                max={MAX_DIAS_ANTES}
                onCambio={(diasAntes) => cambiarNotificaciones({ cobros: { diasAntes } })}
                formato={formatoAntelacion}
                anchoValor={112}
                etiquetaMenos={i18n.t('mov.disminuir')}
                etiquetaMas={i18n.t('mov.aumentar')}
              />
            </Revelar>
          ) : null}
        </Bloque>
      </Seccion>

      {ia.estado.fase !== 'desconocido' ? (
        <Seccion indice={2} titulo={i18n.t('ajustes.ia_seccion')}>
          <FilaAjuste
            icono="sparkles-outline"
            titulo={i18n.t('nav.analisis')}
            descripcion={i18n.t('ajustes.ia_desc', { nombre: ia.modelo.nombre })}
            valor={textoEstadoIA(ia.estado, ia.modelo.tamanoBytes, i18n)}
            onPress={() => router.push('/analisis')}
          />
          {ia.estado.fase === 'pausada' ? (
            <Revelar>
              <Separador />
              <FilaAjuste
                icono="trash-outline"
                titulo={i18n.t('ia.descartar')}
                descripcion={i18n.t('ajustes.ia_descartar_desc')}
                onPress={() => void ia.cancelarDescarga()}
              />
            </Revelar>
          ) : null}
          {ia.estado.fase === 'descargado' || ia.estado.fase === 'listo' || ia.estado.fase === 'cargando' ? (
            <Revelar>
              <Separador />
              <FilaAjuste
                icono="trash-outline"
                titulo={i18n.t('ajustes.ia_eliminar')}
                descripcion={i18n.t('ajustes.ia_eliminar_desc', { tamano: formatearTamano(ia.modelo.tamanoBytes) })}
                onPress={() =>
                  alerta(
                    i18n.t('ajustes.ia_eliminar_titulo'),
                    i18n.t('ajustes.ia_eliminar_desc', { tamano: formatearTamano(ia.modelo.tamanoBytes) }),
                    [
                      { text: i18n.t('comun.cancelar'), style: 'cancel' },
                      { text: i18n.t('comun.eliminar'), style: 'destructive', onPress: () => void ia.eliminar() },
                    ],
                  )
                }
              />
            </Revelar>
          ) : null}
        </Seccion>
      ) : null}

      <Seccion indice={3} titulo={i18n.t('ajustes.datos')}>
        <FilaAjuste
          icono="share-outline"
          titulo={i18n.t('ajustes.exportar')}
          descripcion={i18n.t('ajustes.exportar_desc')}
          onPress={alExportar}
          cargando={ocupado === 'exportar'}
          deshabilitada={ocupado !== null && ocupado !== 'exportar'}
        />
        <Separador />
        <FilaAjuste
          icono="download-outline"
          titulo={i18n.t('ajustes.importar')}
          descripcion={i18n.t('ajustes.importar_desc')}
          onPress={alImportar}
          cargando={ocupado === 'importar'}
          deshabilitada={ocupado !== null && ocupado !== 'importar'}
        />
        <Separador />
        <FilaAjuste
          icono="trash-outline"
          titulo={i18n.t('ajustes.borrar')}
          descripcion={i18n.t('ajustes.borrar_desc')}
          peligro
          onPress={alBorrar}
          cargando={ocupado === 'borrar'}
          deshabilitada={ocupado !== null && ocupado !== 'borrar'}
        />
        <BloqueDrive />
      </Seccion>

      <Seccion indice={4} titulo={i18n.t('ajustes.acerca')}>
        <View style={estilos.bloque}>
          <Texto variante="cuerpo" negrita>{NOMBRE_APP}</Texto>
          <Texto variante="pequeno">{i18n.t('ajustes.acerca_desc')}</Texto>
          <Texto variante="pequeno">{i18n.t('ajustes.acerca_licencias')}</Texto>
        </View>
        <Separador />
        <FilaAjuste
          icono="shield-checkmark-outline"
          titulo={i18n.t('ajustes.privacidad')}
          descripcion={i18n.t('ajustes.privacidad_desc')}
          onPress={() => router.push('/privacidad')}
        />
      </Seccion>
    </ScrollView>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    contenido: { gap: 20 },
    seccion: { gap: 8 },
    tituloSeccion: { marginLeft: 4 },
    tarjeta: { paddingVertical: 4, paddingHorizontal: 12 },
    bloque: { gap: 10, paddingVertical: 12, paddingHorizontal: 4 },
    detalle: { gap: 10 },
    filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    separador: { height: StyleSheet.hairlineWidth, backgroundColor: c.borde },
  });
