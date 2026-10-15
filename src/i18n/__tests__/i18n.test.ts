import { en } from '../en';
import { es } from '../es';
import { ErrorTraducible, mensajeDeError } from '../errores';
import { crearI18n, esPreferenciaDeIdioma, resolverIdioma } from '../traducir';

const marcadores = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('diccionarios', () => {
  const clavesEs = Object.keys(es).sort();
  const clavesEn = Object.keys(en).sort();

  it('español e inglés tienen exactamente las mismas claves', () => {
    expect(clavesEn).toEqual(clavesEs);
  });

  it('cada clave usa los mismos {marcadores} en los dos idiomas', () => {
    for (const clave of clavesEs) {
      expect({ clave, marcadores: marcadores(en[clave as keyof typeof en]) }).toEqual({
        clave,
        marcadores: marcadores(es[clave as keyof typeof es]),
      });
    }
  });

  it('ninguna traducción está vacía', () => {
    for (const clave of clavesEs) {
      expect(es[clave as keyof typeof es].trim()).not.toBe('');
      expect(en[clave as keyof typeof en].trim()).not.toBe('');
    }
  });

  it('toda clave plural tiene sus dos variantes (_uno y _otros)', () => {
    const bases = clavesEs.filter((c) => c.endsWith('_uno')).map((c) => c.slice(0, -4));
    const basesOtros = clavesEs.filter((c) => c.endsWith('_otros')).map((c) => c.slice(0, -6));
    expect(bases.length).toBeGreaterThan(0);
    expect(basesOtros.sort()).toEqual(bases.sort());
  });

  it('la variante plural lleva {n} cuando el texto muestra la cantidad', () => {
    // Las de unidad ("mes"/"meses") no muestran el número; el resto sí.
    const bases = clavesEs.filter((c) => c.endsWith('_otros') && !c.startsWith('unidad.'));
    for (const clave of bases) {
      expect(es[clave as keyof typeof es]).toContain('{n}');
      expect(en[clave as keyof typeof en]).toContain('{n}');
    }
  });
});

describe('crearI18n', () => {
  it('traduce e interpola', () => {
    expect(crearI18n('es').t('saldo.accesible', { monto: '$10.00' })).toBe('Saldo actual: $10.00');
    expect(crearI18n('en').t('saldo.accesible', { monto: '$10.00' })).toBe('Current balance: $10.00');
  });

  it('deja el marcador si falta el parámetro, para que el error se note', () => {
    expect(crearI18n('es').t('saldo.accesible')).toBe('Saldo actual: {monto}');
  });

  it('elige singular o plural', () => {
    const es_ = crearI18n('es');
    expect(es_.plural('inicio.enlace_detalle', 1)).toBe('1 movimiento · ver detalle');
    expect(es_.plural('inicio.enlace_detalle', 0)).toBe('0 movimientos · ver detalle');
    expect(es_.plural('inicio.enlace_detalle', 5)).toBe('5 movimientos · ver detalle');
    const en_ = crearI18n('en');
    expect(en_.plural('inicio.enlace_detalle', 1)).toBe('1 entry · see details');
    expect(en_.plural('inicio.enlace_detalle', 2)).toBe('2 entries · see details');
  });
});

describe('resolverIdioma', () => {
  it('respeta la elección explícita del usuario', () => {
    expect(resolverIdioma('es', 'en')).toBe('es');
    expect(resolverIdioma('en', 'es')).toBe('en');
  });

  it('en «dispositivo» usa el del sistema si es español o inglés', () => {
    expect(resolverIdioma('sistema', 'es')).toBe('es');
    expect(resolverIdioma('sistema', 'en')).toBe('en');
  });

  it('en «dispositivo», con un idioma no soportado o desconocido, usa inglés', () => {
    expect(resolverIdioma('sistema', 'fr')).toBe('en');
    expect(resolverIdioma('sistema', null)).toBe('en');
    expect(resolverIdioma('sistema', undefined)).toBe('en');
  });

  it('valida preferencias', () => {
    expect(esPreferenciaDeIdioma('sistema')).toBe(true);
    expect(esPreferenciaDeIdioma('es')).toBe(true);
    expect(esPreferenciaDeIdioma('fr')).toBe(false);
    expect(esPreferenciaDeIdioma(undefined)).toBe(false);
  });
});

describe('mensajeDeError', () => {
  it('traduce los errores traducibles y usa un texto genérico para el resto', () => {
    const error = new ErrorTraducible('error.motivo_largo', { max: 60 });
    expect(mensajeDeError(error, crearI18n('es'))).toBe('Máximo 60 caracteres.');
    expect(mensajeDeError(error, crearI18n('en'))).toBe('Maximum 60 characters.');
    expect(mensajeDeError(new Error('boom'), crearI18n('es'))).toBe('Ocurrió un error inesperado.');
    expect(mensajeDeError('texto', crearI18n('en'))).toBe('An unexpected error occurred.');
  });
});
