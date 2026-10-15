import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { Boton } from '@/componentes/Boton';
import { Contador } from '@/componentes/Contador';
import { useDialogo } from '@/componentes/DialogoProvider';
import { Entrada } from '@/componentes/Entrada';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { FilaInterruptor } from '@/componentes/FilaInterruptor';
import { Revelar } from '@/componentes/Revelar';
import { SelectorFecha } from '@/componentes/SelectorFecha';
import { SelectorSegmentado, type OpcionSegmento } from '@/componentes/SelectorSegmentado';
import { Tarjeta } from '@/componentes/Tarjeta';
import { Texto } from '@/componentes/Texto';
import { useDatos } from '@/datos/DatosProvider';
import { hoy } from '@/dominio/fechas';
import { limpiarEntradaMonto } from '@/dominio/formato';
import {
  MAX_FRECUENCIA,
  MAX_MOTIVO,
  unidadRecurrencia,
  validarBorrador,
  type ErroresBorrador,
} from '@/dominio/movimiento';
import type { Movimiento, PeriodoRecurrencia, TipoMovimiento } from '@/dominio/tipos';
import { mensajeDeError } from '@/i18n/errores';
import { useRelleno } from '@/hooks/useRelleno';
import { estiloDeFuente } from '@/tema/fuentes';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

function Formulario({ existente, tipoInicial }: { existente?: Movimiento; tipoInicial: TipoMovimiento }) {
  const router = useRouter();
  const estilos = useEstilos(crearEstilos);
  const relleno = useRelleno(true);
  const { ajustes, colores, moneda, i18n } = useAjustes();
  const { alerta } = useDialogo();
  const { guardarMovimiento, eliminarMovimiento } = useDatos();

  const tipo = existente?.tipo ?? tipoInicial;
  const color = tipo === 'ingreso' ? colores.ingreso : colores.gasto;

  const [monto, setMonto] = useState(existente ? String(existente.monto) : '');
  const [motivo, setMotivo] = useState(existente?.motivo ?? '');
  const [fecha, setFecha] = useState(() => existente?.fecha ?? hoy());
  const [recurrente, setRecurrente] = useState(existente?.recurrente ?? false);
  const [periodo, setPeriodo] = useState<PeriodoRecurrencia>(existente?.periodo ?? 'mensual');
  const [frecuencia, setFrecuencia] = useState(existente?.frecuencia ?? 1);
  const [intentado, setIntentado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const periodos: readonly OpcionSegmento<PeriodoRecurrencia>[] = [
    { valor: 'mensual', etiqueta: i18n.t('recurrencia.mensual') },
    { valor: 'anual', etiqueta: i18n.t('recurrencia.anual') },
  ];

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

  const guardar = async () => {
    setIntentado(true);
    if (!entrada) return;
    setOcupado(true);
    try {
      await guardarMovimiento(entrada, existente?.id);
      router.back();
    } catch (fallo) {
      setOcupado(false);
      alerta(i18n.t('mov.error_guardar'), mensajeDeError(fallo, i18n));
    }
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
      <Stack.Screen options={{ title: titulo }} />
      <ScrollView
        contentContainerStyle={[estilos.contenido, relleno]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Entrada indice={0}>
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

        <Entrada indice={1}>
          <Tarjeta style={estilos.grupo}>
            <View style={estilos.campo}>
              <Texto variante="etiqueta">{i18n.t('mov.motivo')}</Texto>
              <TextInput
                value={motivo}
                onChangeText={setMotivo}
                placeholder={i18n.t(tipo === 'ingreso' ? 'mov.motivo_ejemplo_ingreso' : 'mov.motivo_ejemplo_gasto')}
                placeholderTextColor={colores.textoTenue}
                maxLength={MAX_MOTIVO}
                returnKeyType="done"
                accessibilityLabel={i18n.t('mov.motivo')}
                style={[estilos.campoTexto, estiloDeFuente(ajustes.fuente)]}
              />
              {error('motivo') ? <Texto variante="pequeno" color="gasto">{error('motivo')}</Texto> : null}
            </View>

            <View style={estilos.separador} />

            <View style={estilos.filaEntre}>
              <Texto variante="etiqueta">{i18n.t(recurrente ? 'mov.fecha_cobro' : 'mov.fecha')}</Texto>
              <SelectorFecha fecha={fecha} onCambio={setFecha} />
            </View>
            {error('fecha') ? <Texto variante="pequeno" color="gasto">{error('fecha')}</Texto> : null}
          </Tarjeta>
        </Entrada>

        <Entrada indice={2} deslizar>
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

        <Entrada indice={3} style={estilos.acciones}>
          <Boton
            titulo={i18n.t(
              existente ? 'mov.guardar_cambios' : tipo === 'ingreso' ? 'mov.agregar_ingreso' : 'mov.registrar_gasto',
            )}
            variante={tipo === 'ingreso' ? 'ingreso' : 'gasto'}
            icono="checkmark"
            onPress={guardar}
            deshabilitado={ocupado}
          />
          {existente ? (
            <Boton
              titulo={i18n.t('comun.eliminar')}
              variante="peligro"
              icono="trash-outline"
              onPress={confirmarEliminacion}
              deshabilitado={ocupado}
            />
          ) : null}
        </Entrada>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function PantallaMovimiento() {
  const router = useRouter();
  const { tipo, id } = useLocalSearchParams<{ tipo?: string; id?: string }>();
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

  return <Formulario existente={existente} tipoInicial={tipo === 'gasto' ? 'gasto' : 'ingreso'} />;
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
    recurrencia: { gap: 14 },
    acciones: { gap: 16 },
  });
