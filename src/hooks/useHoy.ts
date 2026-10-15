import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { hoy } from '@/dominio/fechas';

function milisegundosHastaMedianoche(ahora: Date): number {
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  return manana.getTime() - ahora.getTime();
}

/** Clave del día actual (`YYYY-MM-DD`). Se actualiza al pasar la medianoche y al volver a la app. */
export function useHoy(): string {
  const [dia, setDia] = useState(() => hoy());

  useEffect(() => {
    const temporizador = setTimeout(() => setDia(hoy()), milisegundosHastaMedianoche(new Date()) + 500);
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') setDia(hoy());
    });
    return () => {
      clearTimeout(temporizador);
      suscripcion.remove();
    };
  }, [dia]);

  return dia;
}
