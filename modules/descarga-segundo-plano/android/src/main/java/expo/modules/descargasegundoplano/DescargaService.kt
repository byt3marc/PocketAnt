package expo.modules.descargasegundoplano

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Servicio en primer plano (tipo `dataSync`) que mantiene viva la app mientras se descarga el modelo y muestra el
 * progreso en una notificación con los botones «Pausar» y «Cancelar». No descarga nada: la descarga la hace
 * JavaScript; el servicio evita que Android congele o mate la app con la pantalla apagada o al cambiar de app.
 */
class DescargaService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  private var iniciado = false
  private var titulo = ""
  private var etiquetaPausar = "Pause"
  private var etiquetaCancelar = "Cancel"

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val accion = intent?.action
    when {
      intent != null && accion == ACCION_INICIAR -> iniciar(intent)
      accion == ACCION_PAUSAR -> if (iniciado) alAccion?.invoke("pausar") else stopSelf()
      accion == ACCION_CANCELAR -> if (iniciado) alAccion?.invoke("cancelar") else stopSelf()
      !iniciado -> stopSelf()
    }
    // Si Android mata el proceso, el servicio no revive solo: lo descargado se conserva y el usuario continúa.
    return START_NOT_STICKY
  }

  /** Android 15+ corta los servicios `dataSync` tras 6 horas: se pausa la descarga y se apaga con calma. */
  override fun onTimeout(startId: Int, fgsType: Int) {
    alAccion?.invoke("pausar")
    detener()
  }

  override fun onDestroy() {
    liberarWakeLock()
    soltarInstancia()
    iniciado = false
    super.onDestroy()
  }

  private fun iniciar(intent: Intent) {
    titulo = intent.getStringExtra(EXTRA_TITULO) ?: ""
    val texto = intent.getStringExtra(EXTRA_TEXTO) ?: ""
    etiquetaPausar = intent.getStringExtra(EXTRA_PAUSAR) ?: etiquetaPausar
    etiquetaCancelar = intent.getStringExtra(EXTRA_CANCELAR) ?: etiquetaCancelar
    crearCanales(
      intent.getStringExtra(EXTRA_CANAL_PROGRESO) ?: "Model download",
      intent.getStringExtra(EXTRA_CANAL_RESULTADO) ?: "Model status"
    )

    // Si el servicio ya está en marcha (p. ej. JavaScript se recarga en desarrollo), solo se repinta el aviso:
    // no se vuelve a llamar a `startForeground` ni se pide otro WakeLock.
    if (iniciado) {
      actualizar(0.0, texto)
      return
    }

    val notificacion = construirProgreso(texto, 0)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(ID_PROGRESO, notificacion, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      } else {
        startForeground(ID_PROGRESO, notificacion)
      }
    } catch (e: Exception) {
      // Android 15 lo impide si ya se gastaron las 6 h diarias de `dataSync` (y Android 12+ si la app no está a la
      // vista): sin el servicio, la descarga sigue mientras la app esté abierta. Sin esto, la app se cerraría.
      synchronized(cerrojo) { terminarPendiente = null }
      stopSelf()
      return
    }
    iniciado = true
    adquirirWakeLock()

    // Si la descarga ya terminó antes de que el servicio llegara a arrancar (p. ej. falló al instante sin conexión),
    // se aplica ahora ese final: si no, la notificación y el wakelock se quedarían colgados.
    val final = synchronized(cerrojo) {
      instancia = this
      terminarPendiente.also { terminarPendiente = null }
    }
    if (final != null) terminar(final.titulo, final.texto, final.mostrarAviso)
  }

  /** `fraccion` de 0 a 1; un valor negativo muestra una barra indeterminada (p. ej. al verificar el archivo). */
  fun actualizar(fraccion: Double, texto: String) {
    if (!iniciado) return
    val porcentaje = if (fraccion < 0) -1 else (fraccion * 100).toInt().coerceIn(0, 100)
    gestor().notify(ID_PROGRESO, construirProgreso(texto, porcentaje))
  }

  /** Quita la notificación de progreso y, si se pide, deja un aviso normal con el resultado. */
  fun terminar(tituloFinal: String, texto: String, mostrarAviso: Boolean) {
    stopForeground(Service.STOP_FOREGROUND_REMOVE)
    if (mostrarAviso) {
      val aviso = NotificationCompat.Builder(this, CANAL_RESULTADO)
        .setSmallIcon(android.R.drawable.stat_sys_download_done)
        .setContentTitle(tituloFinal)
        .setContentText(texto)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .apply { abrirApp()?.let { setContentIntent(it) } }
        .build()
      gestor().notify(ID_RESULTADO, aviso)
    }
    detener()
  }

  private fun detener() {
    liberarWakeLock()
    iniciado = false
    soltarInstancia()
    stopSelf()
  }

  private fun soltarInstancia() {
    synchronized(cerrojo) { if (instancia === this) instancia = null }
  }

  private fun construirProgreso(texto: String, porcentaje: Int): Notification {
    val constructor = NotificationCompat.Builder(this, CANAL_PROGRESO)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle(titulo)
      .setContentText(texto)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .addAction(android.R.drawable.ic_media_pause, etiquetaPausar, pendiente(ACCION_PAUSAR))
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, etiquetaCancelar, pendiente(ACCION_CANCELAR))
    if (porcentaje < 0) constructor.setProgress(0, 0, true) else constructor.setProgress(100, porcentaje, false)
    abrirApp()?.let { constructor.setContentIntent(it) }
    return constructor.build()
  }

  /** Lo que pasa al tocar un botón de la notificación: llega a este mismo servicio como una acción. */
  private fun pendiente(accion: String): PendingIntent =
    PendingIntent.getService(
      this,
      accion.hashCode(),
      Intent(this, DescargaService::class.java).setAction(accion),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

  /** Tocar la notificación abre la app. */
  private fun abrirApp(): PendingIntent? {
    val lanzador = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    return PendingIntent.getActivity(this, 0, lanzador, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun crearCanales(nombreProgreso: String, nombreResultado: String) {
    val gestor = gestor()
    gestor.createNotificationChannel(NotificationChannel(CANAL_PROGRESO, nombreProgreso, NotificationManager.IMPORTANCE_LOW))
    gestor.createNotificationChannel(NotificationChannel(CANAL_RESULTADO, nombreResultado, NotificationManager.IMPORTANCE_DEFAULT))
  }

  private fun gestor(): NotificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun adquirirWakeLock() {
    // Nunca dos a la vez: un `iniciar` repetido reemplazaba el campo sin soltar el anterior, que seguía
    // manteniendo la CPU despierta hasta agotar su plazo.
    liberarWakeLock()
    val energia = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = energia.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pocketant:descarga-modelo").apply {
      setReferenceCounted(false)
      acquire(TRES_HORAS_MS)
    }
  }

  private fun liberarWakeLock() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  /** Cómo se cierra la descarga (título y texto del aviso final, y si se muestra). */
  data class Final(val titulo: String, val texto: String, val mostrarAviso: Boolean)

  companion object {
    const val ACCION_INICIAR = "expo.modules.descargasegundoplano.INICIAR"
    const val ACCION_PAUSAR = "expo.modules.descargasegundoplano.PAUSAR"
    const val ACCION_CANCELAR = "expo.modules.descargasegundoplano.CANCELAR"

    const val EXTRA_TITULO = "titulo"
    const val EXTRA_TEXTO = "texto"
    const val EXTRA_PAUSAR = "pausar"
    const val EXTRA_CANCELAR = "cancelar"
    const val EXTRA_CANAL_PROGRESO = "canalProgreso"
    const val EXTRA_CANAL_RESULTADO = "canalResultado"

    private const val CANAL_PROGRESO = "pocketant_descarga_modelo"
    private const val CANAL_RESULTADO = "pocketant_modelo_listo"
    private const val ID_PROGRESO = 4301
    private const val ID_RESULTADO = 4302
    private const val TRES_HORAS_MS = 3L * 60 * 60 * 1000

    /** El servicio en marcha (el mismo proceso que JavaScript), para actualizarlo sin volver a lanzar intents. */
    @Volatile
    var instancia: DescargaService? = null
      private set

    /** Protege `instancia` y `terminarPendiente`: JavaScript y el servicio corren en hilos distintos. */
    private val cerrojo = Any()

    /** Un `terminar` que llegó antes de que el servicio arrancara; lo aplica el propio servicio al arrancar. */
    private var terminarPendiente: Final? = null

    /** Antes de lanzar el servicio: olvida el final de una descarga anterior. */
    fun prepararInicio() {
      synchronized(cerrojo) { terminarPendiente = null }
    }

    /** Termina el servicio en marcha o, si todavía no arrancó, deja el final pendiente para cuando arranque. */
    fun terminarOAplazar(final: Final) {
      val servicio = synchronized(cerrojo) {
        instancia.also { if (it == null) terminarPendiente = final }
      }
      servicio?.terminar(final.titulo, final.texto, final.mostrarAviso)
    }

    /** Quien recibe los botones «Pausar» y «Cancelar» de la notificación (el módulo, que avisa a JavaScript). */
    @Volatile
    var alAccion: ((String) -> Unit)? = null
  }
}
