import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Pressable, Text } from 'react-native';

import { AjustesProvider } from '@/ajustes/AjustesProvider';
import { AvisoProvider } from '@/componentes/AvisoProvider';
import { MAX_CARACTERES_RESPUESTA } from '@/dominio/promptIA';

import { IAProvider, TIEMPO_MAXIMO_GENERACION_MS, useIA } from '../IAProvider';
import { crearSegundoPlanoFalso } from '@/pruebas/segundoPlanoFalso';
import { crearServicioFalso, type OpcionesServicioFalso } from '@/pruebas/servicioIAFalso';
import type { EvaluacionIA } from '../tipos';

jest.mock('@/ajustes/almacen', () => ({
  leerAjustes: () => ({ tema: 'claro', moneda: 'USD', tipoGrafica: 'linea', idioma: 'es' }),
  guardarAjustes: jest.fn(),
}));

jest.useFakeTimers();

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

function Sonda() {
  const ia = useIA();
  const boton = (nombre: string, accion: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={nombre} onPress={accion}>
      <Text>{nombre}</Text>
    </Pressable>
  );
  return (
    <>
      <Text testID="fase">{ia.estado.fase}</Text>
      <Text testID="progreso">{Math.round(ia.estado.progreso * 100)}</Text>
      <Text testID="error">{ia.estado.error ?? ''}</Text>
      <Text testID="informe">{ia.informe.estado}</Text>
      <Text testID="texto">{ia.informe.texto}</Text>
      <Text testID="errorInforme">{ia.informe.error ?? ''}</Text>
      <Text testID="reportado">{String(ia.informe.reportado)}</Text>
      {boton('refrescar', () => void ia.refrescar())}
      {boton('descargar', () => void ia.descargar())}
      {boton('pausar', () => void ia.pausarDescarga())}
      {boton('cancelar', () => void ia.cancelarDescarga())}
      {boton('eliminar', () => void ia.eliminar())}
      {boton('generar', () => void ia.generarInforme([{ role: 'user', content: 'hola' }]))}
      {boton('detener', () => ia.detener())}
      {boton('liberar', () => void ia.liberar())}
      {boton('reportar', () => ia.reportar())}
    </>
  );
}

/** El servicio en primer plano falso de la última prueba montada. */
let segundo = crearSegundoPlanoFalso();

const montar = async (opciones: OpcionesServicioFalso = {}) => {
  const servicio = crearServicioFalso({ pasoMs: 10, ...opciones });
  segundo = crearSegundoPlanoFalso();
  await render(
    <AjustesProvider>
      <AvisoProvider>
        <IAProvider servicio={servicio} segundoPlano={segundo}>
          <Sonda />
        </IAProvider>
      </AvisoProvider>
    </AjustesProvider>,
  );
  return servicio;
};

const pulsar = async (nombre: string) => {
  await fireEvent.press(screen.getByRole('button', { name: nombre }));
};

const avanzar = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

const valor = (id: string) => screen.getByTestId(id).props.children;

describe('IAProvider: qué hay en el teléfono', () => {
  it.each([
    ['sin descargar', compatible(), 'sin-descargar'],
    ['descargado', compatible({ descargado: true }), 'descargado'],
    ['con una descarga a medias', compatible({ parcialBytes: 1_035_259_085 }), 'pausada'],
    ['ya cargado en memoria', compatible({ descargado: true, cargado: true }), 'listo'],
    ['no compatible', { compatible: false, motivo: 'ram', ramBytes: 2_000_000_000 } as EvaluacionIA, 'no-compatible'],
  ])('%s', async (_nombre, evaluacion, fase) => {
    await montar({ evaluacion });
    expect(valor('fase')).toBe('desconocido');
    await pulsar('refrescar');
    await avanzar(50);
    expect(valor('fase')).toBe(fase);
  });
});

