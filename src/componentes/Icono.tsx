import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useAjustes } from '@/ajustes/AjustesProvider';
import type { Paleta } from '@/tema/paleta';

export type NombreIcono = ComponentProps<typeof Ionicons>['name'];

interface Props {
  nombre: NombreIcono;
  tamano?: number;
  color?: keyof Paleta;
}

export function Icono({ nombre, tamano = 22, color = 'texto' }: Props) {
  const { colores } = useAjustes();
  return <Ionicons name={nombre} size={tamano} color={colores[color]} />;
}

/** Fuentes que hay que cargar antes de mostrar iconos. */
export const fuentesDeIconos = Ionicons.font;
