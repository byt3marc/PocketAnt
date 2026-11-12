import { agruparPorDia, filtrarMovimientos } from '../historial';
import type { Movimiento } from '../tipos';

let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `m${contador}`,
    tipo: 'gasto',
    monto: 10,
    motivo: 'Algo',
    fecha: '2026-11-10',
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-11-10T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};

describe('filtrarMovimientos', () => {
  const lista = [
    mov({ motivo: 'Café con leche' }),
    mov({ tipo: 'ingreso', motivo: 'Sueldo' }),
    mov({ motivo: 'Pasaje' }),
    mov({ motivo: 'CAFE' }),
  ];

  it('sin búsqueda ni filtro devuelve todo, en el mismo orden', () => {
    expect(filtrarMovimientos(lista, { tipo: 'todos', texto: '' })).toEqual(lista);
    expect(filtrarMovimientos(lista, { tipo: 'todos', texto: '   ' })).toEqual(lista);
  });

  it('busca parte del motivo sin distinguir mayúsculas ni tildes', () => {
    expect(filtrarMovimientos(lista, { tipo: 'todos', texto: 'café' }).map((m) => m.motivo)).toEqual([
      'Café con leche',
      'CAFE',
    ]);
    expect(filtrarMovimientos(lista, { tipo: 'todos', texto: 'LECHE' })).toHaveLength(1);
  });

  it('combina la búsqueda con el filtro de tipo', () => {
    expect(filtrarMovimientos(lista, { tipo: 'ingreso', texto: '' }).map((m) => m.motivo)).toEqual(['Sueldo']);
    expect(filtrarMovimientos(lista, { tipo: 'ingreso', texto: 'cafe' })).toEqual([]);
  });
});

describe('agruparPorDia', () => {
  it('pone una cabecera antes de cada día, con el neto del día en centavos exactos', () => {
    const lista = [
      mov({ fecha: '2026-11-10', tipo: 'ingreso', monto: 0.3 }),
      mov({ fecha: '2026-11-10', monto: 0.1 }),
      mov({ fecha: '2026-11-08', monto: 25 }),
    ];
    const filas = agruparPorDia(lista);
    expect(filas.map((f) => f.tipo)).toEqual(['dia', 'movimiento', 'movimiento', 'dia', 'movimiento']);
    expect(filas[0]).toEqual({ tipo: 'dia', clave: '2026-11-10', neto: 0.2 });
    expect(filas[3]).toEqual({ tipo: 'dia', clave: '2026-11-08', neto: -25 });
    expect(filas[1]).toEqual({ tipo: 'movimiento', movimiento: lista[0] });
  });

  it('sin movimientos no hay filas', () => {
    expect(agruparPorDia([])).toEqual([]);
  });
});
