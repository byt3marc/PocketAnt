import { crearI18n } from '@/i18n/traducir';

import {
  esAjusteDeMonedaValido,
  MONEDA_POR_DEFECTO,
  MONEDAS,
  nombreDeMoneda,
  resolverMoneda,
} from '../moneda';

describe('resolverMoneda', () => {
  it('usa la moneda elegida por el usuario', () => {
    expect(resolverMoneda('PEN').simbolo).toBe('S/');
    expect(resolverMoneda('EUR').simbolo).toBe('€');
  });

  it('en automático toma la región del dispositivo', () => {
    expect(resolverMoneda('auto', { currencyCode: 'PEN', currencySymbol: 'S/' }).codigo).toBe('PEN');
    expect(resolverMoneda('auto', { currencyCode: 'MXN', currencySymbol: '$' }).codigo).toBe('MXN');
  });

  it('en automático, si la moneda no está en la lista, usa lo que informa el dispositivo', () => {
    expect(resolverMoneda('auto', { currencyCode: 'SEK', currencySymbol: 'kr' })).toEqual({
      codigo: 'SEK',
      simbolo: 'kr',
    });
    expect(resolverMoneda('auto', { currencyCode: 'SEK', currencySymbol: null }).simbolo).toBe('SEK');
  });

  it('si no se puede detectar, usa $', () => {
    expect(resolverMoneda('auto', null)).toBe(MONEDA_POR_DEFECTO);
    expect(resolverMoneda('auto', { currencyCode: null, currencySymbol: null })).toBe(MONEDA_POR_DEFECTO);
    expect(resolverMoneda('auto')).toBe(MONEDA_POR_DEFECTO);
  });

  it('un ajuste desconocido cae en $', () => {
    expect(resolverMoneda('XXX')).toBe(MONEDA_POR_DEFECTO);
  });

  it('traduce el nombre de la moneda; si no está en la lista usa el código', () => {
    expect(nombreDeMoneda(resolverMoneda('PEN'), crearI18n('es'))).toBe('Sol peruano');
    expect(nombreDeMoneda(resolverMoneda('PEN'), crearI18n('en'))).toBe('Peruvian sol');
    expect(nombreDeMoneda({ codigo: 'SEK', simbolo: 'kr' }, crearI18n('es'))).toBe('SEK');
  });

  it('todas las monedas de la lista tienen nombre en ambos idiomas', () => {
    for (const idioma of ['es', 'en'] as const) {
      for (const moneda of MONEDAS) {
        expect(nombreDeMoneda(moneda, crearI18n(idioma))).not.toBe(moneda.codigo);
      }
    }
  });

  it('valida ajustes', () => {
    expect(esAjusteDeMonedaValido('auto')).toBe(true);
    expect(esAjusteDeMonedaValido('PEN')).toBe(true);
    expect(esAjusteDeMonedaValido('XXX')).toBe(false);
    expect(esAjusteDeMonedaValido(5)).toBe(false);
  });
});
