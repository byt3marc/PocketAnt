import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Margen lateral de todas las pantallas. */
const MARGEN_LATERAL = 16;

/**
 * Relleno de las pantallas para respetar la barra de estado, la de navegación y, a los lados, el recorte de la cámara o
 * la barra de navegación en horizontal (edge-to-edge; Android 16 ignora la orientación fija en pantallas grandes).
 * `conEncabezadoNativo`: la pantalla ya tiene cabecera de navegación, que cubre el borde superior.
 */
export function useRelleno(conEncabezadoNativo: boolean) {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: conEncabezadoNativo ? 16 : insets.top + 12,
    paddingBottom: insets.bottom + 24,
    paddingLeft: insets.left + MARGEN_LATERAL,
    paddingRight: insets.right + MARGEN_LATERAL,
  };
}
