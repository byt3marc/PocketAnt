import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { limpiarEntradaMonto } from '@/dominio/formato';
import type { AvisoPropuesta, ErroresPropuesta, PropuestaMovimiento } from '@/dominio/propuestaMovimiento';
import { hoy } from '@/dominio/fechas';
import type { TipoMovimiento } from '@/dominio/tipos';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono } from './Icono';
import { SelectorFecha } from './SelectorFecha';
import { Texto } from './Texto';

export interface CambiosPropuesta {
  tipo?: TipoMovimiento;
  montoTexto?: string;
  motivo?: string;
  fecha?: string;
}

interface Props {
  propuesta: PropuestaMovimiento;
  /** Avisos derivados (base + duplicados recomputados en cada edición). */
  avisos: AvisoPropuesta[];
  errores: ErroresPropuesta;
  onEditar: (id: string, cambios: CambiosPropuesta) => void;
  onToggleSeleccion: (id: string) => void;
  /** `true` mientras se guarda el lote: la fila no admite más cambios ni cambios de selección. */
  bloqueada?: boolean;
}

/** Las claves de i18n no admiten literales con plantillas: se mapea explícitamente. */
const claveTipo = (tipo: TipoMovimiento): 'tipo.gasto' | 'tipo.ingreso' =>
  tipo === 'gasto' ? 'tipo.gasto' : 'tipo.ingreso';

const CLAVE_AVISO = {
  tipo_dudoso: 'importar.aviso_tipo_dudoso',
  pendiente: 'importar.aviso_pendiente',
  puede_duplicar: 'importar.aviso_puede_duplicar',
  moneda_duda: 'importar.aviso_moneda_duda',
  total_recibo_dudoso: 'importar.aviso_total_recibo_dudoso',
  duplicado_interno: 'importar.aviso_duplicado_interno',
  duplicado_existente: 'importar.aviso_duplicado_existente',
} as const;

/**
 * Una propuesta de la revisión: campos editables (tipo, motivo, monto, fecha), avisos y evidencia de la
 * imagen. La selección es un checkbox aparte: las filas inválidas no se pueden marcar (lo decide la pantalla).
 */
