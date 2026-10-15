import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { guardarAjustes } from '@/ajustes/almacen';
import { formatearFechaCorta, hoy, sumarDias } from '@/dominio/fechas';
import type { PuntoDia } from '@/dominio/series';
import type { Movimiento } from '@/dominio/tipos';
import { crearI18n } from '@/i18n/traducir';

import { BloqueDia } from '../BloqueDia';
import { ItemMovimiento } from '../ItemMovimiento';
import { SelectorFecha } from '../SelectorFecha';
import { SelectorFuente } from '../SelectorFuente';
import { SelectorSegmentado } from '../SelectorSegmentado';
import { TarjetaSaldo } from '../TarjetaSaldo';
import { Texto } from '../Texto';
import { TooltipDia } from '../TooltipDia';
import { MAX_FILAS_VISTA_PREVIA, VistaPreviaHistorial } from '../VistaPreviaHistorial';

// Los ajustes persisten en SQLite; en las pruebas se usan valores fijos en memoria.
jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

const conAjustes = (ui: ReactElement) => <AjustesProvider>{ui}</AjustesProvider>;

const movimiento = (parcial: Partial<Movimiento> = {}): Movimiento => ({
  id: 'm1',
  tipo: 'gasto',
  monto: 12.5,
  motivo: 'Café',
  fecha: '2026-10-12',
  recurrente: false,
  periodo: null,
  frecuencia: null,
  actualizadoEn: '2026-10-12T10:00:00.000Z',
  eliminado: false,
  ...parcial,
});

