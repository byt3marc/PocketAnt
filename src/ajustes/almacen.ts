import Storage from 'expo-sqlite/kv-store';

import { AJUSTES_POR_DEFECTO, normalizarAjustes, type Ajustes } from './normalizar';

const CLAVE = 'ajustes';

/** Lectura síncrona: los ajustes (tema incluido) están listos antes del primer render. */
export function leerAjustes(): Ajustes {
  try {
    const texto = Storage.getItemSync(CLAVE);
    return texto ? normalizarAjustes(JSON.parse(texto)) : AJUSTES_POR_DEFECTO;
  } catch {
    return AJUSTES_POR_DEFECTO;
  }
}

export function guardarAjustes(ajustes: Ajustes): void {
  try {
    Storage.setItemSync(CLAVE, JSON.stringify(ajustes));
  } catch (error) {
    // Perder un ajuste no es grave; la app sigue funcionando con el valor en memoria.
    console.warn('No se pudieron guardar los ajustes', error);
  }
}
