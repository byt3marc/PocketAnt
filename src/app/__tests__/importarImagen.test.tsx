import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync } from 'expo-image-picker';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { AvisoProvider } from '@/componentes/AvisoProvider';
import { useDatos } from '@/datos/DatosProvider';
import type { Movimiento } from '@/dominio/tipos';
import { IAProvider } from '@/ia/IAProvider';
import { reconocerTextoImagen, soportaOcrLocal } from '@/ia/ocrTexto';
import { crearSegundoPlanoFalso } from '@/pruebas/segundoPlanoFalso';
import { crearServicioFalso, type OpcionesServicioFalso } from '@/pruebas/servicioIAFalso';
import type { EvaluacionIA } from '@/ia/tipos';

import ImportarImagen from '../importarImagen';

jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => {
  const { createContext } = jest.requireActual('react');
  const margenes = { top: 0, bottom: 0, left: 0, right: 0 };
  return { useSafeAreaInsets: () => margenes, SafeAreaInsetsContext: createContext(margenes) };
});

jest.mock('@/ia/ocrTexto', () => ({
  soportaOcrLocal: jest.fn(() => true),
  reconocerTextoImagen: jest.fn(),
}));

jest.mock('@/datos/DatosProvider', () => ({ useDatos: jest.fn() }));

jest.useFakeTimers();

let guardarLote: jest.Mock;
let borrarTemporal: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (soportaOcrLocal as jest.Mock).mockReturnValue(true);
  guardarLote = jest.fn().mockResolvedValue(undefined);
  borrarTemporal = jest.fn();
  (useDatos as jest.Mock).mockReturnValue({
    movimientos: [],
    guardarLoteMovimientos: guardarLote,
    almacen: { borrarTemporal },
  });
});

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

let contador = 0;
const mov = (parcial: Partial<Movimiento>): Movimiento => {
  contador += 1;
  return {
    id: `imp${contador}`,
    tipo: 'gasto',
    monto: 45.9,
    motivo: 'Supermercado',
    // Día > 12 para que el orden día/mes sea inequívoco ante el parser estricto del dominio.
    fecha: '2026-10-15',
    recurrente: false,
    periodo: null,
    frecuencia: null,
    actualizadoEn: '2026-10-12T10:00:00.000Z',
    eliminado: false,
    ...parcial,
  };
};

/** Respuesta de extracción válida con un solo gasto completo. */
const EXTRACCION_UN_GASTO = JSON.stringify({
  movimientos: [
    {
      tipo: 'gasto',
      motivo: 'Supermercado',
      montoTexto: '-45,90',
      fechaTexto: '15/10/2026',
      pendiente: false,
      transferencia: false,
      fuente: 'fila 3',
    },
  ],
  monedaDuda: false,
  recibo: false,
  dudaTotalRecibo: false,
});

const montar = async (opciones: OpcionesServicioFalso = {}) => {
  const servicio = crearServicioFalso({ pasoMs: 10, ...opciones });
  await render(
    <AjustesProvider>
      <AvisoProvider>
        <IAProvider servicio={servicio} segundoPlano={crearSegundoPlanoFalso()}>
          <ImportarImagen />
        </IAProvider>
      </AvisoProvider>
    </AjustesProvider>,
  );
  return servicio;
};

const avanzar = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

/** Simula el selector devolviendo una imagen (o cancelándolo). */
const elegirEnElSelector = (uri?: string) => {
  (launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce(
    uri
      ? ({ canceled: false, assets: [{ uri }] } as never)
      : ({ canceled: true, assets: [] } as never),
  );
};

const pulsarElegir = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'Elegir una imagen' }));
};

describe('importarImagen: accesos y estado del modelo', () => {
  it('pide el modelo si no está descargado (sin duplicar el flujo de descarga)', async () => {
    await montar(); // evaluación sin-descargar
    await avanzar(50);
    expect(screen.getByText(/usa la IA en tu teléfono/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Elegir una imagen' })).toBeNull();
    // Se abre desde «Análisis», donde está la descarga: un botón lleva de vuelta.
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('avisa si el teléfono no da para OCR local', async () => {
    (soportaOcrLocal as jest.Mock).mockReturnValue(false);
    await montar();
    await avanzar(50);
    // El OCR local es solo Android: el aviso lo dice sin prometer otra plataforma.
    expect(screen.getByText(/solo está disponible en Android/)).toBeTruthy();
  });

  it('muestra el estado de «elegir imagen» con el modelo listo', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }) });
    await avanzar(50);
    expect(screen.getByRole('button', { name: 'Elegir una imagen' })).toBeTruthy();
  });
});