describe('SelectorSegmentado', () => {
  const opciones = [
    { valor: 'linea', etiqueta: 'Línea' },
    { valor: 'area', etiqueta: 'Área' },
    { valor: 'barras', etiqueta: 'Barras' },
  ] as const;

  it('marca la opción activa y avisa al elegir otra', async () => {
    const alCambiar = jest.fn();
    await render(
      conAjustes(
        <SelectorSegmentado
          opciones={opciones}
          valor="linea"
          onCambio={alCambiar}
          etiquetaAccesible="Tipo de gráfica"
        />,
      ),
    );

    expect(screen.getByRole('radio', { name: 'Línea' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Barras' })).not.toBeSelected();

    await fireEvent.press(screen.getByText('Barras'));
    expect(alCambiar).toHaveBeenCalledWith('barras');
  });
});

describe('ItemMovimiento', () => {
  it('muestra un gasto con signo menos y avisa al tocarlo', async () => {
    const alTocar = jest.fn();
    const gasto = movimiento();
    await render(conAjustes(<ItemMovimiento movimiento={gasto} hoy="2026-10-12" onPress={alTocar} />));

    expect(screen.getByText('Café')).toBeTruthy();
    expect(screen.getByText('−$12.50')).toBeTruthy();
    expect(screen.getByText('Hoy')).toBeTruthy();

    await fireEvent.press(screen.getByText('Café'));
    expect(alTocar).toHaveBeenCalledWith(gasto);
  });

  it('muestra un ingreso recurrente con su periodicidad', async () => {
    const ingreso = movimiento({
      tipo: 'ingreso',
      monto: 900,
      motivo: 'Sueldo',
      recurrente: true,
      periodo: 'mensual',
      frecuencia: 1,
    });
    await render(conAjustes(<ItemMovimiento movimiento={ingreso} hoy="2026-10-13" onPress={jest.fn()} />));

    expect(screen.getByText('+$900.00')).toBeTruthy();
    expect(screen.getByText('Mensual · cada mes')).toBeTruthy();
    expect(screen.getByText('Ayer')).toBeTruthy();
  });
});

describe('TooltipDia', () => {
  const punto: PuntoDia = {
    clave: '2026-10-12',
    ingresos: 50,
    gastos: 15,
    movimientos: [
      movimiento({ id: 'a', tipo: 'ingreso', motivo: 'Venta', monto: 50 }),
      movimiento({ id: 'b', motivo: 'Café' }),
      movimiento({ id: 'c', motivo: 'Bus' }),
    ],
  };

  it('resume ingresos, gastos y los motivos del día', async () => {
    await render(conAjustes(<TooltipDia punto={punto} ancho={150} />));

    expect(screen.getByText('+$50.00')).toBeTruthy();
    expect(screen.getByText('−$15.00')).toBeTruthy();
    expect(screen.getByText('Venta, Café +1')).toBeTruthy();
  });

  it('no dibuja nada si no hay día seleccionado', async () => {
    await render(conAjustes(<TooltipDia punto={undefined} ancho={150} />));
    expect(screen.queryByText(/Ingresos/)).toBeNull();
  });
});

describe('BloqueDia', () => {
  // Fechas relativas a hoy: el componente usa el día real, así que la prueba no depende de cuándo se corra.
  const hoyMasDias = (dias: number) => sumarDias(hoy(), dias);

  it('muestra lo de hoy y el balance del día: arriba, en verde', async () => {
    await render(
      conAjustes(
        <BloqueDia
          compacto
          movimientos={[
            movimiento({ id: 'a', tipo: 'ingreso', monto: 120, fecha: hoy() }),
            movimiento({ id: 'b', monto: 45, fecha: hoy() }),
            movimiento({ id: 'c', monto: 75, fecha: hoyMasDias(-1) }), // ayer: no cuenta para hoy
          ]}
        />,
      ),
    );

    expect(screen.getByText('Hoy')).toBeTruthy();
    expect(screen.getByText('$120.00')).toBeTruthy();
    expect(screen.getByText('$45.00')).toBeTruthy();
    expect(screen.getByText('Vas $75.00 arriba hoy')).toBeTruthy();
    expect(screen.getByTestId('balance-trending-up')).toBeTruthy();
    expect(screen.queryByText(/vs ayer/)).toBeNull();
  });

  it('abajo en rojo si se gastó más de lo que entró, y «a la par» si quedó igual', async () => {
    const { rerender } = await render(
      conAjustes(
        <BloqueDia
          movimientos={[
            movimiento({ id: 'a', tipo: 'ingreso', monto: 20, fecha: hoy() }),
            movimiento({ id: 'b', monto: 50, fecha: hoy() }),
          ]}
        />,
      ),
    );
    expect(screen.getByText('Vas $30.00 abajo hoy')).toBeTruthy();
    expect(screen.getByTestId('balance-trending-down')).toBeTruthy();

    await rerender(
      conAjustes(
        <BloqueDia
          movimientos={[
            movimiento({ id: 'a', tipo: 'ingreso', monto: 20, fecha: hoy() }),
            movimiento({ id: 'b', monto: 20, fecha: hoy() }),
          ]}
        />,
      ),
    );
    expect(screen.getByText('Hoy vas a la par')).toBeTruthy();
    expect(screen.getByTestId('balance-remove')).toBeTruthy();
  });

  it('distingue «hoy sin movimientos» de «la app está vacía»', async () => {
    const { rerender } = await render(
      conAjustes(<BloqueDia movimientos={[movimiento({ fecha: hoyMasDias(-5) })]} />),
    );
    expect(screen.getByText('Sin movimientos hoy')).toBeTruthy();

    await rerender(conAjustes(<BloqueDia movimientos={[]} />));
    expect(screen.getByText('Aún no hay movimientos')).toBeTruthy();
  });

  it('navegable: retrocede día a día hasta el movimiento más viejo', async () => {
    await render(
      conAjustes(
        <BloqueDia
          navegable
          movimientos={[movimiento({ motivo: 'Taxi', monto: 8, fecha: hoyMasDias(-1) })]}
        />,
      ),
    );
    const atras = screen.getByRole('button', { name: 'Periodo anterior' });
    const adelante = screen.getByRole('button', { name: 'Periodo siguiente' });
    expect(screen.getByText('Diaria')).toBeTruthy();
    expect(atras).toBeEnabled();
    expect(adelante).toBeDisabled();

    await fireEvent.press(atras);
    expect(screen.getByText('Ayer')).toBeTruthy();
    expect(screen.getByText('Taxi')).toBeTruthy();
    expect(screen.getByText('$8.00')).toBeTruthy();
    // Para un día pasado, en pasado.
    expect(screen.getByText('Terminaste $8.00 abajo')).toBeTruthy();
    expect(atras).toBeDisabled(); // no hay nada más viejo
    expect(adelante).toBeEnabled();
  });

  it('dibuja dos barras verticales a la misma escala, con su leyenda debajo', async () => {
    await render(
      conAjustes(
        <BloqueDia
          movimientos={[
            movimiento({ id: 'a', tipo: 'ingreso', monto: 100, fecha: hoy() }),
            movimiento({ id: 'b', monto: 25, fecha: hoy() }),
          ]}
        />,
      ),
    );

    // La mayor ocupa todo el riel y la otra, su proporción.
    expect(screen.getByTestId('barra-ingresos')).toHaveStyle({ height: '100%' });
    expect(screen.getByTestId('barra-gastos')).toHaveStyle({ height: '25%' });
    // Leyenda: etiqueta y monto de cada barra.
    expect(screen.getByText('Ingresos')).toBeTruthy();
    expect(screen.getByText('$100.00')).toBeTruthy();
    expect(screen.getByText('Gastos')).toBeTruthy();
    expect(screen.getByText('$25.00')).toBeTruthy();
  });

  it('una barra chica pero no vacía sigue siendo visible; sin movimientos quedan en cero', async () => {
    const { rerender } = await render(
      conAjustes(
        <BloqueDia
          movimientos={[
            movimiento({ id: 'a', tipo: 'ingreso', monto: 1000, fecha: hoy() }),
            movimiento({ id: 'b', monto: 1, fecha: hoy() }),
          ]}
        />,
      ),
    );
    expect(screen.getByTestId('barra-gastos')).toHaveStyle({ height: '4%', minHeight: 6 });

    await rerender(conAjustes(<BloqueDia movimientos={[]} />));
    expect(screen.getByTestId('barra-ingresos')).toHaveStyle({ height: '0%', minHeight: 0 });
    expect(screen.getByTestId('barra-gastos')).toHaveStyle({ height: '0%', minHeight: 0 });
  });
});

describe('VistaPreviaHistorial', () => {
  const muchos = (cantidad: number) =>
    Array.from({ length: cantidad }, (_, i) => movimiento({ id: `m${i}`, motivo: `Gasto ${i + 1}` }));

  it('muestra solo los más recientes y termina en el último, sin repetir «Gráficas e Historial»', async () => {
    await render(conAjustes(<VistaPreviaHistorial movimientos={muchos(15)} onAbrir={jest.fn()} />));

    expect(MAX_FILAS_VISTA_PREVIA).toBe(12);
    expect(screen.getByText('Gasto 1')).toBeTruthy();
    expect(screen.getByText(`Gasto ${MAX_FILAS_VISTA_PREVIA}`)).toBeTruthy();
    expect(screen.queryByText(`Gasto ${MAX_FILAS_VISTA_PREVIA + 1}`)).toBeNull();
    // El enlace ya está en la tarjeta de encima, en el Home: aquí no se repite.
    expect(screen.queryByText('Gráficas e Historial')).toBeNull();
    expect(screen.queryByText('Ver más')).toBeNull();
  });

  it('tocar una fila abre Gráficas e Historial', async () => {
    const alAbrir = jest.fn();
    await render(conAjustes(<VistaPreviaHistorial movimientos={muchos(2)} onAbrir={alAbrir} />));

    await fireEvent.press(screen.getByText('Gasto 1'));
    await fireEvent.press(screen.getByText('Gasto 2'));
    expect(alAbrir).toHaveBeenCalledTimes(2);
  });

  it('sin movimientos muestra el estado vacío y no el enlace', async () => {
    await render(conAjustes(<VistaPreviaHistorial movimientos={[]} onAbrir={jest.fn()} />));

    expect(screen.getByText('Aún no hay movimientos')).toBeTruthy();
    expect(screen.queryByText('Gráficas e Historial')).toBeNull();
  });
});

describe('SelectorFecha', () => {
  // Marzo de 2026 empieza en domingo; el 18 es miércoles y el 20, viernes. Es una fecha lejana a propósito:
  // así el botón no dice «Hoy» ni «Ayer» sea cual sea el día en que se corran las pruebas.
  const FECHA = '2026-03-18';
  const abrir = async (alCambiar = jest.fn(), fecha = FECHA) => {
    await render(conAjustes(<SelectorFecha fecha={fecha} onCambio={alCambiar} primerDia={1} />));
    await fireEvent.press(screen.getByRole('button', { name: /^Fecha:/ }));
    return alCambiar;
  };

  it('muestra la fecha en el botón y abre un calendario en ese mes', async () => {
    await render(conAjustes(<SelectorFecha fecha={FECHA} onCambio={jest.fn()} primerDia={1} />));
    expect(screen.getByText('Mié 18 mar')).toBeTruthy();
    expect(screen.queryByText('Marzo 2026')).toBeNull(); // cerrado

    await fireEvent.press(screen.getByRole('button', { name: /^Fecha:/ }));
    expect(screen.getByText('Marzo 2026')).toBeTruthy();
    expect(screen.getByText('2026')).toBeTruthy(); // el año, en el encabezado
    expect(screen.getAllByText('Mié 18 mar').length).toBeGreaterThan(1); // encabezado + botón
    expect(screen.getByRole('button', { name: 'Mié 18 mar 2026' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Jue 19 mar 2026' })).not.toBeSelected();
  });

  it('elegir un día solo lo marca; «Aceptar» lo confirma', async () => {
    const alCambiar = await abrir();

    await fireEvent.press(screen.getByRole('button', { name: 'Vie 20 mar 2026' }));
    expect(screen.getByRole('button', { name: 'Vie 20 mar 2026' })).toBeSelected();
    expect(alCambiar).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Aceptar'));
    expect(alCambiar).toHaveBeenCalledTimes(1);
    expect(alCambiar).toHaveBeenCalledWith('2026-03-20');
    expect(screen.queryByText('Marzo 2026')).toBeNull(); // se cerró
  });

  it('«Cancelar» cierra sin cambiar la fecha y al reabrir vuelve a la fecha original', async () => {
    const alCambiar = await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Vie 20 mar 2026' }));
    await fireEvent.press(screen.getByText('Cancelar'));

    expect(alCambiar).not.toHaveBeenCalled();
    expect(screen.queryByText('Marzo 2026')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /^Fecha:/ }));
    expect(screen.getByRole('button', { name: 'Mié 18 mar 2026' })).toBeSelected();
  });

  it('las flechas cambian de mes, también de un año al siguiente', async () => {
    await abrir(jest.fn(), '2026-12-15');
    expect(screen.getByText('Diciembre 2026')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(screen.getByText('Enero 2027')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByText('Noviembre 2026')).toBeTruthy();
  });

  it('tocar el título abre la vista de meses para saltar de año', async () => {
    const alCambiar = await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Elegir mes y año' }));

    expect(screen.getByRole('button', { name: 'Marzo 2026' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Año siguiente' }));
    expect(screen.getByText('2027')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Septiembre 2027' }));

    expect(screen.getByText('Septiembre 2027')).toBeTruthy(); // vuelve a los días, ya en ese mes
    await fireEvent.press(screen.getByRole('button', { name: 'Mié 15 sep 2027' }));
    await fireEvent.press(screen.getByText('Aceptar'));
    expect(alCambiar).toHaveBeenCalledWith('2027-09-15');
  });

  it('«Hoy» salta al día de hoy', async () => {
    const alCambiar = await abrir();
    await fireEvent.press(screen.getByText('Hoy'));
    expect(screen.getAllByText(formatearFechaCorta(hoy(), crearI18n('es'))).length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByText('Aceptar'));
    expect(alCambiar).toHaveBeenCalledWith(hoy());
  });
});

describe('TarjetaSaldo', () => {
  it('muestra el saldo y los totales de ingresos y gastos', async () => {
    await render(conAjustes(<TarjetaSaldo ingresos={100} gastos={40} saldo={60} compacta />));
    expect(screen.getByText('Saldo actual')).toBeTruthy();
    expect(screen.getByText('$60.00')).toBeTruthy();
    expect(screen.getByText('$100.00')).toBeTruthy();
    expect(screen.getByText('$40.00')).toBeTruthy();
  });
});

describe('Fuente del texto', () => {
  const montar = () =>
    render(
      conAjustes(
        <>
          <SelectorFuente />
          <Texto variante="cuerpo">Hola</Texto>
          <Texto variante="titulo">Título</Texto>
          <Texto variante="etiqueta">Etiqueta</Texto>
        </>,
      ),
    );

  it('arranca con la del sistema: sin familia propia y con los pesos de siempre', async () => {
    await montar();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeSelected();
    expect(screen.getByText('Hola')).toHaveStyle({ fontWeight: '400' });
    expect(screen.getByText('Título')).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByText('Etiqueta')).toHaveStyle({ fontWeight: '600' });
    expect(screen.getByText('Hola')).not.toHaveStyle({ fontFamily: 'Lora_400Regular' });
  });

  it('muestra las tres opciones, cada una con su nombre', async () => {
    await montar();
    expect(screen.getByLabelText('Fuente del texto de la aplicación')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Redondeada' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Clásica' })).toBeTruthy();
  });

  it('al elegir una cambia el texto de toda la app, con el peso de cada variante, y se guarda', async () => {
    await montar();
    await fireEvent.press(screen.getByRole('radio', { name: 'Clásica' }));

    expect(screen.getByRole('radio', { name: 'Clásica' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Sistema' })).not.toBeSelected();
    expect(screen.getByText('Hola')).toHaveStyle({ fontFamily: 'Lora_400Regular', fontWeight: 'normal' });
    expect(screen.getByText('Título')).toHaveStyle({ fontFamily: 'Lora_700Bold', fontWeight: 'normal' });
    expect(screen.getByText('Etiqueta')).toHaveStyle({ fontFamily: 'Lora_600SemiBold', fontWeight: 'normal' });
    expect(guardarAjustes).toHaveBeenLastCalledWith(expect.objectContaining({ fuente: 'clasica' }));

    await fireEvent.press(screen.getByRole('radio', { name: 'Redondeada' }));
    expect(screen.getByText('Título')).toHaveStyle({ fontFamily: 'Nunito_700Bold' });

    await fireEvent.press(screen.getByRole('radio', { name: 'Sistema' }));
    expect(screen.getByText('Título')).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByText('Título')).not.toHaveStyle({ fontFamily: 'Nunito_700Bold' });
  });

  it('cada opción se escribe con su propia letra, sea cual sea la elegida', async () => {
    await montar();
    // Hay un «Aa» por opción; el orden es el de la fila: sistema, redondeada, clásica.
    const muestras = screen.getAllByText('Aa', { includeHiddenElements: true });
    expect(muestras).toHaveLength(3);
    expect(muestras[1]).toHaveStyle({ fontFamily: 'Nunito_700Bold' });
    expect(muestras[2]).toHaveStyle({ fontFamily: 'Lora_700Bold' });
  });

  it('negrita sube a la versión negrita de la familia propia', async () => {
    await render(
      conAjustes(
        <>
          <SelectorFuente />
          <Texto negrita>Fuerte</Texto>
        </>,
      ),
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Redondeada' }));
    expect(screen.getByText('Fuerte')).toHaveStyle({ fontFamily: 'Nunito_700Bold' });
  });
});
