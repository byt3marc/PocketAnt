import type { ImagenMovimiento, Movimiento } from '@/dominio/tipos';

import type { AlmacenImagenes } from '@/datos/almacenImagenes';

import { crearRepositorioMemoria } from '@/pruebas/repositorioMemoria';
import {
  analizarArchivo,
  crearArchivo,
  ErrorArchivoInvalido,
  serializarArchivo,
  VERSION_ARCHIVO,
} from '../sincronizacion/formatoArchivo';
import { planificarFusion } from '../sincronizacion/fusion';
import type { ProveedorSync } from '../sincronizacion/proveedor';
import { escribirJsonConImagenes } from '../sincronizacion/serializadorArchivo';
import { exportarDatos, importarDatos } from '../sincronizacion/servicio';

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

describe('formato del archivo', () => {
  it('ida y vuelta sin pérdidas', () => {
    const original = [
      mov('a'),
      mov('b', { tipo: 'ingreso', monto: 900.5, recurrente: true, periodo: 'mensual', frecuencia: 1 }),
      mov('c', { eliminado: true }),
    ];
    const texto = serializarArchivo(crearArchivo(original, new Date('2026-10-13T00:00:00.000Z')));
    const { archivo, descartados } = analizarArchivo(texto);
    expect(archivo.version).toBe(VERSION_ARCHIVO);
    expect(archivo.exportadoEn).toBe('2026-10-13T00:00:00.000Z');
    expect(archivo.movimientos).toEqual(original);
    expect(descartados).toBe(0);
  });

  it('rechaza lo que no es JSON o no tiene el formato', () => {
    expect(() => analizarArchivo('esto no es json')).toThrow(ErrorArchivoInvalido);
    expect(() => analizarArchivo('[1,2,3]')).toThrow(ErrorArchivoInvalido);
    expect(() => analizarArchivo('{"version":1}')).toThrow(ErrorArchivoInvalido);
    expect(() => analizarArchivo('{"movimientos":[]}')).toThrow(ErrorArchivoInvalido);
  });

  it('rechaza archivos de una versión más nueva', () => {
    let error: unknown;
    try {
      analizarArchivo(JSON.stringify({ version: VERSION_ARCHIVO + 1, movimientos: [] }));
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorArchivoInvalido);
    expect((error as ErrorArchivoInvalido).clave).toBe('error.archivo.version_nueva');
  });

  it('descarta movimientos inválidos y cuenta cuántos', () => {
    const texto = JSON.stringify({
      version: 1,
      exportadoEn: '2026-10-13T00:00:00.000Z',
      movimientos: [
        mov('ok'),
        { ...mov('sin-tipo'), tipo: 'otro' },
        { ...mov('monto-negativo'), monto: -5 },
        { ...mov('monto-texto'), monto: '10' },
        { ...mov('fecha-mala'), fecha: '2026-13-45' },
        { ...mov('sin-motivo'), motivo: '  ' },
        { ...mov(''), id: '' },
        'basura',
        null,
      ],
    });
    const { archivo, descartados } = analizarArchivo(texto);
    expect(archivo.movimientos.map((m) => m.id)).toEqual(['ok']);
    expect(descartados).toBe(8);
  });

  it('completa o corrige campos opcionales', () => {
    const { archivo } = analizarArchivo(
      JSON.stringify({
        version: 1,
        movimientos: [
          { id: 'x', tipo: 'gasto', monto: 12.345, motivo: ' Café ', fecha: '2026-10-12', recurrente: true },
          { id: 'y', tipo: 'gasto', monto: 5, motivo: 'Taxi', fecha: '2026-10-12', periodo: 'anual', frecuencia: 2 },
        ],
      }),
    );
    expect(archivo.movimientos[0]).toMatchObject({
      monto: 12.35,
      motivo: 'Café',
      recurrente: true,
      periodo: 'mensual',
      frecuencia: 1,
      eliminado: false,
      actualizadoEn: '1970-01-01T00:00:00.000Z',
    });
    // Sin `recurrente: true`, periodo y frecuencia se ignoran.
    expect(archivo.movimientos[1]).toMatchObject({ recurrente: false, periodo: null, frecuencia: null });
  });
});

