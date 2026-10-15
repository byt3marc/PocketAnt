import { useMemo } from 'react';

import { useAjustes } from '@/ajustes/AjustesProvider';

import type { Paleta } from './paleta';

/**
 * Hoja de estilos que depende de la paleta activa (claro/oscuro).
 * `fabrica` debe ser una función de módulo (estable): `const crearEstilos = (c: Paleta) => StyleSheet.create({...})`.
 */
export function useEstilos<T>(fabrica: (colores: Paleta) => T): T {
  const { colores } = useAjustes();
  return useMemo(() => fabrica(colores), [fabrica, colores]);
}
