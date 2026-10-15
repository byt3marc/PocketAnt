import { crearI18n } from '@/i18n/traducir';

import {
  NOTIFICACIONES_POR_DEFECTO,
  normalizarNotificaciones,
  type AjustesNotificaciones,
} from '../ajustesNotificaciones';
import {
  horasDeRecordatorio,
  leerDatosNotificacion,
  planificarNotificaciones,
  type SolicitudNotificacion,
} from '../planNotificaciones';
import type { Movimiento } from '../tipos';

const es = crearI18n('es');
const en = crearI18n('en');
const dinero = (monto: number) => `$${monto.toFixed(2)}`;

let contador = 0;
function gasto(parcial: Partial<Movimiento> = {}): Movimiento {
  contador += 1;
  return {
    id: `g${contador}`,
    tipo: 'gasto',
    monto: 15,
    motivo: 'Netflix',
    fecha: '2026-10-20',
    recurrente: true,
    periodo: 'mensual',
    frecuencia: 1,
    actualizadoEn: '2026-10-01T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
}

// Base de las pruebas del plan: los valores por defecto, pero con el recordatorio encendido (viene apagado).
const ajustes = (cambios: Partial<AjustesNotificaciones> = {}): AjustesNotificaciones => ({
  ...NOTIFICACIONES_POR_DEFECTO,
  recordatorio: { ...NOTIFICACIONES_POR_DEFECTO.recordatorio, activo: true },
  ...cambios,
});

// Martes 13 de octubre de 2026, 10:00 (hora local).
const AHORA = new Date(2026, 9, 13, 10, 0, 0);

const plan = (
  movimientos: Movimiento[],
  config: AjustesNotificaciones = ajustes(),
  i18n = es,
  ahora = AHORA,
): SolicitudNotificacion[] => planificarNotificaciones({ ajustes: config, movimientos, ahora, i18n, formatearMonto: dinero });

const soloCobros = (s: SolicitudNotificacion[]) => s.filter((x) => x.datos.tipo === 'cobro');
const fechaDe = (s: SolicitudNotificacion) => (s.disparo.tipo === 'fecha' ? s.disparo.fecha : null);

describe('horasDeRecordatorio', () => {
  it('cada hora de 8 a 22 son 15 avisos', () => {
    const horas = horasDeRecordatorio(8, 22, 1);
    expect(horas).toHaveLength(15);
    expect(horas[0]).toBe(8);
    expect(horas[14]).toBe(22);
  });

  it('respeta el intervalo y no pasa de la hora final', () => {
    expect(horasDeRecordatorio(8, 22, 4)).toEqual([8, 12, 16, 20]);
    expect(horasDeRecordatorio(8, 22, 6)).toEqual([8, 14, 20]);
    expect(horasDeRecordatorio(8, 22, 12)).toEqual([8, 20]);
  });

  it('todo el día son 24 avisos como máximo', () => {
    expect(horasDeRecordatorio(0, 23, 1)).toHaveLength(24);
  });

  it('un horario al revés o un intervalo inválido no genera avisos', () => {
    expect(horasDeRecordatorio(22, 8, 1)).toEqual([]);
    expect(horasDeRecordatorio(8, 22, 0)).toEqual([]);
  });

  it('con una sola hora (desde = hasta) hay un aviso', () => {
    expect(horasDeRecordatorio(9, 9, 3)).toEqual([9]);
  });
});

describe('recordatorios', () => {
  const sinCobros = ajustes({ cobros: { activo: false, diasAntes: 3 } });

  it('al encenderlo, programa un aviso diario por franja, por defecto de 8:00 a 22:00 cada hora', () => {
    const recordatorios = plan([], sinCobros);
    expect(recordatorios).toHaveLength(15);
    expect(recordatorios[0].disparo).toEqual({ tipo: 'diario', hora: 8, minuto: 0 });
    expect(recordatorios[14].disparo).toEqual({ tipo: 'diario', hora: 22, minuto: 0 });
    expect(recordatorios.every((r) => r.datos.tipo === 'recordatorio')).toBe(true);
  });

  it('rota entre 4 textos para que no se repitan seguidos', () => {
    const cuerpos = plan([], sinCobros).map((r) => r.cuerpo);
    expect(new Set(cuerpos.slice(0, 4)).size).toBe(4);
    expect(cuerpos[4]).toBe(cuerpos[0]);
  });

  it('con el recordatorio apagado no programa nada', () => {
    const apagado = ajustes({
      recordatorio: { activo: false, cadaHoras: 1, desde: 8, hasta: 22 },
      cobros: { activo: false, diasAntes: 3 },
    });
    expect(plan([gasto()], apagado)).toEqual([]);
  });

  it('los textos salen en el idioma activo', () => {
    expect(plan([], sinCobros, es)[0].titulo).toBe('Registra tus gastos');
    expect(plan([], sinCobros, en)[0].titulo).toBe('Log your expenses');
  });

  it('cambiar el intervalo cambia la cantidad de avisos', () => {
    const cada3 = ajustes({
      recordatorio: { activo: true, cadaHoras: 3, desde: 8, hasta: 22 },
      cobros: { activo: false, diasAntes: 3 },
    });
    expect(plan([], cada3).map((r) => (r.disparo as { hora: number }).hora)).toEqual([8, 11, 14, 17, 20]);
  });
});

describe('avisos de cobros recurrentes', () => {
  const soloAvisosDeCobro = ajustes({ recordatorio: { activo: false, cadaHoras: 1, desde: 8, hasta: 22 } });

  it('avisa a las 9:00, 3 días antes de cada cobro', () => {
    const cobros = soloCobros(plan([gasto()], soloAvisosDeCobro));
    // Cobros: 20 oct, 20 nov y 20 dic → avisos el 17 oct, 17 nov y 17 dic.
    expect(cobros.map((c) => fechaDe(c))).toEqual([
      new Date(2026, 9, 17, 9, 0, 0),
      new Date(2026, 10, 17, 9, 0, 0),
      new Date(2026, 11, 17, 9, 0, 0),
    ]);
  });

  it('el texto dice cuántos días faltan, cuándo es y el monto', () => {
    const [primero] = soloCobros(plan([gasto()], soloAvisosDeCobro));
    expect(primero.titulo).toBe('Cobro recurrente');
    expect(primero.cuerpo).toBe('Netflix se cobra en 3 días (Mar 20 oct) · $15.00');
    const [ingles] = soloCobros(plan([gasto()], soloAvisosDeCobro, en));
    expect(ingles.cuerpo).toBe('Netflix is charged in 3 days (Tue Oct 20) · $15.00');
  });

  it('abre el movimiento al tocarlo', () => {
    const movimiento = gasto({ id: 'abc' });
    const [aviso] = soloCobros(plan([movimiento], soloAvisosDeCobro));
    expect(aviso.datos).toEqual({ tipo: 'cobro', id: 'abc' });
  });

  it('descarta el aviso cuya hora ya pasó y sigue con el siguiente cobro', () => {
    // Cobro el 14 oct, aviso 3 días antes = 11 oct (ya pasó). El próximo cobro es el 14 nov → aviso 11 nov.
    const cobros = soloCobros(plan([gasto({ fecha: '2026-10-14' })], soloAvisosDeCobro));
    expect(fechaDe(cobros[0])).toEqual(new Date(2026, 10, 11, 9, 0, 0));
  });

  it('con 0 días avisa el mismo día del cobro (y solo si faltan horas para las 9:00)', () => {
    const mismoDia = ajustes({
      recordatorio: { activo: false, cadaHoras: 1, desde: 8, hasta: 22 },
      cobros: { activo: true, diasAntes: 0 },
    });
    const [hoyMasTarde] = soloCobros(plan([gasto({ fecha: '2026-10-13' })], mismoDia, es, new Date(2026, 9, 13, 7, 0, 0)));
    expect(fechaDe(hoyMasTarde)).toEqual(new Date(2026, 9, 13, 9, 0, 0));
    expect(hoyMasTarde.cuerpo).toBe('Netflix se cobra hoy · $15.00');

    // Ya son las 10:00: el aviso de hoy se descarta y queda el del mes siguiente.
    const [siguiente] = soloCobros(plan([gasto({ fecha: '2026-10-13' })], mismoDia));
    expect(fechaDe(siguiente)).toEqual(new Date(2026, 10, 13, 9, 0, 0));
  });

  it('con 1 día dice "mañana"', () => {
    const unDia = ajustes({
      recordatorio: { activo: false, cadaHoras: 1, desde: 8, hasta: 22 },
      cobros: { activo: true, diasAntes: 1 },
    });
    const [aviso] = soloCobros(plan([gasto()], unDia));
    expect(aviso.cuerpo).toBe('Netflix se cobra mañana · $15.00');
  });

  it('incluye gastos anuales', () => {
    const cobros = soloCobros(plan([gasto({ periodo: 'anual', fecha: '2026-11-01', motivo: 'Seguro' })], soloAvisosDeCobro));
    expect(cobros).toHaveLength(1);
    expect(fechaDe(cobros[0])).toEqual(new Date(2026, 9, 29, 9, 0, 0));
  });

  it('ignora ingresos, movimientos eliminados y los que no son recurrentes', () => {
    const movimientos = [
      gasto({ tipo: 'ingreso' }),
      gasto({ eliminado: true }),
      gasto({ recurrente: false, periodo: null, frecuencia: null }),
    ];
    expect(soloCobros(plan(movimientos, soloAvisosDeCobro))).toEqual([]);
  });

  it('con el aviso de cobros apagado no programa ninguno', () => {
    const apagado = ajustes({
      recordatorio: { activo: false, cadaHoras: 1, desde: 8, hasta: 22 },
      cobros: { activo: false, diasAntes: 3 },
    });
    expect(plan([gasto()], apagado)).toEqual([]);
  });

  it('limita el total de avisos y se queda con los más próximos', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => gasto({ fecha: `2026-10-${String(14 + (i % 15)).padStart(2, '0')}` }));
    const cobros = soloCobros(plan(muchos, soloAvisosDeCobro));
    expect(cobros).toHaveLength(35);
    const tiempos = cobros.map((c) => fechaDe(c)!.getTime());
    expect([...tiempos].sort((a, b) => a - b)).toEqual(tiempos);
  });
});

