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
      vistaEstadisticas: 'graficas',
      idioma: 'sistema',
      notificaciones: NOTIFICACIONES_POR_DEFECTO,
      drive: DRIVE_POR_DEFECTO,
      fuente: 'sistema',
      cobrosOmitidos: [],
    });
  });

  it('respeta valores válidos', () => {
    expect(
      normalizarAjustes({ tema: 'oscuro', moneda: 'PEN', tipoGrafica: 'barras', idioma: 'en' }),
    ).toEqual({
      tema: 'oscuro',
      moneda: 'PEN',
      tipoGrafica: 'barras',
      vistaEstadisticas: 'graficas',
      idioma: 'en',
      notificaciones: NOTIFICACIONES_POR_DEFECTO,
      drive: DRIVE_POR_DEFECTO,
      fuente: 'sistema',
      cobrosOmitidos: [],
    });
  });

  it('los ajustes guardados por versiones anteriores (sin idioma ni notificaciones) reciben los valores por defecto', () => {
    expect(normalizarAjustes({ tema: 'claro', moneda: 'PEN', tipoGrafica: 'area' })).toEqual({
      tema: 'claro',
      moneda: 'PEN',
      tipoGrafica: 'area',
      vistaEstadisticas: 'graficas',
      idioma: 'sistema',
      notificaciones: NOTIFICACIONES_POR_DEFECTO,
      drive: DRIVE_POR_DEFECTO,
      fuente: 'sistema',
      cobrosOmitidos: [],
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

  it('la vista de «Gráficas e Historial» arranca en gráficas y recuerda la elegida', () => {
    expect(normalizarAjustes({}).vistaEstadisticas).toBe('graficas');
    expect(normalizarAjustes({ vistaEstadisticas: 'historial' }).vistaEstadisticas).toBe('historial');
    expect(normalizarAjustes({ vistaEstadisticas: 'tabla' }).vistaEstadisticas).toBe('graficas');
  });

  it('los cobros omitidos solo aceptan claves id|fecha, sin repetidos y como mucho las 50 más recientes', () => {
    expect(normalizarAjustes({}).cobrosOmitidos).toEqual([]);
    expect(normalizarAjustes({ cobrosOmitidos: 'a|2026-11-08' }).cobrosOmitidos).toEqual([]);
    expect(
      normalizarAjustes({
        cobrosOmitidos: ['a|2026-11-08', 'b|2026-13-01', '|2026-11-08', 'c', 5, 'b|2026-11-01', 'a|2026-11-08'],
      }).cobrosOmitidos,
    ).toEqual(['b|2026-11-01', 'a|2026-11-08']);
    const muchas = Array.from({ length: 60 }, (_, i) => `m${i}|2026-11-08`);
    const conservadas = normalizarAjustes({ cobrosOmitidos: muchas }).cobrosOmitidos;
    expect(conservadas).toHaveLength(50);
    expect(conservadas[0]).toBe('m10|2026-11-08');
    expect(conservadas[49]).toBe('m59|2026-11-08');
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
