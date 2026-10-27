import type { ImagenMovimiento, Movimiento } from '@/dominio/tipos';

import { VERSION_ARCHIVO } from './formatoArchivo';

/** Lee una foto como JPEG en Base64; `null` si el archivo ya no está. */
export type LeerBase64 = (movimientoId: string, imagen: ImagenMovimiento) => Promise<string | null>;
/** Recibe un trozo del JSON para añadirlo al archivo que se está construyendo. */
export type EscribirTrozo = (trozo: string) => void | Promise<void>;

/**
 * Un movimiento listo para exportar: los borrados viajan sin fotos y las que no se pueden leer se
 * omiten en vez de romper la exportación; si no se puede leer ninguna, el movimiento viaja sin
 * `imagenes` («no tocar» al importar en el otro dispositivo). Las fotos se leen en serie para no
 * acumular memoria. Lo usan el streaming y el camino con todo en memoria.
 */
export async function movimientoConImagenes(
  movimiento: Movimiento,
  leerBase64: LeerBase64,
): Promise<Movimiento> {
  if (movimiento.eliminado) return { ...movimiento, imagenes: undefined };
  if (!movimiento.imagenes?.length) return movimiento;

  const imagenes: ImagenMovimiento[] = [];
  for (const imagen of movimiento.imagenes) {
    const base64 = await leerBase64(movimiento.id, imagen);
    if (base64) imagenes.push({ ...imagen, base64 });
  }
  return { ...movimiento, imagenes: imagenes.length > 0 ? imagenes : undefined };
}

/**
 * Escribe el JSON de exportación por trozos: cabecera, un movimiento por vez y cierre. Cada
 * movimiento lee sus fotos una a una (en serie) y se serializa en cuanto está completo, así el
 * pico de memoria depende de un movimiento y no del historial completo. Produce el mismo objeto
 * que `serializarArchivo(crearArchivo(...))`, pero compacto (sin indentación).
 */
export async function escribirJsonConImagenes(
  movimientos: readonly Movimiento[],
  leerBase64: LeerBase64,
  escribir: EscribirTrozo,
  ahora: Date = new Date(),
): Promise<void> {
  await escribir(`{"version":${VERSION_ARCHIVO},"exportadoEn":${JSON.stringify(ahora.toISOString())},"movimientos":[`);

  for (const [indice, movimiento] of movimientos.entries()) {
    if (indice > 0) await escribir(',');
    await escribir(JSON.stringify(await movimientoConImagenes(movimiento, leerBase64)));
  }

  await escribir(']}');
}

/** Tamaño (en caracteres) con el que se agrupan los trozos antes de tocar el disco. */
const TAMANO_BLOQUE = 4 * 1024 * 1024;

export interface EscritorPorBloques {
  /** Añade un trozo; solo toca el destino cuando el bloque acumulado se llena. */
  escribir(trozo: string): Promise<void>;
  /** Envía al destino lo que quede pendiente (hay que llamarlo al terminar). */
  volcar(): Promise<void>;
}

/**
 * Agrupa los trozos antes de escribirlos: `File.write(..., { append: true })` abre y cierra el
 * archivo en cada llamada, así que escribir un movimiento por vez sería demasiado. El bloque acota
 * la memoria extra que se retiene.
 */
export function crearEscritorPorBloques(
  destino: EscribirTrozo,
  limite = TAMANO_BLOQUE,
): EscritorPorBloques {
  let pendiente = '';

  const enviar = async (): Promise<void> => {
    if (pendiente === '') return;
    const bloque = pendiente;
    pendiente = '';
    await destino(bloque);
  };

  return {
    async escribir(trozo) {
      pendiente += trozo;
      if (pendiente.length >= limite) await enviar();
    },
    volcar: enviar,
  };
}