export function FilaPropuesta({ propuesta, avisos, errores, onEditar, onToggleSeleccion, bloqueada = false }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { i18n } = useAjustes();

  const textoError = (campo: 'monto' | 'motivo' | 'fecha') => {
    const error = errores[campo];
    return error ? i18n.t(error.clave, error.parametros) : null;
  };

  return (
    <View style={estilos.fila}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: propuesta.seleccionada, disabled: bloqueada }}
        accessibilityLabel={`${propuesta.tipo ? i18n.t(claveTipo(propuesta.tipo)) : ''} ${propuesta.motivo || i18n.t('importar.campo_motivo')}`}
        onPress={bloqueada ? undefined : () => onToggleSeleccion(propuesta.id)}
        hitSlop={8}
        style={estilos.marcoCasilla}
      >
        <View style={[estilos.casilla, propuesta.seleccionada && estilos.casillaMarcada]}>
          {propuesta.seleccionada ? <Icono nombre="checkmark" tamano={16} color="sobrePrimario" /> : null}
        </View>
      </Pressable>

      <View style={estilos.cuerpo}>
        {/* Tipo: sin valor → el usuario debe elegirlo (queda desmarcada la fila hasta que la valide). */}
        {propuesta.tipo === null ? (
          <View style={[estilos.segmento, errores.tipo && estilos.campoConError]} accessibilityLabel={i18n.t('importar.tipo')}>
            {(['gasto', 'ingreso'] as const).map((tipo) => (
              <Pressable
                key={tipo}
                accessibilityRole="radio"
                accessibilityState={{ checked: false, disabled: bloqueada }}
                onPress={bloqueada ? undefined : () => onEditar(propuesta.id, { tipo })}
                style={({ pressed }) => [estilos.segmentoOpcion, pressed && { opacity: 0.7 }]}
              >
                <Texto variante="cuerpo" color="textoSecundario">
                  {i18n.t(claveTipo(tipo))}
                </Texto>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={estilos.segmento} accessibilityLabel={i18n.t('importar.tipo')}>
            {(['gasto', 'ingreso'] as const).map((tipo) => {
              const activo = propuesta.tipo === tipo;
              return (
                <Pressable
                  key={tipo}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: activo, disabled: bloqueada }}
                  onPress={bloqueada ? undefined : () => onEditar(propuesta.id, { tipo })}
                  style={[estilos.segmentoOpcion, activo && estilos.segmentoOpcionActiva]}
                >
                  <Texto variante="cuerpo" negrita color={activo ? (tipo === 'gasto' ? 'gasto' : 'ingreso') : 'textoSecundario'}>
                    {i18n.t(claveTipo(tipo))}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        )}
        {errores.tipo ? (
          <Texto variante="pequeno" color="gasto">
            {i18n.t(errores.tipo.clave)}
          </Texto>
        ) : null}

        <TextInput
          accessibilityLabel={i18n.t('importar.campo_motivo')}
          value={propuesta.motivo}
          editable={!bloqueada}
          onChangeText={(valor) => onEditar(propuesta.id, { motivo: valor })}
          placeholder={i18n.t('importar.campo_motivo')}
          style={[estilos.campo, estilos.colorTexto, errores.motivo && estilos.campoConError]}
        />
        {textoError('motivo') ? (
          <Texto variante="pequeno" color="gasto">
            {textoError('motivo')}
          </Texto>
        ) : null}

        <View style={estilos.filaMontoFecha}>
          <TextInput
            accessibilityLabel={i18n.t('importar.campo_monto')}
            value={propuesta.montoTexto}
            editable={!bloqueada}
            onChangeText={(valor) => onEditar(propuesta.id, { montoTexto: limpiarEntradaMonto(valor) })}
            placeholder="0.00"
            keyboardType="decimal-pad"
            style={[estilos.monto, estilos.colorTexto, errores.monto && estilos.campoConError]}
          />
          {/* Sin fecha resuelta el botón ofrece hoy como punto de partida; el campo sigue inválido hasta aceptar una. */}
          <View pointerEvents={bloqueada ? 'none' : 'auto'}>
            <SelectorFecha fecha={propuesta.fecha ?? hoy()} onCambio={(fecha) => onEditar(propuesta.id, { fecha })} />
          </View>
        </View>
        {textoError('monto') ? (
          <Texto variante="pequeno" color="gasto">
            {textoError('monto')}
          </Texto>
        ) : null}
        {propuesta.fecha === null || errores.fecha ? (
          <Texto variante="pequeno" color="gasto">
            {i18n.t(errores.fecha?.clave ?? 'error.fecha_invalida')}
          </Texto>
        ) : null}

        {avisos.map((aviso) => (
          <View key={aviso} style={estilos.aviso}>
            <Icono nombre="warning" tamano={14} color="gasto" />
            <Texto variante="pequeno" color="gasto">
              {i18n.t(CLAVE_AVISO[aviso])}
            </Texto>
          </View>
        ))}

        {propuesta.montoOriginal !== null || propuesta.fechaOriginal !== null ? (
          <Texto variante="pequeno" color="textoTenue">
            {i18n.t('importar.evidencia', {
              monto: propuesta.montoOriginal ?? '—',
              fecha: propuesta.fechaOriginal ?? '—',
            })}
          </Texto>
        ) : null}

        {propuesta.fuente ? (
          <Texto variante="pequeno" color="textoTenue" numberOfLines={2}>
            {i18n.t('importar.fuente', { fuente: propuesta.fuente })}
          </Texto>
        ) : null}
      </View>
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    fila: {
      flexDirection: 'row',
      gap: 10,
      padding: 12,
      borderRadius: radios.lg,
      borderWidth: 1,
      borderColor: c.borde,
      backgroundColor: c.superficie,
    },
    marcoCasilla: { justifyContent: 'center' },
    casilla: {
      width: 26,
      height: 26,
      borderRadius: radios.pildora,
      borderWidth: 2,
      borderColor: c.textoTenue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    casillaMarcada: { backgroundColor: c.primario, borderColor: c.primario },
    cuerpo: { flex: 1, gap: 8 },
    segmento: {
      flexDirection: 'row',
      borderRadius: radios.md,
      borderWidth: 1,
      borderColor: c.borde,
      overflow: 'hidden',
    },
    segmentoOpcion: { flex: 1, paddingVertical: 6, alignItems: 'center' },
    segmentoOpcionActiva: { backgroundColor: c.superficieAlta },
    colorTexto: { color: c.texto },
    campo: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: radios.md,
      borderWidth: 1,
      borderColor: c.borde,
      backgroundColor: c.fondo,
      fontSize: 15,
    },
    campoConError: { borderColor: c.gasto },
    filaMontoFecha: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    monto: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: radios.md,
      borderWidth: 1,
      borderColor: c.borde,
      backgroundColor: c.fondo,
      fontSize: 15,
    },
    aviso: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  });
