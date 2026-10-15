import { ScrollView, StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { Texto } from '@/componentes/Texto';
import { useRelleno } from '@/hooks/useRelleno';
import { politicaDePrivacidad } from '@/legal/privacidad';

/** La política de privacidad dentro de la app (Google Play pide que se pueda leer sin salir de ella). */
export default function Privacidad() {
  const relleno = useRelleno(true);
  const { i18n } = useAjustes();
  const politica = politicaDePrivacidad(i18n.idioma);

  return (
    <ScrollView contentContainerStyle={[estilos.contenido, relleno]}>
      <View style={estilos.cabecera}>
        <Texto variante="pequeno">{politica.fecha}</Texto>
        <Texto variante="cuerpo">{politica.intro}</Texto>
      </View>
      {politica.secciones.map((seccion) => (
        <View key={seccion.titulo} style={estilos.seccion}>
          <Texto variante="subtitulo" accessibilityRole="header">
            {seccion.titulo}
          </Texto>
          {seccion.parrafos.map((parrafo) => (
            <Texto key={parrafo} variante="secundario" style={estilos.parrafo}>
              {parrafo}
            </Texto>
          ))}
        </View>
      ))}
      {politica.contacto ? (
        <Texto variante="secundario" selectable>
          {politica.contacto}
        </Texto>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { gap: 20 },
  cabecera: { gap: 8 },
  seccion: { gap: 6 },
  parrafo: { lineHeight: 21 },
});
