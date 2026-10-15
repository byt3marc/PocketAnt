import { useLocales } from 'expo-localization';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import type { AjustesDrive } from '@/dominio/ajustesDrive';
import type { AjustesNotificaciones } from '@/dominio/ajustesNotificaciones';
import { formatearMonto, type OpcionesMonto } from '@/dominio/formato';
import { resolverMoneda, type Moneda } from '@/dominio/moneda';
import { crearI18n, resolverIdioma, type I18n, type PreferenciaIdioma } from '@/i18n/traducir';
import type { FuenteApp } from '@/tema/fuentes';
import { paletas, type EsquemaDeColor, type Paleta } from '@/tema/paleta';

import { guardarAjustes, leerAjustes } from './almacen';
import type { Ajustes, PreferenciaTema, TipoGrafica } from './normalizar';

/** Que el sistema (barra de estado, diálogos, selector de fecha) siga la elección del usuario. */
function aplicarEsquemaAlSistema(tema: PreferenciaTema) {
  // react-native-web no implementa setColorScheme (la web solo se usa para desarrollo).
  if (Platform.OS === 'web') return;
  Appearance.setColorScheme(tema === 'sistema' ? 'unspecified' : tema === 'claro' ? 'light' : 'dark');
}

// Se lee y aplica al cargar el módulo para que no haya parpadeo de tema al abrir la app.
const ajustesIniciales = leerAjustes();
aplicarEsquemaAlSistema(ajustesIniciales.tema);

interface ContextoAjustes {
  ajustes: Ajustes;
  esquema: EsquemaDeColor;
  colores: Paleta;
  moneda: Moneda;
  /** Idioma activo y traductor (`i18n.t`, `i18n.plural`). */
  i18n: I18n;
  formatear: (valor: number, opciones?: Omit<OpcionesMonto, 'locale'>) => string;
  cambiarTema: (tema: PreferenciaTema) => void;
  cambiarMoneda: (moneda: string) => void;
  cambiarTipoGrafica: (tipo: TipoGrafica) => void;
  cambiarIdioma: (idioma: PreferenciaIdioma) => void;
  /** Cambia la fuente del texto de toda la app. */
  cambiarFuente: (fuente: FuenteApp) => void;
  /** Cambia solo los campos indicados; `recordatorio` y `cobros` se fusionan con lo que ya había. */
  cambiarNotificaciones: (cambios: CambiosNotificaciones) => void;
  /** Cambia solo los campos indicados de la sincronización con Drive. */
  cambiarDrive: (cambios: Partial<AjustesDrive>) => void;
}

export interface CambiosNotificaciones {
  recordatorio?: Partial<AjustesNotificaciones['recordatorio']>;
  cobros?: Partial<AjustesNotificaciones['cobros']>;
  permisoPreguntado?: boolean;
}

const Contexto = createContext<ContextoAjustes | null>(null);

export function AjustesProvider({ children }: { children: ReactNode }) {
  const [ajustes, setAjustes] = useState<Ajustes>(ajustesIniciales);
  const esquemaDelSistema = useColorScheme();
  const [localePrincipal] = useLocales();

  const esquema: EsquemaDeColor =
    ajustes.tema === 'sistema' ? (esquemaDelSistema === 'dark' ? 'oscuro' : 'claro') : ajustes.tema;

  const moneda = resolverMoneda(ajustes.moneda, localePrincipal);
  const locale = localePrincipal?.languageTag;
  const i18n = crearI18n(resolverIdioma(ajustes.idioma, localePrincipal?.languageCode));

  // Siempre guarda lo último, también para quien llame desde una función asíncrona creada antes de un
  // cambio (p. ej. la sincronización anota su hora mientras el usuario cambia otro ajuste).
  const ultimos = useRef(ajustes);
  const actualizar = (cambiar: (actuales: Ajustes) => Ajustes) => {
    const siguiente = cambiar(ultimos.current);
    ultimos.current = siguiente;
    setAjustes(siguiente);
    guardarAjustes(siguiente);
  };

  const valor: ContextoAjustes = {
    ajustes,
    esquema,
    colores: paletas[esquema],
    moneda,
    i18n,
    formatear: (monto, opciones) => formatearMonto(monto, moneda, { ...opciones, locale }),
    cambiarTema: (tema) => {
      aplicarEsquemaAlSistema(tema);
      actualizar((actuales) => ({ ...actuales, tema }));
    },
    cambiarMoneda: (nueva) => actualizar((actuales) => ({ ...actuales, moneda: nueva })),
    cambiarTipoGrafica: (tipoGrafica) => actualizar((actuales) => ({ ...actuales, tipoGrafica })),
    cambiarIdioma: (idioma) => actualizar((actuales) => ({ ...actuales, idioma })),
    cambiarFuente: (fuente) => actualizar((actuales) => ({ ...actuales, fuente })),
    cambiarDrive: (cambios) =>
      actualizar((actuales) => ({ ...actuales, drive: { ...actuales.drive, ...cambios } })),
    cambiarNotificaciones: (cambios) =>
      actualizar((actuales) => ({
        ...actuales,
        notificaciones: {
          recordatorio: { ...actuales.notificaciones.recordatorio, ...cambios.recordatorio },
          cobros: { ...actuales.notificaciones.cobros, ...cambios.cobros },
          permisoPreguntado: cambios.permisoPreguntado ?? actuales.notificaciones.permisoPreguntado,
        },
      })),
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAjustes(): ContextoAjustes {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAjustes debe usarse dentro de <AjustesProvider>.');
  return contexto;
}
