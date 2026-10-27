import type { ImagenMovimiento, Movimiento } from '@/dominio/tipos';

import { analizarArchivo, crearArchivo, serializarArchivo } from '../sincronizacion/formatoArchivo';
import { crearEscritorPorBloques, escribirJsonConImagenes } from '../sincronizacion/serializadorArchivo';

const AHORA = new Date('2026-10-24T12:00:00.000Z');

function mov(id: string, parcial: Partial<Movimiento> = {}): Movimiento {
  return {
    id,
    tipo: 'gasto',
    monto: 10,
    motivo: 'Prueba',
    fecha: '2026-10-12',
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-10-12T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
}

const imagen = (id: string, orden: number): ImagenMovimiento => ({ id, ancho: 800, alto: 600, orden });

/** Reúne los trozos que escribe el serializador y devuelve el texto completo. */
async function exportar(movimientos: readonly Movimiento[], leerBase64: (m: string, i: ImagenMovimiento) => Promise<string | null>): Promise<string> {
  const trozos: string[] = [];
  await escribirJsonConImagenes(movimientos, leerBase64, (trozo) => {
    trozos.push(trozo);
  }, AHORA);
  return trozos.join('');
}

describe('escribirJsonConImagenes', () => {
  it('con 20 movimientos y 5 fotos cada uno produce el mismo objeto que serializarArchivo', async () => {
    const movimientos = Array.from({ length: 20 }, (_, i) =>
      mov(`m${i}`, { imagenes: Array.from({ length: 5 }, (_, j) => imagen(`f${i}${j}`, j)) }),
    );
    // Base64 solo alfanumérico: el validador de importación rechaza cualquier otro carácter.
    const b64 = (img: ImagenMovimiento) => `B64${img.id}`;
    const texto = await exportar(movimientos, async (_id, img) => b64(img));

    const clasico = crearArchivo(
      movimientos.map((m) => ({
        ...m,
        imagenes: m.imagenes?.map((img) => ({ ...img, base64: b64(img) })),
      })),
      AHORA,
    );
    expect(JSON.parse(serializarArchivo(clasico))).toEqual(analizarArchivo(texto).archivo);
  });

  it('conserva el orden de los movimientos y de sus fotos', async () => {
    const movimientos = [
      mov('segundo', { imagenes: [imagen('foto-b', 1), imagen('foto-a', 0)] }),
      mov('primero'),
    ];
    const texto = await exportar(movimientos, async () => 'b64');

    const { archivo } = analizarArchivo(texto);
    expect(archivo.movimientos.map((m) => m.id)).toEqual(['segundo', 'primero']);
    expect(archivo.movimientos[0].imagenes?.map((i) => i.id)).toEqual(['foto-b', 'foto-a']);
  });

  it('nunca lee dos fotos a la vez', async () => {
    let enCurso = 0;
    let maximo = 0;
    const movimientos = Array.from({ length: 20 }, (_, i) => mov(`m${i}`, { imagenes: [imagen(`f${i}`, 0)] }));

    await exportar(movimientos, async () => {
      enCurso += 1;
      maximo = Math.max(maximo, enCurso);
      // Con un poco de demora se vería cualquier lectura en paralelo.
      await new Promise((resolver) => setTimeout(resolver, 1));
      enCurso -= 1;
      return 'b64';
    });

    expect(maximo).toBe(1);
  });

  it('omite las fotos que no se pueden leer y, si no queda ninguna, viaja sin imagenes', async () => {
    const movimientos = [
      mov('parcial', { imagenes: [imagen('a', 0), imagen('b', 1)] }),
      mov('todo-falla', { imagenes: [imagen('c', 0)] }),
      mov('borrado', { eliminado: true, imagenes: [imagen('d', 0)] }),
    ];
    const texto = await exportar(movimientos, async (_id, img) => (img.id === 'b' || img.id === 'c' ? null : `B64${img.id}`));

    const { archivo } = analizarArchivo(texto);
    expect(archivo.movimientos[0].imagenes?.map((i) => i.id)).toEqual(['a']);
    expect(archivo.movimientos[1]).not.toHaveProperty('imagenes');
    expect(archivo.movimientos[2]).not.toHaveProperty('imagenes');
  });

  it('sin movimientos escribe un archivo válido y vacío', async () => {
    const texto = await exportar([], async () => null);
    expect(analizarArchivo(texto).archivo).toEqual(crearArchivo([], AHORA));
  });
});

describe('crearEscritorPorBloques', () => {
  it('acumula los trozos y manda el resto al volcar', async () => {
    const bloques: string[] = [];
    const escritor = crearEscritorPorBloques((bloque) => {
      bloques.push(bloque);
    }, 4);

    await escritor.escribir('ab');
    await escritor.escribir('cd');
    await escritor.escribir('ef');
    expect(bloques).toEqual(['abcd']);

    await escritor.volcar();
    expect(bloques).toEqual(['abcd', 'ef']);
  });

  it('no escribe nada si no queda pendiente', async () => {
    const bloques: string[] = [];
    const escritor = crearEscritorPorBloques((bloque) => {
      bloques.push(bloque);
    }, 4);

    await escritor.escribir('abcd');
    await escritor.volcar();
    await escritor.volcar();
    expect(bloques).toEqual(['abcd']);
  });

  it('el JSON troceado por bloques sigue siendo válido', async () => {
    const movimientos = [mov('a', { imagenes: [imagen('f', 0)] }), mov('b')];
    const bloques: string[] = [];
    const escritor = crearEscritorPorBloques((bloque) => {
      bloques.push(bloque);
    }, 10);

    await escribirJsonConImagenes(movimientos, async () => 'B64', escritor.escribir, AHORA);
    await escritor.volcar();

    expect(bloques.length).toBeGreaterThan(1);
    expect(analizarArchivo(bloques.join('')).archivo.movimientos.map((m) => m.id)).toEqual(['a', 'b']);
  });
});
