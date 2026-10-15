import * as ModuloSegundoPlano from '../../modules/descarga-segundo-plano';
import type { AccionNotificacion, TextosNotificacion } from '../../modules/descarga-segundo-plano';

export type { AccionNotificacion, TextosNotificacion };

/**
 * Lo que la descarga necesita para seguir con la pantalla apagada o con otra app delante: un servicio de Android en
 * primer plano (con notificación de progreso y botones Pausar/Cancelar). La descarga la hace el descargador de
 * siempre; esto solo evita que Android congele o mate la app mientras tanto.
 */
export interface SegundoPlano {
  iniciar: (textos: TextosNotificacion) => void;
  /** `fraccion` de 0 a 1; negativa = barra indeterminada. */
  actualizar: (fraccion: number, texto: string) => void;
  /** Apaga el servicio; con `mostrarAviso` deja una notificación normal con el resultado. */
  terminar: (titulo: string, texto: string, mostrarAviso: boolean) => void;
  /** Devuelve cómo dejar de escuchar. */
  alAccion: (escucha: (accion: AccionNotificacion) => void) => () => void;
}

/** El servicio real (no hace nada en la web, en Jest ni en un build sin el módulo). */
export const segundoPlanoNativo: SegundoPlano = {
  iniciar: ModuloSegundoPlano.iniciar,
  actualizar: ModuloSegundoPlano.actualizar,
  terminar: ModuloSegundoPlano.terminar,
  alAccion: ModuloSegundoPlano.alAccion,
};

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
