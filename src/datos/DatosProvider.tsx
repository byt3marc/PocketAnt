import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { actualizarMovimiento, crearMovimiento } from '@/dominio/movimiento';
import { calcularTotales, type Totales } from '@/dominio/saldo';
import type { EntradaMovimiento, Movimiento } from '@/dominio/tipos';
import { ErrorTraducible } from '@/i18n/errores';

import type { RepositorioMovimientos } from './repositorio';
import type { ProveedorSync } from './sincronizacion/proveedor';
import {
  exportarDatos,
  importarDatos,
  sincronizar as sincronizarDatos,
  type ResultadoExportacion,
  type ResultadoImportacion,
  type ResultadoSincronizacion,
} from './sincronizacion/servicio';

interface ContextoDatos {
  /** Movimientos visibles, del más reciente al más antiguo. */
  movimientos: Movimiento[];
  /** `true` hasta que termina la primera lectura de la base de datos. */
  cargando: boolean;
  totales: Totales;
  /** Sin `id` crea un movimiento; con `id` edita el existente. */
  guardarMovimiento: (entrada: EntradaMovimiento, id?: string) => Promise<void>;
  eliminarMovimiento: (id: string) => Promise<void>;
  exportar: () => Promise<ResultadoExportacion>;
  /** `null` si el usuario canceló la selección del archivo. */
  importar: () => Promise<ResultadoImportacion | null>;
  /**
   * Sube de 1 cada vez que el usuario cambia sus datos (agregar, editar, eliminar, importar), pero no cuando
   * llegan cambios de la nube. Sirve para sincronizar tras un cambio local sin entrar en un bucle.
   */
  versionLocal: number;
  /** Sincroniza con un proveedor de nube (trae, fusiona y sube lo que falte) y refresca la lista. */
  sincronizar: (proveedor: ProveedorSync) => Promise<ResultadoSincronizacion>;
}

const Contexto = createContext<ContextoDatos | null>(null);

interface Props {
  repositorio: RepositorioMovimientos;
  /** Dónde se exporta/importa. Hoy es un archivo JSON; mañana Google Drive. */
  proveedorSync: ProveedorSync;
  children: ReactNode;
}

export function DatosProvider({ repositorio, proveedorSync, children }: Props) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [versionLocal, setVersionLocal] = useState(0);

  useEffect(() => {
    let vigente = true;
    repositorio
      .listarActivos()
      .then((lista) => {
        if (vigente) setMovimientos(lista);
      })
      .catch((error) => console.error('No se pudieron leer los movimientos', error))
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [repositorio]);

  const recargar = async () => {
    setMovimientos(await repositorio.listarActivos());
  };

  const valor: ContextoDatos = {
    movimientos,
    cargando,
    totales: calcularTotales(movimientos),

    guardarMovimiento: async (entrada, id) => {
      const ahora = new Date();
      if (id) {
        const existente = movimientos.find((m) => m.id === id);
        if (!existente) throw new ErrorTraducible('error.movimiento_inexistente');
        await repositorio.guardar(actualizarMovimiento(existente, entrada, ahora));
      } else {
        await repositorio.guardar(crearMovimiento(entrada, Crypto.randomUUID(), ahora));
      }
      await recargar();
      setVersionLocal((v) => v + 1);
    },

    eliminarMovimiento: async (id) => {
      await repositorio.eliminar(id, new Date());
      await recargar();
      setVersionLocal((v) => v + 1);
    },

    exportar: () => exportarDatos(repositorio, proveedorSync),

    importar: async () => {
      const resultado = await importarDatos(repositorio, proveedorSync);
      if (resultado) {
        await recargar();
        setVersionLocal((v) => v + 1);
      }
      return resultado;
    },

    versionLocal,

    sincronizar: async (proveedor) => {
      const resultado = await sincronizarDatos(repositorio, proveedor);
      await recargar(); // sin subir `versionLocal`: lo que llega de la nube no dispara otra sincronización
      return resultado;
    },
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDatos(): ContextoDatos {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useDatos debe usarse dentro de <DatosProvider>.');
  return contexto;
}
