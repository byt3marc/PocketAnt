import { StyleSheet, View } from 'react-native';

import { useAjustes } from '@/ajustes/AjustesProvider';
import { useSincronizacion } from '@/datos/sincronizacion/SincronizacionProvider';
import { claveDeFecha, formatearDia, formatearHora } from '@/dominio/fechas';
import { mensajeDeError } from '@/i18n/errores';
import type { I18n } from '@/i18n/traducir';
import type { Paleta } from '@/tema/paleta';
import { useEstilos } from '@/tema/useEstilos';

import { useDialogo } from './DialogoProvider';
import { FilaAjuste } from './FilaAjuste';
import { FilaInterruptor } from './FilaInterruptor';

/** "Hoy, 21:35" / "Today, 21:35" en hora local. */
function formatearCuando(iso: string, i18n: I18n): string {
  const fecha = new Date(iso);
  const hora = formatearHora(fecha.getHours(), fecha.getMinutes());
  return i18n.t('drive.hora', { dia: formatearDia(claveDeFecha(fecha), i18n), hora });
}

/**
 * Filas de Ajustes para conectar, ver el estado y controlar la sincronización con Google Drive, con su separador de
 * arriba. Si Drive no está disponible (sin activar en `app.json` o sin el módulo nativo) no muestra nada.
 */
export function BloqueDrive() {
  const estilos = useEstilos(crearEstilos);
  const { ajustes, cambiarDrive, i18n } = useAjustes();
  const { alerta } = useDialogo();
  const { disponible, estado, error, requiereReconectar, conectar, desconectar, sincronizarAhora } =
    useSincronizacion();
  const drive = ajustes.drive;

  if (!disponible) return null;

  if (!drive.conectado) {
    return (
      <>
        <View style={estilos.separador} />
        <FilaAjuste
          icono="cloud-outline"
          titulo={i18n.t('drive.conectar')}
          descripcion={i18n.t('drive.conectar_desc')}
          onPress={conectar}
        />
        {error ? <MensajeDeError texto={mensajeDeError(error, i18n)} /> : null}
      </>
    );
  }

  const textoEstado =
    estado === 'sincronizando'
      ? i18n.t('drive.sincronizando')
      : error
        ? mensajeDeError(error, i18n)
        : drive.ultimaSync
          ? i18n.t('drive.ultima', { cuando: formatearCuando(drive.ultimaSync, i18n) })
          : i18n.t('drive.nunca');

  const confirmarDesconexion = () =>
    alerta(i18n.t('drive.desconectar_titulo'), i18n.t('drive.desconectar_mensaje'), [
      { text: i18n.t('comun.cancelar'), style: 'cancel' },
      { text: i18n.t('drive.desconectar'), style: 'destructive', onPress: () => void desconectar() },
    ]);

  return (
    <>
      <View style={estilos.separador} />
      <FilaAjuste
        icono="cloud-done-outline"
        titulo={i18n.t('drive.conectado_como', { email: drive.email ?? '' })}
        descripcion={i18n.t('drive.respaldo_nota')}
      />
      <View style={estilos.separador} />
      <View style={estilos.bloque}>
        <FilaInterruptor
          titulo={i18n.t('drive.auto')}
          descripcion={i18n.t('drive.auto_desc')}
          valor={drive.auto}
          onCambio={(auto) => cambiarDrive({ auto })}
        />
      </View>
      <View style={estilos.separador} />
      <FilaAjuste
        icono="sync-outline"
        titulo={i18n.t('drive.sincronizar_ahora')}
        descripcion={textoEstado}
        onPress={() => void sincronizarAhora()}
        cargando={estado === 'sincronizando'}
      />
      {requiereReconectar ? (
        <>
          <View style={estilos.separador} />
          <FilaAjuste icono="log-in-outline" titulo={i18n.t('drive.reconectar')} onPress={() => void conectar()} />
        </>
      ) : null}
      <View style={estilos.separador} />
      <FilaAjuste icono="log-out-outline" titulo={i18n.t('drive.desconectar')} onPress={confirmarDesconexion} />
    </>
  );
}

function MensajeDeError({ texto }: { texto: string }) {
  const estilos = useEstilos(crearEstilos);
  return (
    <View style={estilos.bloque}>
      <FilaAjuste icono="alert-circle-outline" titulo={texto} deshabilitada />
    </View>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    separador: { height: StyleSheet.hairlineWidth, backgroundColor: c.borde },
    bloque: { paddingVertical: 8, paddingHorizontal: 4 },
  });
