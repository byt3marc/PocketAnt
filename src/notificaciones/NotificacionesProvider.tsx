import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { useDialogo } from '@/componentes/DialogoProvider';
import { useDatos } from '@/datos/DatosProvider';
import { leerDatosNotificacion, planificarNotificaciones } from '@/dominio/planNotificaciones';

import { asegurarCanal } from './canal';
import { leerPermiso, solicitarPermiso, type EstadoPermiso } from './permiso';
import { aplicarPlan } from './programador';

/** Espera tras un cambio antes de reprogramar, para agrupar varios cambios seguidos en una sola pasada. */
const ESPERA_REPROGRAMAR_MS = 600;

interface ContextoNotificaciones {
  /** `null` mientras se lee del sistema. */
  permiso: EstadoPermiso | null;
  /** Muestra el aviso de permiso del sistema. */
  pedirPermiso: () => Promise<void>;
  /** Pide el permiso solo si aún se puede preguntar: al encender un aviso en Ajustes. */
  pedirPermisoSiHaceFalta: () => Promise<void>;
  /**
   * Tras guardar un gasto recurrente: la primera vez (y si aún no hay permiso) pregunta con un diálogo propio si quiere
   * avisos antes de cada cobro y, si dice que sí, muestra el del sistema. No vuelve a preguntar.
   */
  ofrecerAvisosDeCobros: () => void;
  /** Abre los ajustes de la app en el sistema (para quien rechazó el permiso). */
  abrirAjustesDelSistema: () => void;
}

const Contexto = createContext<ContextoNotificaciones | null>(null);

/**
 * Mantiene programadas las notificaciones (recordatorios y avisos de cobros) acordes con los datos y los ajustes y lleva
 * al usuario a la pantalla correcta al tocar un aviso. El permiso no se pide al abrir la app (sin contexto, la mayoría
 * lo rechaza): se pide al encender un aviso o se ofrece tras guardar el primer gasto recurrente.
 * Debe montarse dentro de la navegación y de los proveedores de ajustes, diálogos y datos.
 */
export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ajustes, i18n, formatear, cambiarNotificaciones } = useAjustes();
  const { alerta } = useDialogo();
  const { movimientos, cargando } = useDatos();
  const [permiso, setPermiso] = useState<EstadoPermiso | null>(null);
  // Sube cada vez que la app vuelve a primer plano: el permiso pudo cambiar en los ajustes del sistema.
  const [refresco, setRefresco] = useState(0);

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') setRefresco((n) => n + 1);
    });
    return () => suscripcion.remove();
  }, []);

  const pedirPermiso = async () => {
    if (!ajustes.notificaciones.permisoPreguntado) cambiarNotificaciones({ permisoPreguntado: true });
    setPermiso(await solicitarPermiso(i18n.t('notif.canal')));
  };

  const pedirPermisoSiHaceFalta = async () => {
    if (permiso === 'pendiente') await pedirPermiso();
  };

  const ofrecerAvisosDeCobros = () => {
    const notificaciones = ajustes.notificaciones;
    if (permiso !== 'pendiente' || notificaciones.permisoPreguntado || !notificaciones.cobros.activo) return;
    cambiarNotificaciones({ permisoPreguntado: true });
    alerta(i18n.t('notif.ofrecer_titulo'), i18n.t('notif.ofrecer_mensaje'), [
      { text: i18n.t('notif.ofrecer_no'), style: 'cancel' },
      { text: i18n.t('notif.ofrecer_si'), onPress: () => void pedirPermiso() },
    ]);
  };

  // El permiso pudo cambiar en los ajustes del sistema: se vuelve a leer al volver a la app.
  useEffect(() => {
    let vigente = true;
    leerPermiso().then((estado) => {
      if (vigente) setPermiso(estado);
    });
    return () => {
      vigente = false;
    };
  }, [refresco]);

  const reprogramar = useEffectEvent(async () => {
    if (permiso !== 'concedido') {
      await aplicarPlan([]); // sin permiso no hay nada que dejar programado
      return;
    }
    await asegurarCanal(i18n.t('notif.canal'));
    const plan = planificarNotificaciones({
      ajustes: ajustes.notificaciones,
      movimientos,
      ahora: new Date(),
      i18n,
      formatearMonto: (monto) => formatear(monto),
    });
    await aplicarPlan(plan);
  });
  useEffect(() => {
    if (cargando || permiso === null || Platform.OS === 'web') return;
    const temporizador = setTimeout(() => {
      reprogramar().catch((error) => console.warn('No se pudieron programar las notificaciones', error));
    }, ESPERA_REPROGRAMAR_MS);
    return () => clearTimeout(temporizador);
    // `reprogramar` es un evento de efecto: lee siempre lo último sin volver a disparar el efecto.
  }, [cargando, permiso, movimientos, ajustes.notificaciones, ajustes.moneda, i18n.idioma, refresco]);

  // Tocar una notificación: el recordatorio abre el formulario de gasto y el cobro abre ese movimiento.
  const alTocar = useEffectEvent((respuesta: Notifications.NotificationResponse) => {
    const datos = leerDatosNotificacion(respuesta.notification.request.content.data);
    if (!datos) return;
    if (datos.tipo === 'recordatorio') {
      router.push({ pathname: '/movimiento', params: { tipo: 'gasto' } });
    } else {
      router.push({ pathname: '/movimiento', params: { id: datos.id } });
    }
  });
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Si la app se abrió tocando una notificación, la respuesta ya estaba guardada.
    const inicial = Notifications.getLastNotificationResponse();
    const temporizador = inicial
      ? setTimeout(() => {
          alTocar(inicial);
          Notifications.clearLastNotificationResponse();
        }, 150)
      : undefined;
    const suscripcion = Notifications.addNotificationResponseReceivedListener(alTocar);
    return () => {
      if (temporizador) clearTimeout(temporizador);
      suscripcion.remove();
    };
  }, []);

  const valor: ContextoNotificaciones = {
    permiso,
    pedirPermiso,
    pedirPermisoSiHaceFalta,
    ofrecerAvisosDeCobros,
    abrirAjustesDelSistema: () => {
      void Linking.openSettings();
    },
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useNotificaciones(): ContextoNotificaciones {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useNotificaciones debe usarse dentro de <NotificacionesProvider>.');
  return contexto;
}
