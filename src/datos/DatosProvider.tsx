import * as Crypto from 'expo-crypto';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { actualizarMovimiento, crearMovimiento } from '@/dominio/movimiento';
import type { ImagenBorrador } from '@/dominio/imagenes';
import { calcularTotales, type Totales } from '@/dominio/saldo';
import type { EntradaMovimiento, Movimiento } from '@/dominio/tipos';
import { ErrorTraducible } from '@/i18n/errores';

import { crearAlmacenImagenes, type AlmacenImagenes } from './almacenImagenes';
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
  /**
   * Sin `id` crea un movimiento; con `id` edita el existente. `imagenes` reemplaza las fotos actuales.
   * Devuelve el id del movimiento guardado (el nuevo, si se creó).
   */
  guardarMovimiento: (
    entrada: EntradaMovimiento,
    id?: string,
    imagenes?: readonly ImagenBorrador[],
  ) => Promise<string>;
  /** Guarda un lote de forma atómica (p. ej. la importación desde imagen): se persiste todo o nada. */
  guardarLoteMovimientos: (entradas: readonly EntradaMovimiento[]) => Promise<void>;
  eliminarMovimiento: (id: string) => Promise<void>;
  /** Borra lógicamente todos los movimientos; la sincronización propaga el borrado a la nube. */
  limpiarDatos: () => Promise<void>;
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
  /** Disco de las fotos: galería, cámara, rutas locales y limpieza de temporales. */
  almacen: AlmacenImagenes;
}

const Contexto = createContext<ContextoDatos | null>(null);

interface Props {
  repositorio: RepositorioMovimientos;
  /** Dónde se exporta/importa. Hoy es un archivo JSON; mañana Google Drive. */
  proveedorSync: ProveedorSync;
  /** Disco de las fotos; se puede reemplazar en las pruebas. */
  almacen?: AlmacenImagenes;
  children: ReactNode;
}

export function DatosProvider({
  repositorio,
  proveedorSync,
  almacen = crearAlmacenImagenes(),
  children,
}: Props) {
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

    guardarMovimiento: async (entrada, id, imagenes) => {
      const ahora = new Date();
      let existente: Movimiento | undefined;
      if (id) {
        existente = movimientos.find((m) => m.id === id);
        if (!existente) throw new ErrorTraducible('error.movimiento_inexistente');
      }

      const movimientoId = id ?? Crypto.randomUUID();
      // Primero los archivos: si falla el guardado, no queda un movimiento apuntando a fotos que no existen.
      const metadatos = imagenes ? await almacen.guardar(movimientoId, imagenes) : undefined;

      const base = existente
        ? actualizarMovimiento(existente, entrada, ahora)
        : crearMovimiento(entrada, movimientoId, ahora);
      const movimiento = metadatos === undefined ? base : { ...base, imagenes: metadatos };

      await repositorio.guardar(movimiento);
      if (metadatos !== undefined) almacen.conservar(movimientoId, metadatos);
      await recargar();
      setVersionLocal((v) => v + 1);
      return movimientoId;
    },

    guardarLoteMovimientos: async (entradas) => {
      if (entradas.length === 0) return;
      const ahora = new Date();
      const lote = entradas.map((entrada) => crearMovimiento(entrada, Crypto.randomUUID(), ahora));
      // Atómico: si la transacción falla, nada se persiste y el error se propaga al llamante.
      await repositorio.guardarLote(lote);
      try {
        await recargar();
      } catch {
        // Un refresco que falla después de un commit no invalida el lote: lo verá la pantalla de destino.
      }
      setVersionLocal((v) => v + 1);
    },

    eliminarMovimiento: async (id) => {
      await repositorio.eliminar(id, new Date());
      almacen.eliminarDeMovimiento(id);
      await recargar();
      setVersionLocal((v) => v + 1);
    },

    limpiarDatos: async () => {
      await repositorio.limpiarTodo(new Date());
      almacen.limpiarTodo();
      await recargar();
      setVersionLocal((v) => v + 1);
    },

    exportar: () => exportarDatos(repositorio, proveedorSync, almacen),

    importar: async () => {
      const resultado = await importarDatos(repositorio, proveedorSync, almacen);
      if (resultado) {
        await recargar();
        setVersionLocal((v) => v + 1);
      }
      return resultado;
    },

    versionLocal,

    almacen,

    sincronizar: async (proveedor) => {
      const resultado = await sincronizarDatos(repositorio, proveedor, almacen);
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