describe('IAProvider: descarga', () => {
  it('muestra el progreso y termina en «descargado»', async () => {
    await montar();
    await pulsar('descargar');
    // Al empezar se consulta al teléfono el espacio libre: la fase cambia un tick después.
    await avanzar(15);
    expect(valor('fase')).toBe('descargando');
    await avanzar(25);
    expect(Number(valor('progreso'))).toBeGreaterThan(0);
    expect(Number(valor('progreso'))).toBeLessThan(100);
    await avanzar(200);
    expect(valor('fase')).toBe('descargado');
    expect(valor('progreso')).toBe(100);
  });

  it('verifica el archivo antes de darlo por descargado', async () => {
    await montar();
    await pulsar('descargar');
    // La consulta previa al teléfono retrasa un tick el arranque de la descarga.
    await avanzar(115);
    expect(valor('fase')).toBe('verificando');
    expect(valor('progreso')).toBe(100);
    await avanzar(50);
    expect(valor('fase')).toBe('descargado');
  });

  it('cancelar borra lo descargado y vuelve a «sin descargar» sin mostrar un error', async () => {
    const servicio = await montar();
    await pulsar('descargar');
    await avanzar(30);
    await pulsar('cancelar');
    await avanzar(100);
    expect(valor('fase')).toBe('sin-descargar');
    expect(valor('error')).toBe('');
    expect(servicio.parcialBytes).toBe(0);
  });

  it('si la red se corta, lo descargado se conserva y se puede continuar', async () => {
    const servicio = await montar({ fallos: { descargar: 'DOWNLOAD_FAILED' } });
    await pulsar('descargar');
    await avanzar(200);
    expect(valor('fase')).toBe('pausada');
    expect(valor('error')).toBe('ia.error_descarga');
    expect(valor('progreso')).toBe(40);
    expect(screen.getByText('La descarga se interrumpió')).toBeTruthy();
    expect(servicio.parcialBytes).toBeGreaterThan(0);

    await pulsar('descargar'); // continuar
    await avanzar(15);
    expect(valor('fase')).toBe('descargando');
    expect(valor('error')).toBe('');
    await avanzar(300);
    expect(valor('fase')).toBe('descargado');
  });

  it('sin espacio en el disco muestra ese error y deja continuar', async () => {
    await montar({ fallos: { descargar: 'DOWNLOAD_STORAGE_FULL' } });
    await pulsar('descargar');
    await avanzar(200);
    expect(valor('error')).toBe('ia.error_disco');
    expect(valor('fase')).toBe('pausada');
    await pulsar('descargar');
    await avanzar(15);
    expect(valor('error')).toBe('');
  });

  it('con poco disco, «Continuar» una descarga pausada no baja nada y muestra el error', async () => {
    const servicio = await montar({
      evaluacion: compatible({ parcialBytes: 1_035_259_085, discoLibreBytes: 1_500_000_000 }),
    });
    await pulsar('refrescar');
    await avanzar(50);
    expect(valor('fase')).toBe('pausada');

    // Falta ~1.5 GB y solo hay 1.5 GB libres: ni con el margen alcanza.
    await pulsar('descargar'); // continuar
    await avanzar(50);
    expect(valor('fase')).toBe('pausada');
    expect(valor('error')).toBe('ia.error_disco');
    expect(servicio.descargado).toBe(false);
  });

  it('pausar detiene la descarga conservando el avance, y continuar sigue desde ahí', async () => {
    const servicio = await montar();
    await pulsar('descargar');
    await avanzar(35);
    await pulsar('pausar');
    await avanzar(50);
    expect(valor('fase')).toBe('pausada');
    expect(valor('error')).toBe('');
    const avance = Number(valor('progreso'));
    expect(avance).toBeGreaterThan(0);
    expect(avance).toBeLessThan(100);
    expect(servicio.parcialBytes).toBeGreaterThan(0);

    await pulsar('descargar');
    await avanzar(15);
    expect(valor('fase')).toBe('descargando');
    expect(Number(valor('progreso'))).toBeGreaterThanOrEqual(avance);
    await avanzar(400);
    expect(valor('fase')).toBe('descargado');
    expect(servicio.parcialBytes).toBe(0);
  });

  it('descartar una descarga pausada borra lo descargado', async () => {
    const servicio = await montar({ evaluacion: compatible({ parcialBytes: 1_000_000_000 }) });
    await pulsar('refrescar');
    await avanzar(50);
    expect(valor('fase')).toBe('pausada');
    expect(Number(valor('progreso'))).toBe(39);
    await pulsar('cancelar');
    await avanzar(10);
    expect(valor('fase')).toBe('sin-descargar');
    expect(valor('progreso')).toBe(0);
    expect(servicio.parcialBytes).toBe(0);
  });

  it('una descarga cortada en una sesión anterior se ofrece para continuar al volver', async () => {
    await montar({ evaluacion: compatible({ parcialBytes: 1_035_259_085 }) });
    await pulsar('refrescar');
    await avanzar(50);
    expect(valor('fase')).toBe('pausada');
    expect(valor('progreso')).toBe(40);
    await pulsar('descargar');
    await avanzar(300);
    expect(valor('fase')).toBe('descargado');
  });
});