describe('plan completo', () => {
  it('con el recordatorio encendido: 15 recordatorios diarios más los avisos de cobros', () => {
    const todo = plan([gasto()]);
    expect(todo.filter((s) => s.datos.tipo === 'recordatorio')).toHaveLength(15);
    expect(soloCobros(todo)).toHaveLength(3);
  });

  it('con el máximo posible queda bajo el límite de 64 de iOS', () => {
    const todoElDia = ajustes({ recordatorio: { activo: true, cadaHoras: 1, desde: 0, hasta: 23 } });
    const muchos = Array.from({ length: 50 }, () => gasto());
    expect(plan(muchos, todoElDia).length).toBeLessThan(64);
  });
});

describe('leerDatosNotificacion', () => {
  it('reconoce los dos tipos', () => {
    expect(leerDatosNotificacion({ tipo: 'recordatorio' })).toEqual({ tipo: 'recordatorio' });
    expect(leerDatosNotificacion({ tipo: 'cobro', id: 'abc' })).toEqual({ tipo: 'cobro', id: 'abc' });
  });

  it('descarta lo que no sea válido', () => {
    expect(leerDatosNotificacion(null)).toBeNull();
    expect(leerDatosNotificacion(undefined)).toBeNull();
    expect(leerDatosNotificacion('hola')).toBeNull();
    expect(leerDatosNotificacion({ tipo: 'otro' })).toBeNull();
    expect(leerDatosNotificacion({ tipo: 'cobro' })).toBeNull();
    expect(leerDatosNotificacion({ tipo: 'cobro', id: '' })).toBeNull();
  });
});