describe('imágenes en el archivo', () => {
  const BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const imagen = (id: string, parcial: Partial<ImagenMovimiento> = {}): ImagenMovimiento => ({
    id,
    ancho: 800,
    alto: 600,
    orden: 0,
    base64: BASE64,
    ...parcial,
  });

  it('conserva las fotos con su Base64 y ordena según el arreglo', () => {
    const original = [mov('a', { imagenes: [imagen('dos', { orden: 1 }), imagen('uno', { orden: 0 })] })];
    const { archivo } = analizarArchivo(serializarArchivo(crearArchivo(original)));

    expect(archivo.movimientos[0].imagenes).toEqual([
      imagen('dos', { orden: 0 }),
      imagen('uno', { orden: 1 }),
    ]);
  });

  it('descarta solo las imágenes inválidas y conserva el movimiento', () => {
    const texto = JSON.stringify({
      version: 2,
      movimientos: [
        {
          ...mov('a'),
          imagenes: [
            imagen('ok'),
            imagen('id-malo', { id: '../fuera' }),
            imagen('ancho-malo', { ancho: 0 }),
            imagen('alto-malo', { alto: 1.5 }),
            imagen('sin-datos', { base64: '' }),
            imagen('base64-malo', { base64: 'no es base64' }),
            'basura',
          ],
        },
      ],
    });

    const { archivo, descartados } = analizarArchivo(texto);
    expect(descartados).toBe(0);
    expect(archivo.movimientos[0].imagenes).toEqual([imagen('ok', { orden: 0 })]);
  });

  it('acepta como máximo 5 fotos por movimiento', () => {
    const seis = Array.from({ length: 6 }, (_, i) => imagen(`img${i}`));
    const texto = JSON.stringify({ version: 2, movimientos: [{ ...mov('a'), imagenes: seis }] });

    expect(analizarArchivo(texto).archivo.movimientos[0].imagenes).toHaveLength(5);
  });

  it('un archivo sin el campo imagenes no toca las fotos locales', () => {
    const { archivo } = analizarArchivo(JSON.stringify({ version: 1, movimientos: [mov('a')] }));
    expect(archivo.movimientos[0]).not.toHaveProperty('imagenes');
  });
});

describe('planificarFusion', () => {
  it('agrega lo que no existe', () => {
    const plan = planificarFusion([mov('a')], [mov('b')]);
    expect(plan).toMatchObject({ nuevos: 1, actualizados: 0, eliminados: 0, sinCambios: 0 });
    expect(plan.aplicar.map((m) => m.id)).toEqual(['b']);
  });

  it('gana el más reciente por actualizadoEn', () => {
    const local = mov('a', { monto: 10, actualizadoEn: '2026-10-12T10:00:00.000Z' });
    const masNuevo = mov('a', { monto: 20, actualizadoEn: '2026-10-12T11:00:00.000Z' });
    const masViejo = mov('a', { monto: 5, actualizadoEn: '2026-10-12T09:00:00.000Z' });

    expect(planificarFusion([local], [masNuevo])).toMatchObject({ actualizados: 1, sinCambios: 0 });
    expect(planificarFusion([local], [masViejo])).toMatchObject({ actualizados: 0, sinCambios: 1, aplicar: [] });
  });

  it('en un empate se queda el local', () => {
    const plan = planificarFusion([mov('a', { monto: 10 })], [mov('a', { monto: 99 })]);
    expect(plan).toMatchObject({ sinCambios: 1, aplicar: [] });
  });

  it('propaga borrados y restauraciones', () => {
    const local = mov('a');
    const borrado = mov('a', { eliminado: true, actualizadoEn: '2026-10-13T00:00:00.000Z' });
    expect(planificarFusion([local], [borrado])).toMatchObject({ eliminados: 1 });

    const restaurado = mov('a', { eliminado: false, actualizadoEn: '2026-10-14T00:00:00.000Z' });
    expect(planificarFusion([borrado], [restaurado])).toMatchObject({ nuevos: 1 });
  });

  it('un borrado de algo que no existe localmente se guarda sin contarlo como nuevo', () => {
    const plan = planificarFusion([], [mov('z', { eliminado: true })]);
    expect(plan).toMatchObject({ nuevos: 0, sinCambios: 1 });
    expect(plan.aplicar).toHaveLength(1);
  });

  it('con ids repetidos en el archivo vale el más reciente', () => {
    const plan = planificarFusion(
      [],
      [
        mov('a', { monto: 1, actualizadoEn: '2026-10-12T10:00:00.000Z' }),
        mov('a', { monto: 2, actualizadoEn: '2026-10-12T12:00:00.000Z' }),
        mov('a', { monto: 3, actualizadoEn: '2026-10-12T11:00:00.000Z' }),
      ],
    );
    expect(plan.aplicar).toHaveLength(1);
    expect(plan.aplicar[0].monto).toBe(2);
  });

  it('es idempotente: importar dos veces el mismo archivo no cambia nada', async () => {
    const repo = crearRepositorioMemoria([mov('a')]);
    const entrantes = [mov('b'), mov('a', { monto: 99, actualizadoEn: '2026-10-13T00:00:00.000Z' })];
    const primera = await repo.fusionar(entrantes);
    const segunda = await repo.fusionar(entrantes);
    expect(primera).toMatchObject({ nuevos: 1, actualizados: 1 });
    expect(segunda).toMatchObject({ nuevos: 0, actualizados: 0, sinCambios: 2 });
  });
});

