import { crearI18n } from '@/i18n/traducir';

import { analizar, generarConsejos, normalizarMotivo } from '../analisis';
import type { Movimiento } from '../tipos';

// Fecha fija para no depender de «hoy». Periodo actual: 2026-10-02 … 2026-10-31; anterior: 2026-09-02 … 2026-10-01.
const FIN = '2026-10-31';

let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `m${contador}`,
    tipo: 'gasto',
    monto: 10,
    motivo: 'Algo',
    fecha: '2026-10-10',
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-10-10T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};

const gasto = (motivo: string, monto: number, fecha: string, extra: Partial<Movimiento> = {}) =>
  mov({ tipo: 'gasto', motivo, monto, fecha, ...extra });
const ingreso = (motivo: string, monto: number, fecha: string) => mov({ tipo: 'ingreso', motivo, monto, fecha });

const formatear = (valor: number) => `$${valor.toFixed(2)}`;

describe('normalizarMotivo', () => {
  it('ignora mayúsculas, tildes y espacios sobrantes', () => {
    expect(normalizarMotivo('  CAFÉ  ')).toBe('cafe');
    expect(normalizarMotivo('Café   con   leche')).toBe('cafe con leche');
    expect(normalizarMotivo('')).toBe('');
  });
});

describe('analizar: resumen y periodos', () => {
  it('suma ingresos y gastos del periodo actual y calcula el ahorro', () => {
    const hechos = analizar(
      [ingreso('Sueldo', 1000, '2026-10-05'), gasto('Renta', 300, '2026-10-06'), gasto('Comida', 200, '2026-10-20')],
      FIN,
    );
    expect(hechos.actual).toMatchObject({
      desde: '2026-10-02',
      hasta: '2026-10-31',
      ingresos: 1000,
      gastos: 500,
      neto: 500,
      cantidadGastos: 2,
      tasaAhorro: 50,
    });
    expect(hechos.hayDatos).toBe(true);
  });

  it('la tasa de ahorro es null sin ingresos y negativa si se gasta más de lo ganado', () => {
    expect(analizar([gasto('Comida', 50, '2026-10-20')], FIN).actual.tasaAhorro).toBeNull();
    expect(
      analizar([ingreso('Sueldo', 100, '2026-10-05'), gasto('Comida', 150, '2026-10-20')], FIN).actual.tasaAhorro,
    ).toBe(-50);
  });

  it('separa el periodo anterior y no mezcla los bordes', () => {
    const hechos = analizar(
      [
        gasto('Dentro', 10, '2026-10-02'), // primer día del actual
        gasto('Anterior', 20, '2026-10-01'), // último día del anterior
        gasto('Anterior viejo', 30, '2026-09-02'), // primer día del anterior
        gasto('Fuera', 99, '2026-09-01'),
        gasto('Futuro', 99, '2026-11-01'),
      ],
      FIN,
    );
    expect(hechos.actual.gastos).toBe(10);
    expect(hechos.anterior).toMatchObject({ desde: '2026-09-02', hasta: '2026-10-01', gastos: 50 });
  });

  it('ignora los movimientos eliminados', () => {
    const hechos = analizar([gasto('Borrado', 500, '2026-10-10', { eliminado: true })], FIN);
    expect(hechos.actual.gastos).toBe(0);
    expect(hechos.hayDatos).toBe(false);
  });

  it('suma en centavos sin arrastrar errores de punto flotante', () => {
    const hechos = analizar([gasto('A', 0.1, '2026-10-10'), gasto('B', 0.2, '2026-10-11')], FIN);
    expect(hechos.actual.gastos).toBe(0.3);
  });

  it('sin movimientos no hay datos', () => {
    const hechos = analizar([], FIN);
    expect(hechos.hayDatos).toBe(false);
    expect(hechos.topMotivos).toEqual([]);
    expect(hechos.suscripciones).toEqual([]);
    expect(hechos.hormiga).toBeNull();
    expect(hechos.diaMasCaro).toBeNull();
  });
});

