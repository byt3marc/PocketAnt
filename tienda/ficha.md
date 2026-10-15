# Pocketant en Google Play: ficha y formularios

Todo lo que pide Play Console para publicar, listo para copiar. Revisado el 2026-10-15 con la documentación de Play; antes de enviar, comprueba en la propia consola que las preguntas no hayan cambiado.

## Archivos de esta carpeta

| Archivo | Para qué | Requisito de Play |
| --- | --- | --- |
| `icono-512.png` | Icono de la ficha | 512 × 512, PNG de 32 bits con alfa, ≤ 1 MB |
| `grafico-destacado-es.png`, `grafico-destacado-en.png` | Gráfico destacado (uno por idioma de la ficha) | 1024 × 500, sin transparencia |
| `politica-privacidad.html` | Página de la política de privacidad, para subirla a una URL pública | URL activa, pública, sin PDF |
| `capturas/` | Capturas de pantalla de borrador (vista previa web, datos de ejemplo) | Mínimo 2 por idioma; mejor 4 o más de 1080 × 1920 |

`politica-privacidad.html` se genera desde `src/legal/privacidad.json` (el mismo texto que muestra la app en Ajustes → Política de privacidad) con `node scripts/politica-html.mjs`. Si cambias la política, cambia el JSON (y su fecha) y vuelve a generarla.

**Capturas definitivas:** mejor sacarlas del teléfono con datos reales (o de ejemplo) que de la vista previa web, que no usa la fuente ni los bordes exactos de Android.

## Lista antes de subir

- [ ] **Correo de contacto** en `src/legal/privacidad.json` (`"contacto"`) y en la ficha de Play. Vuelve a generar la página.
- [ ] **Publicar la política** en una URL pública: Google Sites, Netlify Drop o GitHub Pages. GitHub Pages gratis exige un repositorio público: usa uno aparte solo con la página, no el del código.
- [ ] **Formulario de reportes de la IA** creado y puesto en `src/ia/config.ts` → `FORMULARIO_REPORTES` (pasos en Info.md, «Reportes de la IA»). Sin él no se cumple la política de contenido generado por IA.
- [ ] Confirmar el **nombre** «Pocketant» y el paquete **`com.pocketant.app`**: el paquete no se puede cambiar después de la primera subida.
- [ ] Generar el **AAB**: `bunx eas-cli build -p android --profile production` (consume un build).
- [ ] **Prueba cerrada**: con una cuenta personal creada después del 13-11-2023, hacen falta **12 testers con la app instalada durante 14 días seguidos** antes de pedir acceso a producción.
- [ ] Rellenar los formularios de «Contenido de la app» (abajo).

## Textos de la ficha

**Nombre** (máx. 30): `Pocketant`

**Descripción breve** (máx. 80)
- es: `Anota tus gastos hormiga en segundos y mira a dónde se va tu dinero.`
- en: `Log small expenses in seconds and see where your money goes.`

**Descripción completa** (máx. 4000)

> **es**
>
> Pocketant es la forma más rápida de anotar tus ingresos y gastos, sobre todo los «gastos hormiga»: el café, el snack, el taxi… esos pequeños gastos que, sumados, se llevan buena parte del mes.
>
> • Registra un gasto o un ingreso en segundos, con su motivo y su fecha.
> • Mira de un vistazo cómo vas hoy y los últimos 7 días, con gráficas claras de ingresos y gastos.
> • Gráficas e historial por día, semana y mes.
> • Marca los gastos que se repiten (suscripciones, gimnasio, renta) y recibe un aviso antes de cada cobro.
> • Análisis automático: en qué gastas más, tus suscripciones y tus gastos hormiga, con consejos.
> • IA opcional que funciona dentro de tu teléfono, sin enviar tus datos a ningún servidor, para un informe en lenguaje natural.
> • Tema claro u oscuro, español o inglés, y 20 monedas.
> • Exporta e importa tus datos en un archivo.
>
> Privado por diseño: sin cuentas, sin anuncios y sin analítica. Tus datos se guardan en tu teléfono.
>
> **en**
>
> Pocketant is the fastest way to log your income and expenses, especially the small ones: the coffee, the snack, the cab… those little expenses that add up to a big part of the month.
>
> • Log an expense or income in seconds, with its reason and date.
> • See at a glance how today and the last 7 days are going, with clear income and expense charts.
> • Charts and history by day, week and month.
> • Mark recurring expenses (subscriptions, gym, rent) and get a reminder before each charge.
> • Automatic analysis: where you spend the most, your subscriptions and your small expenses, with tips.
> • Optional AI that runs inside your phone, without sending your data to any server, for a plain-language report.
> • Light or dark theme, Spanish or English, and 20 currencies.
> • Export and import your data as a file.
>
> Private by design: no accounts, no ads and no analytics. Your data stays on your phone.

**Categoría:** Finanzas. **Correo de contacto:** obligatorio. **Sitio web:** opcional (puede ser el de la política).

