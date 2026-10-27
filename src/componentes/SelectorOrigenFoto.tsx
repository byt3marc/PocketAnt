import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { ONDA, radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono, type NombreIcono } from './Icono';
import { PresionableEscala } from './PresionableEscala';
import { Texto } from './Texto';

export type OrigenFoto = 'galeria' | 'camara';

interface Props {
  visible: boolean;
  /** Acento del tipo de movimiento: el mismo que usa el botón «Agregar foto». */
  color: keyof Paleta;
  onElegir: (origen: OrigenFoto) => void;
  onCerrar: () => void;
}

interface PropsOpcion {
  icono: NombreIcono;
  etiqueta: string;
  color: keyof Paleta;
  acento?: boolean;
  onPress: () => void;
}

function Opcion({ icono, etiqueta, color, acento = false, onPress }: PropsOpcion) {
  const estilos = useEstilos(crearEstilos);
  return (
    <PresionableEscala
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      android_ripple={ONDA}
      style={[estilos.opcion, acento && { borderColor: color }]}
    >
      <Icono nombre={icono} tamano={26} color={acento ? color : 'textoSecundario'} />
      <Texto
        variante="pequeno"
        color={acento ? 'texto' : 'textoSecundario'}
        negrita={acento}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={estilos.etiqueta}
      >
        {etiqueta}
      </Texto>
    </PresionableEscala>
  );
}

/** Panel para elegir de dónde tomar la foto: Galería, Cámara o Cancelar, en una sola fila. */
export function SelectorOrigenFoto({ visible, color, onElegir, onCerrar }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { i18n } = useAjustes();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCerrar}
      testID="origen-foto"
    >
      <View style={estilos.fondo}>
        {/* Tocar fuera cancela. Va detrás de la tarjeta, que recibe sus propios toques. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCerrar}
          accessible={false}
          importantForAccessibility="no"
          testID="origen-foto-fondo"
        />
        <View
          style={estilos.tarjeta}
          accessibilityViewIsModal
          accessibilityLabel={i18n.t('mov.imagen_fuente_titulo')}
        >
          <Texto variante="subtitulo" accessibilityRole="header">
            {i18n.t('mov.imagen_fuente_titulo')}
          </Texto>
          <Texto variante="pequeno" color="textoSecundario">
            {i18n.t('mov.imagen_fuente_desc')}
          </Texto>

          <View style={estilos.fila} testID="origen-foto-fila">
            <Opcion
              icono="images-outline"
              etiqueta={i18n.t('mov.imagen_fuente_galeria')}
              color={color}
              onPress={() => onElegir('galeria')}
              acento
            />
            <Opcion
              icono="camera-outline"
              etiqueta={i18n.t('mov.imagen_fuente_camara')}
              color={color}
              onPress={() => onElegir('camara')}
              acento
            />
            <Opcion
              icono="close"
              etiqueta={i18n.t('comun.cancelar')}
              color={color}
              onPress={onCerrar}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    fondo: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: c.velo,
    },
    tarjeta: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: c.superficie,
      borderRadius: radios.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borde,
      padding: 20,
      gap: 10,
    },
    fila: { flexDirection: 'row', gap: 8, paddingTop: 6 },
    opcion: {
      flex: 1,
      minWidth: 0,
      minHeight: 88,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 4,
      borderRadius: radios.md,
      backgroundColor: c.superficieAlta,
      borderWidth: 1.5,
      borderColor: c.superficieAlta,
      overflow: 'hidden',
    },
    etiqueta: { textAlign: 'center' },
  });
