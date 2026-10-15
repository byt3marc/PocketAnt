import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { useAviso } from '@/componentes/AvisoProvider';
import { formatearTamano } from '@/dominio/formato';
import { MAX_CARACTERES_RESPUESTA, type MensajeIA } from '@/dominio/promptIA';
import type { ClaveTexto } from '@/i18n/es';

import { traducirErrorIA } from './errores';
import { crearServicioExpoAiKit } from './servicioExpoAiKit';
import { segundoPlanoNativo, type SegundoPlano } from './segundoPlano';
import type { EvaluacionIA, Generacion, InfoModelo, ServicioIA } from './tipos';

/**
 * - `desconocido`: todavía no se consultó al teléfono.
 * - `no-compatible`: la IA no puede correr aquí (se queda el análisis por reglas).
 * - `sin-descargar` → `descargando` → `verificando` → `descargado` (el archivo ya está en el teléfono, entero).
 * - `pausada`: hay una descarga a medias (pausada o cortada) que se puede continuar sin empezar de cero.
 * - `cargando` → `listo`: el modelo está en memoria y puede generar.
 */
export type FaseIA =
  | 'desconocido'
  | 'no-compatible'
  | 'sin-descargar'
  | 'descargando'
  | 'verificando'
  | 'pausada'
  | 'descargado'
  | 'cargando'
  | 'listo';

export interface EstadoIA {
  fase: FaseIA;
  /** Fracción de 0 a 1 de lo descargado, mientras `fase` es `descargando`, `verificando` o `pausada`. */
  progreso: number;
  evaluacion: EvaluacionIA | null;
  /** Último fallo (de la descarga o de la carga); se borra al volver a intentar. */
  error: ClaveTexto | null;
}

export type EstadoInforme = 'inactivo' | 'generando' | 'listo' | 'error';

export interface InformeIA {
  estado: EstadoInforme;
  texto: string;
  error: ClaveTexto | null;
  /** El usuario reportó la respuesta: se oculta. */
  reportado: boolean;
}

interface ContextoIA {
  modelo: InfoModelo;
  estado: EstadoIA;
  informe: InformeIA;
  /** Vuelve a preguntarle al teléfono qué hay (compatibilidad y si el modelo ya está descargado). */
  refrescar: () => Promise<void>;
  /** Empieza la descarga o continúa la que quedó a medias. */
  descargar: () => Promise<void>;
  /** Detiene la descarga conservando lo descargado (se continúa con `descargar`). */
  pausarDescarga: () => Promise<void>;
  /** Cancela y borra lo descargado. */
  cancelarDescarga: () => Promise<void>;
  eliminar: () => Promise<void>;
  generarInforme: (mensajes: MensajeIA[]) => Promise<void>;
  detener: () => void;
  /** Saca el modelo de la memoria (p. ej. al salir de Análisis). El archivo sigue en el teléfono. */
  liberar: () => Promise<void>;
  reportar: () => void;
}

const ESTADO_INICIAL: EstadoIA = { fase: 'desconocido', progreso: 0, evaluacion: null, error: null };
const INFORME_INICIAL: InformeIA = { estado: 'inactivo', texto: '', error: null, reportado: false };

const Contexto = createContext<ContextoIA | null>(null);

interface Props {
  /** Por defecto, la IA real (`expo-ai-kit`). Las pruebas y la vista previa web pasan una falsa. */
  servicio?: ServicioIA;
  /** El servicio en primer plano que mantiene viva la descarga. Por defecto, el nativo (no hace nada donde no existe). */
  segundoPlano?: SegundoPlano;
  children: ReactNode;
}

/**
 * Cada cuánto se publica el progreso como máximo, en la tarjeta y en la notificación. La descarga avisa ~10 veces por
 * segundo: publicar cada aviso volvería a pintar Ajustes, Análisis y la tarjeta sin que se note (la barra ya avanza
 * sola entre dato y dato) y gastaría batería.
 */
const INTERVALO_PROGRESO_MS = 1000;

function faseDeEvaluacion(evaluacion: EvaluacionIA): FaseIA {
  if (!evaluacion.compatible) return 'no-compatible';
  if (evaluacion.cargado) return 'listo';
  if (evaluacion.descargado) return 'descargado';
  return evaluacion.parcialBytes > 0 ? 'pausada' : 'sin-descargar';
}

/** Cuánto del modelo hay ya en el teléfono, de 0 a 1 (para la barra de una descarga pausada). */
function progresoDeEvaluacion(evaluacion: EvaluacionIA, tamanoBytes: number): number {
  return evaluacion.compatible && !evaluacion.descargado ? Math.min(1, evaluacion.parcialBytes / tamanoBytes) : 0;
}

