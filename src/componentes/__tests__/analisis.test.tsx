import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useEffectEvent, type ReactElement } from 'react';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { analizar } from '@/dominio/analisis';
import type { Movimiento } from '@/dominio/tipos';
import { FORMULARIO_REPORTES } from '@/ia/config';
import { IAProvider, useIA } from '@/ia/IAProvider';
import { crearServicioFalso, type OpcionesServicioFalso } from '@/pruebas/servicioIAFalso';
import type { EvaluacionIA } from '@/ia/tipos';

import { AnalisisReglas } from '../AnalisisReglas';
import { BloqueIA } from '../BloqueIA';
import { AvisoProvider } from '../AvisoProvider';
import { DialogoProvider } from '../DialogoProvider';

jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));
// El formulario de reportes es un objeto propio de las pruebas: cada una lo configura (o no) a su gusto.
jest.mock('@/ia/config', () => ({
  ...jest.requireActual('@/ia/config'),
  FORMULARIO_REPORTES: { url: '', campo: '' },
}));

jest.useFakeTimers();

const FIN = '2026-10-31';
let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `a${contador}`,
    tipo: 'gasto',
    monto: 10,
    motivo: 'Algo',
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
  mov({ tipo: 'ingreso', motivo: 'Sueldo', monto: 1000, fecha: '2026-10-02' }),
  mov({ motivo: 'Renta', monto: 300, fecha: '2026-10-05' }),
  mov({ motivo: 'Gimnasio', monto: 60, fecha: '2026-10-03', recurrente: true, periodo: 'mensual', frecuencia: 1 }),
  ...[4, 5, 6, 7, 8, 9].map((d) => mov({ motivo: 'Café', monto: 4, fecha: `2026-10-0${d}` })),
];

const compatible = (parcial: Partial<Extract<EvaluacionIA, { compatible: true }>> = {}): EvaluacionIA => ({
  compatible: true,
  descargado: false,
  parcialBytes: 0,
  cargado: false,
  ramBytes: 17_179_869_184,
  ramJusta: false,
  discoLibreBytes: 50_000_000_000,
  ...parcial,
});

function Arranque() {
  const { refrescar } = useIA();
  const alEntrar = useEffectEvent(() => void refrescar());
  useEffect(() => {
    alEntrar();
  }, []);
  return null;
}

const montar = async (ui: ReactElement, opciones: OpcionesServicioFalso = {}) => {
  const servicio = crearServicioFalso({ pasoMs: 10, ...opciones });
  await render(
    <AjustesProvider>
      <DialogoProvider>
        <AvisoProvider>
          <IAProvider servicio={servicio}>
            <Arranque />
            {ui}
          </IAProvider>
        </AvisoProvider>
      </DialogoProvider>
    </AjustesProvider>,
  );
  await avanzar(50);
  return servicio;
};

const avanzar = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

/** Pulsa un botón del diálogo de la app. */
const pulsarDialogo = async (nombre: string) => {
  await fireEvent.press(screen.getByRole('button', { name: nombre }));
};

afterEach(() => jest.restoreAllMocks());

