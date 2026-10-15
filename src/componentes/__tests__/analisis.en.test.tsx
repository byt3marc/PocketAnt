import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useEffectEvent, type ReactElement } from 'react';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { analizar } from '@/dominio/analisis';
import type { Movimiento } from '@/dominio/tipos';
import { IAProvider, useIA } from '@/ia/IAProvider';
import { crearServicioFalso, type OpcionesServicioFalso } from '@/pruebas/servicioIAFalso';

import { AnalisisReglas } from '../AnalisisReglas';
import { BloqueIA } from '../BloqueIA';
import { AvisoProvider } from '../AvisoProvider';
import { DialogoProvider } from '../DialogoProvider';

// Mismo montaje que `analisis.test.tsx`, pero con la app en inglés.
jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'en' }),
  guardarAjustes: jest.fn(),
}));

jest.useFakeTimers();

const FIN = '2026-10-31';
let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `e${contador}`,
    tipo: 'gasto',
    monto: 10,
    motivo: 'Something',
    fecha: '2026-10-10',
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-10-10T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};

const ejemplo = (): Movimiento[] => [
  mov({ tipo: 'ingreso', motivo: 'Pay', monto: 1000, fecha: '2026-10-02' }),
  mov({ motivo: 'Rent', monto: 300, fecha: '2026-10-05' }),
  mov({ motivo: 'Gym', monto: 60, fecha: '2026-10-03', recurrente: true, periodo: 'mensual', frecuencia: 1 }),
  ...[4, 5, 6, 7, 8, 9].map((d) => mov({ motivo: 'Coffee', monto: 4, fecha: `2026-10-0${d}` })),
];

function Arranque() {
  const { refrescar } = useIA();
  const alEntrar = useEffectEvent(() => void refrescar());
  useEffect(() => {
    alEntrar();
  }, []);
  return null;
}

const avanzar = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

const montar = async (ui: ReactElement, opciones: OpcionesServicioFalso = {}) => {
  await render(
    <AjustesProvider>
      <DialogoProvider>
        <AvisoProvider>
          <IAProvider servicio={crearServicioFalso({ pasoMs: 10, ...opciones })}>
            <Arranque />
            {ui}
          </IAProvider>
        </AvisoProvider>
      </DialogoProvider>
    </AjustesProvider>,
  );
  await avanzar(50);
};

afterEach(() => jest.restoreAllMocks());

describe('Análisis en inglés', () => {
  it('la tarjeta de IA invita a descargar el modelo', async () => {
    await montar(<BloqueIA hechos={analizar(ejemplo(), FIN)} />);
    expect(screen.getByText('AI analysis on your phone')).toBeTruthy();
    expect(screen.getByText('Private: the AI runs on your phone and your data never leaves it.')).toBeTruthy();
    expect(screen.getByText('One-time 2.6 GB download (best on Wi-Fi). Works offline afterwards.')).toBeTruthy();
    expect(screen.getByText('Your phone: 16 GB of RAM ✓')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download model' })).toBeTruthy();
    expect(screen.getByText('Model: Gemma 4 E2B')).toBeTruthy();
  });

  it('muestra la pausa y la reanudación en inglés', async () => {
    await montar(<BloqueIA hechos={analizar(ejemplo(), FIN)} />, { fallos: { descargar: 'DOWNLOAD_FAILED' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Download model' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Download' }));
    await avanzar(200);
    expect(screen.getByText('Download paused · 40%')).toBeTruthy();
    // El mismo texto sale en la tarjeta y en el aviso rojo de abajo.
    expect(
      screen.getAllByText('The download was interrupted. What you downloaded is kept: check your connection and resume.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
  });

  it('pide confirmación en inglés y genera el informe', async () => {
    await montar(<BloqueIA hechos={analizar(ejemplo(), FIN)} />, { informe: 'Short summary.\n• One idea.' });
    await fireEvent.press(screen.getByRole('button', { name: 'Download model' }));
    expect(screen.getByText('Download the model?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Download' }));
    await avanzar(300);
    await fireEvent.press(screen.getByRole('button', { name: 'Generate report' }));
    await avanzar(500);
    expect(screen.getByText('Short summary.')).toBeTruthy();
    expect(screen.getByText('Generated on your phone. For guidance only, not financial advice.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report response' })).toBeTruthy();
  });

  it('el aviso de error y la eliminación del modelo también están en inglés', async () => {
    await montar(<BloqueIA hechos={analizar(ejemplo(), FIN)} />, {
      evaluacion: {
        compatible: true,
        descargado: true,
        parcialBytes: 0,
        cargado: true,
        ramBytes: 17_179_869_184,
        ramJusta: false,
        discoLibreBytes: 50_000_000_000,
      },
      fallos: { generar: 'INFERENCE_FAILED' },
      mensajes: { generar: 'out of ideas' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Generate report' }));
    await avanzar(100);
    expect(screen.getByText('The report could not be generated')).toBeTruthy();
    expect(screen.getByText('Technical reason')).toBeTruthy();
    expect(screen.getByText('INFERENCE_FAILED: out of ideas')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete model' }));
    expect(screen.getByText('Delete the model?')).toBeTruthy();
    expect(screen.getByText('Frees 2.6 GB of space. You can download it again.')).toBeTruthy();
  });

  it('si la RAM no alcanza, lo explica', async () => {
    await montar(<BloqueIA hechos={analizar(ejemplo(), FIN)} />, {
      evaluacion: { compatible: false, motivo: 'ram', ramBytes: 3_221_225_472 },
    });
    expect(
      screen.getByText('Your phone has 3 GB of RAM and the AI needs at least 4 GB. You will still see the regular analysis.'),
    ).toBeTruthy();
  });

  it('las reglas están en inglés', async () => {
    await render(
      <AjustesProvider>
        <AnalisisReglas hechos={analizar(ejemplo(), FIN)} />
      </AjustesProvider>,
    );
    expect(screen.getByText('Last 30 days')).toBeTruthy();
    expect(screen.getByText('Where you spend the most')).toBeTruthy();
    expect(screen.getByText('Subscriptions and fixed charges')).toBeTruthy();
    expect(screen.getByText('$60.00/month · $720.00/year')).toBeTruthy();
    expect(screen.getByText('Small purchases')).toBeTruthy();
    expect(screen.getByText('6 purchases of up to $20.00 added up to $24.00: 6% of your spending.')).toBeTruthy();
    expect(screen.getByText('Most repeated: “Coffee” (6 times).')).toBeTruthy();
    expect(screen.getByText('What you can do')).toBeTruthy();
    expect(screen.getByText('Savings: 62% of your income')).toBeTruthy();
    expect(screen.getByText('6% · 6 times')).toBeTruthy();
    expect(screen.getByText('78% · 1 time')).toBeTruthy();
  });
});
