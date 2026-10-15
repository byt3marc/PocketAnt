import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Relleno de las pantallas para respetar la barra de estado y la de navegación (edge-to-edge).
 * `conEncabezadoNativo`: la pantalla ya tiene cabecera de navegación, que cubre el borde superior.
 */
export function useRelleno(conEncabezadoNativo: boolean) {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: conEncabezadoNativo ? 16 : insets.top + 12,
    paddingBottom: insets.bottom + 24,
    paddingHorizontal: 16,
  };
}
