import { StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { Cobro } from '@/dominio/cobros';
import { textoCuando } from '@/hooks/useCobros';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono } from './Icono';
import { ESCALA_ICONO, PresionableEscala } from './PresionableEscala';
import { Revelar } from './Revelar';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

interface Props {
  /** Cobros pendientes (ya sin los omitidos), del más antiguo al más reciente. Vacío: no se muestra nada. */
  pendientes: readonly Cobro[];
  hoy: string;
  onRegistrar: (cobro: Cobro) => void;
  onOmitir: (cobro: Cobro) => void;
}

/**
 * Fila compacta del Home que recuerda un cobro recurrente que ya llegó y no se anotó («Netflix · se cobró ayer ·
 * S/ 40.00»). Muestra el primero y cuántos más hay; «Registrar» lo anota en un toque y ✕ deja de ofrecerlo.
 */
export function AvisoCobro({ pendientes, hoy, onRegistrar, onOmitir }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { i18n, formatear } = useAjustes();
  const [cobro] = pendientes;
  if (!cobro) return null;

  return (
    <Revelar>
      <Tarjeta style={estilos.tarjeta}>
        <View style={estilos.icono}>
          <Icono nombre="repeat-outline" tamano={18} color={cobro.movimiento.tipo === 'gasto' ? 'gasto' : 'ingreso'} />
        </View>
        <View style={estilos.textos}>
          <Texto variante="secundario" numberOfLines={2}>
            {i18n.t('cobro.resumen', {
              motivo: cobro.movimiento.motivo,
              cuando: textoCuando(cobro, hoy, i18n),
              monto: formatear(cobro.movimiento.monto),
            })}
          </Texto>
          {pendientes.length > 1 ? (
            <Texto variante="pequeno">{i18n.plural('cobro.mas', pendientes.length - 1)}</Texto>
          ) : null}
        </View>
        <PresionableEscala
          accessibilityRole="button"
          accessibilityLabel={i18n.t('cobro.registrar_accesible', {
            motivo: cobro.movimiento.motivo,
            monto: formatear(cobro.movimiento.monto),
            cuando: textoCuando(cobro, hoy, i18n),
          })}
          onPress={() => onRegistrar(cobro)}
          hitSlop={6}
          style={estilos.registrar}
        >
          <Texto variante="secundario" color="primario" negrita>
            {i18n.t('cobro.registrar')}
          </Texto>
        </PresionableEscala>
        <PresionableEscala
          accessibilityRole="button"
          accessibilityLabel={i18n.t('cobro.omitir_accesible', {
            motivo: cobro.movimiento.motivo,
            cuando: textoCuando(cobro, hoy, i18n),
          })}
          onPress={() => onOmitir(cobro)}
          hitSlop={8}
          escala={ESCALA_ICONO}
          style={estilos.cerrar}
        >
          <Icono nombre="close" tamano={18} color="textoTenue" />
        </PresionableEscala>
      </Tarjeta>
    </Revelar>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    tarjeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
    },
    icono: {
      width: 32,
      height: 32,
      borderRadius: radios.md,
      backgroundColor: c.superficieAlta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textos: { flex: 1, minWidth: 0, gap: 2 },
    registrar: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: radios.md,
    },
    cerrar: {
      width: 32,
      height: 32,
      borderRadius: radios.pildora,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
