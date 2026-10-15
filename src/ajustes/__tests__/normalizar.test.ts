import { DRIVE_POR_DEFECTO } from '@/dominio/ajustesDrive';
import { NOTIFICACIONES_POR_DEFECTO } from '@/dominio/ajustesNotificaciones';

import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../normalizar';

describe('normalizarAjustes', () => {
  it('sin nada guardado usa los valores por defecto', () => {
    expect(normalizarAjustes(null)).toEqual(AJUSTES_POR_DEFECTO);
    expect(normalizarAjustes(undefined)).toEqual(AJUSTES_POR_DEFECTO);
    expect(normalizarAjustes('basura')).toEqual(AJUSTES_POR_DEFECTO);
  });

  it('por defecto: tema e idioma del sistema, moneda automática, gráfica de línea', () => {
    expect(AJUSTES_POR_DEFECTO).toEqual({
      tema: 'sistema',
      moneda: 'auto',
      tipoGrafica: 'linea',
      idioma: 'sistema',
      notificaciones: NOTIFICACIONES_POR_DEFECTO,
      drive: DRIVE_POR_DEFECTO,
      fuente: 'sistema',
    });
  });

  it('respeta valores válidos', () => {
    expect(
      normalizarAjustes({ tema: 'oscuro', moneda: 'PEN', tipoGrafica: 'barras', idioma: 'en' }),
    ).toEqual({
      tema: 'oscuro',
      moneda: 'PEN',
      tipoGrafica: 'barras',
      idioma: 'en',
      notificaciones: NOTIFICACIONES_POR_DEFECTO,
      drive: DRIVE_POR_DEFECTO,
      fuente: 'sistema',
    });
  });

  it('los ajustes guardados por versiones anteriores (sin idioma ni notificaciones) reciben los valores por defecto', () => {
    expect(normalizarAjustes({ tema: 'claro', moneda: 'PEN', tipoGrafica: 'area' })).toEqual({
      tema: 'claro',
      moneda: 'PEN',
      tipoGrafica: 'area',
      idioma: 'sistema',
      notificaciones: NOTIFICACIONES_POR_DEFECTO,
      drive: DRIVE_POR_DEFECTO,
      fuente: 'sistema',
    });
  });

  it('normaliza también la sincronización con Drive', () => {
    const ajustes = normalizarAjustes({ drive: { conectado: true, email: 'ana@example.com', auto: false } });
    expect(ajustes.drive).toMatchObject({ conectado: true, email: 'ana@example.com', auto: false });
    expect(normalizarAjustes({ drive: { conectado: true } }).drive.conectado).toBe(false);
  });

  it('normaliza también las notificaciones', () => {
    const ajustes = normalizarAjustes({
      notificaciones: { recordatorio: { cadaHoras: 3 }, cobros: { diasAntes: 5 } },
    });
    expect(ajustes.notificaciones.recordatorio.cadaHoras).toBe(3);
    expect(ajustes.notificaciones.cobros.diasAntes).toBe(5);
    expect(ajustes.notificaciones.recordatorio.desde).toBe(8);
  });

  it('corrige campo por campo lo que no sea válido', () => {
    expect(
      normalizarAjustes({ tema: 'rosa', moneda: 'XXX', tipoGrafica: 'pastel', idioma: 'fr' }),
    ).toEqual(AJUSTES_POR_DEFECTO);
    expect(normalizarAjustes({ tema: 'claro', moneda: 5 })).toEqual({
      ...AJUSTES_POR_DEFECTO,
      tema: 'claro',
    });
  });

  it('la fuente viene del sistema y solo acepta una de las tres conocidas', () => {
    expect(AJUSTES_POR_DEFECTO.fuente).toBe('sistema');
    expect(normalizarAjustes({}).fuente).toBe('sistema');
    expect(normalizarAjustes({ fuente: 'redondeada' }).fuente).toBe('redondeada');
    expect(normalizarAjustes({ fuente: 'clasica' }).fuente).toBe('clasica');
    expect(normalizarAjustes({ fuente: 'sistema' }).fuente).toBe('sistema');
    expect(normalizarAjustes({ fuente: 'comic' }).fuente).toBe('sistema');
    expect(normalizarAjustes({ fuente: 3 }).fuente).toBe('sistema');
  });
});
