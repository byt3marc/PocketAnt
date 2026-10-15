import { createContext, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { radios, type Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { Texto } from './Texto';

export interface BotonDialogo {
  text: string;
  /** `cancel` es lo que pasa al tocar fuera o con «atrás»; `destructive` va en rojo. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface Dialogo {
  titulo: string;
  mensaje?: string;
  botones: BotonDialogo[];
}

interface ContextoDialogo {
  /** Igual que `Alert.alert(titulo, mensaje, botones)`, pero con el diseño de la app. */
  alerta: (titulo: string, mensaje?: string, botones?: BotonDialogo[]) => void;
}

const Contexto = createContext<ContextoDialogo | null>(null);

/**
 * Diálogos de aviso y confirmación con el diseño de la app (como el calendario): reemplazan a los de Android, que
 * usan la fuente del sistema, un gris propio y el acento verde azulado. Si llegan varios seguidos, se muestran de a uno.
 */
export function DialogoProvider({ children }: { children: ReactNode }) {
  const estilos = useEstilos(crearEstilos);
  const { i18n } = useAjustes();
  const [cola, setCola] = useState<Dialogo[]>([]);
  const actual = cola[0];

  const alerta: ContextoDialogo['alerta'] = (titulo, mensaje, botones) => {
    const lista = botones && botones.length > 0 ? botones : [{ text: i18n.t('comun.aceptar') }];
    setCola((anterior) => [...anterior, { titulo, mensaje, botones: lista }]);
  };

  const pulsar = (boton: BotonDialogo) => {
    // Primero se cierra y luego se ejecuta: si la acción abre otro diálogo, queda en la cola y sale a continuación.
    setCola((anterior) => anterior.slice(1));
    boton.onPress?.();
  };

  const cancelable = actual?.botones.find((b) => b.style === 'cancel');
  // Tocar fuera o «atrás»: cancela si hay un botón de cancelar; en un aviso de un solo botón, lo cierra.
  const cerrar = () => {
    if (!actual) return;
    if (cancelable) pulsar(cancelable);
    else if (actual.botones.length === 1) pulsar(actual.botones[0]);
  };

  // Hasta 2 botones van en fila a la derecha; con más, en columna a lo ancho.
  const enColumna = (actual?.botones.length ?? 0) > 2;

  return (
    <Contexto.Provider value={{ alerta }}>
      {children}
      {actual ? (
        <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={cerrar} testID="dialogo">
          <View style={estilos.fondo}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={cerrar}
              testID="dialogo-fondo"
              accessible={false}
              importantForAccessibility="no"
            />
            <View style={estilos.tarjeta} accessibilityViewIsModal accessibilityLabel={actual.titulo}>
              <Texto variante="subtitulo" accessibilityRole="header">
                {actual.titulo}
              </Texto>
              {actual.mensaje ? (
                <Texto variante="secundario" color="textoSecundario" style={estilos.mensaje}>
                  {actual.mensaje}
                </Texto>
              ) : null}
              <View style={[estilos.botones, enColumna && estilos.botonesColumna]}>
                {actual.botones.map((boton, i) => (
                  <Pressable
                    key={`${i}-${boton.text}`}
                    accessibilityRole="button"
                    accessibilityLabel={boton.text}
                    onPress={() => pulsar(boton)}
                    android_ripple={{ color: 'rgba(128,128,128,0.2)' }}
                    style={({ pressed }) => [estilos.boton, pressed && { opacity: 0.6 }]}
                  >
                    <Texto
                      variante="cuerpo"
                      negrita
                      color={boton.style === 'destructive' ? 'gasto' : boton.style === 'cancel' ? 'textoSecundario' : 'primario'}
                    >
                      {boton.text}
                    </Texto>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </Contexto.Provider>
  );
}

export function useDialogo(): ContextoDialogo {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useDialogo debe usarse dentro de <DialogoProvider>.');
  return contexto;
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    fondo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.velo },
    tarjeta: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: c.superficie,
      borderRadius: radios.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borde,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 10,
      gap: 10,
    },
    mensaje: { lineHeight: 21 },
    botones: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 6, gap: 4 },
    botonesColumna: { flexDirection: 'column', alignItems: 'stretch' },
    boton: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  });
