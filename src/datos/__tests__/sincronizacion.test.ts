import type { Movimiento } from '@/dominio/tipos';

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
});
