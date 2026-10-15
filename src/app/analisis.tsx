import { useEffect, useEffectEvent } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { DESLIZAR } from '@/animacion/constantes';

import { AnalisisReglas } from '@/componentes/AnalisisReglas';
import { BloqueIA } from '@/componentes/BloqueIA';
import { Entrada } from '@/componentes/Entrada';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { Tarjeta } from '@/componentes/Tarjeta';
import { useAjustes } from '@/ajustes/AjustesProvider';
import { useDatos } from '@/datos/DatosProvider';
import { analizar } from '@/dominio/analisis';
import { useHoy } from '@/hooks/useHoy';
import { useRelleno } from '@/hooks/useRelleno';
import { useIA } from '@/ia/IAProvider';

export default function Analisis() {
  const relleno = useRelleno(true);
  const hoy = useHoy();
  const { movimientos } = useDatos();
  const { i18n } = useAjustes();
  const { refrescar, liberar } = useIA();

  const hechos = analizar(movimientos, hoy);

  // Al entrar se consulta qué hay en el teléfono; al salir se saca el modelo de la memoria (el archivo se queda).
  const alEntrar = useEffectEvent(() => void refrescar());
  const alSalir = useEffectEvent(() => void liberar());
  useEffect(() => {
    alEntrar();
    return () => alSalir();
  }, []);

  return (
    <ScrollView contentContainerStyle={[estilos.contenido, relleno]} showsVerticalScrollIndicator={false}>
      {/* Sin `Entrada`: lleva su propio fundido por fase. Solo desliza, para que las de abajo no salten al cambiar de alto. */}
      <Animated.View layout={DESLIZAR}>
        <BloqueIA hechos={hechos} />
      </Animated.View>
      {hechos.hayDatos ? (
        <AnalisisReglas hechos={hechos} />
      ) : (
        <Entrada indice={1}>
          <Tarjeta>
            <EstadoVacio
              icono="sparkles-outline"
              titulo={i18n.t('analisis.vacio_titulo')}
              descripcion={i18n.t('analisis.vacio_desc')}
            />
          </Tarjeta>
        </Entrada>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: { gap: 12 },
});
