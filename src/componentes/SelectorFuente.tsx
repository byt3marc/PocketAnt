import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { TRANSICION_TARJETA } from '@/animacion/constantes';
import { useAjustes } from '@/ajustes/AjustesProvider';
import { FUENTES, type FuenteApp } from '@/tema/fuentes';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { PresionableEscala } from './PresionableEscala';
import { Texto } from './Texto';

/**
 * Elige la fuente del texto: cada opción se muestra escrita con su propia letra. Al cambiar, la tarjeta elegida pasa
 * de fondo y borde suaves a los del color primario (200 ms) y la anterior hace el camino contrario.
 */
export function SelectorFuente() {
  const estilos = useEstilos(crearEstilos);
  const { ajustes, cambiarFuente, i18n } = useAjustes();
  // Los ajustes viejos o parciales no traen `fuente`: cuenta como la del sistema.
  const actual: FuenteApp = ajustes.fuente ?? 'sistema';

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={i18n.t('ajustes.fuente_accesible')} style={estilos.fila}>
      {FUENTES.map((fuente) => {
        const seleccionada = fuente === actual;
        const nombre = i18n.t(`fuente.${fuente}`);
        return (
          <PresionableEscala
            key={fuente}
            accessibilityRole="radio"
            accessibilityLabel={nombre}
            accessibilityState={{ selected: seleccionada }}
            onPress={() => cambiarFuente(fuente)}
            style={estilos.celda}
          >
            <Animated.View style={[estilos.opcion, seleccionada && estilos.opcionActiva, TRANSICION_TARJETA]}>
              <Texto
                variante="titulo"
                fuente={fuente}
                color={seleccionada ? 'primario' : 'texto'}
                animado
                importantForAccessibility="no"
              >
                Aa
              </Texto>
              <Texto
                variante="secundario"
                fuente={fuente}
                color={seleccionada ? 'texto' : 'textoSecundario'}
                negrita={seleccionada}
                animado
                numberOfLines={1}
                adjustsFontSizeToFit
                importantForAccessibility="no"
              >
                {nombre}
              </Texto>
            </Animated.View>
          </PresionableEscala>
        );
      })}
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    fila: { flexDirection: 'row', gap: 8 },
    // La celda es lo que se pulsa y se encoge; la tarjeta de dentro es la que cambia de color.
    celda: { flex: 1, minWidth: 0 },
    opcion: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderRadius: radios.md,
      backgroundColor: c.superficieAlta,
      borderWidth: 1.5,
      // Del mismo color que el fondo (no `transparent`): al animar hacia el borde primario no pasa por un tono oscuro.
      borderColor: c.superficieAlta,
    },
    opcionActiva: { backgroundColor: c.superficie, borderColor: c.primario },
  });
