import { claveCobro, cobrosDe, diasDesde, entradaDeCobro, estaRegistrado, quitarOmitidos } from '../cobros';
import type { Movimiento } from '../tipos';

const HOY = '2026-11-10';
let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `m${contador}`,
    tipo: 'gasto',
    monto: 40,
    motivo: 'Netflix',
    fecha: HOY,
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-11-10T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};
const mensual = (fecha: string, parcial: Partial<Movimiento> = {}) =>
  mov({ fecha, recurrente: true, periodo: 'mensual', frecuencia: 1, ...parcial });

const resumen = (lista: ReturnType<typeof cobrosDe>) =>
  lista.map((c) => `${c.movimiento.motivo} ${c.fecha} ${c.estado}`);

describe('estaRegistrado', () => {
  const netflix = mensual('2026-09-08');

  it('acepta una copia no recurrente del mismo tipo y motivo a ±7 días', () => {
    expect(estaRegistrado([netflix, mov({ fecha: '2026-11-01', motivo: ' NETFLIX' })], netflix, '2026-11-08')).toBe(true);
    expect(estaRegistrado([netflix, mov({ fecha: '2026-11-15' })], netflix, '2026-11-08')).toBe(true);
  });

  it('no cuenta copias lejanas, de otro tipo, recurrentes ni eliminadas', () => {
    const fecha = '2026-11-08';
    expect(estaRegistrado([netflix, mov({ fecha: '2026-10-31' })], netflix, fecha)).toBe(false);
    expect(estaRegistrado([netflix, mov({ fecha, tipo: 'ingreso' })], netflix, fecha)).toBe(false);
    expect(estaRegistrado([netflix, mensual(fecha)], netflix, fecha)).toBe(false);
    expect(estaRegistrado([netflix, mov({ fecha, eliminado: true })], netflix, fecha)).toBe(false);
    expect(estaRegistrado([netflix, mov({ fecha, motivo: 'Spotify' })], netflix, fecha)).toBe(false);
  });
});

describe('cobrosDe', () => {
  it('da un pendiente y un próximo por recurrente, ordenados por fecha', () => {
    const netflix = mensual('2026-08-08');
    const spotify = mensual('2026-07-20', { motivo: 'Spotify' });
    expect(resumen(cobrosDe([netflix, spotify], HOY))).toEqual([
      'Spotify 2026-10-20 pendiente',
      'Netflix 2026-11-08 pendiente',
      'Spotify 2026-11-20 proximo',
      'Netflix 2026-12-08 proximo',
    ]);
  });

  it('solo marca pendiente el último cobro, aunque haya dos en la ventana', () => {
    // Del 1 de noviembre al 1 de diciembre (hoy) caben dos cobros mensuales: el 1 de noviembre y hoy.
    const resultado = cobrosDe([mensual('2026-09-01')], '2026-12-01');
    expect(resultado.filter((c) => c.estado === 'pendiente').map((c) => c.fecha)).toEqual(['2026-12-01']);
  });

  it('no marca pendiente la fecha del propio movimiento', () => {
    expect(resumen(cobrosDe([mensual('2026-11-05')], HOY))).toEqual(['Netflix 2026-12-05 proximo']);
  });

  it('no marca pendiente un cobro ya anotado', () => {
    const netflix = mensual('2026-08-08');
    expect(resumen(cobrosDe([netflix, mov({ fecha: '2026-11-09' })], HOY))).toEqual([
      'Netflix 2026-12-08 proximo',
    ]);
  });

  it('ignora los cobros de hace más de 30 días y los que llegan después de 30 días', () => {
    // Anual: el último fue hace dos meses y el siguiente es dentro de diez.
    expect(cobrosDe([mov({ fecha: '2025-09-01', recurrente: true, periodo: 'anual', frecuencia: 1 })], HOY)).toEqual([]);
  });

  it('respeta el fin de mes', () => {
    const resultado = cobrosDe([mensual('2026-08-31')], '2026-12-01');
    expect(resultado.map((c) => `${c.fecha} ${c.estado}`)).toEqual(['2026-11-30 pendiente', '2026-12-31 proximo']);
  });

  it('cubre los cobros anuales y cada varios meses', () => {
    const anual = mov({ fecha: '2025-11-03', recurrente: true, periodo: 'anual', frecuencia: 1, motivo: 'Dominio' });
    const trimestral = mensual('2026-08-25', { frecuencia: 3, motivo: 'Seguro' });
    expect(resumen(cobrosDe([anual, trimestral], HOY))).toEqual([
      'Dominio 2026-11-03 pendiente',
      'Seguro 2026-11-25 proximo',
    ]);
  });

  it('incluye ingresos recurrentes e ignora los eliminados y los no recurrentes', () => {
    const sueldo = mensual('2026-10-30', { tipo: 'ingreso', motivo: 'Sueldo' });
    const borrado = mensual('2026-08-08', { eliminado: true });
    expect(resumen(cobrosDe([sueldo, borrado, mov({})], HOY))).toEqual(['Sueldo 2026-11-30 proximo']);
  });
});

describe('entradaDeCobro', () => {
  it('copia tipo, monto y motivo en la fecha del cobro, sin recurrencia', () => {
    const netflix = mensual('2026-08-08', { frecuencia: 2 });
    expect(entradaDeCobro(netflix, '2026-11-08')).toEqual({
      tipo: 'gasto',
      monto: 40,
      motivo: 'Netflix',
      fecha: '2026-11-08',
      recurrente: false,
      periodo: null,
      frecuencia: null,
    });
    expect(claveCobro({ movimiento: netflix, fecha: '2026-11-08' })).toBe(`${netflix.id}|2026-11-08`);
  });
});

describe('quitarOmitidos y diasDesde', () => {
  it('quita solo los pendientes omitidos', () => {
    const netflix = mensual('2026-08-08');
    const cobros = cobrosDe([netflix], HOY);
    expect(quitarOmitidos(cobros, undefined)).toEqual(cobros);
    expect(resumen(quitarOmitidos(cobros, [`${netflix.id}|2026-11-08`, `${netflix.id}|2026-12-08`]))).toEqual([
      'Netflix 2026-12-08 proximo',
    ]);
  });

  it('cuenta los días hasta hoy, también al cambiar de horario', () => {
    expect(diasDesde(HOY, HOY)).toBe(0);
    expect(diasDesde('2026-11-09', HOY)).toBe(1);
    expect(diasDesde('2026-10-20', HOY)).toBe(21);
    expect(diasDesde('2026-03-01', '2026-04-01')).toBe(31);
  });
});