describe('servicio de exportar e importar', () => {
  const IMAGEN: ImagenMovimiento = { id: 'img1', ancho: 10, alto: 20, orden: 0 };
  const BASE64 = 'QUJD';

  function almacenFalso(base64: string | null) {
    const importadas: { movimientoId: string; imagenes: readonly ImagenMovimiento[] }[] = [];
    const conservadas: { movimientoId: string; imagenes: readonly ImagenMovimiento[] }[] = [];
    const almacen: AlmacenImagenes = {
      elegirDeGaleria: async () => [],
      tomarFoto: async () => null,
      guardar: async () => [],
      conservar: (movimientoId, imagenes) => {
        conservadas.push({ movimientoId, imagenes });
      },
      importar: async (movimientoId, imagenes) => {
        importadas.push({ movimientoId, imagenes });
      },
      uriDe: () => '',
      leerBase64: async () => base64,
      borrarTemporal: () => {},
      eliminarDeMovimiento: () => {},
      limpiarTodo: () => {},
    };
    return { almacen, importadas, conservadas };
  }

  function proveedorEnMemoria(): ProveedorSync & { enviado: string | null } {
    const estado: { enviado: string | null } = { enviado: null };
    return {
      id: 'memoria',
      nombre: 'Memoria',
      get enviado() {
        return estado.enviado;
      },
      async subir(archivo) {
        estado.enviado = serializarArchivo(archivo);
      },
      async descargar() {
        return estado.enviado ? analizarArchivo(estado.enviado) : null;
      },
    };
  }

  /** Proveedor que exporta en streaming (como hará el de archivo JSON). */
  function proveedorStreaming() {
    const trozos: string[] = [];
    let subidoCompleto = false;
    return {
      proveedor: {
        id: 'stream',
        nombre: 'Stream',
        async subir() {
          subidoCompleto = true;
        },
        async subirConImagenes(movimientos, almacen) {
          await escribirJsonConImagenes(
            movimientos,
            (id, imagen) => almacen.leerBase64(id, imagen),
            (trozo) => {
              trozos.push(trozo);
            },
          );
        },
        async descargar() {
          return null;
        },
      } satisfies ProveedorSync,
      get texto() {
        return trozos.join('');
      },
      get subidoCompleto() {
        return subidoCompleto;
      },
    };
  }

  it('lo exportado en un dispositivo se importa en otro, incluidos los borrados', async () => {
    const proveedor = proveedorEnMemoria();

    const celular = crearRepositorioMemoria([mov('a'), mov('b', { tipo: 'ingreso', monto: 500 })]);
    await celular.eliminar('a', new Date('2026-10-13T00:00:00.000Z'));
    expect(await exportarDatos(celular, proveedor)).toEqual({ total: 1 });

    const otro = crearRepositorioMemoria([mov('a')]);
    const resultado = await importarDatos(otro, proveedor);
    expect(resultado).toMatchObject({ nuevos: 1, eliminados: 1, descartados: 0 });
    expect((await otro.listarActivos()).map((m) => m.id)).toEqual(['b']);
  });

  it('devuelve null si el usuario cancela', async () => {
    const cancelado: ProveedorSync = {
      id: 'x',
      nombre: 'x',
      subir: async () => {},
      descargar: async () => null,
    };
    expect(await importarDatos(crearRepositorioMemoria(), cancelado)).toBeNull();
  });

  it('exporta el Base64 de las fotos y no incluye las de los borrados', async () => {
    const proveedor = proveedorEnMemoria();
    const conFotos = mov('a', { imagenes: [IMAGEN] });
    const borrado = mov('b', { eliminado: true, imagenes: [IMAGEN] });

    await exportarDatos(crearRepositorioMemoria([conFotos, borrado]), proveedor, almacenFalso(BASE64).almacen);

    const { archivo } = analizarArchivo(proveedor.enviado ?? '');
    expect(archivo.movimientos.find((m) => m.id === 'a')?.imagenes).toEqual([{ ...IMAGEN, base64: BASE64 }]);
    expect(archivo.movimientos.find((m) => m.id === 'b')).not.toHaveProperty('imagenes');
  });

  it('si no se puede leer ninguna foto, el movimiento viaja sin imagenes (no toca las locales al importar)', async () => {
    const proveedor = proveedorEnMemoria();
    await exportarDatos(
      crearRepositorioMemoria([mov('a', { imagenes: [IMAGEN] })]),
      proveedor,
      almacenFalso(null).almacen,
    );

    expect(analizarArchivo(proveedor.enviado ?? '').archivo.movimientos[0]).not.toHaveProperty('imagenes');
  });

  it('usa el streaming cuando el proveedor lo soporta y hay almacén', async () => {
    const streaming = proveedorStreaming();

    await exportarDatos(
      crearRepositorioMemoria([mov('a', { imagenes: [IMAGEN] })]),
      streaming.proveedor,
      almacenFalso(BASE64).almacen,
    );

    expect(streaming.subidoCompleto).toBe(false);
    expect(analizarArchivo(streaming.texto).archivo.movimientos[0].imagenes).toEqual([{ ...IMAGEN, base64: BASE64 }]);
  });

  it('cae a subir(archivo) cuando el proveedor no soporta streaming', async () => {
    const proveedor = proveedorEnMemoria();

    await exportarDatos(
      crearRepositorioMemoria([mov('a', { imagenes: [IMAGEN] })]),
      proveedor,
      almacenFalso(BASE64).almacen,
    );

    expect(proveedor.enviado).not.toBeNull();
  });

  it('al importar escribe las fotos en disco antes de fusionar y limpia las sobrantes', async () => {
    const nube = proveedorEnMemoria();
    await exportarDatos(
      crearRepositorioMemoria([mov('a', { imagenes: [IMAGEN] })]),
      nube,
      almacenFalso(BASE64).almacen,
    );

    const destino = crearRepositorioMemoria();
    const { almacen, importadas, conservadas } = almacenFalso(null);
    const resultado = await importarDatos(destino, nube, almacen);

    expect(resultado).toMatchObject({ nuevos: 1, descartados: 0 });
    expect(importadas).toEqual([{ movimientoId: 'a', imagenes: [{ ...IMAGEN, base64: BASE64 }] }]);
    expect(conservadas).toEqual([{ movimientoId: 'a', imagenes: [{ ...IMAGEN, base64: BASE64 }] }]);
  });
});

