import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { hoy, sumarDias } from '@/dominio/fechas';
import type { Movimiento } from '@/dominio/tipos';

import { BloqueDia } from '../BloqueDia';
import { ItemMovimiento } from '../ItemMovimiento';
import { SelectorFecha } from '../SelectorFecha';
import { SelectorFuente } from '../SelectorFuente';
import { TarjetaSaldo } from '../TarjetaSaldo';

// Mismo montaje que `componentes.test.tsx`, pero con la app en inglés.
jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'en' }),
  guardarAjustes: jest.fn(),
}));

const conAjustes = (ui: ReactElement) => <AjustesProvider>{ui}</AjustesProvider>;

const movimiento = (parcial: Partial<Movimiento> = {}): Movimiento => ({
  id: 'm1',
  tipo: 'gasto',
  monto: 12.5,
  motivo: 'Coffee',
  fecha: '2026-10-09',
  recurrente: false,
  periodo: null,
  frecuencia: null,
  actualizadoEn: '2026-10-09T10:00:00.000Z',
  eliminado: false,
  ...parcial,
});

describe('app en inglés', () => {
  it('traduce la tarjeta de saldo', async () => {
    await render(conAjustes(<TarjetaSaldo ingresos={100} gastos={40} saldo={60} />));
    expect(screen.getByText('Current balance')).toBeTruthy();
    expect(screen.getByText('Income')).toBeTruthy();
    expect(screen.getByText('Expenses')).toBeTruthy();
  });

  it('traduce la fila del historial, con fecha y recurrencia', async () => {
    const suscripcion = movimiento({ recurrente: true, periodo: 'mensual', frecuencia: 2 });
    await render(conAjustes(<ItemMovimiento movimiento={suscripcion} hoy="2026-10-12" onPress={jest.fn()} />));
    expect(screen.getByText('Fri Oct 9')).toBeTruthy();
    expect(screen.getByText('Monthly · every 2 months')).toBeTruthy();
  });

  it('la gráfica diaria compara con ayer', async () => {
    // Fechas relativas a hoy: `BloqueDia` usa el día real, así que la prueba no depende de cuándo se corra.
    const movimientos = [
      movimiento({ id: 'a', tipo: 'ingreso', monto: 120, fecha: hoy(), motivo: 'Sale' }),
      movimiento({ id: 'b', monto: 45, fecha: hoy() }),
      movimiento({ id: 'c', monto: 75, fecha: sumarDias(hoy(), -1) }),
    ];
    await render(conAjustes(<BloqueDia movimientos={movimientos} compacto />));
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('▼ $30.00 vs yesterday')).toBeTruthy();
  });

  it('la gráfica diaria avisa cuando hoy no hay movimientos', async () => {
    const antiguo = movimiento({ fecha: sumarDias(hoy(), -5) });
    await render(conAjustes(<BloqueDia movimientos={[antiguo]} compacto />));
    expect(screen.getByText('No entries today')).toBeTruthy();
  });

  it('el calendario está en inglés y empieza la semana donde se le indica', async () => {
    const alCambiar = jest.fn();
    await render(conAjustes(<SelectorFecha fecha="2026-03-18" onCambio={alCambiar} primerDia={0} />));
    await fireEvent.press(screen.getByRole('button', { name: /^Date:/ }));

    expect(screen.getByText('March 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose month and year' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Fri Mar 20, 2026' }));
    await fireEvent.press(screen.getByText('OK'));
    expect(alCambiar).toHaveBeenCalledWith('2026-03-20');
  });

  it('el selector de fuente está en inglés', async () => {
    await render(conAjustes(<SelectorFuente />));
    expect(screen.getByLabelText('App text font')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'System' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Rounded' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Classic' })).toBeTruthy();
  });
});
