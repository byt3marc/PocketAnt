package expo.modules.autorizaciongoogle

import android.accounts.Account
import android.app.Activity
import android.content.Context
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.ClearTokenRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.identity.RevokeAccessRequest
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Permiso para usar Google Drive con la API actual de Google (`AuthorizationClient`, de Google Identity Services), que
 * sustituye a la de Google Sign-In (obsoleta y retirada en `play-services-auth` 22). No inicia sesión: solo pide un
 * token de acceso para los permisos indicados. Si el usuario ya los concedió, el token llega sin mostrar nada; si no,
 * Google muestra su pantalla (elegir cuenta y aceptar) y la respuesta vuelve en `OnActivityResult`.
 */
class AutorizacionGoogleModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** La llamada a `autorizar` que espera la respuesta de la pantalla de Google. Solo puede haber una a la vez. */
  private var pendiente: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("AutorizacionGoogle")

    // Devuelve `{ token, scopes }`, o `null` si el usuario cerró la pantalla de Google. Sin `interactivo` nunca
    // muestra nada: si hace falta el consentimiento del usuario, falla con `NECESITA_PERMISO`.
    AsyncFunction("autorizar") { scopes: List<String>, interactivo: Boolean, promise: Promise ->
      if (pendiente != null) {
        promise.reject("EN_CURSO", "Ya hay una autorización de Google en curso", null)
        return@AsyncFunction
      }
      val solicitud = AuthorizationRequest.builder()
        .setRequestedScopes(scopes.map { Scope(it) })
        .build()
      Identity.getAuthorizationClient(context)
        .authorize(solicitud)
        .addOnSuccessListener { resultado ->
          if (!resultado.hasResolution()) {
            resolver(promise, resultado)
            return@addOnSuccessListener
          }
          val pantalla = resultado.pendingIntent
          if (!interactivo || pantalla == null) {
            promise.reject("NECESITA_PERMISO", "Google necesita que el usuario vuelva a dar permiso", null)
            return@addOnSuccessListener
          }
          try {
            pendiente = promise
            appContext.throwingActivity.startIntentSenderForResult(pantalla.intentSender, CODIGO_PETICION, null, 0, 0, 0)
          } catch (e: Exception) {
            pendiente = null
            promise.reject("GENERICO", e.message ?: "No se pudo abrir la pantalla de Google", e)
          }
        }
        .addOnFailureListener { e -> rechazar(promise, e) }
      // Lo que se devuelve es la promesa; el valor de la lambda no se usa.
      Unit
    }

    OnActivityResult { _, (requestCode, resultCode, data) ->
      if (requestCode != CODIGO_PETICION) return@OnActivityResult
      val promise = pendiente ?: return@OnActivityResult
      pendiente = null
      if (resultCode != Activity.RESULT_OK || data == null) {
        promise.resolve(null)
        return@OnActivityResult
      }
      try {
        resolver(promise, Identity.getAuthorizationClient(context).getAuthorizationResultFromIntent(data))
      } catch (e: ApiException) {
        rechazar(promise, e)
      }
    }

    // Google rechazó este token (caducado o revocado): se quita de la caché para que el siguiente sea nuevo.
    AsyncFunction("limpiarToken") { token: String, promise: Promise ->
      Identity.getAuthorizationClient(context)
        .clearToken(ClearTokenRequest.builder().setToken(token).build())
        .addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { e -> rechazar(promise, e) }
      Unit
    }

    // Retira todos los permisos que la cuenta le dio a la app (al desconectar), así se puede elegir otra cuenta.
    AsyncFunction("revocar") { email: String, scopes: List<String>, promise: Promise ->
      val solicitud = RevokeAccessRequest.builder()
        .setAccount(Account(email, TIPO_CUENTA_GOOGLE))
        .setScopes(scopes.map { Scope(it) })
        .build()
      Identity.getAuthorizationClient(context)
        .revokeAccess(solicitud)
        .addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { e -> rechazar(promise, e) }
      Unit
    }
  }

  private fun resolver(promise: Promise, resultado: AuthorizationResult) {
    val token = resultado.accessToken
    if (token == null) {
      promise.reject("GENERICO", "Google no devolvió un token de acceso", null)
      return
    }
    promise.resolve(mapOf("token" to token, "scopes" to resultado.grantedScopes))
  }

  /** Traduce el fallo de Google a un código que JavaScript sabe explicar. */
  private fun rechazar(promise: Promise, e: Exception) {
    val codigo = when ((e as? ApiException)?.statusCode) {
      CommonStatusCodes.NETWORK_ERROR -> "RED"
      CommonStatusCodes.CANCELED -> "CANCELADO"
      CommonStatusCodes.DEVELOPER_ERROR -> "CONFIGURACION"
      CommonStatusCodes.SIGN_IN_REQUIRED -> "NECESITA_PERMISO"
      else -> "GENERICO"
    }
    promise.reject(codigo, e.message ?: codigo, e)
  }

  companion object {
    private const val CODIGO_PETICION = 4310
    private const val TIPO_CUENTA_GOOGLE = "com.google"
  }
}