describe('normalizarNotificaciones', () => {
  it('sin nada guardado usa los valores por defecto', () => {
    expect(normalizarNotificaciones(undefined)).toEqual(NOTIFICACIONES_POR_DEFECTO);
    expect(normalizarNotificaciones('basura')).toEqual(NOTIFICACIONES_POR_DEFECTO);
  });

  it('por defecto: recordatorio apagado (cada 1 h de 8 a 22 al encenderlo) y avisos de cobros 3 días antes', () => {
    expect(NOTIFICACIONES_POR_DEFECTO).toEqual({
      recordatorio: { activo: false, cadaHoras: 1, desde: 8, hasta: 22 },
      cobros: { activo: true, diasAntes: 3 },
      permisoPreguntado: false,
    });
  });

  it('respeta valores válidos', () => {
    const guardado = {
      recordatorio: { activo: false, cadaHoras: 4, desde: 9, hasta: 20 },
      cobros: { activo: false, diasAntes: 7 },
      permisoPreguntado: true,
    };
    expect(normalizarNotificaciones(guardado)).toEqual(guardado);
  });

  it('corrige campo por campo lo inválido', () => {
    const resultado = normalizarNotificaciones({
      recordatorio: { activo: 'sí', cadaHoras: 5, desde: -1, hasta: 30 },
      cobros: { activo: 1, diasAntes: 99 },
      permisoPreguntado: 'no',
    });
    expect(resultado).toEqual(NOTIFICACIONES_POR_DEFECTO);
  });

  it('un horario al revés vuelve al horario por defecto', () => {
    const resultado = normalizarNotificaciones({ recordatorio: { desde: 20, hasta: 8 } });
    expect(resultado.recordatorio).toMatchObject({ desde: 8, hasta: 22 });
  });

  it('acepta el día de cobro como día de aviso (0) y hasta 14 días', () => {
    expect(normalizarNotificaciones({ cobros: { diasAntes: 0 } }).cobros.diasAntes).toBe(0);
    expect(normalizarNotificaciones({ cobros: { diasAntes: 14 } }).cobros.diasAntes).toBe(14);
    expect(normalizarNotificaciones({ cobros: { diasAntes: 15 } }).cobros.diasAntes).toBe(3);
  });
});
