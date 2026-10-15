import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { BloqueDia } from '@/componentes/BloqueDia';
import { BloqueGrafica } from '@/componentes/BloqueGrafica';
import { Boton } from '@/componentes/Boton';
import { Icono } from '@/componentes/Icono';
import { Logo } from '@/componentes/Logo';
import { Tarjeta } from '@/componentes/Tarjeta';
import { TarjetaSaldo } from '@/componentes/TarjetaSaldo';
import { Texto } from '@/componentes/Texto';
import { VistaPreviaHistorial } from '@/componentes/VistaPreviaHistorial';
import { useDatos } from '@/datos/DatosProvider';
import { evaluarDesborde, TOLERANCIA_DESBORDE } from '@/dominio/desborde';
import { useRelleno } from '@/hooks/useRelleno';
import { NOMBRE_APP } from '@/marca';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

/** Por debajo de este ancho (dp) las dos gráficas no caben lado a lado y se apilan. */
const ANCHO_MINIMO_DOS_COLUMNAS = 340;

/** Alto de la gráfica de 7 días (dp). En dos columnas se encoge, si hace falta, hasta el mínimo para no hacer scroll. */
const ALTO_GRAFICA_COLUMNAS = { normal: 110, minimo: 64 } as const;
const ALTO_GRAFICA_APILADA = 150;

export default function Inicio() {
  const router = useRouter();
  const estilos = useEstilos(crearEstilos);
  const relleno = useRelleno(false);
  const { width } = useWindowDimensions();
  const { movimientos, totales } = useDatos();
  const { i18n } = useAjustes();

  const enColumnas = width >= ANCHO_MINIMO_DOS_COLUMNAS;
  const cantidad = movimientos.length;
  const abrirEstadisticas = () => router.push('/estadisticas');

  // El Home debe quedar fijo: solo hace scroll si, aun con todo lo que se puede comprimir, no cabe. Se mide
  // lo que le sobra al contenido frente a la ventana y se le quita a la gráfica (la vista previa del historial
  // ya cede su alto sola). Si queda desborde, entonces sí se activa el scroll.
  const medidas = useRef({ ventana: 0, contenido: 0 });
  const [reduccion, setReduccion] = useState(0);
  const [desborda, setDesborda] = useState(false);
  const reduccionMaxima = ALTO_GRAFICA_COLUMNAS.normal - ALTO_GRAFICA_COLUMNAS.minimo;

  const revisarDesborde = () => {
    const { ventana, contenido } = medidas.current;
    // Apilado (pantalla muy angosta) no hay nada que comprimir: va directo al scroll.
    const resultado = evaluarDesborde(ventana, contenido, reduccion, enColumnas ? reduccionMaxima : 0);
    setDesborda(resultado.desborda);
    setReduccion(resultado.reduccion);
  };
  const alMedirVentana = (e: LayoutChangeEvent) => {
    const alto = e.nativeEvent.layout.height;
    // Otra ventana (otro teléfono, pantalla dividida): se vuelve a calcular desde el alto normal.
    if (Math.abs(alto - medidas.current.ventana) > TOLERANCIA_DESBORDE) setReduccion(0);
    medidas.current.ventana = alto;
    revisarDesborde();
  };
  const alCambiarContenido = (_ancho: number, alto: number) => {
    medidas.current.contenido = alto;
    revisarDesborde();
  };
  const altoGrafica = enColumnas ? ALTO_GRAFICA_COLUMNAS.normal - reduccion : ALTO_GRAFICA_APILADA;

  const hoy = <BloqueDia movimientos={movimientos} compacto={enColumnas} />;
  const semana = (
    <BloqueGrafica
      titulo={i18n.t(enColumnas ? 'inicio.titulo_7' : 'inicio.ultimos_7')}
      dias={7}
      tipo="linea"
      modoEtiquetas="semana"
      movimientos={movimientos}
      alto={altoGrafica}
      compacto={enColumnas}
    />
  );

  return (
    <ScrollView
      contentContainerStyle={[estilos.contenido, relleno]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={desborda}
      // Sin nada que mostrar de más, tampoco rebota ni se estira al arrastrar.
      bounces={false}
      overScrollMode="never"
      onLayout={alMedirVentana}
      onContentSizeChange={alCambiarContenido}
    >
      <View style={estilos.encabezado}>
        <View style={estilos.marca}>
          <Logo tamano={32} />
          <Texto variante="titulo">{NOMBRE_APP}</Texto>
        </View>
        <View style={estilos.botones}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.t('inicio.analisis_accesible')}
            onPress={() => router.push('/analisis')}
            hitSlop={8}
            style={estilos.botonRedondo}
          >
            <Icono nombre="sparkles-outline" tamano={22} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={i18n.t('inicio.ajustes_accesible')}
            onPress={() => router.push('/ajustes')}
            hitSlop={8}
            style={estilos.botonRedondo}
          >
            <Icono nombre="settings-outline" tamano={22} />
          </Pressable>
        </View>
      </View>

      <TarjetaSaldo {...totales} compacta={enColumnas} />

      <View style={estilos.acciones}>
        <Boton
          titulo={i18n.t('inicio.agregar')}
          variante="ingreso"
          icono="add"
          estilo={estilos.accion}
          onPress={() => router.push({ pathname: '/movimiento', params: { tipo: 'ingreso' } })}
        />
        <Boton
          titulo={i18n.t('inicio.quitar')}
          variante="gasto"
          icono="remove"
          estilo={estilos.accion}
          onPress={() => router.push({ pathname: '/movimiento', params: { tipo: 'gasto' } })}
        />
      </View>

      {enColumnas ? (
        <View style={estilos.columnas}>
          <View style={estilos.columna}>{hoy}</View>
          <View style={estilos.columna}>{semana}</View>
        </View>
      ) : (
        <>
          {hoy}
          {semana}
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={i18n.t('inicio.enlace_accesible')}
        onPress={abrirEstadisticas}
        style={({ pressed }) => pressed && { opacity: 0.8 }}
      >
        <Tarjeta style={estilos.enlace}>
          <View style={estilos.iconoEnlace}>
            <Icono nombre="stats-chart" tamano={20} color="primario" />
          </View>
          <View style={estilos.textoEnlace}>
            <Texto variante="cuerpo" negrita>
              {i18n.t('inicio.enlace_titulo')}
            </Texto>
            <Texto variante="pequeno">
              {cantidad === 0
                ? i18n.t('inicio.enlace_vacio')
                : i18n.plural('inicio.enlace_detalle', cantidad)}
            </Texto>
          </View>
          <Icono nombre="chevron-forward" tamano={20} color="textoTenue" />
        </Tarjeta>
      </Pressable>

      {/* Ocupa lo que queda de pantalla; si el resto ya llena el alto, el Home hace scroll. */}
      <VistaPreviaHistorial movimientos={movimientos} onAbrir={abrirEstadisticas} />
    </ScrollView>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    // `flexGrow: 1` deja que la vista previa (con `flex: 1`) rellene el alto sobrante.
    contenido: { gap: 12, flexGrow: 1 },
    encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    marca: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    botones: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    botonRedondo: {
      width: 42,
      height: 42,
      borderRadius: radios.pildora,
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borde,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acciones: { flexDirection: 'row', gap: 12 },
    accion: { flex: 1 },
    columnas: { flexDirection: 'row', gap: 12 },
    columna: { flex: 1, minWidth: 0 },
    enlace: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    iconoEnlace: {
      width: 40,
      height: 40,
      borderRadius: radios.md,
      backgroundColor: c.superficieAlta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textoEnlace: { flex: 1, gap: 2 },
  });