describe('IAProvider: informe', () => {
  it('carga el modelo, genera el texto en streaming y deja el informe listo', async () => {
    await montar({ evaluacion: compatible({ descargado: true }), informe: 'Hola mundo desde la IA local' });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('generar');
    expect(valor('fase')).toBe('cargando');
    expect(valor('informe')).toBe('generando');
    await avanzar(15);
    expect(valor('fase')).toBe('listo');
    await avanzar(25);
    // A mitad de camino ya hay texto parcial.
    expect(String(valor('texto')).length).toBeGreaterThan(0);
    expect(valor('informe')).toBe('generando');
    await avanzar(200);
    expect(valor('informe')).toBe('listo');
    expect(valor('texto')).toBe('Hola mundo desde la IA local');
  });

  it('detener deja lo que ya había salido', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: 'uno dos tres cuatro cinco seis siete' });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('generar');
    await avanzar(35);
    await pulsar('detener');
    await avanzar(100);
    expect(valor('informe')).toBe('listo');
    const texto = String(valor('texto'));
    expect(texto.length).toBeGreaterThan(0);
    expect(texto.length).toBeLessThan('uno dos tres cuatro cinco seis siete'.length);
  });

  it('corta una respuesta que no termina nunca', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: 'palabra '.repeat(600) });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('generar');
    await avanzar(10_000);
    expect(valor('informe')).toBe('listo');
    expect(String(valor('texto')).length).toBeLessThanOrEqual(MAX_CARACTERES_RESPUESTA);
  });

  it('una generación atascada se detiene sola al llegar al tiempo máximo', async () => {
    await montar({
      evaluacion: compatible({ descargado: true, cargado: true }),
      informe: 'uno dos tres cuatro cinco seis siete ocho nueve diez',
      generacionAtascada: true,
    });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('generar');
    // Emite una palabra y se atasca: sin el temporizador nunca terminaría.
    expect(valor('informe')).toBe('generando');
    await avanzar(TIEMPO_MAXIMO_GENERACION_MS - 10);
    expect(valor('informe')).toBe('generando');
    await avanzar(10);
    // Se detuvo como si el usuario hubiera pulsado «Detener»: se queda con lo que ya había salido y,
    // como no fue un fallo, no reinicia el motor.
    expect(valor('informe')).toBe('listo');
    const texto = String(valor('texto'));
    expect(texto.length).toBeGreaterThan(0);
    expect(texto).not.toBe('uno dos tres cuatro cinco seis siete ocho nueve diez');
    expect(valor('fase')).toBe('listo');
  });

  it('si falla la carga del modelo, avisa y sigue en «descargado»', async () => {
    await montar({ evaluacion: compatible({ descargado: true }), fallos: { cargar: 'INFERENCE_OOM' } });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('generar');
    await avanzar(50);
    expect(valor('fase')).toBe('descargado');
    expect(valor('informe')).toBe('error');
    expect(valor('errorInforme')).toBe('ia.error_memoria');
    expect(screen.getByText('No se pudo preparar la IA')).toBeTruthy();
    expect(screen.getByText('INFERENCE_OOM')).toBeTruthy();
  });

  it('si falla la generación, cuenta por qué en un aviso y reinicia el motor para el siguiente intento', async () => {
    await montar({
      evaluacion: compatible({ descargado: true, cargado: true }),
      fallos: { generar: 'INFERENCE_FAILED' },
      mensajes: { generar: 'Can not find OpenCL library on this device' },
      informe: 'Todo bien esta vez',
    });
    await pulsar('refrescar');
    await avanzar(50);
    expect(valor('fase')).toBe('listo');

    await pulsar('generar');
    await avanzar(50);
    expect(valor('informe')).toBe('error');
    // El aviso rojo: qué pasó, cómo entenderlo y el motivo exacto del motor.
    expect(screen.getByTestId('aviso')).toBeTruthy();
    expect(screen.getByText('No se pudo generar el informe')).toBeTruthy();
    expect(screen.getByText('La IA no pudo terminar el informe. Vuelve a intentarlo.')).toBeTruthy();
    expect(screen.getByText('INFERENCE_FAILED: Can not find OpenCL library on this device')).toBeTruthy();
    // El motor se descargó de la memoria: el siguiente intento lo crea de nuevo.
    expect(valor('fase')).toBe('descargado');

    await pulsar('generar');
    expect(valor('fase')).toBe('cargando');
    await avanzar(300);
    expect(valor('informe')).toBe('listo');
    expect(valor('texto')).toBe('Todo bien esta vez');
    expect(valor('fase')).toBe('listo');
  });

  it('si falla la generación, muestra el error y no deja texto', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), fallos: { generar: 'INFERENCE_FAILED' } });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('generar');
    await avanzar(50);
    expect(valor('informe')).toBe('error');
    expect(valor('errorInforme')).toBe('ia.error_generar');
    expect(valor('texto')).toBe('');
  });

  it('reportar oculta la respuesta', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: 'algo' });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('generar');
    await avanzar(100);
    expect(valor('texto')).toBe('algo');
    await pulsar('reportar');
    expect(valor('reportado')).toBe('true');
    expect(valor('texto')).toBe('');
  });
});

