import { detalleDeError, traducirErrorIA } from '../errores';

describe('traducirErrorIA', () => {
  it.each([
    ['DOWNLOAD_FAILED', 'ia.error_descarga'],
    ['DOWNLOAD_STORAGE_FULL', 'ia.error_disco'],
    ['DOWNLOAD_CORRUPT', 'ia.error_corrupto'],
    ['DOWNLOAD_UNVERIFIED', 'ia.error_verificar'],
    ['MODEL_LOAD_FAILED', 'ia.error_carga'],
    ['MODEL_NOT_DOWNLOADED', 'ia.error_carga'],
    ['INFERENCE_OOM', 'ia.error_memoria'],
    ['INFERENCE_BUSY', 'ia.error_ocupado'],
    ['INFERENCE_FAILED', 'ia.error_generar'],
    ['DEVICE_NOT_SUPPORTED', 'ia.no_compatible_generico'],
    ['LLM_NOT_ENABLED', 'ia.no_compatible_generico'],
  ])('%s → %s', (code, clave) => {
    expect(traducirErrorIA({ code })).toMatchObject({ cancelado: false, clave, detalle: code });
  });

  it('las cancelaciones no son fallos', () => {
    expect(traducirErrorIA({ code: 'DOWNLOAD_CANCELLED' }).cancelado).toBe(true);
    expect(traducirErrorIA({ code: 'INFERENCE_CANCELLED' }).cancelado).toBe(true);
  });

  it('un error desconocido o sin código cae en el mensaje genérico', () => {
    expect(traducirErrorIA(new Error('boom'))).toEqual({ cancelado: false, clave: 'ia.error_desconocido', detalle: 'boom' });
    expect(traducirErrorIA({ code: 'OTRA_COSA' })).toMatchObject({ cancelado: false, clave: 'ia.error_desconocido' });
    expect(traducirErrorIA(null)).toEqual({ cancelado: false, clave: 'ia.error_desconocido', detalle: '' });
    expect(traducirErrorIA('texto')).toMatchObject({ clave: 'ia.error_desconocido', detalle: 'texto' });
  });

  it('el detalle lleva el motivo que dio el motor, para saber por qué falló', () => {
    const error = Object.assign(new Error('Can not find OpenCL library on this device'), { code: 'INFERENCE_FAILED' });
    expect(traducirErrorIA(error)).toEqual({
      cancelado: false,
      clave: 'ia.error_generar',
      detalle: 'INFERENCE_FAILED: Can not find OpenCL library on this device',
    });
  });
});

describe('detalleDeError', () => {
  it('quita el envoltorio que pone Expo y se queda con la causa', () => {
    const error = new Error(
      "Call to function 'ExpoAiKit.startStreaming' has been rejected.\n→ Caused by: java.lang.RuntimeException: INFERENCE_FAILED:gemma-e2b:Failed to create conversation: bad state",
    );
    expect(detalleDeError(error)).toBe('INFERENCE_FAILED:gemma-e2b:Failed to create conversation: bad state');
  });

  it('quita el nombre de la clase de Java y los saltos de línea', () => {
    expect(detalleDeError(new Error('java.lang.IllegalStateException:  algo\n  salió   mal'))).toBe('algo salió mal');
  });

  it('no repite el código si el mensaje ya lo trae', () => {
    const error = Object.assign(new Error('INFERENCE_OOM: sin memoria'), { code: 'INFERENCE_OOM' });
    expect(detalleDeError(error)).toBe('INFERENCE_OOM: sin memoria');
  });

  it('con código pero sin mensaje, el código solo', () => {
    expect(detalleDeError({ code: 'DOWNLOAD_FAILED' })).toBe('DOWNLOAD_FAILED');
  });

  it('recorta lo larguísimo', () => {
    const largo = detalleDeError(new Error('x'.repeat(1000)));
    expect(largo).toHaveLength(300);
    expect(largo.endsWith('…')).toBe(true);
  });

  it('acepta textos y objetos con mensaje', () => {
    expect(detalleDeError('simple')).toBe('simple');
    expect(detalleDeError({ message: 'con mensaje' })).toBe('con mensaje');
    expect(detalleDeError(undefined)).toBe('');
  });
});
