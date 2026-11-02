import { Image, Pressable, StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { MAX_IMAGENES, type ImagenBorrador } from '@/dominio/imagenes';
import { ONDA, radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono } from './Icono';
import { Texto } from './Texto';

interface Props {
  imagenes: readonly ImagenBorrador[];
  onAgregar: () => void;
  onQuitar: (id: string) => void;
  /** Color de acento: el del tipo de movimiento. */
  color: keyof Paleta;
}

/** Fotos adjuntas al movimiento: miniaturas, botón para quitar y botón para agregar (hasta `MAX_IMAGENES`). */
export function ImagenesMovimiento({ imagenes, onAgregar, onQuitar, color }: Props) {
  const estilos = useEstilos(crearEstilos);
  const { colores, i18n } = useAjustes();
  const lleno = imagenes.length >= MAX_IMAGENES;

  return (
    <View style={estilos.grupo}>
      <View style={estilos.cabecera}>
        <Texto variante="etiqueta">{i18n.t('mov.imagenes')}</Texto>
        <Texto variante="pequeno">
          {i18n.t('mov.imagenes_cuenta', { n: imagenes.length, max: MAX_IMAGENES })}
        </Texto>
      </View>

      <View style={estilos.fila}>
        {imagenes.map((imagen, indice) => (
          <View key={imagen.id} style={estilos.miniatura}>
            <Image
              source={{ uri: imagen.uri }}
              style={estilos.foto}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              accessibilityLabel={i18n.t('mov.imagen_accesible', {
                n: indice + 1,
                total: imagenes.length,
              })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t('mov.imagen_quitar')}
              onPress={() => onQuitar(imagen.id)}
              hitSlop={8}
              style={({ pressed }) => [estilos.quitar, pressed && estilos.pulsado]}
            >
              <Icono nombre="close" tamano={15} color="sobreGasto" />
            </Pressable>
          </View>
        ))}

        {lleno ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.t('mov.imagen_agregar')}
            onPress={onAgregar}
            android_ripple={ONDA}
            style={({ pressed }) => [
              estilos.agregar,
              { borderColor: colores[color] },
              pressed && estilos.pulsado,
            ]}
          >
            <Icono nombre="camera-outline" tamano={22} color={color} />
            <Texto variante="pequeno" color={color} negrita style={estilos.textoAgregar}>
              {i18n.t('mov.imagen_agregar')}
            </Texto>
          </Pressable>
        )}
      </View>

      <Texto variante="pequeno">
        {lleno
          ? i18n.t('mov.imagen_limite', { max: MAX_IMAGENES })
          : i18n.t('mov.imagenes_desc')}
      </Texto>
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    grupo: { gap: 10 },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    miniatura: {
      width: 84,
      height: 84,
      borderRadius: radios.md,
      overflow: 'hidden',
      backgroundColor: c.superficieAlta,
    },
    foto: { width: '100%', height: '100%' },
    quitar: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: radios.pildora,
      backgroundColor: c.gasto,
      alignItems: 'center',
      justifyContent: 'center',
    },
    agregar: {
      width: 84,
      height: 84,
      borderRadius: radios.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 4,
    },
    textoAgregar: { textAlign: 'center' },
    pulsado: { opacity: 0.65 },
  });
