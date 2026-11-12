import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { vibrar } from '@/animacion/haptica';
import { useAjustes } from '@/ajustes/AjustesProvider';
import { useAviso } from '@/componentes/AvisoProvider';
import { Boton } from '@/componentes/Boton';
import { Contador } from '@/componentes/Contador';
import { useDialogo } from '@/componentes/DialogoProvider';
import { Entrada } from '@/componentes/Entrada';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { FilaInterruptor } from '@/componentes/FilaInterruptor';
import { FlechaPeriodo } from '@/componentes/FlechaPeriodo';
import { Icono } from '@/componentes/Icono';
import { ImagenesMovimiento } from '@/componentes/ImagenesMovimiento';
import { ESCALA_ICONO, PresionableEscala } from '@/componentes/PresionableEscala';
import { Revelar } from '@/componentes/Revelar';
import { SelectorFecha } from '@/componentes/SelectorFecha';
import { SelectorOrigenFoto, type OrigenFoto } from '@/componentes/SelectorOrigenFoto';
import { SelectorSegmentado, type OpcionSegmento } from '@/componentes/SelectorSegmentado';
import { SugerenciasMotivo } from '@/componentes/SugerenciasMotivo';
import { Tarjeta } from '@/componentes/Tarjeta';
import { Texto } from '@/componentes/Texto';
import { useDatos } from '@/datos/DatosProvider';
import { esClaveValida, hoy, sumarDias } from '@/dominio/fechas';
import { limpiarEntradaMonto } from '@/dominio/formato';
import { MAX_IMAGENES, type ImagenBorrador } from '@/dominio/imagenes';
import {
  MAX_FRECUENCIA,
  MAX_MOTIVO,
  unidadRecurrencia,
  validarBorrador,
  type ErroresBorrador,
} from '@/dominio/movimiento';
import { sugerirMotivos, type SugerenciaMotivo } from '@/dominio/sugerencias';
import type { Movimiento, PeriodoRecurrencia, TipoMovimiento } from '@/dominio/tipos';
import { mensajeDeError } from '@/i18n/errores';
import { useHoy } from '@/hooks/useHoy';
import { useRelleno } from '@/hooks/useRelleno';
import { useNotificaciones } from '@/notificaciones/NotificacionesProvider';
import { estiloDeFuente } from '@/tema/fuentes';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

/** Lo que se copia de otro movimiento al duplicarlo (o al registrar un cobro recurrente). */
type Plantilla = Pick<Movimiento, 'tipo' | 'monto' | 'motivo'>;

interface PropsFormulario {
  /** Movimiento que se edita; sin él, se crea uno nuevo. */
  existente?: Movimiento;
  /** Al crear: datos de partida copiados de otro movimiento. Nunca trae fotos ni recurrencia. */
  plantilla?: Plantilla;
  /** Al crear: fecha de partida (`YYYY-MM-DD`); por defecto, hoy. */
  fechaInicial?: string;
  tipoInicial: TipoMovimiento;
}

