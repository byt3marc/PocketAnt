import { cambiarMes, mesDeClave, ordenarSemana, semanasDelMes } from '../calendario';

const OCTUBRE = 9; // los meses van de 0 a 11

const dias = (semanas: (string | null)[][]) => semanas.flat().filter((d): d is string => d !== null);

describe('semanasDelMes', () => {
  it('octubre de 2026 empieza en jueves: con la semana desde el lunes hay 3 huecos', () => {
    const semanas = semanasDelMes(2026, OCTUBRE, 1);
    expect(semanas[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(semanas[1][0]).toBe('2026-10-05');
  });

  it('con la semana desde el domingo hay 4 huecos', () => {
    const semanas = semanasDelMes(2026, OCTUBRE, 0);
    expect(semanas[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('siempre son 6 filas de 7 y cada día del mes aparece una sola vez, en orden', () => {
    for (const [anio, mes, total] of [
      [2026, OCTUBRE, 31],
      [2026, 1, 28], // febrero
      [2028, 1, 29], // febrero bisiesto
      [2026, 3, 30], // abril
      [2027, 7, 31], // agosto: empieza en domingo (6 huecos con semana desde el lunes)
    ] as const) {
      for (const primerDia of [0, 1, 6]) {
        const semanas = semanasDelMes(anio, mes, primerDia);
        expect(semanas).toHaveLength(6);
        for (const fila of semanas) expect(fila).toHaveLength(7);
        const lista = dias(semanas);
        expect(lista).toHaveLength(total);
        expect(lista).toEqual([...lista].sort());
        expect(new Set(lista).size).toBe(total);
      }
    }
  });

  it('un mes que empieza el último día de la semana usa 6 huecos y aun así cabe en 6 filas', () => {
    // Agosto de 2027 empieza en domingo; con la semana desde el lunes el 1 cae en la última columna.
    const semanas = semanasDelMes(2027, 7, 1);
    expect(semanas[0]).toEqual([null, null, null, null, null, null, '2027-08-01']);
    expect(dias(semanas)).toHaveLength(31);
    expect(semanas[5].filter((d) => d !== null).length).toBeGreaterThan(0);
  });
});

describe('cambiarMes', () => {
  it('avanza y retrocede dentro del año', () => {
    expect(cambiarMes(2026, OCTUBRE, 1)).toEqual({ anio: 2026, mes: 10 });
    expect(cambiarMes(2026, OCTUBRE, -1)).toEqual({ anio: 2026, mes: 8 });
  });

  it('cruza de diciembre a enero y de enero a diciembre', () => {
    expect(cambiarMes(2026, 11, 1)).toEqual({ anio: 2027, mes: 0 });
    expect(cambiarMes(2026, 0, -1)).toEqual({ anio: 2025, mes: 11 });
  });

  it('admite saltos de más de un año', () => {
    expect(cambiarMes(2026, OCTUBRE, 14)).toEqual({ anio: 2027, mes: 11 });
    expect(cambiarMes(2026, OCTUBRE, -22)).toEqual({ anio: 2024, mes: 11 });
  });
});

describe('ordenarSemana', () => {
  const porDia = ['D', 'L', 'M', 'X', 'J', 'V', 'S']; // índice 0 = domingo

  it('empieza en el día indicado', () => {
    expect(ordenarSemana(porDia, 0)).toEqual(['D', 'L', 'M', 'X', 'J', 'V', 'S']);
    expect(ordenarSemana(porDia, 1)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    expect(ordenarSemana(porDia, 6)).toEqual(['S', 'D', 'L', 'M', 'X', 'J', 'V']);
  });
});

describe('mesDeClave', () => {
  it('devuelve el año y el mes (de 0 a 11)', () => {
    expect(mesDeClave('2026-10-14')).toEqual({ anio: 2026, mes: OCTUBRE });
    expect(mesDeClave('2028-02-29')).toEqual({ anio: 2028, mes: 1 });
  });
});
