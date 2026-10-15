import { ocurrencias } from '../recurrencia';

const mensual = (fecha: string, frecuencia = 1) => ({
  fecha,
  recurrente: true,
  periodo: 'mensual' as const,
  frecuencia,
});
const anual = (fecha: string, frecuencia = 1) => ({
  fecha,
  recurrente: true,
  periodo: 'anual' as const,
  frecuencia,
});

describe('ocurrencias', () => {
  it('lista los cobros mensuales dentro del rango', () => {
    expect(ocurrencias(mensual('2026-01-15'), '2026-02-01', '2026-04-30')).toEqual([
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ]);
  });

  it('incluye la fecha del propio movimiento si cae en el rango (cobro futuro)', () => {
    expect(ocurrencias(mensual('2026-10-20'), '2026-10-13', '2026-12-31')).toEqual([
      '2026-10-20',
      '2026-11-20',
      '2026-12-20',
    ]);
  });

  it('los extremos del rango son inclusivos', () => {
    expect(ocurrencias(mensual('2026-01-15'), '2026-02-15', '2026-03-15')).toEqual(['2026-02-15', '2026-03-15']);
  });

  it('respeta la frecuencia (cada 2 meses)', () => {
    expect(ocurrencias(mensual('2026-01-10', 2), '2026-01-01', '2026-07-31')).toEqual([
      '2026-01-10',
      '2026-03-10',
      '2026-05-10',
      '2026-07-10',
    ]);
  });

  it('cruza el cambio de año', () => {
    expect(ocurrencias(mensual('2026-11-20'), '2026-12-01', '2027-02-28')).toEqual([
      '2026-12-20',
      '2027-01-20',
      '2027-02-20',
    ]);
  });

  it('un movimiento antiguo sigue generando los cobros de hoy en adelante', () => {
    expect(ocurrencias(mensual('2020-05-10'), '2026-10-01', '2026-12-31')).toEqual([
      '2026-10-10',
      '2026-11-10',
      '2026-12-10',
    ]);
  });

  it('recorta el día al fin de mes sin arrastrar el recorte', () => {
    expect(ocurrencias(mensual('2026-01-31'), '2026-01-31', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('en año bisiesto, el 29 de febrero vuelve a ser 29 solo cuando existe', () => {
    expect(ocurrencias(mensual('2028-01-29'), '2028-02-01', '2028-02-29')).toEqual(['2028-02-29']);
    expect(ocurrencias(anual('2024-02-29'), '2025-01-01', '2028-12-31')).toEqual([
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('calcula cobros anuales y cada 2 años', () => {
    expect(ocurrencias(anual('2026-03-05'), '2026-01-01', '2029-12-31')).toEqual([
      '2026-03-05',
      '2027-03-05',
      '2028-03-05',
      '2029-03-05',
    ]);
    expect(ocurrencias(anual('2026-03-05', 2), '2026-01-01', '2030-12-31')).toEqual(['2026-03-05', '2028-03-05', '2030-03-05']);
  });

  it('respeta el tope de fechas', () => {
    expect(ocurrencias(mensual('2026-01-01'), '2026-01-01', '2030-12-31', 3)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('un movimiento que no es recurrente no tiene cobros', () => {
    expect(
      ocurrencias({ fecha: '2026-01-15', recurrente: false, periodo: null, frecuencia: null }, '2026-01-01', '2026-12-31'),
    ).toEqual([]);
    expect(
      ocurrencias({ fecha: '2026-01-15', recurrente: true, periodo: null, frecuencia: null }, '2026-01-01', '2026-12-31'),
    ).toEqual([]);
  });

  it('si no hay cobros en el rango, devuelve una lista vacía', () => {
    expect(ocurrencias(anual('2026-03-05'), '2026-04-01', '2027-02-28')).toEqual([]);
  });
});
