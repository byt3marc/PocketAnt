import { StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { Totales } from '@/dominio/saldo';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono } from './Icono';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

interface Props extends Totales {
  /** Menos relleno vertical, para que el Home quepa sin hacer scroll. */
  compacta?: boolean;
}

export function TarjetaSaldo({ ingresos, gastos, saldo, compacta }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { formatear, i18n } = useAjustes();
  const textoSaldo = formatear(saldo);

  return (
    <Tarjeta style={[estilos.tarjeta, compacta && estilos.tarjetaCompacta]}>
      <View style={[estilos.contenido, compacta && estilos.contenidoCompacto]}>
        <Texto variante="etiqueta">{i18n.t('saldo.titulo')}</Texto>
        <Texto
          variante="monto"
          color={saldo < 0 ? 'gasto' : 'texto'}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={i18n.t('saldo.accesible', { monto: textoSaldo })}
        >
          {textoSaldo}
        </Texto>

        <View style={estilos.resumen}>
          <View style={estilos.dato}>
            <View style={[estilos.insignia, estilos.insigniaIngreso]}>
              <Icono nombre="arrow-up" tamano={14} color="ingreso" />
            </View>
            <View style={estilos.textoDato}>
              <Texto variante="pequeno" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {i18n.t('comun.ingresos')}
              </Texto>
              <Texto
                variante="secundario"
                color="ingreso"
                negrita
                style={estilos.numero}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatear(ingresos)}
              </Texto>
            </View>
          </View>
          <View style={estilos.dato}>
            <View style={[estilos.insignia, estilos.insigniaGasto]}>
              <Icono nombre="arrow-down" tamano={14} color="gasto" />
            </View>
            <View style={estilos.textoDato}>
              <Texto variante="pequeno" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {i18n.t('comun.gastos')}
              </Texto>
              <Texto
                variante="secundario"
                color="gasto"
                negrita
                style={estilos.numero}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatear(gastos)}
              </Texto>
            </View>
          </View>
        </View>
      </View>
    </Tarjeta>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    tarjeta: { paddingVertical: 20 },
    tarjetaCompacta: { paddingVertical: 14 },
    contenido: { minWidth: 0, gap: 6 },
    contenidoCompacto: { gap: 2 },
    resumen: { flexDirection: 'row', gap: 20, marginTop: 10 },
    dato: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minWidth: 0 },
    textoDato: { flexShrink: 1, minWidth: 0 },
    insignia: {
      width: 28,
      height: 28,
      borderRadius: radios.pildora,
      alignItems: 'center',
      justifyContent: 'center',
    },
    insigniaIngreso: { backgroundColor: c.ingresoSuave },
    insigniaGasto: { backgroundColor: c.gastoSuave },
    numero: { fontVariant: ['tabular-nums'] },
  });
