# Pocketant

App móvil (Android e iPhone) para registrar tus **gastos hormiga**, llevar tu saldo y visualizar tus ingresos y gastos en gráficas. Todo se guarda en tu dispositivo.

> 🚧 Estado: **preparando la publicación en Google Play** (2026-10-15). La app está completa (Home, gráficas, Análisis con IA local, notificaciones, idiomas, fuentes, animaciones) y se revisó para Play: política de privacidad, reportes de la IA, permisos, respaldo y ficha de la tienda en [`tienda/`](tienda/ficha.md). Verificado con tipos, lint y 483 pruebas. Falta probar el último APK en un teléfono, poner el correo de contacto y el formulario de reportes, y rellenar Play Console.

---

## 📌 Descripción

Al abrir la app tu saldo es **0**. Con dos botones puedes **agregar** o **quitar** saldo indicando monto y motivo, y marcar si el movimiento es **recurrente** (mensual o anual) y cada cuánto se factura.

## ✨ Funcionalidades

- 💰 Saldo actual con botones **Agregar** y **Quitar**.
- 📝 Cada movimiento: monto, motivo, fecha y opción de recurrencia (mensual/anual + frecuencia). La fecha se elige en un **calendario propio** con los colores de la app. Se puede **editar** y **eliminar**.
- 📈 En el Home, **lo de hoy** (barras de ingresos vs gastos y el **balance del día**: «Vas $8.00 arriba hoy» en verde o «abajo» en rojo) y la gráfica de **7 días**, lado a lado: 🟢 ingresos, 🔴 gastos, con un esqueleto mientras no hay datos.
- 🎞️ Debajo, una **vista previa del historial con scroll automático** que rellena el resto de la pantalla (la tarjeta «Gráficas e Historial», justo encima, lleva al detalle). El Home queda **fijo** (sin scroll) cuando todo cabe.
- 📊 Sección de **Gráficas e Historial**: gráficas **diaria, semanal y mensual** (línea, área o barras), con tooltip al tocar, navegación por periodos e historial con filtro.
- ✨ **Análisis** (botón junto a Ajustes): en qué gastas más, **suscripciones y cobros fijos**, **gasto hormiga**, tendencia y consejos, calculado al instante en tu teléfono. Opcionalmente, una **IA local (Gemma 4)** que se descarga una vez (~2.6 GB) y redacta un informe **sin enviar nada a la nube** (en teléfonos de 64 bits con 4 GB de RAM o más). Cada respuesta se puede **reportar** sin salir de la app.
- 🔔 **Notificaciones**: recordatorio para registrar gastos (se enciende en Ajustes; cada 1 h por defecto, dentro de un horario) y aviso unos días antes de cada cobro recurrente. El permiso se pide en contexto: al encender un aviso o tras el primer gasto recurrente.
- 🌐 **Idioma**: español, inglés o el del dispositivo.
- 🔤 **Fuente** del texto a elegir entre tres: Sistema, Redondeada o Clásica (con serifas).
- 🎬 **Animaciones** cortas: las pantallas aparecen subiendo, las tarjetas entran una tras otra, la opción elegida de un selector se desliza de una a otra, los botones se encogen un poco al pulsarlos y los bloques que aparecen o se van no empujan de golpe. Respetan «reducir animaciones».
- 🎨 Tema **claro**, **oscuro** (`#151517`) o el del **dispositivo**.
- 💱 **Moneda** automática según tu región (por defecto `$`) o elegida a mano.
- 🔒 Almacenamiento **local** en el dispositivo (sin cuentas, anuncios, analítica ni servidores propios). **Política de privacidad** dentro de la app (Ajustes → Acerca de).
- 📤 Exportar/importar datos en JSON.
- ☁️ **Google Drive** (opcional): respaldo y sincronización en una carpeta privada de tu Drive, con la API actual de Google. Queda oculto hasta registrar la app en Google Cloud y poner `driveActivado: true`.

## 🛠️ Stack