export function IAProvider({ servicio: servicioPropio, segundoPlano = segundoPlanoNativo, children }: Props) {
  const [servicioPorDefecto] = useState(() => (servicioPropio ? null : crearServicioExpoAiKit()));
  const servicio = (servicioPropio ?? servicioPorDefecto) as ServicioIA;
  const { i18n } = useAjustes();
  const { avisar } = useAviso();

  const [estado, setEstado] = useState<EstadoIA>(ESTADO_INICIAL);
  const [informe, setInforme] = useState<InformeIA>(INFORME_INICIAL);
  const generacion = useRef<Generacion | null>(null);
  // Si pasa otra cosa (descargar, eliminar) mientras se evalúa, la evaluación vieja se descarta.
  const version = useRef(0);
  const ocupado = useRef(false);
  // Si piden liberar la memoria mientras se genera, se hace en cuanto termine la generación.
  const liberarPendiente = useRef(false);

  /** Un fallo real (no una cancelación) se cuenta con un aviso: qué pasó y por qué. */
  const avisarFallo = (titulo: ClaveTexto, clave: ClaveTexto, detalle: string) =>
    avisar({ titulo: i18n.t(titulo), mensaje: i18n.t(clave), detalle });

  /**
   * Tras un fallo del motor se descarga de la memoria: el siguiente intento crea uno nuevo. Un motor que falló una vez
   * (p. ej. una cola de OpenCL rota) no se recupera sin reiniciarse.
   */
  const reiniciarMotor = async () => {
    try {
      await servicio.liberar();
    } catch {
      // Si tampoco se deja liberar, el siguiente intento lo dirá.
    }
    setEstado((actual) => (actual.fase === 'listo' || actual.fase === 'cargando' ? { ...actual, fase: 'descargado' } : actual));
  };

  const refrescar = async () => {
    if (ocupado.current) return;
    const mia = ++version.current;
    const evaluacion = await servicio.evaluar();
    if (mia !== version.current || ocupado.current) return;
    setEstado((actual) => ({
      ...actual,
      evaluacion,
      fase: faseDeEvaluacion(evaluacion),
      progreso: progresoDeEvaluacion(evaluacion, servicio.modelo.tamanoBytes),
    }));
  };

  const descargar = async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    version.current += 1;
    // Si queda algo descargado, el progreso arranca desde ahí (la descarga continúa, no empieza de cero).
    setEstado((actual) => ({ ...actual, fase: 'descargando', error: null }));

    // Servicio en primer plano: mantiene viva la app y muestra el progreso con los botones Pausar y Cancelar.
    const tamano = servicio.modelo.tamanoBytes;
    const textoProgreso = (fraccion: number) =>
      i18n.t('ia.noti_progreso', {
        porcentaje: Math.round(fraccion * 100),
        hecho: formatearTamano(tamano * fraccion),
        total: formatearTamano(tamano),
      });
    try {
      segundoPlano.iniciar({
        titulo: i18n.t('ia.noti_titulo'),
        texto: textoProgreso(estado.progreso),
        pausar: i18n.t('ia.pausar'),
        cancelar: i18n.t('ia.cancelar_corto'),
        canalProgreso: i18n.t('ia.noti_canal_progreso'),
        canalResultado: i18n.t('ia.noti_canal_resultado'),
      });
    } catch {
      // Sin el servicio en primer plano la descarga sigue igual mientras la app esté abierta.
    }
    const dejarDeEscuchar = segundoPlano.alAccion((accion) =>
      accion === 'pausar' ? void pausarDescarga() : void cancelarDescarga(),
    );
    let ultimoProgreso = 0;
    // Lo que se le cuenta al usuario al terminar; `null` = nada (lo canceló él mismo).
    let final: { titulo: ClaveTexto; texto: ClaveTexto } | null = null;

    try {
      const resultado = await servicio.descargar(
        (fraccion) => {
          const ahora = Date.now();
          if (ahora - ultimoProgreso < INTERVALO_PROGRESO_MS) return;
          ultimoProgreso = ahora;
          setEstado((actual) => (actual.fase === 'descargando' ? { ...actual, progreso: fraccion } : actual));
          segundoPlano.actualizar(fraccion, textoProgreso(fraccion));
        },
        () => {
          setEstado((actual) => ({ ...actual, fase: 'verificando', progreso: 1 }));
          segundoPlano.actualizar(-1, i18n.t('ia.noti_verificando'));
        },
      );
      setEstado((actual) =>
        resultado === 'completa'
          ? { ...actual, fase: 'descargado', progreso: 1, error: null }
          : { ...actual, fase: 'pausada', error: null },
      );
      final =
        resultado === 'completa'
          ? { titulo: 'ia.noti_completa_titulo', texto: 'ia.noti_completa' }
          : { titulo: 'ia.noti_pausada_titulo', texto: 'ia.noti_pausada' };
    } catch (fallo) {
      const { cancelado, clave, detalle } = traducirErrorIA(fallo);
      if (!cancelado) {
        avisarFallo('aviso.descarga', clave, detalle);
        final = { titulo: 'ia.noti_error_titulo', texto: 'ia.noti_error' };
      }
      // Un corte no pierde lo descargado: se pregunta al teléfono cuánto quedó para poder continuar.
      let evaluacion: EvaluacionIA | null = null;
      try {
        evaluacion = await servicio.evaluar();
      } catch {
        evaluacion = null;
      }
      const parcial = evaluacion?.compatible ? evaluacion.parcialBytes : 0;
      setEstado((actual) => ({
        ...actual,
        evaluacion: evaluacion ?? actual.evaluacion,
        fase: parcial > 0 ? 'pausada' : 'sin-descargar',
        progreso: Math.min(1, parcial / servicio.modelo.tamanoBytes),
        error: cancelado ? null : clave,
      }));
    } finally {
      ocupado.current = false;
      dejarDeEscuchar();
      // Con la app a la vista no hace falta una notificación más: se ve en la tarjeta.
      const aLaVista = AppState.currentState === 'active';
      segundoPlano.terminar(final ? i18n.t(final.titulo) : '', final ? i18n.t(final.texto) : '', final !== null && !aLaVista);
    }
  };

  const pausarDescarga = async () => {
    await servicio.pausarDescarga();
  };

  const cancelarDescarga = async () => {
    await servicio.cancelarDescarga();
    // Con la descarga pausada no hay nada en curso que lo actualice: se hace aquí.
    if (!ocupado.current) setEstado((actual) => ({ ...actual, fase: 'sin-descargar', progreso: 0, error: null }));
  };

  const detener = () => generacion.current?.detener();

  const liberar = async () => {
    detener();
    if (ocupado.current) {
      liberarPendiente.current = true;
      return;
    }
    try {
      await servicio.liberar();
    } catch {
      // Liberar memoria nunca debe molestar al usuario.
    }
    setEstado((actual) => (actual.fase === 'listo' ? { ...actual, fase: 'descargado' } : actual));
  };

  const eliminar = async () => {
    detener();
    version.current += 1;
    try {
      await servicio.eliminar();
    } catch (fallo) {
      const { clave, detalle } = traducirErrorIA(fallo);
      setEstado((actual) => ({ ...actual, error: clave }));
      avisarFallo('aviso.eliminar', clave, detalle);
      return;
    }
    setInforme(INFORME_INICIAL);
    setEstado((actual) => ({
      ...actual,
      fase: 'sin-descargar',
      progreso: 0,
      error: null,
      evaluacion: actual.evaluacion?.compatible
        ? { ...actual.evaluacion, descargado: false, cargado: false, parcialBytes: 0 }
        : actual.evaluacion,
    }));
  };

  const generarInforme = async (mensajes: MensajeIA[]) => {
    if (ocupado.current) return;
    ocupado.current = true;
    setInforme({ estado: 'generando', texto: '', error: null, reportado: false });
    try {
      // La primera vez el modelo se carga en memoria (unos segundos).
      if (estado.fase !== 'listo') {
        setEstado((actual) => ({ ...actual, fase: 'cargando', error: null }));
        try {
          await servicio.cargar();
        } catch (fallo) {
          const { clave, detalle } = traducirErrorIA(fallo);
          await reiniciarMotor();
          setEstado((actual) => ({ ...actual, fase: 'descargado', error: clave }));
          setInforme({ estado: 'error', texto: '', error: clave, reportado: false });
          avisarFallo('aviso.carga', clave, detalle);
          return;
        }
        setEstado((actual) => ({ ...actual, fase: 'listo' }));
      }

      let acumulado = '';
      let cortar = () => {};
      const flujo = servicio.generar(mensajes, (texto) => {
        acumulado = texto;
        setInforme((actual) => (actual.estado === 'generando' ? { ...actual, texto } : actual));
        // Un modelo pequeño a veces no sabe parar: se corta al llegar al límite.
        if (texto.length > MAX_CARACTERES_RESPUESTA) cortar();
      });
      cortar = flujo.detener;
      generacion.current = flujo;
      try {
        const final = await flujo.promesa;
        const texto = (final || acumulado).slice(0, MAX_CARACTERES_RESPUESTA).trim();
        setInforme({ estado: 'listo', texto, error: null, reportado: false });
      } catch (fallo) {
        const { cancelado, clave, detalle } = traducirErrorIA(fallo);
        // Si el usuario detuvo la generación, se queda con lo que ya había salido.
        if (cancelado && acumulado) setInforme({ estado: 'listo', texto: acumulado.trim(), error: null, reportado: false });
        else if (cancelado) setInforme(INFORME_INICIAL);
        else {
          setInforme({ estado: 'error', texto: '', error: clave, reportado: false });
          avisarFallo('aviso.informe', clave, detalle);
          await reiniciarMotor();
        }
      }
    } finally {
      generacion.current = null;
      ocupado.current = false;
      if (liberarPendiente.current) {
        liberarPendiente.current = false;
        await liberar();
      }
    }
  };

  const reportar = () => setInforme((actual) => ({ ...actual, reportado: true, texto: '' }));

  // Si la app pasa a segundo plano a mitad de un informe, se detiene: no hay que gastar batería a escondidas.
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (siguiente) => {
      if (siguiente !== 'active') generacion.current?.detener();
    });
    return () => suscripcion.remove();
  }, []);

  const valor: ContextoIA = {
    modelo: servicio.modelo,
    estado,
    informe,
    refrescar,
    descargar,
    pausarDescarga,
    cancelarDescarga,
    eliminar,
    generarInforme,
    detener,
    liberar,
    reportar,
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useIA(): ContextoIA {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useIA debe usarse dentro de <IAProvider>.');
  return contexto;
}
