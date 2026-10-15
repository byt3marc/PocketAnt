export interface AjustesDrive {
  /** El usuario conectó su cuenta de Google. */
  conectado: boolean;
  /** Correo de la cuenta conectada (solo para mostrarlo). */
  email: string | null;
  /** Sincronizar al abrir la app, al volver a ella y poco después de cada cambio. */
  auto: boolean;
  /** Última sincronización exitosa (ISO UTC). */
  ultimaSync: string | null;
}

export const DRIVE_POR_DEFECTO: AjustesDrive = {
  conectado: false,
  email: null,
  auto: true,
  ultimaSync: null,
};

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** Convierte lo guardado (posiblemente incompleto o de una versión vieja) en ajustes válidos. */
export function normalizarDrive(crudo: unknown): AjustesDrive {
  const datos = esObjeto(crudo) ? crudo : {};
  const email = typeof datos.email === 'string' && datos.email.trim() !== '' ? datos.email : null;
  const ultimaSync =
    typeof datos.ultimaSync === 'string' && !Number.isNaN(Date.parse(datos.ultimaSync))
      ? datos.ultimaSync
      : null;
  // Sin correo no hay cuenta conectada que mostrar: se considera desconectado.
  const conectado = datos.conectado === true && email !== null;
  return {
    conectado,
    email: conectado ? email : null,
    auto: typeof datos.auto === 'boolean' ? datos.auto : DRIVE_POR_DEFECTO.auto,
    ultimaSync: conectado ? ultimaSync : null,
  };
}
