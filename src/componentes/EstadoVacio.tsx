import { StyleSheet, View } from 'react-native';

import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Icono, type NombreIcono } from './Icono';
import { Texto } from './Texto';

interface Props {
  icono: NombreIcono;
  titulo: string;
  descripcion: string;
}

export function EstadoVacio({ icono, titulo, descripcion }: Props) {
  const estilos = useEstilos(crearEstilos);
  return (
    <View style={estilos.contenedor}>
      <View style={estilos.circulo}>
        <Icono nombre={icono} tamano={28} color="textoTenue" />
      </View>
      <Texto variante="cuerpo" negrita>
        {titulo}
      </Texto>
      <Texto variante="secundario" style={estilos.descripcion}>
        {descripcion}
      </Texto>
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    contenedor: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
    circulo: {
      width: 64,
      height: 64,
      borderRadius: radios.pildora,
      backgroundColor: c.superficieAlta,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    descripcion: { textAlign: 'center' },
  });