describe('IAProvider: memoria y borrado', () => {
  it('liberar saca el modelo de la memoria: pasa de «listo» a «descargado»', async () => {
    const servicio = await montar({ evaluacion: compatible({ descargado: true, cargado: true }) });
    await pulsar('refrescar');
    await avanzar(50);
    expect(valor('fase')).toBe('listo');
    await pulsar('liberar');
    await avanzar(10);
    expect(valor('fase')).toBe('descargado');
    expect(servicio.descargado).toBe(true);
  });

  it('liberar mientras se genera espera a que termine y entonces libera', async () => {
    await montar({ evaluacion: compatible({ descargado: true, cargado: true }), informe: 'uno dos tres cuatro cinco' });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('generar');
    await avanzar(25);
    await pulsar('liberar');
    await avanzar(500);
    expect(valor('informe')).toBe('listo');
    expect(valor('fase')).toBe('descargado');
  });

  it('eliminar borra el modelo y vuelve a «sin descargar»', async () => {
    const servicio = await montar({ evaluacion: compatible({ descargado: true }) });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('eliminar');
    await avanzar(10);
    expect(valor('fase')).toBe('sin-descargar');
    expect(servicio.descargado).toBe(false);
  });

  it('eliminar también borra una descarga a medias', async () => {
    const servicio = await montar({ evaluacion: compatible({ parcialBytes: 500_000_000 }) });
    await pulsar('refrescar');
    await avanzar(50);
    await pulsar('eliminar');
    await avanzar(10);
    expect(servicio.parcialBytes).toBe(0);
    expect(valor('fase')).toBe('sin-descargar');
  });
});

