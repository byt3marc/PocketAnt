import { useLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DURACION, TRANSICION_OPACIDAD } from '@/animacion/constantes';
import { useAjustes } from '@/ajustes/AjustesProvider';
import { Icono } from '@/componentes/Icono';
import { Texto } from '@/componentes/Texto';
import { MONEDA_AUTOMATICA, MONEDAS, nombreDeMoneda, resolverMoneda } from '@/dominio/moneda';
import { useRelleno } from '@/hooks/useRelleno';
import { ONDA, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

interface Opcion {
  ajuste: string;
  titulo: string;
  detalle: string;
}

export default function Moneda() {
  const router = useRouter();
  const estilos = useEstilos(crearEstilos);
  const relleno = useRelleno(true);
  const { ajustes, cambiarMoneda, i18n } = useAjustes();
  const [locale] = useLocales();
  // Al elegir, se ve el cambio (el check pasa de una fila a otra) y recién entonces se vuelve a Ajustes.
  const [eligiendo, setEligiendo] = useState(false);
  useEffect(() => {
    if (!eligiendo) return;
    const temporizador = setTimeout(() => router.back(), DURACION.eleccion);
    // Si se sale antes (botón atrás del sistema) no se vuelve dos veces.
    return () => clearTimeout(temporizador);
  }, [eligiendo, router]);

  const detectada = locale?.currencyCode ? resolverMoneda(MONEDA_AUTOMATICA, locale) : null;
  const opciones: Opcion[] = [
    {
      ajuste: MONEDA_AUTOMATICA,
      titulo: i18n.t('moneda.auto_titulo'),
      detalle: detectada
        ? i18n.t('moneda.auto_detectada', {
            nombre: nombreDeMoneda(detectada, i18n),
            codigo: detectada.codigo,
            simbolo: detectada.simbolo,
          })
        : i18n.t('moneda.auto_no_detectada'),
    },
    ...MONEDAS.map((m) => ({
      ajuste: m.codigo,
      titulo: nombreDeMoneda(m, i18n),
      detalle: `${m.codigo} · ${m.simbolo}`,
    })),
  ];

  return (
    <FlatList
      data={opciones}
      keyExtractor={(o) => o.ajuste}
      contentContainerStyle={relleno}
      ItemSeparatorComponent={() => <View style={estilos.separador} />}
      renderItem={({ item }) => {
        const activa = item.ajuste === ajustes.moneda;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: activa }}
            onPress={() => {
              if (eligiendo) return;
              cambiarMoneda(item.ajuste);
              setEligiendo(true);
            }}
            android_ripple={ONDA}
            style={({ pressed }) => [estilos.fila, pressed && { opacity: 0.7 }]}
          >
            <View style={estilos.texto}>
              <Texto variante="cuerpo" negrita={activa}>
                {item.titulo}
              </Texto>
              <Texto variante="pequeno">{item.detalle}</Texto>
            </View>
            {/* Siempre presente y solo se enciende o apaga: así no se anima al reciclar filas al hacer scroll. */}
            <Animated.View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[{ opacity: activa ? 1 : 0 }, TRANSICION_OPACIDAD]}
            >
              <Icono nombre="checkmark-circle" tamano={22} color="primario" />
            </Animated.View>
          </Pressable>
        );
      }}
    />
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
    texto: { flex: 1, gap: 2 },
    separador: { height: StyleSheet.hairlineWidth, backgroundColor: c.borde },
  });
