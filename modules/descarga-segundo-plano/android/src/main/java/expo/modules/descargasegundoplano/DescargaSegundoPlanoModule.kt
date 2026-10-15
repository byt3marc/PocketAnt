package expo.modules.descargasegundoplano

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Puente entre JavaScript y [DescargaService]. La descarga en sí la hace JavaScript; este módulo solo enciende el
 * servicio en primer plano (con su notificación de progreso), lo actualiza y lo apaga, y avisa a JavaScript cuando
 * el usuario toca «Pausar» o «Cancelar» en la notificación.
 */
class DescargaSegundoPlanoModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("DescargaSegundoPlano")

    Events("onAccion")

    OnCreate {
      DescargaService.alAccion = { accion -> sendEvent("onAccion", mapOf("accion" to accion)) }
    }

    OnDestroy {
      DescargaService.alAccion = null
    }

    // `textos`: titulo, texto, pausar, cancelar, canalProgreso y canalResultado, ya traducidos.
    Function("iniciar") { textos: Map<String, String> ->
      val intent = Intent(context, DescargaService::class.java).apply {
        action = DescargaService.ACCION_INICIAR
        putExtra(DescargaService.EXTRA_TITULO, textos["titulo"])
        putExtra(DescargaService.EXTRA_TEXTO, textos["texto"])
        putExtra(DescargaService.EXTRA_PAUSAR, textos["pausar"])
        putExtra(DescargaService.EXTRA_CANCELAR, textos["cancelar"])
        putExtra(DescargaService.EXTRA_CANAL_PROGRESO, textos["canalProgreso"])
        putExtra(DescargaService.EXTRA_CANAL_RESULTADO, textos["canalResultado"])
      }
      ContextCompat.startForegroundService(context, intent)
      // Last expression must be Unit: the lambda's value is what JavaScript receives.
      Unit
    }

    Function("actualizar") { fraccion: Double, texto: String ->
      DescargaService.instancia?.actualizar(fraccion, texto)
      Unit
    }

    Function("terminar") { titulo: String, texto: String, mostrarAviso: Boolean ->
      DescargaService.instancia?.terminar(titulo, texto, mostrarAviso)
      Unit
    }
  }
}