describe('repositorio en memoria', () => {
  it('ordena por fecha descendente y, en el mismo día, lo último guardado primero', async () => {
    const repo = crearRepositorioMemoria();
    await repo.guardar(mov('a', { fecha: '2026-10-10' }));
    await repo.guardar(mov('b', { fecha: '2026-10-12' }));
    await repo.guardar(mov('c', { fecha: '2026-10-12' }));
    expect((await repo.listarActivos()).map((m) => m.id)).toEqual(['c', 'b', 'a']);
  });

  it('el borrado es lógico', async () => {
    const repo = crearRepositorioMemoria([mov('a')]);
    await repo.eliminar('a', new Date('2026-10-13T00:00:00.000Z'));
    expect(await repo.listarActivos()).toHaveLength(0);
    const todos = await repo.listarTodos();
    expect(todos[0]).toMatchObject({ id: 'a', eliminado: true, actualizadoEn: '2026-10-13T00:00:00.000Z' });
  });

  it('limpiarTodo borra lógicamente todo lo activo y conserva las marcas previas', async () => {
    const repo = crearRepositorioMemoria([mov('a'), mov('b')]);
    await repo.eliminar('a', new Date('2026-10-12T00:00:00.000Z'));

    await repo.limpiarTodo(new Date('2026-10-13T00:00:00.000Z'));

    expect(await repo.listarActivos()).toHaveLength(0);
    const todos = (await repo.listarTodos()).sort((x, y) => (x.id < y.id ? -1 : 1));
    expect(todos[0]).toMatchObject({ id: 'a', eliminado: true, actualizadoEn: '2026-10-12T00:00:00.000Z' });
    expect(todos[1]).toMatchObject({ id: 'b', eliminado: true, actualizadoEn: '2026-10-13T00:00:00.000Z' });
  });
});