describe('analizar: en qué gastas más', () => {
  it('agrupa motivos aunque cambien mayúsculas o tildes y ordena por total', () => {
    const hechos = analizar(
      [
        gasto('Café', 5, '2026-10-03'),
        gasto('café ', 5, '2026-10-04'),
        gasto('CAFÉ', 5, '2026-10-05'),
        gasto('Renta', 100, '2026-10-06'),
        ingreso('Café', 999, '2026-10-07'), // los ingresos no cuentan
      ],
      FIN,
    );
    expect(hechos.topMotivos).toEqual([
      { motivo: 'Renta', total: 100, cantidad: 1, porcentaje: 87 },
      { motivo: 'Café', total: 15, cantidad: 3, porcentaje: 13 },
    ]);
  });

  it('se queda con los 5 mayores', () => {
    const gastos = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((m, i) => gasto(m, 100 - i, '2026-10-10'));
    expect(analizar(gastos, FIN).topMotivos.map((g) => g.motivo)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('analizar: suscripciones', () => {
  it('convierte los cobros marcados a costo mensual y anual', () => {
    const hechos = analizar(
      [
        gasto('Netflix', 15.99, '2026-08-05', { recurrente: true, periodo: 'mensual', frecuencia: 1 }),
        gasto('Seguro', 120, '2026-03-01', { recurrente: true, periodo: 'anual', frecuencia: 1 }),
        gasto('Revista', 30, '2026-09-01', { recurrente: true, periodo: 'mensual', frecuencia: 2 }),
      ],
      FIN,
    );
    expect(hechos.suscripciones).toEqual([
      { motivo: 'Netflix', monto: 15.99, mensual: 15.99, anual: 191.88, origen: 'marcada' },
      { motivo: 'Revista', monto: 30, mensual: 15, anual: 180, origen: 'marcada' },
      { motivo: 'Seguro', monto: 120, mensual: 10, anual: 120, origen: 'marcada' },
    ]);
    expect(hechos.totalSuscripcionesMensual).toBe(40.99);
    expect(hechos.totalSuscripcionesAnual).toBe(491.88);
  });

  it('un ingreso recurrente no es una suscripción', () => {
    const hechos = analizar([ingreso('Sueldo', 1000, '2026-10-05')].map((m) => ({ ...m, recurrente: true, periodo: 'mensual' as const, frecuencia: 1 })), FIN);
    expect(hechos.suscripciones).toEqual([]);
  });

  it('detecta un cobro que se repite 3+ meses con monto parecido aunque no esté marcado', () => {
    const hechos = analizar(
      [
        gasto('Gimnasio', 50, '2026-08-03'),
        gasto('Gimnasio', 52, '2026-09-03'),
        gasto('gimnasio', 50, '2026-10-03'),
      ],
      FIN,
    );
    expect(hechos.suscripciones).toEqual([
      { motivo: 'gimnasio', monto: 50, mensual: 50, anual: 600, origen: 'detectada' },
    ]);
  });

  it('no sospecha si se repite en menos de 3 meses o si el monto varía mucho', () => {
    expect(
      analizar([gasto('Gimnasio', 50, '2026-09-03'), gasto('Gimnasio', 50, '2026-10-03')], FIN).suscripciones,
    ).toEqual([]);
    expect(
      analizar(
        [gasto('Super', 20, '2026-08-03'), gasto('Super', 80, '2026-09-03'), gasto('Super', 35, '2026-10-03')],
        FIN,
      ).suscripciones,
    ).toEqual([]);
  });

  it('varias compras el mismo mes cuentan como un solo mes', () => {
    const hechos = analizar([gasto('Café', 5, '2026-10-03'), gasto('Café', 5, '2026-10-04'), gasto('Café', 5, '2026-10-05')], FIN);
    expect(hechos.suscripciones).toEqual([]);
  });

  it('lo marcado manda sobre lo detectado y no se duplica', () => {
    const hechos = analizar(
      [
        gasto('Spotify', 10, '2026-08-03'),
        gasto('Spotify', 10, '2026-09-03'),
        gasto('Spotify', 10, '2026-10-03', { recurrente: true, periodo: 'mensual', frecuencia: 1 }),
      ],
      FIN,
    );
    expect(hechos.suscripciones).toHaveLength(1);
    expect(hechos.suscripciones[0].origen).toBe('marcada');
  });
});

describe('analizar: gasto hormiga', () => {
  const sueldo = ingreso('Sueldo', 1000, '2026-10-02'); // umbral = 2 % = 20

  it('cuenta las compras pequeñas respecto a los ingresos del periodo', () => {
    const hechos = analizar(
      [
        sueldo,
        gasto('Café', 4, '2026-10-03'),
        gasto('Café', 4, '2026-10-04'),
        gasto('Café', 4, '2026-10-05'),
        gasto('Café', 4, '2026-10-06'),
        gasto('Snack', 6, '2026-10-07'),
        gasto('Renta', 400, '2026-10-08'),
      ],
      FIN,
    );
    expect(hechos.hormiga).toMatchObject({ umbral: 20, cantidad: 5, total: 22 });
    expect(hechos.hormiga?.porcentaje).toBeCloseTo((22 / 422) * 100, 0);
    expect(hechos.hormiga?.masFrecuente).toMatchObject({ motivo: 'Café', cantidad: 4 });
  });

  it('con menos de 5 compras pequeñas no habla de gasto hormiga', () => {
    const hechos = analizar([sueldo, gasto('Café', 4, '2026-10-03'), gasto('Café', 4, '2026-10-04')], FIN);
    expect(hechos.hormiga).toBeNull();
  });

  it('sin ingresos usa la mediana de los gastos como umbral', () => {
    const gastos = [1, 1, 1, 1, 1, 100, 100].map((monto, i) => gasto(`G${i}`, monto, '2026-10-10'));
    const hechos = analizar(gastos, FIN);
    expect(hechos.hormiga).toMatchObject({ umbral: 1, cantidad: 5, total: 5 });
    expect(hechos.hormiga?.masFrecuente).toBeNull(); // ningún motivo se repite 3 veces
  });
});

describe('analizar: tendencia y día más caro', () => {
  it('compara los gastos con los del periodo anterior', () => {
    const sube = analizar([gasto('A', 150, '2026-10-10'), gasto('B', 100, '2026-09-10')], FIN);
    expect(sube.tendencia).toEqual({ actual: 150, anterior: 100, diferencia: 50, porcentaje: 50 });
    const baja = analizar([gasto('A', 50, '2026-10-10'), gasto('B', 100, '2026-09-10')], FIN);
    expect(baja.tendencia).toMatchObject({ diferencia: -50, porcentaje: -50 });
  });

  it('sin gastos antes, el porcentaje es null', () => {
    expect(analizar([gasto('A', 50, '2026-10-10')], FIN).tendencia.porcentaje).toBeNull();
  });

  it('encuentra el día de la semana que más gasta (necesita al menos 10 gastos)', () => {
    // 2026-10-05, 12, 19 y 26 son lunes.
    const lunes = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((f) => gasto('Gran compra', 100, f));
    const resto = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].map((f) =>
      gasto('Pequeña', 10, f),
    );
    const hechos = analizar([...lunes, ...resto], FIN);
    expect(hechos.diaMasCaro).toEqual({ diaSemana: 1, total: 400, porcentaje: 87 });
    expect(analizar(lunes, FIN).diaMasCaro).toBeNull();
  });
});

describe('generarConsejos', () => {
  const es = crearI18n('es');
  const en = crearI18n('en');

  it('sin datos no hay consejos', () => {
    expect(generarConsejos(analizar([], FIN), es, formatear)).toEqual([]);
  });

  it('con datos tranquilos devuelve una frase de que no hay alertas', () => {
    const hechos = analizar([ingreso('Sueldo', 1000, '2026-10-02'), gasto('Renta', 700, '2026-10-05'), gasto('Luz', 100, '2026-10-06')], FIN);
    // Sin ingresos anotados y con gastos repartidos no hay nada que señalar.
    const sinIngresos = analizar(
      [
        gasto('Luz', 100, '2026-10-06'),
        gasto('Agua', 95, '2026-10-07'),
        gasto('Gas', 90, '2026-10-08'),
        gasto('Internet', 100, '2026-10-09'),
        gasto('Limpieza', 95, '2026-10-10'),
      ],
      FIN,
    );
    expect(generarConsejos(sinIngresos, es, formatear)).toEqual(['Sin alertas: tus gastos se ven estables.']);
    expect(generarConsejos(hechos, es, formatear).join(' ')).toContain('ahorraste el 20%');
  });

  it('avisa del déficit antes que de lo demás', () => {
    const hechos = analizar([ingreso('Sueldo', 100, '2026-10-02'), gasto('Renta', 250, '2026-10-05')], FIN);
    const consejos = generarConsejos(hechos, es, formatear);
    expect(consejos[0]).toBe('Gastaste $150.00 más de lo que ingresó. Empieza por recortar lo que menos valor te da.');
  });

  it('habla de suscripciones, de la mayor y del gasto hormiga, y no pasa de 4', () => {
    const hechos = analizar(
      [
        ingreso('Sueldo', 1000, '2026-10-02'),
        gasto('Netflix', 15, '2026-10-03', { recurrente: true, periodo: 'mensual', frecuencia: 1 }),
        gasto('Gimnasio', 60, '2026-10-03', { recurrente: true, periodo: 'mensual', frecuencia: 1 }),
        gasto('Café', 4, '2026-10-04'),
        gasto('Café', 4, '2026-10-05'),
        gasto('Café', 4, '2026-10-06'),
        gasto('Café', 4, '2026-10-07'),
        gasto('Café', 4, '2026-10-08'),
        gasto('Café', 4, '2026-10-09'),
        gasto('Café', 4, '2026-10-10'),
      ],
      FIN,
    );
    const consejos = generarConsejos(hechos, es, formatear);
    expect(consejos.length).toBeLessThanOrEqual(4);
    expect(consejos[0]).toContain('suman $75.00 al mes ($900.00 al año)');
    expect(consejos[1]).toBe('Cancelar «Gimnasio» te ahorraría $720.00 al año.');
    // Lo recurrente no cuenta como compra pequeña: son las 7 compras de café.
    expect(consejos.join(' ')).toContain('7 compras pequeñas');
  });

  it('avisa si el gasto sube o baja un 15 % o más', () => {
    const sube = analizar([gasto('A', 150, '2026-10-10'), gasto('B', 100, '2026-09-10')], FIN);
    expect(generarConsejos(sube, es, formatear).join(' ')).toContain('Gastaste 50% más');
    const baja = analizar([gasto('A', 50, '2026-10-10'), gasto('B', 100, '2026-09-10')], FIN);
    expect(generarConsejos(baja, es, formatear).join(' ')).toContain('gastaste 50% menos');
  });

  it('señala cuando un motivo concentra 30 % o más de los gastos', () => {
    const hechos = analizar([gasto('Renta', 300, '2026-10-05'), gasto('Luz', 50, '2026-10-06'), gasto('Agua', 50, '2026-10-07')], FIN);
    expect(generarConsejos(hechos, es, formatear).join(' ')).toContain('«Renta» concentra el 75% de tus gastos ($300.00)');
  });

  it('está traducido al inglés', () => {
    const hechos = analizar(
      [
        ingreso('Pay', 100, '2026-10-02'),
        gasto('Rent', 250, '2026-10-05'),
        gasto('Netflix', 15, '2026-10-03', { recurrente: true, periodo: 'mensual', frecuencia: 1 }),
      ],
      FIN,
    );
    const consejos = generarConsejos(hechos, en, formatear);
    expect(consejos[0]).toBe('You spent $165.00 more than you earned. Start by cutting what gives you the least value.');
    expect(consejos.join(' ')).toContain('subscriptions and fixed charges add up to $15.00 a month');
  });

  it('el día más caro sale con el nombre del día en cada idioma', () => {
    const lunes = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((f) => gasto('Gran compra', 100, f));
    const resto = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].map((f) =>
      gasto('Pequeña', 10, f),
    );
    const hechos = analizar([...lunes, ...resto], FIN);
    expect(generarConsejos(hechos, es, formatear).join(' ')).toContain('Los lunes concentran el 87%');
    expect(generarConsejos(hechos, en, formatear).join(' ')).toContain('Mondays make up 87%');
  });
});
