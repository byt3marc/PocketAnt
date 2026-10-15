import type { TextStyle } from 'react-native';

/**
 * Fuente del texto de la app:
 * - `sistema`: la del teléfono (Roboto en Android).
 * - `redondeada`: Nunito, sans-serif de terminaciones redondeadas, amable.
 * - `clasica`: Lora, serif de aire editorial.
 */
export type FuenteApp = 'sistema' | 'redondeada' | 'clasica';

export const FUENTES: readonly FuenteApp[] = ['sistema', 'redondeada', 'clasica'];

export const FUENTE_POR_DEFECTO: FuenteApp = 'sistema';

export function esFuenteApp(valor: unknown): valor is FuenteApp {
  return FUENTES.includes(valor as FuenteApp);
}

/** Pesos que usa la app. Cada uno es un archivo distinto en las fuentes propias. */
export type PesoFuente = 'normal' | 'seminegrita' | 'negrita';

const PESO_DEL_SISTEMA: Record<PesoFuente, TextStyle['fontWeight']> = {
  normal: '400',
  seminegrita: '600',
  negrita: '700',
};

/** Nombre con el que se registra cada archivo (`useFonts`) y con el que se pide en `fontFamily`. */
const FAMILIA: Record<Exclude<FuenteApp, 'sistema'>, Record<PesoFuente, string>> = {
  redondeada: {
    normal: 'Nunito_400Regular',
    seminegrita: 'Nunito_600SemiBold',
    negrita: 'Nunito_700Bold',
  },
  clasica: {
    normal: 'Lora_400Regular',
    seminegrita: 'Lora_600SemiBold',
    negrita: 'Lora_700Bold',
  },
};

/**
 * Estilo de tipografía para una fuente y un peso. Con las fuentes propias el peso va en el nombre de la
 * familia, y `fontWeight` debe quedar en `normal`: si no, Android engrosaría otra vez un archivo que ya es
 * negrita. Acepta `undefined` (ajustes viejos o parciales) y entonces usa la del sistema.
 */
export function estiloDeFuente(fuente: FuenteApp | undefined, peso: PesoFuente = 'normal'): TextStyle {
  if (fuente === 'redondeada' || fuente === 'clasica') {
    return { fontFamily: FAMILIA[fuente][peso], fontWeight: 'normal' };
  }
  return { fontWeight: PESO_DEL_SISTEMA[peso] };
}
