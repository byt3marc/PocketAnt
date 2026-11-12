import { useRouter } from 'expo-router';
import { useRef } from 'react';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { vibrar } from '@/animacion/haptica';
import { useAviso } from '@/componentes/AvisoProvider';
import { useDatos } from '@/datos/DatosProvider';
import { claveCobro, cobrosDe, diasDesde, entradaDeCobro, quitarOmitidos, type Cobro } from '@/dominio/cobros';
import type { I18n } from '@/i18n/traducir';

import { useHoy } from './useHoy';

/** «se cobró ayer», «se cobró hace 5 días»; en un ingreso, «llegaba ayer». */
export function textoCuando(cobro: Cobro, hoy: string, i18n: I18n): string {
  const dias = diasDesde(cobro.fecha, hoy);
  const tipo = cobro.movimiento.tipo;
  if (dias <= 0) return i18n.t(tipo === 'gasto' ? 'cobro.gasto_hoy' : 'cobro.ingreso_hoy');
  if (dias === 1) return i18n.t(tipo === 'gasto' ? 'cobro.gasto_ayer' : 'cobro.ingreso_ayer');
  return i18n.plural(tipo === 'gasto' ? 'cobro.gasto_hace' : 'cobro.ingreso_hace', dias);
}

/**
 * Los cobros recurrentes de hoy (sin los pendientes que el usuario omitió) y las acciones para anotarlos u omitirlos.
 * Registrar guarda una copia simple en el día del cobro y confirma con un aviso que deja editarla.
 */
export function useCobros() {
  const router = useRouter();
  const hoy = useHoy();
  const { movimientos, guardarMovimiento } = useDatos();
  const { ajustes, i18n, formatear, omitirCobro } = useAjustes();
  const { avisar } = useAviso();
  // Evita guardar dos veces el mismo cobro con un doble toque mientras se guarda.
  const enCurso = useRef(new Set<string>());

  const cobros = quitarOmitidos(cobrosDe(movimientos, hoy), ajustes.cobrosOmitidos);

  const registrar = async (cobro: Cobro) => {
    const clave = claveCobro(cobro);
    if (enCurso.current.has(clave)) return;
    enCurso.current.add(clave);
    const entrada = entradaDeCobro(cobro.movimiento, cobro.fecha);
    try {
      const id = await guardarMovimiento(entrada);
      vibrar('exito');
      const monto = formatear(entrada.tipo === 'ingreso' ? entrada.monto : -entrada.monto, { conSigno: true });
      avisar({
        tono: 'exito',
        titulo: i18n.t(entrada.tipo === 'ingreso' ? 'mov.guardado_ingreso' : 'mov.guardado_gasto', { monto }),
        accion: {
          titulo: i18n.t('comun.editar'),
          onPress: () => router.push({ pathname: '/movimiento', params: { id } }),
        },
      });
    } catch {
      vibrar('error');
      avisar({ titulo: i18n.t('mov.error_guardar') });
    } finally {
      enCurso.current.delete(clave);
    }
  };

  const omitir = (cobro: Cobro) => {
    vibrar('aviso');
    omitirCobro(claveCobro(cobro));
  };

  return { cobros, hoy, registrar, omitir };
}
