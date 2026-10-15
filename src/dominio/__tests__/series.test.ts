import { calcularEscala } from '../escala';
import { calcularTotales } from '../saldo';
import { construirSerie, fechaMasAntigua, resumirDia, resumirSerie } from '../series';
import type { Movimiento } from '../tipos';

let contador = 0;
function mov(parcial: Partial<Movimiento>): Movimiento {
  contador += 1;
  return {
    id: `m${contador}`,
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

describe('calcularTotales', () => {
  it('el saldo empieza en 0', () => {
    expect(calcularTotales([])).toEqual({ ingresos: 0, gastos: 0, saldo: 0 });
  });

  it('suma ingresos y resta gastos', () => {
    const t = calcularTotales([
      mov({ tipo: 'ingreso', monto: 900 }),
      mov({ tipo: 'gasto', monto: 12.5 }),
      mov({ tipo: 'gasto', monto: 7.5 }),
    ]);
    expect(t).toEqual({ ingresos: 900, gastos: 20, saldo: 880 });
  });

  it('no arrastra errores de punto flotante', () => {
    const t = calcularTotales([mov({ tipo: 'ingreso', monto: 0.1 }), mov({ tipo: 'ingreso', monto: 0.2 })]);
    expect(t.ingresos).toBe(0.3);
  });

  it('puede ser negativo e ignora los eliminados', () => {
    const t = calcularTotales([
      mov({ tipo: 'gasto', monto: 30 }),
      mov({ tipo: 'ingreso', monto: 500, eliminado: true }),
    ]);
    expect(t.saldo).toBe(-30);
  });
});

describe('construirSerie', () => {
  it('agrupa por día dentro de la ventana, de más antiguo a más reciente', () => {
    const serie = construirSerie(
      [
        mov({ tipo: 'ingreso', monto: 50, fecha: '2026-10-12', motivo: 'Venta' }),
        mov({ tipo: 'gasto', monto: 12, fecha: '2026-10-12', motivo: 'Café' }),
        mov({ tipo: 'gasto', monto: 3, fecha: '2026-10-12', motivo: 'Chicle' }),
        mov({ tipo: 'gasto', monto: 8, fecha: '2026-10-10' }),
        mov({ tipo: 'gasto', monto: 99, fecha: '2026-09-01' }), // fuera de la ventana
      ],
      '2026-10-12',
      7,
    );
    expect(serie).toHaveLength(7);
    expect(serie[0].clave).toBe('2026-10-06');
    expect(serie[6].clave).toBe('2026-10-12');
    expect(serie[6]).toMatchObject({ ingresos: 50, gastos: 15 });
    expect(serie[6].movimientos.map((m) => m.motivo)).toEqual(['Venta', 'Café', 'Chicle']);
    expect(serie[4]).toMatchObject({ ingresos: 0, gastos: 8 });
    expect(serie[0]).toMatchObject({ ingresos: 0, gastos: 0, movimientos: [] });
  });

  it('ignora los eliminados', () => {
    const serie = construirSerie([mov({ eliminado: true })], '2026-10-12', 3);
    expect(resumirSerie(serie).hayMovimientos).toBe(false);
  });

  it('resume el periodo', () => {
    const serie = construirSerie(
      [mov({ tipo: 'ingreso', monto: 300 }), mov({ tipo: 'gasto', monto: 85, fecha: '2026-10-09' })],
      '2026-10-12',
      7,
    );
    expect(resumirSerie(serie)).toEqual({ ingresos: 300, gastos: 85, neto: 215, hayMovimientos: true });
  });
});

describe('fechaMasAntigua', () => {
  it('devuelve el día más viejo o null sin movimientos', () => {
    expect(fechaMasAntigua([])).toBeNull();
    expect(
      fechaMasAntigua([mov({ fecha: '2026-10-12' }), mov({ fecha: '2026-08-03' }), mov({ fecha: '2026-09-30' })]),
    ).toBe('2026-08-03');
  });
});

describe('resumirDia', () => {
  it('compara el día con el anterior', () => {
    const r = resumirDia(
      [
        mov({ tipo: 'ingreso', monto: 120, fecha: '2026-10-12' }),
        mov({ tipo: 'gasto', monto: 45, fecha: '2026-10-12' }),
        mov({ tipo: 'gasto', monto: 75, fecha: '2026-10-11' }),
        mov({ tipo: 'gasto', monto: 500, fecha: '2026-10-10' }), // dos días atrás: no cuenta
      ],
      '2026-10-12',
    );
    expect(r.dia).toMatchObject({ clave: '2026-10-12', ingresos: 120, gastos: 45 });
    expect(r.anterior).toMatchObject({ clave: '2026-10-11', ingresos: 0, gastos: 75 });
    expect(r.difGastos).toBe(-30);
  });

  it('la diferencia no arrastra errores de punto flotante', () => {
    const r = resumirDia(
      [mov({ monto: 0.3, fecha: '2026-10-12' }), mov({ monto: 0.1, fecha: '2026-10-11' })],
      '2026-10-12',
    );
    expect(r.difGastos).toBe(0.2);
  });

  it('un día sin movimientos queda en cero e ignora los eliminados', () => {
    const r = resumirDia([mov({ eliminado: true, fecha: '2026-10-12' })], '2026-10-12');
    expect(r.dia).toMatchObject({ ingresos: 0, gastos: 0, movimientos: [] });
    expect(r.difGastos).toBe(0);
  });
});

describe('calcularEscala', () => {
  it('da una escala por defecto cuando no hay datos', () => {
    expect(calcularEscala(0)).toEqual({ maximo: 100, paso: 25, secciones: 4 });
  });

  it('redondea hacia arriba a valores "bonitos"', () => {
    expect(calcularEscala(87)).toMatchObject({ maximo: 100, paso: 25 });
    expect(calcularEscala(100)).toMatchObject({ maximo: 100, paso: 25 });
    expect(calcularEscala(101)).toMatchObject({ maximo: 200, paso: 50 });
    expect(calcularEscala(1234)).toMatchObject({ maximo: 2000, paso: 500 });
    expect(calcularEscala(9)).toMatchObject({ maximo: 10, paso: 2.5 });
  });

  it('el máximo siempre cubre el valor', () => {
    for (const v of [0.4, 3, 17, 48, 260, 999, 5400, 120000]) {
      expect(calcularEscala(v).maximo).toBeGreaterThanOrEqual(v);
    }
  });
});
