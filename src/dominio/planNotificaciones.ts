import type { I18n } from '@/i18n/traducir';

import type { AjustesNotificaciones } from './ajustesNotificaciones';
import { claveDeFecha, fechaDeClave, formatearDia, sumarDias } from './fechas';
import { ocurrencias } from './recurrencia';
import type { Movimiento } from './tipos';

/** Hora del día (local) a la que sale el aviso de un cobro. */
export const HORA_AVISO_COBRO = 9;
/** Cuántos días hacia adelante se programan avisos de cobro (se reprograma cada vez que se abre la app). */
export const HORIZONTE_COBROS_DIAS = 90;
const MAX_COBROS_POR_MOVIMIENTO = 4;
/** Tope total de avisos de cobro; con los recordatorios diarios se queda bajo el límite de 64 de iOS. */
const MAX_COBROS_TOTALES = 35;
const MENSAJES_RECORDATORIO = 4;

/** Qué hacer al tocar una notificación. Viaja en `content.data`. */
export type DatosNotificacion = { tipo: 'recordatorio' } | { tipo: 'cobro'; id: string };

export type Disparo =
  | { tipo: 'diario'; hora: number; minuto: number }
  | { tipo: 'fecha'; fecha: Date };

export interface SolicitudNotificacion {
  titulo: string;
  cuerpo: string;
  disparo: Disparo;
  datos: DatosNotificacion;
}

/** Horas del día en que suena el recordatorio: `desde`, `desde + cada`, … hasta `hasta` (inclusive). */
export function horasDeRecordatorio(desde: number, hasta: number, cadaHoras: number): number[] {
  if (!(cadaHoras >= 1) || desde > hasta) return [];
  const horas: number[] = [];
  for (let hora = desde; hora <= hasta && hora <= 23; hora += cadaHoras) horas.push(hora);
  return horas;
}

/** Valida lo que llega en `content.data` al tocar una notificación (puede ser cualquier cosa). */
export function leerDatosNotificacion(crudo: unknown): DatosNotificacion | null {
  if (typeof crudo !== 'object' || crudo === null) return null;
  const datos = crudo as Record<string, unknown>;
  if (datos.tipo === 'recordatorio') return { tipo: 'recordatorio' };
  if (datos.tipo === 'cobro' && typeof datos.id === 'string' && datos.id !== '') {
    return { tipo: 'cobro', id: datos.id };
  }
  return null;
}

export interface EntradaPlan {
  ajustes: AjustesNotificaciones;
  movimientos: readonly Movimiento[];
  ahora: Date;
  i18n: I18n;
  /** Da formato al monto con la moneda activa (p. ej. "S/ 15.00"). */
  formatearMonto: (monto: number) => string;
}

function planRecordatorios({ ajustes, i18n }: EntradaPlan): SolicitudNotificacion[] {
  const { activo, cadaHoras, desde, hasta } = ajustes.recordatorio;
  if (!activo) return [];
  return horasDeRecordatorio(desde, hasta, cadaHoras).map((hora, indice) => ({
    titulo: i18n.t('notif.recordatorio_titulo'),
    // Rota el texto entre varios para que los avisos repetidos no cansen.
    cuerpo: i18n.t(`notif.recordatorio_${(indice % MENSAJES_RECORDATORIO) + 1}` as `notif.recordatorio_1`),
    disparo: { tipo: 'diario', hora, minuto: 0 },
    datos: { tipo: 'recordatorio' },
  }));
}

function planCobros({ ajustes, movimientos, ahora, i18n, formatearMonto }: EntradaPlan): SolicitudNotificacion[] {
  if (!ajustes.cobros.activo) return [];
  const { diasAntes } = ajustes.cobros;
  const hoy = claveDeFecha(ahora);
  const limite = sumarDias(hoy, HORIZONTE_COBROS_DIAS + diasAntes);

  const programados: { cuando: Date; solicitud: SolicitudNotificacion }[] = [];
  for (const m of movimientos) {
    if (m.eliminado || m.tipo !== 'gasto' || !m.recurrente) continue;
    for (const cobro of ocurrencias(m, hoy, limite, MAX_COBROS_POR_MOVIMIENTO)) {
      const dia = fechaDeClave(sumarDias(cobro, -diasAntes));
      const cuando = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), HORA_AVISO_COBRO, 0, 0);
      // Un aviso cuya hora ya pasó se descarta: no se avisa "tarde" cada vez que se reprograma.
      if (cuando.getTime() <= ahora.getTime()) continue;

      const parametros = {
        motivo: m.motivo,
        monto: formatearMonto(m.monto),
        n: diasAntes,
        fecha: formatearDia(cobro, i18n, hoy),
      };
      programados.push({
        cuando,
        solicitud: {
          titulo: i18n.t('notif.cobro_titulo'),
          cuerpo: i18n.t(
            diasAntes === 0 ? 'notif.cobro_hoy' : diasAntes === 1 ? 'notif.cobro_manana' : 'notif.cobro_dias',
            parametros,
          ),
          disparo: { tipo: 'fecha', fecha: cuando },
          datos: { tipo: 'cobro', id: m.id },
        },
      });
    }
  }

  // Si hay más de los permitidos, se quedan los más próximos.
  return programados
    .sort((a, b) => a.cuando.getTime() - b.cuando.getTime())
    .slice(0, MAX_COBROS_TOTALES)
    .map((p) => p.solicitud);
}

/** Todo lo que hay que programar ahora: los recordatorios diarios y los avisos de cobros próximos. */
export function planificarNotificaciones(entrada: EntradaPlan): SolicitudNotificacion[] {
  return [...planRecordatorios(entrada), ...planCobros(entrada)];
}