## Contenido de la app (Play Console → Política → Contenido de la app)

| Formulario | Respuesta |
| --- | --- |
| Política de privacidad | La URL donde publiques `politica-privacidad.html`. |
| Anuncios | No contiene anuncios. |
| Acceso a la app | Todas las funciones están disponibles sin acceso especial (no hay inicio de sesión). |
| Público objetivo | **18 años o más**. Así no se aplica la política de Familias, que es más estricta con la IA. |
| Clasificación de contenido | Responde el cuestionario con la verdad: no hay violencia, sexo, lenguaje ofensivo, drogas, apuestas, compras ni interacción entre usuarios. Si pregunta por contenido generado por IA, la respuesta es sí: es texto que genera un modelo local, y se puede reportar. |
| ID de publicidad | No se usa. **Compruébalo en el manifiesto final** (tras el build se revisa que no esté el permiso `AD_ID`). |
| Funciones financieras | Pocketant registra gastos personales: no presta, no cobra, no invierte y no maneja dinero ni cripto. Si el formulario ofrece una opción de presupuesto o finanzas personales, es esa; si no, «Mi app no ofrece funciones financieras». |
| Apps de salud / gubernamentales / noticias | No. |

### Seguridad de los datos

**Primera versión (sin Drive), con el formulario de reportes puesto:**

- ¿Recoge o comparte datos de usuario? **Sí**: solo cuando el usuario reporta una respuesta de la IA.
- Tipo de dato: **Información financiera → Otra información financiera**. El texto reportado puede incluir cifras de gastos.
  - Recogida: **sí**. Compartida: **no**. Google Forms la trata por cuenta del desarrollador, como proveedor del servicio.
  - **Opcional**: solo si el usuario decide reportar.
  - Propósito: **Funcionalidad de la app**. Sirve para revisar las respuestas de la IA y mejorarla.
  - No es temporal: se guarda para revisarla.
- ¿Se cifran los datos en tránsito? **Sí** (HTTPS).
- ¿Se pueden pedir borrar? **Sí**, escribiendo al correo de contacto.
- Lo que **no** cuenta como recogida, porque no sale del teléfono:
  - los movimientos y los ajustes,
  - las notificaciones locales,
  - el análisis y el informe de la IA local.
- La descarga del modelo desde Hugging Face no envía datos del usuario. Ese servicio ve la IP, como en cualquier descarga.

**Si el formulario de reportes no estuviera puesto:** no se recoge ningún dato. Aun así, el formulario hace falta por la política de IA.

**Cuando se active Google Drive** (`driveActivado: true`), añade:
- Información financiera: recogida, opcional, para funcionalidad de la app (copia en el Drive del propio usuario), cifrada en tránsito.
- Actualiza también la política: la sección de Drive ya está escrita.

### Servicio en primer plano (tipo `dataSync`)

Play Console → Contenido de la app → **Servicios en primer plano**: declara el permiso `FOREGROUND_SERVICE_DATA_SYNC`.

- **Tipo de tarea:** transferencia de red (descarga) iniciada por el usuario.
- **Descripción:** «Cuando el usuario elige activar la IA local en la pantalla Análisis y confirma la descarga, la app descarga el modelo de lenguaje (unos 2.6 GB). Un servicio en primer plano mantiene la descarga activa con la pantalla apagada o con otra app delante, y muestra una notificación con el progreso y los botones Pausar y Cancelar. El servicio termina en cuanto la descarga acaba, se pausa o se cancela.»
- **Impacto si se interrumpe:** la descarga se detiene. Lo descargado se conserva y el usuario tiene que volver a la app para continuar; la IA no está disponible hasta que termine.
- **Vídeo** (enlace de YouTube, puede ser «no listado»), unos 30 segundos:
  1. Abrir Pocketant → ✨ Análisis → «Descargar modelo» → confirmar.
  2. Bajar la barra de notificaciones: se ve la notificación de progreso con Pausar y Cancelar.
  3. Salir de la app o apagar la pantalla, volver y ver que siguió avanzando.
  4. Tocar «Pausar» en la notificación y ver que la tarjeta queda en «pausada».

### Contenido generado por IA

- La app genera texto con un modelo que corre en el teléfono (Gemma 4 E2B), a petición del usuario.
- Debajo de cada informe hay un botón **«Reportar respuesta»**.
  - Envía el informe al formulario de reportes sin salir de la app.
  - Avisa antes de qué se envía.
- Las instrucciones del modelo le piden no dar consejos de inversión ni legales.
- El pie de cada informe dice que no es asesoría financiera.

## Firma y Drive

- Al subir el primer AAB, Play firma la app con su propia clave («Firma de apps de Play»). Su **SHA-1** está en Play Console → *Integridad de la app*.
- Para Google Drive hace falta **otro cliente OAuth de Android** con ese SHA-1, además del de los APK de prueba (`29:90:E7:…:FC:4F`).
