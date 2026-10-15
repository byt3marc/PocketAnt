import { crearSegundoPlanoFalso, segundoPlanoNativo } from '../segundoPlano';

const TEXTOS = {
  titulo: 't',
  texto: 'x',
  pausar: 'p',
  cancelar: 'c',
  canalProgreso: 'cp',
  canalResultado: 'cr',
};

describe('segundoPlanoNativo sin el módulo nativo (web, Jest, APK viejo)', () => {
  it('todo es un no-op: nada se rompe', () => {
    expect(() => {
      segundoPlanoNativo.iniciar(TEXTOS);
      segundoPlanoNativo.actualizar(0.5, '50%');
      segundoPlanoNativo.terminar('fin', 'ok', true);
      segundoPlanoNativo.alAccion(() => {})();
    }).not.toThrow();
  });
});

describe('módulo descarga-segundo-plano con el módulo nativo presente', () => {
  /** Carga el envoltorio con un módulo nativo falso, aislado del resto de las pruebas. */
  function cargar() {
    const llamadas: unknown[][] = [];
    let escucha: ((datos: { accion: string }) => void) | undefined;
    const quitar = jest.fn();
    const nativo = {
      iniciar: (...args: unknown[]) => llamadas.push(['iniciar', ...args]),
      actualizar: (...args: unknown[]) => llamadas.push(['actualizar', ...args]),
      terminar: (...args: unknown[]) => llamadas.push(['terminar', ...args]),
      addListener: (evento: string, alEvento: (datos: { accion: string }) => void) => {
        llamadas.push(['addListener', evento]);
        escucha = alEvento;
        return { remove: quitar };
      },
    };
    let modulo!: typeof import('../../../modules/descarga-segundo-plano');
    jest.isolateModules(() => {
      jest.doMock('expo', () => ({ requireOptionalNativeModule: () => nativo }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      modulo = require('../../../modules/descarga-segundo-plano');
    });
    jest.dontMock('expo');
    return { modulo, llamadas, quitar, disparar: (accion: string) => escucha?.({ accion }) };
  }

  it('está disponible y reenvía cada llamada al módulo nativo', () => {
    const { modulo, llamadas } = cargar();
    expect(modulo.disponible).toBe(true);
    modulo.iniciar(TEXTOS);
    modulo.actualizar(0.25, '25%');
    modulo.terminar('Listo', 'ok', true);
    expect(llamadas).toEqual([
      ['iniciar', TEXTOS],
      ['actualizar', 0.25, '25%'],
      ['terminar', 'Listo', 'ok', true],
    ]);
  });

  it('entrega los botones de la notificación y deja de escuchar al pedirlo', () => {
    const { modulo, llamadas, quitar, disparar } = cargar();
    const acciones: string[] = [];
    const dejar = modulo.alAccion((accion) => acciones.push(accion));
    expect(llamadas).toContainEqual(['addListener', 'onAccion']);
    disparar('pausar');
    disparar('cancelar');
    expect(acciones).toEqual(['pausar', 'cancelar']);
    dejar();
    expect(quitar).toHaveBeenCalledTimes(1);
  });
});

describe('crearSegundoPlanoFalso', () => {
  it('anota las llamadas y entrega los botones solo a quien escucha', () => {
    const falso = crearSegundoPlanoFalso();
    const recibidas: string[] = [];
    const dejar = falso.alAccion((accion) => recibidas.push(accion));
    falso.iniciar(TEXTOS);
    falso.actualizar(0.5, '50%');
    falso.terminar('Fin', 'ok', false);
    falso.tocar('pausar');
    expect(falso.llamadas.map((l) => l.tipo)).toEqual(['iniciar', 'actualizar', 'terminar']);
    expect(recibidas).toEqual(['pausar']);
    expect(falso.escuchas).toBe(1);
    dejar();
    falso.tocar('cancelar');
    expect(recibidas).toEqual(['pausar']);
    expect(falso.escuchas).toBe(0);
  });
});
