import { ErrorDrive } from './errores';

/** Nombre del archivo con todos los datos dentro de la carpeta oculta de la app en Drive. */
export const NOMBRE_ARCHIVO_DRIVE = 'datos.json';

const API = 'https://www.googleapis.com/drive/v3/files';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
const LIMITE_MULTIPART = 'gastos_hormiga_limite_9c2e7f3a';

export interface ArchivoRemoto {
  id: string;
  modificadoEn?: string;
}

export interface DependenciasDrive {
  /** Token de acceso vigente. */
  obtenerToken: () => Promise<string>;
  /** Descarta un token que Google rechazó (401) para que `obtenerToken` entregue uno nuevo. */
  descartarToken: (token: string) => Promise<void>;
  /** Inyectable para pruebas. */
  fetchFn?: typeof fetch;
}

export interface ClienteDrive {
  /** El archivo de datos en `appDataFolder`, o `null` si todavía no existe. */
  buscar: () => Promise<ArchivoRemoto | null>;
  leer: (id: string) => Promise<string>;
  /** Crea el archivo y devuelve su id. */
  crear: (contenido: string) => Promise<string>;
  actualizar: (id: string, contenido: string) => Promise<void>;
}

/**
 * Cliente mínimo de la API REST de Google Drive, limitado a un solo archivo JSON en la carpeta oculta de
 * la app (`appDataFolder`, scope `drive.appdata`): nunca toca otros archivos del Drive del usuario.
 */
export function crearClienteDrive({ obtenerToken, descartarToken, fetchFn = fetch }: DependenciasDrive): ClienteDrive {
  /** Hace la petición con el token; ante un 401 renueva el token y reintenta una sola vez. */
  async function pedir(url: string, init: RequestInit): Promise<Response> {
    const intentar = async (): Promise<{ respuesta: Response; token: string }> => {
      const token = await obtenerToken();
      try {
        const respuesta = await fetchFn(url, {
          ...init,
          headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
        });
        return { respuesta, token };
      } catch {
        // `fetch` solo rechaza si no hubo respuesta: sin conexión, DNS, tiempo agotado.
        throw new ErrorDrive('error.drive.red');
      }
    };

    let { respuesta, token } = await intentar();
    if (respuesta.status === 401) {
      await descartarToken(token);
      ({ respuesta, token } = await intentar());
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorDrive('error.drive.permiso', { requiereReconectar: true });
    }
    if (!respuesta.ok) {
      throw new ErrorDrive('error.drive.servicio', { parametros: { codigo: respuesta.status } });
    }
    return respuesta;
  }

  return {
    async buscar() {
      // Se arma a mano con encodeURIComponent: se comporta igual en todos los motores (Hermes incluido).
      const consulta = Object.entries({
        spaces: 'appDataFolder',
        q: `name = '${NOMBRE_ARCHIVO_DRIVE}' and trashed = false`,
        fields: 'files(id,modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: '10',
      })
        .map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`)
        .join('&');
      const respuesta = await pedir(`${API}?${consulta}`, { method: 'GET' });
      const cuerpo = (await respuesta.json()) as { files?: { id: string; modifiedTime?: string }[] };
      // Si por una carrera hubiera varios, se usa el más reciente.
      const primero = cuerpo.files?.[0];
      return primero ? { id: primero.id, modificadoEn: primero.modifiedTime } : null;
    },

    async leer(id) {
      const respuesta = await pedir(`${API}/${encodeURIComponent(id)}?alt=media`, { method: 'GET' });
      return respuesta.text();
    },

    async crear(contenido) {
      const metadatos = JSON.stringify({
        name: NOMBRE_ARCHIVO_DRIVE,
        parents: ['appDataFolder'],
        mimeType: 'application/json',
      });
      const cuerpo =
        `--${LIMITE_MULTIPART}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadatos}\r\n` +
        `--${LIMITE_MULTIPART}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${contenido}\r\n` +
        `--${LIMITE_MULTIPART}--`;
      const respuesta = await pedir(`${SUBIDA}?uploadType=multipart&fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${LIMITE_MULTIPART}` },
        body: cuerpo,
      });
      const resultado = (await respuesta.json()) as { id?: string };
      if (!resultado.id) throw new ErrorDrive('error.drive.servicio', { parametros: { codigo: 'sin id' } });
      return resultado.id;
    },

    async actualizar(id, contenido) {
      await pedir(`${SUBIDA}/${encodeURIComponent(id)}?uploadType=media&fields=id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: contenido,
      });
    },
  };
}
