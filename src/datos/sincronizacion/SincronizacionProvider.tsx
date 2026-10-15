import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { ErrorTraducible } from '@/i18n/errores';

import { useDatos } from '../DatosProvider';

import { accesoGoogle } from './google/cuenta';
import { DRIVE_DISPONIBLE } from './google/config';
import { crearClienteDrive } from './google/driveApi';
import { ErrorDrive } from './google/errores';
import { crearProveedorDrive } from './google/proveedorDrive';
import type { ProveedorSync } from './proveedor';

/** Tras abrir la app, espera un momento antes de la primera sincronización (deja que cargue la interfaz). */
const ESPERA_AL_ABRIR_MS = 1500;
/** Tras un cambio local, espera para agrupar varios cambios seguidos en una sola sincronización. */
const ESPERA_TRAS_CAMBIO_MS = 10_000;
/** Al volver a la app, no se sincroniza si hubo un intento hace menos de este tiempo. */
const MIN_ENTRE_INTENTOS_MS = 60_000;

export type EstadoSincronizacion = 'desconectado' | 'inactivo' | 'sincronizando' | 'error';

interface ContextoSincronizacion {
  /** Drive está activado en `app.json` y este build trae el módulo nativo de Google (solo Android). */
  disponible: boolean;
  estado: EstadoSincronizacion;
  /** Último error, para mostrarlo traducido (`mensajeDeError`). */
  error: ErrorTraducible | null;
  /** El error se resuelve volviendo a conectar la cuenta (sesión caducada, permiso retirado). */
  requiereReconectar: boolean;
  /** Abre el selector de cuentas de Google, guarda la cuenta y hace la primera sincronización. */
  conectar: () => Promise<void>;
  /** Retira el permiso de la app en la cuenta. Los datos locales y la copia en Drive se conservan. */
  desconectar: () => Promise<void>;
  sincronizarAhora: () => Promise<void>;
}

const Contexto = createContext<ContextoSincronizacion | null>(null);

function crearProveedor(): ProveedorSync {
  return crearProveedorDrive(
    crearClienteDrive({
      obtenerToken: accesoGoogle.obtenerTokenDeAcceso,
      descartarToken: accesoGoogle.descartarToken,
    }),
  );
}

/**
 * Mantiene sincronizados los datos con la carpeta oculta de la app en Google Drive. Solo hace algo si el
 * usuario conectó su cuenta; con la sincronización automática activa sincroniza al abrir la app, al volver
 * a ella y unos segundos después de cada cambio. Los fallos (p. ej. sin internet) no interrumpen nada:
 * se muestran en Ajustes y se reintenta en el siguiente evento.
 */
export function SincronizacionProvider({ children }: { children: ReactNode }) {
  const { ajustes, cambiarDrive } = useAjustes();
  const { cargando, versionLocal, sincronizar } = useDatos();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<ErrorTraducible | null>(null);

  // Estas variables solo se leen y escriben dentro de funciones y eventos, nunca al renderizar.
  const trabajando = useRef(false);
  const pendiente = useRef(false);
  const ultimoIntento = useRef(0);
  // Se recrea al conectar otra cuenta, porque recuerda el id del archivo de la cuenta anterior.
  const proveedor = useRef<ProveedorSync | null>(null);

  const ejecutar = async () => {
    if (trabajando.current) {
      pendiente.current = true; // se vuelve a correr al terminar, para no perder cambios recientes
      return;
    }
    trabajando.current = true;
    setEnCurso(true);
    setError(null);
    ultimoIntento.current = Date.now();
    try {
      do {
        pendiente.current = false;
        proveedor.current ??= crearProveedor();
        await sincronizar(proveedor.current);
        cambiarDrive({ ultimaSync: new Date().toISOString() });
      } while (pendiente.current);
    } catch (fallo) {
      setError(fallo instanceof ErrorTraducible ? fallo : new ErrorTraducible('error.inesperado'));
    } finally {
      trabajando.current = false;
      setEnCurso(false);
    }
  };

  const conectar = async () => {
    setError(null);
    try {
      const cuenta = await accesoGoogle.conectarCuenta();
      if (!cuenta) return; // el usuario canceló
      proveedor.current = null;
      cambiarDrive({ conectado: true, email: cuenta.email });
      await ejecutar();
    } catch (fallo) {
      setError(fallo instanceof ErrorTraducible ? fallo : new ErrorTraducible('error.inesperado'));
    }
  };

  const desconectar = async () => {
    try {
      await accesoGoogle.desconectarCuenta(ajustes.drive.email);
    } catch {
      // Aunque Google no responda (p. ej. sin conexión), en esta app la cuenta queda desconectada.
    }
    proveedor.current = null;
    cambiarDrive({ conectado: false, email: null, ultimaSync: null });
    setError(null);
  };

  const activo = DRIVE_DISPONIBLE && ajustes.drive.conectado && ajustes.drive.auto && !cargando;

  // `ejecutar` lee siempre lo último; al ser un evento de efecto no hace falta listarlo como dependencia.
  const sincronizarSiHaceFalta = useEffectEvent(() => {
    void ejecutar();
  });

  // Al abrir la app y tras cada cambio local (se agrupan varios cambios seguidos en una sola pasada).
  useEffect(() => {
    if (!activo) return;
    const espera = versionLocal === 0 ? ESPERA_AL_ABRIR_MS : ESPERA_TRAS_CAMBIO_MS;
    const temporizador = setTimeout(sincronizarSiHaceFalta, espera);
    return () => clearTimeout(temporizador);
  }, [activo, versionLocal]);

  // Al volver a la app (con un mínimo entre intentos).
  const alVolverALaApp = useEffectEvent(() => {
    if (Date.now() - ultimoIntento.current >= MIN_ENTRE_INTENTOS_MS) void ejecutar();
  });
  useEffect(() => {
    if (!activo) return;
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') alVolverALaApp();
    });
    return () => suscripcion.remove();
  }, [activo]);

  const estado: EstadoSincronizacion = !ajustes.drive.conectado
    ? 'desconectado'
    : enCurso
      ? 'sincronizando'
      : error
        ? 'error'
        : 'inactivo';

  const valor: ContextoSincronizacion = {
    disponible: DRIVE_DISPONIBLE,
    estado,
    error,
    requiereReconectar: error instanceof ErrorDrive && error.requiereReconectar,
    conectar,
    desconectar,
    sincronizarAhora: ejecutar,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSincronizacion(): ContextoSincronizacion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useSincronizacion debe usarse dentro de <SincronizacionProvider>.');
  return contexto;
}