| Componente | Tecnología |
| :--- | :--- |
| Framework | React Native + Expo SDK 57 (TypeScript), una sola base de código para Android e iOS |
| Navegación | Expo Router |
| Gráficas | `react-native-gifted-charts` |
| Base de datos local | `expo-sqlite` |
| Exportar/importar | `expo-file-system`, `expo-sharing`, `expo-document-picker` |
| Notificaciones | `expo-notifications` (locales, sin servidor) |
| Idiomas | Diccionarios propios tipados (`src/i18n/`) |
| Fuentes | `expo-font` + `@expo-google-fonts/nunito` y `lora` |
| Animaciones | `react-native-reanimated` 4 + `react-native-worklets` |
| IA local | `expo-ai-kit` (LiteRT-LM) con Gemma 4 E2B, `expo-device`, módulo nativo propio para la descarga en segundo plano |
| Sincronización | Google Drive `appDataFolder` + módulo nativo propio con `AuthorizationClient` (Google Identity Services) |
| Respaldo de Android | Plugin propio (`plugins/reglas-respaldo.js`): los datos sí, el modelo de IA no |
| Compilación | EAS Build: APK (`preview`) para pruebas, AAB (`production`) para Google Play |
| Testing | Jest + React Native Testing Library |

## 🚀 Inicio Rápido

Requisitos: **Node.js 24 LTS** (lo necesita el CLI de Expo), [Bun](https://bun.sh), Git y, para el APK, una cuenta gratuita de [Expo](https://expo.dev). La app trae módulos nativos propios (IA, descarga en segundo plano, Google): para probarla en un celular hace falta un APK de EAS. Para revisar la interfaz sirve la vista previa web (`bun run web`).

```bash
bun install            # instalar dependencias
bun run start          # servidor de desarrollo
bun run typecheck      # TypeScript
bun run lint           # ESLint de todo el proyecto, sin advertencias
bun run test           # pruebas (Jest + React Native Testing Library)
```

### Generar el APK de prueba (Android)

```bash
bunx eas-cli login                                  # una sola vez
bunx eas-cli init                                   # vincula el proyecto a tu cuenta
bunx eas-cli build -p android --profile preview     # genera el .apk en la nube
```

Al terminar, EAS entrega un enlace para descargar e instalar el `.apk`. Para subir a Google Play se usa el perfil `production`, que genera un `.aab` (pasos y formularios en [tienda/ficha.md](tienda/ficha.md)).

## 📁 Estructura del Proyecto

```text
AppHormiga/
├── src/
│   ├── app/            # Pantallas (Expo Router): inicio, estadísticas, análisis, movimiento (modal), ajustes, moneda, privacidad
│   ├── componentes/    # Piezas de interfaz: gráficas, tarjetas, fila del historial, botones, diálogos, avisos…
│   ├── animacion/      # Curvas, duraciones y animaciones compartidas (Reanimated)
│   ├── dominio/        # Lógica pura y probada: fechas, formato, moneda, saldo, series, recurrencia, análisis, prompt de la IA, plan de notificaciones
│   ├── datos/          # Repositorio SQLite, migraciones, red (fetch con tiempo máximo) y sincronización
│   │   └── sincronizacion/   # Formato JSON versionado, fusión por id, ProveedorSync y Google Drive (google/)
│   ├── ia/             # IA local: servicio con expo-ai-kit, descarga reanudable, estados, errores y reportes
│   ├── notificaciones/ # Permiso (en contexto), canal, programador y proveedor de las notificaciones locales
│   ├── i18n/           # Diccionarios es/en, traducción con plurales, calendario y errores traducibles
│   ├── ajustes/        # Preferencias (tema, idioma, moneda, fuente, gráfica, notificaciones, Drive) y su proveedor
│   ├── legal/          # Política de privacidad (un JSON para la app y la página web)
│   ├── tema/           # Paleta clara/oscura, fuentes y radios
│   ├── pruebas/        # Falsos que solo usan las pruebas y la vista previa (no entran en la app)
│   ├── logo.ts         # Geometría del logo (la usan el componente Logo y los PNG de assets/images y tienda/)
│   ├── marca.ts        # Nombre público de la app
│   └── hooks/          # useHoy, useRelleno
├── modules/            # Módulos nativos propios (Kotlin): descarga-segundo-plano y autorizacion-google
├── plugins/            # Plugins de configuración propios: reglas-respaldo
├── scripts/            # politica-html.mjs: genera la página de la política de privacidad
├── tienda/             # Ficha de Google Play: icono 512, gráficos destacados, política (HTML) y ficha.md
├── assets/images/      # Icono, icono adaptativo (color y monocromo), pantalla de carga, favicon y notificaciones
├── app.json            # Configuración de Expo
├── eas.json            # Perfiles de compilación (APK de prueba y AAB de producción)
└── README.md           # Este archivo
```


