import { sumarDias } from '../fechas';
import { DIAS_SUGERENCIAS, sugerirMotivos } from '../sugerencias';
import type { Movimiento } from '../tipos';

const HOY = '2026-11-10';
let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `m${contador}`,
    tipo: 'gasto',
    monto: 5,
    motivo: 'Café',
    fecha: HOY,
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-11-10T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};

const motivos = (lista: { motivo: string }[]) => lista.map((s) => s.motivo);

describe('sugerirMotivos', () => {
  it('ordena por cuántas veces se usó y une mayúsculas, tildes y espacios', () => {
    const movimientos = [
      mov({ motivo: 'Pasaje' }),
      mov({ motivo: 'café' }),
      mov({ motivo: 'CAFE ' }),
      mov({ motivo: 'Café' }),
      mov({ motivo: 'Almuerzo' }),
      mov({ motivo: 'Almuerzo' }),
    ];
    expect(motivos(sugerirMotivos(movimientos, 'gasto', '', HOY))).toEqual(['Café', 'Almuerzo', 'Pasaje']);
  });

  it('usa la grafía y el monto de la última vez', () => {
    const movimientos = [
      mov({ motivo: 'café', monto: 4, fecha: sumarDias(HOY, -5) }),
      mov({ motivo: 'Café grande', monto: 9, fecha: sumarDias(HOY, -3) }),
      mov({ motivo: 'Cafe', monto: 6.5, fecha: sumarDias(HOY, -1) }),
    ];
    const [primera] = sugerirMotivos(movimientos, 'gasto', '', HOY);
    expect(primera).toEqual({ motivo: 'Cafe', monto: 6.5 });
  });

  it('a igual fecha, gana el último que se tocó', () => {
    const movimientos = [
      mov({ motivo: 'Taxi', monto: 10, actualizadoEn: '2026-11-10T08:00:00.000Z' }),
      mov({ motivo: 'taxi', monto: 12, actualizadoEn: '2026-11-10T09:00:00.000Z' }),
    ];
    expect(sugerirMotivos(movimientos, 'gasto', '', HOY)[0]).toEqual({ motivo: 'taxi', monto: 12 });
  });

  it('solo cuenta como frecuente lo de los últimos 90 días; a igualdad, el más reciente primero', () => {
    const viejo = sumarDias(HOY, -DIAS_SUGERENCIAS);
    const movimientos = [
      mov({ motivo: 'Gimnasio', fecha: viejo }),
      mov({ motivo: 'Gimnasio', fecha: viejo }),
      mov({ motivo: 'Gimnasio', fecha: viejo }),
      mov({ motivo: 'Pan', fecha: sumarDias(HOY, -10) }),
      mov({ motivo: 'Leche', fecha: sumarDias(HOY, -2) }),
    ];
    expect(motivos(sugerirMotivos(movimientos, 'gasto', '', HOY))).toEqual(['Leche', 'Pan', 'Gimnasio']);
  });

  it('separa ingresos de gastos y omite los eliminados', () => {
    const movimientos = [
      mov({ tipo: 'ingreso', motivo: 'Sueldo' }),
      mov({ motivo: 'Cine', eliminado: true }),
      mov({ motivo: 'Pan' }),
    ];
    expect(motivos(sugerirMotivos(movimientos, 'ingreso', '', HOY))).toEqual(['Sueldo']);
    expect(motivos(sugerirMotivos(movimientos, 'gasto', '', HOY))).toEqual(['Pan']);
  });

  it('con texto, deja los que lo contienen y quita el que ya está escrito', () => {
    const movimientos = [mov({ motivo: 'Café' }), mov({ motivo: 'Café con leche' }), mov({ motivo: 'Pan' })];
    expect(motivos(sugerirMotivos(movimientos, 'gasto', 'caf', HOY))).toEqual(['Café', 'Café con leche']);
    expect(motivos(sugerirMotivos(movimientos, 'gasto', 'Cafe', HOY))).toEqual(['Café con leche']);
    expect(sugerirMotivos(movimientos, 'gasto', 'zzz', HOY)).toEqual([]);
  });

  it('respeta el límite', () => {
    const movimientos = Array.from({ length: 10 }, (_, i) => mov({ motivo: `Cosa ${i}` }));
    expect(sugerirMotivos(movimientos, 'gasto', '', HOY)).toHaveLength(6);
    expect(sugerirMotivos(movimientos, 'gasto', '', HOY, 3)).toHaveLength(3);
  });
});
