/** Sin respuesta en este tiempo, se da por perdida la conexión: el `fetch` de Android (OkHttp) no tiene límite propio. */
export const TIEMPO_MAXIMO_RED_MS = 30_000;

/** Un `fetch` que se rinde a los `ms` milisegundos: rechaza igual que cualquier otro fallo de red. */
export async function fetchConTiempoMaximo(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit = {},
  ms = TIEMPO_MAXIMO_RED_MS,
): Promise<Response> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ms);
  try {
    return await fetchFn(url, { ...init, signal: control.signal });
  } finally {
    clearTimeout(temporizador);
  }
}
