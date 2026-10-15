package expo.modules.descargasegundoplano

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.security.MessageDigest

/**
 * Puente entre JavaScript y [DescargaService]. La descarga en sí la hace JavaScript; este módulo solo enciende el
 * servicio en primer plano (con su notificación de progreso), lo actualiza y lo apaga, y avisa a JavaScript cuando
 * el usuario toca «Pausar» o «Cancelar» en la notificación. También calcula el MD5 del archivo descargado fuera del
 * hilo de JavaScript (son ~2.6 GB: hacerlo allí congelaría la app varios segundos).
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
      DescargaService.prepararInicio()
      try {
        ContextCompat.startForegroundService(context, intent)
      } catch (e: Exception) {
        // Android no deja lanzarlo (p. ej. la app ya no está a la vista): la descarga sigue igual con la app abierta.
      }
      // Last expression must be Unit: the lambda's value is what JavaScript receives.
      Unit
    }

    Function("actualizar") { fraccion: Double, texto: String ->
      DescargaService.instancia?.actualizar(fraccion, texto)
      Unit
    }

    Function("terminar") { titulo: String, texto: String, mostrarAviso: Boolean ->
      DescargaService.terminarOAplazar(DescargaService.Final(titulo, texto, mostrarAviso))
      Unit
    }

    // MD5 en hexadecimal (minúsculas) de un archivo, leído en bloques de 1 MB en un hilo de E/S. `ruta` puede ser una
    // ruta o una URI `file://` (la `uri` de `File` de expo-file-system).
    AsyncFunction("md5") Coroutine { ruta: String ->
      withContext(Dispatchers.IO) { md5DeArchivo(ruta) }
    }
  }
}

private fun md5DeArchivo(ruta: String): String {
  val camino = if (ruta.startsWith("file:")) Uri.parse(ruta).path ?: ruta else ruta
  val resumen = MessageDigest.getInstance("MD5")
  File(camino).inputStream().use { entrada ->
    val bloque = ByteArray(1024 * 1024)
    while (true) {
      val leidos = entrada.read(bloque)
      if (leidos < 0) break
      resumen.update(bloque, 0, leidos)
    }
  }
  return resumen.digest().joinToString("") { "%02x".format(it) }
}
