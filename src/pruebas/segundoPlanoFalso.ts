import type { AccionNotificacion, SegundoPlano, TextosNotificacion } from '@/ia/segundoPlano';

export interface LlamadaSegundoPlano {
  tipo: 'iniciar' | 'actualizar' | 'terminar';
  textos?: TextosNotificacion;
  fraccion?: number;
  texto?: string;
  titulo?: string;
  mostrarAviso?: boolean;
}

/** Un servicio falso que anota lo que se le pide y deja «tocar» los botones de la notificación. */
export function crearSegundoPlanoFalso(): SegundoPlano & {
  llamadas: LlamadaSegundoPlano[];
  tocar: (accion: AccionNotificacion) => void;
  escuchas: number;
} {
  const llamadas: LlamadaSegundoPlano[] = [];
  const escuchadores = new Set<(accion: AccionNotificacion) => void>();
  return {
    llamadas,
    get escuchas() {
      return escuchadores.size;
    },
    iniciar: (textos) => {
      llamadas.push({ tipo: 'iniciar', textos });
    },
    actualizar: (fraccion, texto) => {
      llamadas.push({ tipo: 'actualizar', fraccion, texto });
    },
    terminar: (titulo, texto, mostrarAviso) => {
      llamadas.push({ tipo: 'terminar', titulo, texto, mostrarAviso });
    },
    alAccion: (escucha) => {
      escuchadores.add(escucha);
      return () => {
        escuchadores.delete(escucha);
      };
    },
    tocar: (accion) => escuchadores.forEach((escucha) => escucha(accion)),
  };
}