describe('importarImagen: análisis', () => {
  it('deja la pantalla intacta si se cancela el selector', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }) });
    await avanzar(50);
    elegirEnElSelector(undefined);
    await pulsarElegir();
    await avanzar(50);
    expect(screen.getByRole('button', { name: 'Elegir una imagen' })).toBeTruthy();
    // La cancelación (y todo el flujo de análisis) nunca escribe movimientos.
    expect(guardarLote).not.toHaveBeenCalled();
  });

  it('falla con «sin texto» si el OCR no encuentra nada legible', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }) });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('   ');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(100);
    expect(screen.getByText(/No se encontró texto legible/)).toBeTruthy();
  });

  it('falla con un aviso si el OCR no puede leer la imagen (archivo corrupto)', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }) });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockRejectedValueOnce(new Error('imagen no legible'));
    elegirEnElSelector('file:///corrupta.png');
    await pulsarElegir();
    await avanzar(100);

    expect(screen.getByText(/No se pudo leer la imagen/)).toBeTruthy();
    // Una imagen ilegible no genera propuestas ni escrituras.
    expect(guardarLote).not.toHaveBeenCalled();
  });

  it('falla si la respuesta de la IA no es el contrato esperado', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: 'esto no es json' });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 SUPERMERCADO -45,90');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);
    expect(screen.getByText(/La respuesta de la IA no era usable/)).toBeTruthy();
  });

  it('detecta movimientos que muestran y los preselecciona cuando son completos', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: EXTRACCION_UN_GASTO });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 SUPERMERCADO -45,90');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);

    // Revisión: la fila muestra motivo y monto originales y está seleccionada (completa, sin avisos).
    expect(screen.getByDisplayValue('Supermercado')).toBeTruthy();
    // El dominio normaliza el token OCR al formato de la app (positivo, punto decimal).
    expect(screen.getByDisplayValue('45.90')).toBeTruthy();
    const casilla = screen.getByRole('checkbox');
    expect(casilla.props.accessibilityState?.checked).toBe(true);
    // Resumen con el total de lo seleccionado.
    expect(screen.getByText(/Agregar 1 movimiento/)).toBeTruthy();
    expect(screen.getByText(/Efecto en el saldo/)).toBeTruthy();
  });

  it('no detecta movimientos si la extracción no produce filas', async () => {
    const vacia = JSON.stringify({ movimientos: [], monedaDuda: false, recibo: false, dudaTotalRecibo: false });
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: vacia });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 SUPERMERCADO -45,90');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);
    expect(screen.getByText(/No se detectaron movimientos/)).toBeTruthy();
  });

  it('descarta el resultado tardío si se cancela durante el análisis', async () => {
    let resolverOcr: (texto: string) => void = () => {};
    (reconocerTextoImagen as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<string>((resolver) => {
          resolverOcr = resolver;
        }),
    );
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: EXTRACCION_UN_GASTO });
    await avanzar(50);
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(20);

    // «Detener» invalida el intento; lo que llegue después no debe llegar a la revisión.
    await fireEvent.press(screen.getByRole('button', { name: /Detener/ }));
    await act(async () => {
      resolverOcr('15/10/2026 SUPERMERCADO -45,90');
    });
    await avanzar(300);

    expect(screen.getByRole('button', { name: 'Elegir una imagen' })).toBeTruthy();
    expect(screen.queryByDisplayValue('Supermercado')).toBeNull();
  });

  it('desmarca la fila cuando el usuario deja un campo inválido', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: EXTRACCION_UN_GASTO });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 SUPERMERCADO -45,90');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);

    expect(screen.getByRole('checkbox').props.accessibilityState?.checked).toBe(true);
    // Borrar el monto: la fila se desmarca y deja de contarse en el resumen.
    await fireEvent.changeText(screen.getByDisplayValue('45.90'), '');
    expect(screen.getByRole('checkbox').props.accessibilityState?.checked).toBe(false);
    expect(screen.getByText(/Agregar 0 movimientos/)).toBeTruthy();
  });

  it('guarda solo las filas seleccionadas y vuelve a la sección de análisis', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: EXTRACCION_UN_GASTO });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 SUPERMERCADO -45,90');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);

    const boton = screen.getByRole('button', { name: /Agregar 1 movimiento/ });
    await fireEvent.press(boton);
    await avanzar(50);

    // La entrada llega ya normalizada por el dominio (monto positivo, fecha en clave local).
    expect(guardarLote).toHaveBeenCalledWith([
      { tipo: 'gasto', monto: 45.9, motivo: 'Supermercado', fecha: '2026-10-15', recurrente: false, periodo: null, frecuencia: null },
    ]);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    // La copia temporal del selector se limpia una vez hecho el OCR.
    expect(borrarTemporal).toHaveBeenCalled();
    // Y lo confirma con un aviso discreto.
    expect(screen.getByText('1 movimiento agregado')).toBeTruthy();
  });

  it('también puede tomar la foto con la cámara', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: EXTRACCION_UN_GASTO });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 SUPERMERCADO -45,90');
    (launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///foto.jpg' }] });
    await fireEvent.press(screen.getByRole('button', { name: 'Tomar una foto' }));
    await avanzar(300);

    expect(requestCameraPermissionsAsync).toHaveBeenCalled();
    expect(launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ quality: 1 }));
    expect(reconocerTextoImagen).toHaveBeenCalledWith('file:///foto.jpg');
    expect(screen.getByRole('button', { name: /Agregar 1 movimiento/ })).toBeTruthy();
  });

  it('sin permiso de cámara lo explica y no abre la cámara', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }) });
    await avanzar(50);
    (requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Tomar una foto' }));
    await avanzar(50);
    expect(launchCameraAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/permiso para usar la cámara/)).toBeTruthy();
  });

  it('dos toques rápidos no duplican el lote', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: EXTRACCION_UN_GASTO });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 SUPERMERCADO -45,90');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);

    const boton = screen.getByRole('button', { name: /Agregar 1 movimiento/ });
    // Un `act` explícito completa el trabajo pendiente de ambos toques sin solapar scopes.
    await act(async () => {
      fireEvent.press(boton);
      fireEvent.press(boton); // el segundo toque llega antes de que el primero termine
    });
    await avanzar(100);

    expect(guardarLote).toHaveBeenCalledTimes(1);
  });

  it('si el guardado falla, avisa y deja la revisión intacta para reintentar', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: EXTRACCION_UN_GASTO });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 SUPERMERCADO -45,90');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);

    guardarLote.mockRejectedValueOnce(new Error('fallo de base de datos'));
    await fireEvent.press(screen.getByRole('button', { name: /Agregar 1 movimiento/ }));
    await avanzar(100);

    // Aviso de fallo y la fila sigue en revisión, sin que nada se haya guardado.
    expect(screen.getByText(/No se pudo guardar la importación/)).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();

    // El reintento funciona y vuelve a la sección de análisis.
    await fireEvent.press(screen.getByRole('button', { name: /Agregar 1 movimiento/ }));
    await avanzar(100);
    expect(guardarLote).toHaveBeenCalledTimes(2);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('avisa cuando una propuesta duplica un movimiento existente', async () => {
    (useDatos as jest.Mock).mockReturnValue({
      movimientos: [mov({ tipo: 'gasto', monto: 45.9, motivo: 'Supermercado', fecha: '2026-10-15' })],
      guardarLoteMovimientos: guardarLote,
      almacen: { borrarTemporal },
    });
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: EXTRACCION_UN_GASTO });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 SUPERMERCADO -45,90');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);

    expect(screen.getByText(/Coincide con un movimiento que ya tienes/)).toBeTruthy();
  });

  it('falla con aviso si la imagen es demasiado grande en bytes o resolución', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }) });
    await avanzar(50);
    (launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///enorme.png', fileSize: 35 * 1024 * 1024, width: 8000, height: 7000 }],
    });
    await pulsarElegir();
    await avanzar(50);

    expect(screen.getByText(/La imagen es demasiado grande/)).toBeTruthy();
    expect(borrarTemporal).toHaveBeenCalledWith('file:///enorme.png');
  });

  it('falla con aviso si el texto OCR supera el límite permitido', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }) });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('x'.repeat(12_001));
    elegirEnElSelector('file:///larga.png');
    await pulsarElegir();
    await avanzar(100);

    expect(screen.getByText(/La imagen tiene demasiado texto/)).toBeTruthy();
  });

  it('muestra la evidencia original de monto y fecha en la fila', async () => {
    const extraccionConOriginal = JSON.stringify({
      movimientos: [
        {
          tipo: 'gasto',
          motivo: 'Cafetería',
          montoTexto: '1.234',
          fechaTexto: '04/11/2026',
          pendiente: false,
          transferencia: false,
          fuente: 'fila 1',
        },
      ],
      monedaDuda: false,
      recibo: false,
      dudaTotalRecibo: false,
    });
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: extraccionConOriginal });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('04/11/2026 Cafetería 1.234');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);

    expect(screen.getByText(/En la imagen: monto «1.234» · fecha «04\/11\/2026»/)).toBeTruthy();
  });

  it('muestra el error de tipo faltante y el límite de caracteres interpolado en el motivo', async () => {
    const extraccionIncompleta = JSON.stringify({
      movimientos: [
        {
          tipo: null,
          motivo: 'x'.repeat(61),
          montoTexto: '15.00',
          fechaTexto: '15/10/2026',
          pendiente: false,
          transferencia: false,
          fuente: 'fila 1',
        },
      ],
      monedaDuda: false,
      recibo: false,
      dudaTotalRecibo: false,
    });
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: extraccionIncompleta });
    await avanzar(50);
    (reconocerTextoImagen as jest.Mock).mockResolvedValueOnce('15/10/2026 xxx 15.00');
    elegirEnElSelector('file:///captura.png');
    await pulsarElegir();
    await avanzar(300);

    expect(screen.getByText('Elige un tipo')).toBeTruthy();
    expect(screen.getByText('Máximo 60 caracteres.')).toBeTruthy();
  });
});
