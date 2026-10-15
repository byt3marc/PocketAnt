import { crearI18n } from '@/i18n/traducir';

import {
  actualizarMovimiento,
  crearMovimiento,
  describirRecurrencia,
  unidadRecurrencia,
  validarBorrador,
  type BorradorMovimiento,
} from '../movimiento';

const borrador = (parcial: Partial<BorradorMovimiento> = {}): BorradorMovimiento => ({
  tipo: 'gasto',
  monto: '12.50',
  motivo: '  Café  ',
  fecha: '2026-10-12',
  recurrente: false,
  periodo: 'mensual',
  frecuencia: 1,
  ...parcial,
});

describe('validarBorrador', () => {
  it('acepta un gasto simple y limpia el motivo', () => {
    const { entrada, errores } = validarBorrador(borrador());
    expect(errores).toEqual({});
    expect(entrada).toEqual({
      tipo: 'gasto',
      monto: 12.5,
      motivo: 'Café',
      fecha: '2026-10-12',
      recurrente: false,
      periodo: null,
      frecuencia: null,
    });
  });

  it('rechaza monto vacío, cero o demasiado grande', () => {
    expect(validarBorrador(borrador({ monto: '' })).errores.monto).toBeDefined();
    expect(validarBorrador(borrador({ monto: '0' })).errores.monto).toBeDefined();
    expect(validarBorrador(borrador({ monto: '0.00' })).errores.monto).toBeDefined();
    expect(validarBorrador(borrador({ monto: '999999999.99' })).errores.monto).toBeUndefined();
  });

  it('rechaza motivo vacío o demasiado largo', () => {
    expect(validarBorrador(borrador({ motivo: '   ' })).errores.motivo).toBeDefined();
    expect(validarBorrador(borrador({ motivo: 'x'.repeat(61) })).errores.motivo).toBeDefined();
  });

  it('rechaza fechas inválidas', () => {
    expect(validarBorrador(borrador({ fecha: '2026-02-31' })).errores.fecha).toBeDefined();
  });

  it('guarda periodo y frecuencia solo si es recurrente', () => {
    const { entrada } = validarBorrador(borrador({ recurrente: true, periodo: 'anual', frecuencia: 2 }));
    expect(entrada).toMatchObject({ recurrente: true, periodo: 'anual', frecuencia: 2 });
  });

  it('valida la frecuencia de un movimiento recurrente', () => {
    expect(validarBorrador(borrador({ recurrente: true, frecuencia: 0 })).errores.frecuencia).toBeDefined();
    expect(validarBorrador(borrador({ recurrente: true, frecuencia: 100 })).errores.frecuencia).toBeDefined();
    // Si no es recurrente, la frecuencia se ignora.
    expect(validarBorrador(borrador({ recurrente: false, frecuencia: 0 })).errores.frecuencia).toBeUndefined();
  });
});

describe('crear y actualizar', () => {
  const entrada = validarBorrador(borrador()).entrada!;

  it('crea con id y marcas de control', () => {
    const m = crearMovimiento(entrada, 'abc', new Date('2026-10-12T15:00:00.000Z'));
    expect(m).toMatchObject({ id: 'abc', eliminado: false, actualizadoEn: '2026-10-12T15:00:00.000Z' });
  });

  it('al editar conserva el id y renueva actualizadoEn', () => {
    const creado = crearMovimiento(entrada, 'abc', new Date('2026-10-12T15:00:00.000Z'));
    const editado = actualizarMovimiento(creado, { ...entrada, monto: 20 }, new Date('2026-10-13T08:00:00.000Z'));
    expect(editado).toMatchObject({ id: 'abc', monto: 20, actualizadoEn: '2026-10-13T08:00:00.000Z' });
  });
});

describe('describirRecurrencia', () => {
  const es = crearI18n('es');
  const en = crearI18n('en');

  it('describe en español', () => {
    expect(describirRecurrencia({ recurrente: true, periodo: 'mensual', frecuencia: 1 }, es)).toBe(
      'Mensual · cada mes',
    );
    expect(describirRecurrencia({ recurrente: true, periodo: 'mensual', frecuencia: 3 }, es)).toBe(
      'Mensual · cada 3 meses',
    );
    expect(describirRecurrencia({ recurrente: true, periodo: 'anual', frecuencia: 1 }, es)).toBe(
      'Anual · cada año',
    );
    expect(describirRecurrencia({ recurrente: true, periodo: 'anual', frecuencia: 2 }, es)).toBe(
      'Anual · cada 2 años',
    );
    expect(describirRecurrencia({ recurrente: false, periodo: null, frecuencia: null }, es)).toBeNull();
  });

  it('describe en inglés', () => {
    expect(describirRecurrencia({ recurrente: true, periodo: 'mensual', frecuencia: 1 }, en)).toBe(
      'Monthly · every month',
    );
    expect(describirRecurrencia({ recurrente: true, periodo: 'anual', frecuencia: 2 }, en)).toBe(
      'Yearly · every 2 years',
    );
  });

  it('da la unidad del formulario según el número', () => {
    expect(unidadRecurrencia('mensual', 1, es)).toBe('mes');
    expect(unidadRecurrencia('mensual', 2, es)).toBe('meses');
    expect(unidadRecurrencia('anual', 1, en)).toBe('year');
    expect(unidadRecurrencia('anual', 5, en)).toBe('years');
  });
});

describe('errores de validación', () => {
  it('devuelven claves de traducción con sus parámetros', () => {
    const { errores } = validarBorrador(borrador({ monto: '', motivo: 'x'.repeat(61), recurrente: true, frecuencia: 0 }));
    expect(errores.monto).toEqual({ clave: 'error.monto_requerido' });
    expect(errores.motivo).toEqual({ clave: 'error.motivo_largo', parametros: { max: 60 } });
    expect(errores.frecuencia).toEqual({ clave: 'error.frecuencia', parametros: { max: 99 } });
  });
});