function Formulario({ existente, plantilla, fechaInicial, tipoInicial }: PropsFormulario) {
  const router = useRouter();
  const estilos = useEstilos(crearEstilos);
  const relleno = useRelleno(true);
  const diaActual = useHoy();
  const { ajustes, colores, moneda, formatear, i18n } = useAjustes();
  const { alerta } = useDialogo();
  const { avisar } = useAviso();
  const { movimientos, guardarMovimiento, eliminarMovimiento, almacen } = useDatos();
  const { ofrecerAvisosDeCobros } = useNotificaciones();

  const [tipo, setTipo] = useState<TipoMovimiento>(existente?.tipo ?? plantilla?.tipo ?? tipoInicial);
  const color = tipo === 'ingreso' ? colores.ingreso : colores.gasto;
  const claveColor = tipo === 'ingreso' ? 'ingreso' : 'gasto';

  const [monto, setMonto] = useState(() => {
    const base = existente ?? plantilla;
    return base ? limpiarEntradaMonto(String(base.monto)) : '';
  });
  const [motivo, setMotivo] = useState(existente?.motivo ?? plantilla?.motivo ?? '');
  const [fecha, setFecha] = useState(() => existente?.fecha ?? fechaInicial ?? hoy());
  const [recurrente, setRecurrente] = useState(existente?.recurrente ?? false);
  const [periodo, setPeriodo] = useState<PeriodoRecurrencia>(existente?.periodo ?? 'mensual');
  const [frecuencia, setFrecuencia] = useState(existente?.frecuencia ?? 1);
  const [intentado, setIntentado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [imagenes, setImagenes] = useState<ImagenBorrador[]>(() => {
    const inicial = existente;
    if (!inicial?.imagenes) return [];
    return inicial.imagenes.map((imagen) => ({
      id: imagen.id,
      uri: almacen.uriDe(inicial.id, imagen),
      ancho: imagen.ancho,
      alto: imagen.alto,
      nueva: false,
    }));
  });

  const campoMotivo = useRef<TextInput>(null);
  // Guarda síncrona: el botón de la cabecera, el de abajo y «Listo» del teclado pueden llegar casi a la vez.
  const enCurso = useRef(false);

  // Al salir sin guardar se borran las fotos recién elegidas que aún viven en la caché.
  const imagenesRef = useRef(imagenes);
  const almacenRef = useRef(almacen);
  const guardadoRef = useRef(false);
  useEffect(() => {
    imagenesRef.current = imagenes;
    almacenRef.current = almacen;
  }, [imagenes, almacen]);
  useEffect(
    () => () => {
      if (guardadoRef.current) return;
      for (const imagen of imagenesRef.current) {
        if (imagen.nueva) almacenRef.current.borrarTemporal(imagen.uri);
      }
    },
    [],
  );

  const tipos: readonly OpcionSegmento<TipoMovimiento>[] = [
    { valor: 'ingreso', etiqueta: i18n.t('tipo.ingreso') },
    { valor: 'gasto', etiqueta: i18n.t('tipo.gasto') },
  ];
  const periodos: readonly OpcionSegmento<PeriodoRecurrencia>[] = [
    { valor: 'mensual', etiqueta: i18n.t('recurrencia.mensual') },
    { valor: 'anual', etiqueta: i18n.t('recurrencia.anual') },
  ];

  // Las sugerencias ayudan a crear; al editar, el motivo ya está escrito.
  const sugerencias = existente ? [] : sugerirMotivos(movimientos, tipo, motivo, diaActual);

  const { entrada, errores } = validarBorrador({ tipo, monto, motivo, fecha, recurrente, periodo, frecuencia });
  /** Texto del error de un campo; solo se muestra después de intentar guardar. */
  const error = (campo: keyof ErroresBorrador): string | undefined => {
    const detalle = intentado ? errores[campo] : undefined;
    return detalle ? i18n.t(detalle.clave, detalle.parametros) : undefined;
  };

  const titulo = i18n.t(
    existente
      ? tipo === 'ingreso'
        ? 'mov.titulo_editar_ingreso'
        : 'mov.titulo_editar_gasto'
      : tipo === 'ingreso'
        ? 'mov.titulo_agregar'
        : 'mov.titulo_quitar',
  );
  const textoGuardar = i18n.t(
    existente ? 'mov.guardar_cambios' : tipo === 'ingreso' ? 'mov.agregar_ingreso' : 'mov.registrar_gasto',
  );

  const elegirSugerencia = (sugerencia: SugerenciaMotivo) => {
    vibrar('seleccion');
    setMotivo(sugerencia.motivo);
    // El monto habitual solo rellena un campo vacío: nunca pisa lo que el usuario ya escribió.
    if (monto === '') setMonto(limpiarEntradaMonto(String(sugerencia.monto)));
  };

  const quitarImagen = (id: string) => {
    const imagen = imagenes.find((actual) => actual.id === id);
    if (imagen?.nueva) almacen.borrarTemporal(imagen.uri);
    setImagenes((actual) => actual.filter((otra) => otra.id !== id));
  };

  const agregarImagenes = async (origen: OrigenFoto) => {
    setOcupado(true);
    try {
      const nuevas =
        origen === 'galeria'
          ? await almacen.elegirDeGaleria(MAX_IMAGENES - imagenes.length)
          : [await almacen.tomarFoto()].filter((imagen): imagen is ImagenBorrador => imagen !== null);
      if (nuevas.length > 0) setImagenes((actual) => [...actual, ...nuevas].slice(0, MAX_IMAGENES));
    } catch (fallo) {
      alerta(i18n.t('mov.imagenes'), mensajeDeError(fallo, i18n));
    } finally {
      setOcupado(false);
    }
  };

  const elegirFuenteDeImagen = () => {
    if (imagenes.length >= MAX_IMAGENES) return;
    setSelectorAbierto(true);
  };

  const guardar = async () => {
    if (enCurso.current) return;
    setIntentado(true);
    if (!entrada) {
      vibrar('error');
      return;
    }
    enCurso.current = true;
    setOcupado(true);
    try {
      const id = await guardarMovimiento(entrada, existente?.id, imagenes);
      guardadoRef.current = true;
      router.back();
      vibrar('exito');
      const montoConSigno = formatear(entrada.tipo === 'ingreso' ? entrada.monto : -entrada.monto, { conSigno: true });
      avisar({
        tono: 'exito',
        titulo: existente
          ? i18n.t('mov.guardado_cambios')
          : i18n.t(entrada.tipo === 'ingreso' ? 'mov.guardado_ingreso' : 'mov.guardado_gasto', { monto: montoConSigno }),
        accion: existente
          ? undefined
          : {
              titulo: i18n.t('comun.editar'),
              onPress: () => router.push({ pathname: '/movimiento', params: { id } }),
            },
      });
      // Un gasto recurrente es el momento en que un aviso antes del cobro tiene sentido: ahí se ofrece el permiso.
      if (entrada.recurrente && entrada.tipo === 'gasto') ofrecerAvisosDeCobros();
    } catch (fallo) {
      enCurso.current = false;
      setOcupado(false);
      alerta(i18n.t('mov.error_guardar'), mensajeDeError(fallo, i18n));
    }
  };

  const duplicar = () => {
    if (!existente) return;
    // Lo que se copia es lo guardado, no lo que se esté editando ahora.
    router.replace({ pathname: '/movimiento', params: { desde: existente.id } });
  };

  const confirmarEliminacion = () => {
    if (!existente) return;
    alerta(
      i18n.t('mov.eliminar_titulo'),
      i18n.t('mov.eliminar_mensaje', { motivo: existente.motivo }),
      [
        { text: i18n.t('comun.cancelar'), style: 'cancel' },
        {
          text: i18n.t('comun.eliminar'),
          style: 'destructive',
          onPress: async () => {
            setOcupado(true);
            try {
              await eliminarMovimiento(existente.id);
              router.back();
              vibrar('aviso');
              avisar({ tono: 'exito', titulo: i18n.t('mov.eliminado') });
            } catch (fallo) {
              setOcupado(false);
              alerta(i18n.t('mov.error_eliminar'), mensajeDeError(fallo, i18n));
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: titulo,
          // Siempre a la vista, también con el teclado abierto tapando los botones de abajo.
          headerRight: () => (
            <PresionableEscala
              accessibilityRole="button"
              accessibilityLabel={textoGuardar}
              accessibilityState={{ disabled: ocupado }}
              disabled={ocupado}
              onPress={() => void guardar()}
              hitSlop={8}
              escala={ESCALA_ICONO}
              testID="guardar-cabecera"
              style={[estilos.botonCabecera, ocupado && estilos.inactivo]}
            >
              <Icono nombre="checkmark" tamano={24} color={claveColor} />
            </PresionableEscala>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[estilos.contenido, relleno]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Entrada indice={0}>
          <SelectorSegmentado
            opciones={tipos}
            valor={tipo}
            onCambio={setTipo}
            etiquetaAccesible={i18n.t('mov.tipo_accesible')}
          />
        </Entrada>

        <Entrada indice={1}>
          <Tarjeta style={estilos.tarjetaMonto}>
            <Texto variante="etiqueta">{i18n.t('mov.monto')}</Texto>
            <View style={estilos.filaMonto}>
              <Texto variante="subtitulo" style={{ color }}>
                {moneda.simbolo}
              </Texto>
              <TextInput
                value={monto}
                onChangeText={(texto) => setMonto(limpiarEntradaMonto(texto))}
                placeholder="0.00"
                placeholderTextColor={colores.textoTenue}
                keyboardType="decimal-pad"
                inputMode="decimal"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => campoMotivo.current?.focus()}
                autoFocus={!existente}
                selectTextOnFocus
                maxLength={12}
                accessibilityLabel={i18n.t('mov.monto')}
                style={[estilos.campoMonto, estiloDeFuente(ajustes.fuente, 'negrita'), { color }]}
              />
            </View>
            {error('monto') ? <Texto variante="pequeno" color="gasto">{error('monto')}</Texto> : null}
          </Tarjeta>
        </Entrada>

        <Entrada indice={2}>
          <Tarjeta style={estilos.grupo}>
            <View style={estilos.campo}>
              <Texto variante="etiqueta">{i18n.t('mov.motivo')}</Texto>
              <TextInput
                ref={campoMotivo}
                value={motivo}
                onChangeText={setMotivo}
                placeholder={i18n.t(tipo === 'ingreso' ? 'mov.motivo_ejemplo_ingreso' : 'mov.motivo_ejemplo_gasto')}
                placeholderTextColor={colores.textoTenue}
                maxLength={MAX_MOTIVO}
                returnKeyType="done"
                onSubmitEditing={() => void guardar()}
                accessibilityLabel={i18n.t('mov.motivo')}
                style={[estilos.campoTexto, estiloDeFuente(ajustes.fuente)]}
              />
              {error('motivo') ? <Texto variante="pequeno" color="gasto">{error('motivo')}</Texto> : null}
              <SugerenciasMotivo sugerencias={sugerencias} onElegir={elegirSugerencia} />
            </View>

            <View style={estilos.separador} />

            <View style={estilos.campo}>
              <Texto variante="etiqueta">{i18n.t(recurrente ? 'mov.fecha_cobro' : 'mov.fecha')}</Texto>
              <View style={estilos.filaFecha}>
                <FlechaPeriodo
                  sentido="atras"
                  habilitada
                  onPress={() => setFecha((actual) => sumarDias(actual, -1))}
                  etiqueta={i18n.t('mov.dia_anterior')}
                />
                <SelectorFecha fecha={fecha} onCambio={setFecha} />
                <FlechaPeriodo
                  sentido="adelante"
                  habilitada
                  onPress={() => setFecha((actual) => sumarDias(actual, 1))}
                  etiqueta={i18n.t('mov.dia_siguiente')}
                />
              </View>
            </View>
            {error('fecha') ? <Texto variante="pequeno" color="gasto">{error('fecha')}</Texto> : null}
          </Tarjeta>
        </Entrada>

        <Entrada indice={3} deslizar>
          <Tarjeta deslizar style={estilos.grupo}>
            <FilaInterruptor
              titulo={i18n.t(tipo === 'ingreso' ? 'mov.recurrente_ingreso' : 'mov.recurrente_gasto')}
              descripcion={i18n.t('mov.recurrente_desc')}
              valor={recurrente}
              onCambio={setRecurrente}
              colorActivo={color}
            />

            {recurrente ? (
              <Revelar style={estilos.recurrencia}>
                <SelectorSegmentado
                  opciones={periodos}
                  valor={periodo}
                  onCambio={setPeriodo}
                  etiquetaAccesible={i18n.t('mov.periodo_accesible')}
                />
                <View style={estilos.filaEntre}>
                  <Texto variante="cuerpo">{i18n.t('mov.se_cobra_cada')}</Texto>
                  <Contador
                    valor={frecuencia}
                    min={1}
                    max={MAX_FRECUENCIA}
                    onCambio={setFrecuencia}
                    sufijo={unidadRecurrencia(periodo, frecuencia, i18n)}
                    etiquetaMenos={i18n.t('mov.disminuir')}
                    etiquetaMas={i18n.t('mov.aumentar')}
                  />
                </View>
                {error('frecuencia') ? (
                  <Texto variante="pequeno" color="gasto">{error('frecuencia')}</Texto>
                ) : null}
              </Revelar>
            ) : null}
          </Tarjeta>
        </Entrada>

        <Entrada indice={4} deslizar>
          <Tarjeta deslizar style={estilos.grupo}>
            <ImagenesMovimiento
              imagenes={imagenes}
              onAgregar={elegirFuenteDeImagen}
              onQuitar={quitarImagen}
              color={claveColor}
            />
          </Tarjeta>
        </Entrada>

        <Entrada indice={5} style={estilos.acciones}>
          <Boton
            titulo={textoGuardar}
            variante={claveColor}
            icono="checkmark"
            onPress={() => void guardar()}
            deshabilitado={ocupado}
          />
          {existente ? (
            <>
              <Boton
                titulo={i18n.t('mov.duplicar')}
                variante="neutro"
                icono="copy-outline"
                onPress={duplicar}
                deshabilitado={ocupado}
              />
              <Boton
                titulo={i18n.t('comun.eliminar')}
                variante="peligro"
                icono="trash-outline"
                onPress={confirmarEliminacion}
                deshabilitado={ocupado}
              />
            </>
          ) : null}
        </Entrada>
      </ScrollView>
      <SelectorOrigenFoto
        visible={selectorAbierto}
        color={claveColor}
        onCerrar={() => setSelectorAbierto(false)}
        onElegir={(origen) => {
          setSelectorAbierto(false);
          void agregarImagenes(origen);
        }}
      />
    </KeyboardAvoidingView>
  );
}

export default function PantallaMovimiento() {
  const router = useRouter();
  const { tipo, id, desde, fecha } = useLocalSearchParams<{
    tipo?: string;
    id?: string;
    /** Id de un movimiento a copiar (duplicar o registrar un cobro recurrente). */
    desde?: string;
    /** Fecha de partida al crear, `YYYY-MM-DD`. */
    fecha?: string;
  }>();
  const { movimientos } = useDatos();
  const { i18n } = useAjustes();
  const estilos = useEstilos(crearEstilos);

  const existente = id ? movimientos.find((m) => m.id === id) : undefined;
  if (id && !existente) {
    return (
      <View style={[estilos.pantalla, estilos.centrado]}>
        <EstadoVacio
          icono="alert-circle-outline"
          titulo={i18n.t('mov.inexistente_titulo')}
          descripcion={i18n.t('mov.inexistente_desc')}
        />
        <Boton titulo={i18n.t('comun.volver')} variante="neutro" onPress={() => router.back()} />
      </View>
    );
  }

  // Si el original ya no está, se crea uno en blanco: no hay nada que copiar, pero tampoco nada roto.
  const origen = !existente && desde ? movimientos.find((m) => m.id === desde) : undefined;
  const plantilla: Plantilla | undefined = origen
    ? { tipo: origen.tipo, monto: origen.monto, motivo: origen.motivo }
    : undefined;

  return (
    <Formulario
      existente={existente}
      plantilla={plantilla}
      fechaInicial={!existente && esClaveValida(fecha) ? fecha : undefined}
      tipoInicial={tipo === 'gasto' ? 'gasto' : 'ingreso'}
    />
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    pantalla: { flex: 1, backgroundColor: c.fondo },
    centrado: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
    contenido: { gap: 16 },
    tarjetaMonto: { gap: 6 },
    filaMonto: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    campoMonto: {
      flex: 1,
      fontSize: 38,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
      paddingVertical: 4,
    },
    grupo: { gap: 14 },
    campo: { gap: 6 },
    campoTexto: {
      fontSize: 16,
      color: c.texto,
      backgroundColor: c.superficieAlta,
      borderRadius: radios.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    separador: { height: StyleSheet.hairlineWidth, backgroundColor: c.borde },
    filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    filaFecha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    recurrencia: { gap: 14 },
    acciones: { gap: 12 },
    botonCabecera: {
      width: 40,
      height: 40,
      borderRadius: radios.pildora,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inactivo: { opacity: 0.45 },
  });