describe('IAProvider: descarga en segundo plano', () => {
  // En el mock de Jest `AppState.currentState` no es una cadena: se fija a mano.
  const poner = (estado: 'active' | 'background') => {
    (AppState as unknown as { currentState: string }).currentState = estado;
  };
  const aSegundoPlano = () => poner('background');
  beforeEach(() => poner('active'));

  it('si Android no deja encender el servicio, la descarga sigue con la app abierta y se puede repetir', async () => {
    await montar();
    segundo.iniciar = () => {
      throw new Error('ForegroundServiceStartNotAllowedException');
    };
    await pulsar('descargar');
    await avanzar(15);
    expect(valor('fase')).toBe('descargando');
    await avanzar(300);
    expect(valor('fase')).toBe('descargado');
    // No quedó «ocupado»: eliminar y volver a descargar funciona.
    await pulsar('eliminar');
    await avanzar(50);
    await pulsar('descargar');
    await avanzar(15);
    expect(valor('fase')).toBe('descargando');
  });

  it('enciende el servicio al empezar, con la notificación ya traducida, y lo apaga al terminar', async () => {
    await montar();
    await pulsar('descargar');
    // El servicio se enciende tras la consulta previa al teléfono.
    await avanzar(15);
    expect(segundo.llamadas[0]).toMatchObject({
      tipo: 'iniciar',
      textos: {
        titulo: 'Descargando el modelo de IA',
        texto: '0% · 0 KB de 2.6 GB',
        pausar: 'Pausar',
        cancelar: 'Cancelar',
        canalProgreso: 'Descarga del modelo de IA',
        canalResultado: 'Aviso del modelo de IA',
      },
    });
    expect(segundo.escuchas).toBe(1);
    await avanzar(300);

    const ultima = segundo.llamadas[segundo.llamadas.length - 1];
    expect(ultima.tipo).toBe('terminar');
    expect(ultima.titulo).toBe('Modelo de IA listo');
    // Con la app a la vista no se deja otra notificación: se ve en la tarjeta.
    expect(ultima.mostrarAviso).toBe(false);
    expect(segundo.escuchas).toBe(0);
  });

  it('actualiza el progreso y marca la verificación como barra indeterminada', async () => {
    await montar();
    await pulsar('descargar');
    await avanzar(300);
    const progreso = segundo.llamadas.filter((l) => l.tipo === 'actualizar');
    expect(progreso.length).toBeGreaterThan(0);
    expect(progreso.some((l) => l.fraccion === -1 && l.texto === 'Verificando el archivo…')).toBe(true);
    // Los porcentajes salen en el texto de la notificación.
    expect(progreso.find((l) => (l.fraccion ?? -1) > 0)?.texto).toMatch(/^\d+% · /);
  });

  it('no satura al sistema: como mucho una actualización por segundo', async () => {
    await montar();
    await pulsar('descargar');
    await avanzar(300);
    // La descarga falsa dura ~100 ms con 10 avances: solo pasa el primero (y la verificación).
    const avances = segundo.llamadas.filter((l) => l.tipo === 'actualizar' && (l.fraccion ?? 0) >= 0);
    expect(avances).toHaveLength(1);
  });

  it('el botón «Pausar» de la notificación pausa la descarga', async () => {
    await montar();
    await pulsar('descargar');
    await avanzar(35);
    await act(async () => {
      segundo.tocar('pausar');
    });
    await avanzar(50);
    expect(valor('fase')).toBe('pausada');
    const ultima = segundo.llamadas[segundo.llamadas.length - 1];
    expect(ultima).toMatchObject({ tipo: 'terminar', titulo: 'Descarga pausada' });
  });

  it('el botón «Cancelar» de la notificación borra lo descargado y no deja aviso', async () => {
    const servicio = await montar();
    await pulsar('descargar');
    await avanzar(35);
    await act(async () => {
      segundo.tocar('cancelar');
    });
    await avanzar(100);
    expect(valor('fase')).toBe('sin-descargar');
    expect(servicio.parcialBytes).toBe(0);
    const ultima = segundo.llamadas[segundo.llamadas.length - 1];
    expect(ultima).toMatchObject({ tipo: 'terminar', titulo: '', texto: '', mostrarAviso: false });
  });

  it('con la app en segundo plano, al terminar deja una notificación normal con el resultado', async () => {
    aSegundoPlano();
    await montar();
    await pulsar('descargar');
    await avanzar(300);
    const ultima = segundo.llamadas[segundo.llamadas.length - 1];
    expect(ultima).toMatchObject({
      tipo: 'terminar',
      titulo: 'Modelo de IA listo',
      texto: 'Ya puedes generar informes sin internet.',
      mostrarAviso: true,
    });
  });

  it('si la descarga se corta, el servicio se apaga y avisa de que lo descargado se conserva', async () => {
    aSegundoPlano();
    await montar({ fallos: { descargar: 'DOWNLOAD_FAILED' } });
    await pulsar('descargar');
    await avanzar(300);
    const ultima = segundo.llamadas[segundo.llamadas.length - 1];
    expect(ultima).toMatchObject({
      tipo: 'terminar',
      titulo: 'La descarga se interrumpió',
      texto: 'Lo descargado se conserva. Toca para continuar.',
      mostrarAviso: true,
    });
    expect(segundo.escuchas).toBe(0);
  });

  it('al continuar una descarga vuelve a encender el servicio', async () => {
    await montar({ fallos: { descargar: 'DOWNLOAD_FAILED' } });
    await pulsar('descargar');
    await avanzar(300);
    await pulsar('descargar');
    await avanzar(400);
    const inicios = segundo.llamadas.filter((l) => l.tipo === 'iniciar');
    expect(inicios).toHaveLength(2);
    expect(valor('fase')).toBe('descargado');
  });
});

