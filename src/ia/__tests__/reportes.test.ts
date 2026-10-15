import { cuerpoDelReporte, enviarReporte, formularioConfigurado, MAX_CARACTERES_REPORTE, type Reporte } from '../reportes';

const FORMULARIO = { url: 'https://docs.google.com/forms/d/e/ABC/formResponse', campo: 'entry.123' };
const REPORTE: Reporte = { texto: 'Gastaste $40 en café.', idioma: 'es', modelo: 'Gemma 4 E2B' };

const respuesta = (status: number) => ({ ok: status >= 200 && status < 300, status }) as Response;

describe('formularioConfigurado', () => {
  it('pide una URL https y un campo entry.N', () => {
    expect(formularioConfigurado(FORMULARIO)).toBe(true);
    expect(formularioConfigurado({ url: '', campo: '' })).toBe(false);
    expect(formularioConfigurado({ url: 'http://x', campo: 'entry.1' })).toBe(false);
    expect(formularioConfigurado({ url: FORMULARIO.url, campo: '123' })).toBe(false);
  });
});

describe('cuerpoDelReporte', () => {
  it('lleva una cabecera con la versión, el idioma y el modelo, y después la respuesta', () => {
    expect(cuerpoDelReporte(REPORTE, '1.2.3')).toBe('Pocketant 1.2.3 · es · Gemma 4 E2B\n\nGastaste $40 en café.');
  });

  it('recorta una respuesta desmesurada', () => {
    const largo = cuerpoDelReporte({ ...REPORTE, texto: 'x'.repeat(MAX_CARACTERES_REPORTE + 500) }, '1');
    expect(largo.endsWith('x'.repeat(MAX_CARACTERES_REPORTE))).toBe(true);
    expect(largo.length).toBeLessThan(MAX_CARACTERES_REPORTE + 100);
  });
});

describe('enviarReporte', () => {
  it('rellena el formulario con un POST, sin salir de la app', async () => {
    const fetchFn = jest.fn(async () => respuesta(200));
    await enviarReporte(REPORTE, FORMULARIO, fetchFn as unknown as typeof fetch);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(FORMULARIO.url);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    const cuerpo = new URLSearchParams(String(init.body));
    expect(cuerpo.get('entry.123')).toContain('Gastaste $40 en café.');
    expect(cuerpo.get('entry.123')).toContain('· es · Gemma 4 E2B');
  });

  it('falla si el formulario responde con un error, si no hay red o si no está configurado', async () => {
    await expect(
      enviarReporte(REPORTE, FORMULARIO, (async () => respuesta(500)) as unknown as typeof fetch),
    ).rejects.toThrow('500');
    await expect(
      enviarReporte(REPORTE, FORMULARIO, (async () => {
        throw new TypeError('Network request failed');
      }) as unknown as typeof fetch),
    ).rejects.toThrow('Network request failed');
    const fetchFn = jest.fn();
    await expect(enviarReporte(REPORTE, { url: '', campo: '' }, fetchFn)).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('se rinde a los 15 s sin respuesta', async () => {
    jest.useFakeTimers();
    try {
      // Un servidor que nunca contesta: solo el aborto del tiempo máximo corta la espera.
      const fetchFn = ((_url: string, init: RequestInit) =>
        new Promise((_resolver, rechazar) => {
          init.signal?.addEventListener('abort', () => rechazar(new Error('abortado')));
        })) as unknown as typeof fetch;
      const envio = enviarReporte(REPORTE, FORMULARIO, fetchFn);
      const resultado = expect(envio).rejects.toThrow('abortado');
      await jest.advanceTimersByTimeAsync(15_000);
      await resultado;
    } finally {
      jest.useRealTimers();
    }
  });
});
