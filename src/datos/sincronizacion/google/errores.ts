import { ErrorTraducible } from '@/i18n/errores';
import type { ClaveTexto, Parametros } from '@/i18n/traducir';

/** Fallo al hablar con Google. `clave` es el mensaje (traducible) para el usuario. */
export class ErrorDrive extends ErrorTraducible {
  /** Reconectar la cuenta lo resolvería (sesión caducada, permiso retirado). */
  readonly requiereReconectar: boolean;

  constructor(
    clave: Extract<ClaveTexto, `error.drive.${string}`>,
    opciones: { parametros?: Parametros; requiereReconectar?: boolean } = {},
  ) {
    super(clave, opciones.parametros);
    this.name = 'ErrorDrive';
    this.requiereReconectar = opciones.requiereReconectar ?? false;
  }
}