describe('BloqueIA', () => {
  const hechos = analizar(ejemplo(), FIN);

  it('invita a descargar el modelo, con lo que hay que saber', async () => {
    await montar(<BloqueIA hechos={hechos} />);
    expect(screen.getByText('Análisis con IA en tu teléfono')).toBeTruthy();
    expect(screen.getByText('Privado: la IA corre en tu teléfono y tus datos nunca salen de aquí.')).toBeTruthy();
    expect(screen.getByText('Descarga única de 2.6 GB (mejor con Wi-Fi). Después funciona sin internet.')).toBeTruthy();
    expect(screen.getByText('Tu teléfono: 16 GB de RAM ✓')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descargar modelo' })).toBeTruthy();
    // El nombre del modelo se queda tal cual, en inglés, también en la app en español.
    expect(screen.getByText('Modelo: Gemma 4 E2B')).toBeTruthy();
  });

  it('avisa si el teléfono va justo de memoria', async () => {
    await montar(<BloqueIA hechos={hechos} />, { evaluacion: compatible({ ramBytes: 6_000_000_000, ramJusta: true }) });
    expect(screen.getByText(/Tu teléfono: 5\.6 GB de RAM · Va justo de memoria/)).toBeTruthy();
  });

  it('si la RAM no alcanza, lo explica y no ofrece descargar', async () => {
    await montar(<BloqueIA hechos={hechos} />, {
      evaluacion: { compatible: false, motivo: 'ram', ramBytes: 3_221_225_472 },
    });
    expect(
      screen.getByText('Tu teléfono tiene 3 GB de RAM y la IA necesita al menos 4 GB. Seguirás viendo el análisis normal.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Descargar modelo' })).toBeNull();
  });

  it('en un procesador de 32 bits lo explica y no ofrece descargar', async () => {
    await montar(<BloqueIA hechos={hechos} />, {
      evaluacion: { compatible: false, motivo: 'procesador', ramBytes: 4_000_000_000 },
    });
    expect(screen.getByText(/necesita uno de 64 bits/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Descargar modelo' })).toBeNull();
  });

  it('en una plataforma sin soporte lo dice', async () => {
    await montar(<BloqueIA hechos={hechos} />, {
      evaluacion: { compatible: false, motivo: 'plataforma', ramBytes: null },
    });
    expect(screen.getByText(/solo está disponible en Android/)).toBeTruthy();
  });

  it('pide confirmación antes de descargar y luego muestra el progreso', async () => {
    await montar(<BloqueIA hechos={hechos} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Descargar modelo' }));

    // El diálogo es de la app (no el de Android) y dice lo que hay que saber antes de bajar 2.6 GB.
    expect(screen.getByText('¿Descargar el modelo?')).toBeTruthy();
    expect(screen.getByText(/2\.6 GB se descargarán|Se descargarán 2\.6 GB/)).toBeTruthy();
    expect(screen.getByText(/Espacio libre: 50\.0 GB/)).toBeTruthy();
    expect(screen.getByText(/podrás continuar donde quedó/)).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();

    await pulsarDialogo('Descargar');
    expect(screen.queryByText('¿Descargar el modelo?')).toBeNull();

    // Al empezar se consulta al teléfono cuánto falta por bajar: la barra aparece un tick después.
    await avanzar(15);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    await avanzar(35);
    expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBeGreaterThan(0);

    // Al llegar al 100 % se comprueba el archivo antes de ofrecer el informe.
    // La verificación dura un paso del reloj falso: hay que cogerla antes de que termine la descarga.
    await avanzar(65);
    expect(screen.getByText('Verificando que el archivo esté completo… (unos segundos)')).toBeTruthy();
    await avanzar(300);
    expect(screen.getByRole('button', { name: 'Generar informe' })).toBeTruthy();
  });

  it('no descarga si el usuario cancela la confirmación', async () => {
    await montar(<BloqueIA hechos={hechos} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Descargar modelo' }));
    await pulsarDialogo('Cancelar');
    expect(screen.queryByText('¿Descargar el modelo?')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Descargar modelo' })).toBeTruthy();
  });

  it('no deja descargar sin espacio libre suficiente', async () => {
    await montar(<BloqueIA hechos={hechos} />, { evaluacion: compatible({ discoLibreBytes: 1_000_000_000 }) });
    await fireEvent.press(screen.getByRole('button', { name: 'Descargar modelo' }));
    expect(screen.getByText('No hay espacio suficiente: hacen falta 2.6 GB y tienes 1.0 GB libres.')).toBeTruthy();
    expect(screen.queryByText('¿Descargar el modelo?')).toBeNull();
    // Es un aviso de un solo botón: se cierra con «Aceptar» y no se descargó nada.
    await pulsarDialogo('Aceptar');
    expect(screen.queryByText(/No hay espacio suficiente/)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('se puede cancelar la descarga', async () => {
    await montar(<BloqueIA hechos={hechos} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Descargar modelo' }));
    await pulsarDialogo('Descargar');
    await avanzar(25);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
    await avanzar(100);
    expect(screen.getByRole('button', { name: 'Descargar modelo' })).toBeTruthy();
    expect(screen.queryByText(/No se pudo descargar/)).toBeNull();
  });

  it('si la descarga se corta, conserva lo descargado y deja continuar', async () => {
    await montar(<BloqueIA hechos={hechos} />, { fallos: { descargar: 'DOWNLOAD_FAILED' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Descargar modelo' }));
    await pulsarDialogo('Descargar');
    await avanzar(200);

    expect(screen.getByText('Descarga pausada · 40%')).toBeTruthy();
    // El mismo texto sale en la tarjeta y en el aviso rojo de abajo.
    expect(screen.getAllByText('Se cortó la descarga. Lo descargado se conserva: revisa tu conexión y continúa.').length).toBe(2);
    expect(screen.getByText('La descarga se interrumpió')).toBeTruthy();
    expect(screen.getByText('1.0 GB de 2.6 GB')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Descargar modelo' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    // Al continuar se vuelve a consultar el espacio libre: la barra aparece un tick después.
    await avanzar(15);
    expect(screen.getByText(/Descargando… 40%/)).toBeTruthy();
    await avanzar(400);
    expect(screen.getByRole('button', { name: 'Generar informe' })).toBeTruthy();
  });

  it('se puede pausar y continuar sin perder lo descargado', async () => {
    await montar(<BloqueIA hechos={hechos} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Descargar modelo' }));
    await pulsarDialogo('Descargar');
    await avanzar(35);
    await fireEvent.press(screen.getByRole('button', { name: 'Pausar' }));
    await avanzar(50);
    expect(screen.getByText(/Descarga pausada · \d+%/)).toBeTruthy();
    expect(screen.getByText('Lo descargado se conserva: continúa cuando quieras, sin empezar de cero.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    await avanzar(500);
    expect(screen.getByRole('button', { name: 'Generar informe' })).toBeTruthy();
  });

  it('una descarga a medias de otra sesión se ofrece para continuar, y se puede descartar', async () => {
    await montar(<BloqueIA hechos={hechos} />, { evaluacion: compatible({ parcialBytes: 1_035_259_085 }) });
    expect(screen.getByText('Descarga pausada · 40%')).toBeTruthy();
    expect(screen.queryByText(/Se cortó la descarga/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Descartar' }));
    await avanzar(20);
    expect(screen.getByRole('button', { name: 'Descargar modelo' })).toBeTruthy();
  });

  it('con el modelo descargado genera el informe, lo muestra por líneas y permite reportarlo', async () => {
    await montar(<BloqueIA hechos={hechos} />, {
      evaluacion: compatible({ descargado: true }),
      informe: 'Resumen corto.\n• Primera idea.\n• Segunda idea.\n• Tercera idea.',
    });
    expect(screen.queryByRole('button', { name: 'Descargar modelo' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Generar informe' }));
    expect(screen.getByRole('button', { name: 'Detener' })).toBeTruthy();
    await avanzar(500);

    expect(screen.getByText('Resumen corto.')).toBeTruthy();
    expect(screen.getByText('• Primera idea.')).toBeTruthy();
    expect(screen.getByText('• Tercera idea.')).toBeTruthy();
    expect(screen.getByText('Generado en tu teléfono. Información orientativa, no es asesoría financiera.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Actualizar informe' })).toBeTruthy();

    // Sin formulario configurado: solo se oculta, y no se dice que se haya enviado nada.
    await fireEvent.press(screen.getByRole('button', { name: 'Reportar respuesta' }));
    expect(screen.getByText('¿Reportar esta respuesta?')).toBeTruthy();
    expect(screen.getByText(/Se ocultará de la pantalla/)).toBeTruthy();
    await pulsarDialogo('Reportar');
    expect(screen.getByText('Ocultamos esa respuesta.')).toBeTruthy();
    expect(screen.queryByText(/Gracias por avisar/)).toBeNull();
    expect(screen.queryByText('Resumen corto.')).toBeNull();
  });

  describe('reportar con el formulario de Google Forms configurado', () => {
    const fetchOriginal = globalThis.fetch;
    const mockFetch = jest.fn();
    beforeEach(() => {
      Object.assign(FORMULARIO_REPORTES, { url: 'https://docs.google.com/forms/d/e/X/formResponse', campo: 'entry.7' });
      mockFetch.mockReset();
      globalThis.fetch = mockFetch as unknown as typeof fetch;
    });
    afterEach(() => {
      Object.assign(FORMULARIO_REPORTES, { url: '', campo: '' });
      globalThis.fetch = fetchOriginal;
    });

    const generarYReportar = async () => {
      await montar(<BloqueIA hechos={hechos} />, {
        evaluacion: compatible({ descargado: true }),
        informe: 'Resumen corto.\n• Una idea.',
      });
      await fireEvent.press(screen.getByRole('button', { name: 'Generar informe' }));
      await avanzar(500);
      await fireEvent.press(screen.getByRole('button', { name: 'Reportar respuesta' }));
      // El diálogo dice qué se envía antes de enviarlo.
      expect(screen.getByText(/Se enviará solo el texto de esta respuesta/)).toBeTruthy();
      await pulsarDialogo('Reportar');
      await avanzar(10);
    };

    it('envía la respuesta sin salir de la app, la oculta y da las gracias', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      await generarYReportar();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://docs.google.com/forms/d/e/X/formResponse');
      expect(new URLSearchParams(init.body).get('entry.7')).toContain('Resumen corto.');
      expect(screen.getByText('Gracias por avisar: recibimos tu reporte y ocultamos esa respuesta.')).toBeTruthy();
      expect(screen.queryByText('Resumen corto.')).toBeNull();
    });

    it('sin conexión lo dice, y la respuesta se oculta igual', async () => {
      mockFetch.mockRejectedValue(new TypeError('Network request failed'));
      await generarYReportar();
      expect(screen.getByText(/No se pudo enviar el reporte/)).toBeTruthy();
      expect(screen.queryByText('Resumen corto.')).toBeNull();
    });
  });

  it('desde la tarjeta se puede eliminar el modelo, con confirmación', async () => {
    const servicio = await montar(<BloqueIA hechos={hechos} />, { evaluacion: compatible({ descargado: true }) });
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar modelo' }));
    expect(screen.getByText('¿Eliminar el modelo?')).toBeTruthy();
    expect(screen.getByText('Libera 2.6 GB de espacio. Podrás volver a descargarlo.')).toBeTruthy();
    // Todavía no se borró: hay que confirmar.
    expect(servicio.descargado).toBe(true);

    await pulsarDialogo('Eliminar');
    await avanzar(50);
    expect(servicio.descargado).toBe(false);
    expect(screen.getByRole('button', { name: 'Descargar modelo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Eliminar modelo' })).toBeNull();
  });

  it('cancelar la confirmación deja el modelo donde estaba', async () => {
    const servicio = await montar(<BloqueIA hechos={hechos} />, { evaluacion: compatible({ descargado: true }) });
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar modelo' }));
    await pulsarDialogo('Cancelar');
    await avanzar(50);
    expect(servicio.descargado).toBe(true);
    expect(screen.getByRole('button', { name: 'Generar informe' })).toBeTruthy();
  });

  it('no ofrece eliminar mientras se genera ni si no hay modelo', async () => {
    await montar(<BloqueIA hechos={hechos} />);
    expect(screen.queryByRole('button', { name: 'Eliminar modelo' })).toBeNull();
  });

  it('si la generación falla, enseña el aviso con el motivo y la tarjeta sigue usable', async () => {
    await montar(<BloqueIA hechos={hechos} />, {
      evaluacion: compatible({ descargado: true, cargado: true }),
      fallos: { generar: 'INFERENCE_FAILED' },
      mensajes: { generar: 'GPU delegate failed' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Generar informe' }));
    await avanzar(100);
    expect(screen.getByText('No se pudo generar el informe')).toBeTruthy();
    expect(screen.getByText('INFERENCE_FAILED: GPU delegate failed')).toBeTruthy();
    // En la tarjeta también queda el texto y se puede volver a intentar.
    expect(screen.getAllByText('La IA no pudo terminar el informe. Vuelve a intentarlo.').length).toBe(2);
    expect(screen.getByRole('button', { name: 'Generar informe' })).toBeTruthy();
  });

  it('se puede detener un informe a medias', async () => {
    await montar(<BloqueIA hechos={hechos} />, {
      evaluacion: compatible({ descargado: true, cargado: true }),
      informe: 'uno dos tres cuatro cinco seis siete ocho',
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Generar informe' }));
    await avanzar(35);
    await fireEvent.press(screen.getByRole('button', { name: 'Detener' }));
    await avanzar(200);
    expect(screen.getByRole('button', { name: 'Actualizar informe' })).toBeTruthy();
    expect(screen.queryByText('uno dos tres cuatro cinco seis siete ocho')).toBeNull();
  });

  it('sin datos que analizar no deja generar el informe', async () => {
    await montar(<BloqueIA hechos={analizar([], FIN)} />, { evaluacion: compatible({ descargado: true }) });
    expect(screen.getByRole('button', { name: 'Generar informe' })).toBeDisabled();
  });

  it('si el modelo no carga, lo dice', async () => {
    await montar(<BloqueIA hechos={hechos} />, {
      evaluacion: compatible({ descargado: true }),
      fallos: { cargar: 'INFERENCE_OOM' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Generar informe' }));
    await avanzar(100);
    expect(screen.getAllByText('Se acabó la memoria. Cierra otras apps e inténtalo de nuevo.').length).toBe(2);
    expect(screen.getByText('No se pudo preparar la IA')).toBeTruthy();
  });
});

describe('AnalisisReglas', () => {
  const montarReglas = async (movimientos: Movimiento[]) => {
    await render(
      <AjustesProvider>
        <AnalisisReglas hechos={analizar(movimientos, FIN)} />
      </AjustesProvider>,
    );
  };

  it('resume el periodo: balance, ingresos, gastos y ahorro', async () => {
    await montarReglas(ejemplo());
    expect(screen.getByText('Últimos 30 días')).toBeTruthy();
    expect(screen.getByText('$616.00')).toBeTruthy();
    expect(screen.getByText('$1,000.00')).toBeTruthy();
    expect(screen.getByText('$384.00')).toBeTruthy();
    expect(screen.getByText('Ahorro: 62% de tus ingresos')).toBeTruthy();
  });

  it('muestra en qué se gasta más, con porcentajes y veces', async () => {
    await montarReglas(ejemplo());
    expect(screen.getByText('En qué gastas más')).toBeTruthy();
    expect(screen.getByText('Renta')).toBeTruthy();
    expect(screen.getByText('$300.00')).toBeTruthy();
    expect(screen.getByText('78% · 1 vez')).toBeTruthy();
    expect(screen.getByText('6% · 6 veces')).toBeTruthy();
  });

  it('lista las suscripciones con su costo mensual y al año', async () => {
    await montarReglas(ejemplo());
    expect(screen.getByText('Suscripciones y cobros fijos')).toBeTruthy();
    expect(screen.getByText('$60.00 al mes · $720.00 al año')).toBeTruthy();
    // «Gimnasio» sale también en «En qué gastas más», porque es un gasto como cualquier otro.
    expect(screen.getAllByText('Gimnasio')).toHaveLength(2);
    expect(screen.getByText('Recurrente')).toBeTruthy();
    expect(screen.getByText('$60.00 al mes')).toBeTruthy();
  });

  it('explica el gasto hormiga', async () => {
    await montarReglas(ejemplo());
    expect(screen.getByText('Gasto hormiga')).toBeTruthy();
    expect(screen.getByText('6 compras de hasta $20.00 sumaron $24.00: el 6% de tus gastos.')).toBeTruthy();
    expect(screen.getByText('La que más se repite: «Café» (6 veces).')).toBeTruthy();
  });

  it('da consejos', async () => {
    await montarReglas(ejemplo());
    expect(screen.getByText('Qué puedes hacer')).toBeTruthy();
    expect(screen.getByText(/Tus suscripciones y cobros fijos suman \$60\.00 al mes/)).toBeTruthy();
  });

  it('sin suscripciones ni compras pequeñas lo dice con calma', async () => {
    await montarReglas([mov({ motivo: 'Renta', monto: 300, fecha: '2026-10-05' })]);
    expect(screen.getByText(/No encontramos cobros fijos/)).toBeTruthy();
    expect(screen.getByText('No hay compras pequeñas que se repitan mucho. ¡Bien!')).toBeTruthy();
    expect(screen.getByText('Sin ingresos en el periodo')).toBeTruthy();
    expect(screen.getByText('Todavía no hay un periodo anterior para comparar.')).toBeTruthy();
  });

  it('compara con el periodo anterior', async () => {
    await montarReglas([
      mov({ motivo: 'Renta', monto: 150, fecha: '2026-10-05' }),
      mov({ motivo: 'Renta', monto: 100, fecha: '2026-09-10' }),
    ]);
    expect(screen.getByText('Frente a los 30 días anteriores')).toBeTruthy();
    expect(screen.getByText('Gastaste 50% más (+$50.00)')).toBeTruthy();
  });
});
