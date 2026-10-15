/** Todos los colores de la app viven aquí; ningún componente usa colores sueltos. */
export interface Paleta {
  fondo: string;
  superficie: string;
  superficieAlta: string;
  borde: string;
  texto: string;
  textoSecundario: string;
  textoTenue: string;
  primario: string;
  sobrePrimario: string;
  ingreso: string;
  sobreIngreso: string;
  ingresoSuave: string;
  gasto: string;
  sobreGasto: string;
  gastoSuave: string;
  /** Líneas y relleno del esqueleto que se muestra cuando todavía no hay datos. */
  esqueleto: string;
  /** Velo detrás de diálogos y superposiciones. */
  velo: string;
}

export const paletaClara: Paleta = {
  fondo: '#F4F6F5',
  superficie: '#FFFFFF',
  superficieAlta: '#ECEFED',
  borde: '#DDE3E0',
  texto: '#111A16',
  textoSecundario: '#55635C',
  textoTenue: '#85928B',
  primario: '#2F5BEA',
  sobrePrimario: '#FFFFFF',
  ingreso: '#15803D',
  sobreIngreso: '#FFFFFF',
  ingresoSuave: '#DCFCE7',
  gasto: '#DC2626',
  sobreGasto: '#FFFFFF',
  gastoSuave: '#FEE2E2',
  esqueleto: '#D3DAD6',
  velo: 'rgba(0,0,0,0.4)',
};

export const paletaOscura: Paleta = {
  fondo: '#151517',
  superficie: '#1F1F22',
  superficieAlta: '#2A2A2E',
  borde: '#35353A',
  texto: '#F2F2F3',
  textoSecundario: '#A6A6AB',
  textoTenue: '#82828A',
  primario: '#7C9BFF',
  sobrePrimario: '#000000',
  ingreso: '#4ADE80',
  sobreIngreso: '#052E16',
  ingresoSuave: '#12331F',
  gasto: '#F87171',
  sobreGasto: '#3B0A0A',
  gastoSuave: '#3A1717',
  esqueleto: '#33333A',
  velo: 'rgba(0,0,0,0.6)',
};

export type EsquemaDeColor = 'claro' | 'oscuro';

export const paletas: Record<EsquemaDeColor, Paleta> = {
  claro: paletaClara,
  oscuro: paletaOscura,
};

export const espaciado = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radios = { sm: 8, md: 12, lg: 16, xl: 24, pildora: 999 } as const;
