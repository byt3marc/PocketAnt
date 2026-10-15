import { crearI18n } from '@/i18n/traducir';

import {
  claveDeFecha,
  diasDelMes,
  dosDigitos,
  esClaveValida,
  formatearDia,
  formatearHora,
  formatearRango,
  inicialDia,
  nombreDiaCorto,
  sumarDias,
  ventanaDeDias,
} from '../fechas';

const es = crearI18n('es');
const en = crearI18n('en');

describe('fechas', () => {
  it('genera claves locales YYYY-MM-DD', () => {
    expect(claveDeFecha(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(claveDeFecha(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('valida claves y descarta fechas imposibles', () => {
    expect(esClaveValida('2026-02-28')).toBe(true);
    expect(esClaveValida('2026-02-31')).toBe(false);
    expect(esClaveValida('2026-2-3')).toBe(false);
    expect(esClaveValida(20260203)).toBe(false);
    expect(esClaveValida(undefined)).toBe(false);
  });

  it('suma días cruzando mes y año', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(sumarDias('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('rellena con un cero y cuenta los días de cada mes', () => {
    expect(dosDigitos(7)).toBe('07');
    expect(dosDigitos(12)).toBe('12');
    expect(diasDelMes(2026, 1)).toBe(28);
    expect(diasDelMes(2028, 1)).toBe(29);
    expect(diasDelMes(2026, 9)).toBe(31);
  });

  it('formatea la hora en 24 h', () => {
    expect(formatearHora(8)).toBe('08:00');
    expect(formatearHora(21, 5)).toBe('21:05');
  });

  it('arma la ventana de días de más antiguo a más reciente', () => {
    expect(ventanaDeDias('2026-10-12', 3)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
    expect(ventanaDeDias('2026-03-02', 7)).toHaveLength(7);
    expect(ventanaDeDias('2026-03-02', 7)[0]).toBe('2026-02-24');
  });

  it('formatea el día de forma amigable en español', () => {
    expect(formatearDia('2026-10-12', es, '2026-10-12')).toBe('Hoy');
    expect(formatearDia('2026-10-11', es, '2026-10-12')).toBe('Ayer');
    expect(formatearDia('2026-10-09', es, '2026-10-12')).toBe('Vie 9 oct');
    expect(formatearDia('2025-12-31', es, '2026-10-12')).toBe('Mié 31 dic 2025');
  });

  it('formatea el día de forma amigable en inglés (con el orden propio del idioma)', () => {
    expect(formatearDia('2026-10-12', en, '2026-10-12')).toBe('Today');
    expect(formatearDia('2026-10-11', en, '2026-10-12')).toBe('Yesterday');
    expect(formatearDia('2026-10-09', en, '2026-10-12')).toBe('Fri Oct 9');
    expect(formatearDia('2025-12-31', en, '2026-10-12')).toBe('Wed Dec 31, 2025');
  });

  it('formatea rangos en español', () => {
    expect(formatearRango('2026-10-06', '2026-10-12', es)).toBe('6 – 12 oct');
    expect(formatearRango('2026-09-28', '2026-10-04', es)).toBe('28 sep – 4 oct');
    expect(formatearRango('2025-12-28', '2026-01-03', es)).toBe('28 dic 2025 – 3 ene 2026');
  });

  it('formatea rangos en inglés', () => {
    expect(formatearRango('2026-10-06', '2026-10-12', en)).toBe('Oct 6 – 12');
    expect(formatearRango('2026-09-28', '2026-10-04', en)).toBe('Sep 28 – Oct 4');
    expect(formatearRango('2025-12-28', '2026-01-03', en)).toBe('Dec 28, 2025 – Jan 3, 2026');
  });

  it('da el nombre y la inicial del día según el idioma', () => {
    // 2026-10-12 es lunes.
    expect(nombreDiaCorto('2026-10-12', 'es')).toBe('Lun');
    expect(nombreDiaCorto('2026-10-12', 'en')).toBe('Mon');
    expect(inicialDia('2026-10-12', 'es')).toBe('L');
    expect(inicialDia('2026-10-14', 'en')).toBe('W');
  });
});
