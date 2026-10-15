# Pocketant

App móvil (Android e iPhone) para registrar tus **gastos hormiga**, llevar tu saldo y visualizar tus ingresos y gastos en gráficas. Todo se guarda en tu dispositivo.

> 🚧 Estado: **MVP probado en un celular** (APK del 2026-10-13, cuando la app aún se llamaba «Gastos Hormiga»). Después se programaron notificaciones, idiomas, Google Drive y el rediseño del Home (gráfica diaria, vista previa del historial, logo y nombre **Pocketant**); verificado con tipos, lint y 442 pruebas. Falta generar el APK nuevo (se instala aparte del viejo por el cambio de paquete), probarlo, poner las credenciales de Google para Drive y verificar el nombre en Google Play Console.

---

## 📌 Descripción

Al abrir la app tu saldo es **0**. Con dos botones puedes **agregar** o **quitar** saldo indicando monto y motivo, y marcar si el movimiento es **recurrente** (mensual o anual) y cada cuánto se factura.

## ✨ Funcionalidades

- 💰 Saldo actual con botones **Agregar** y **Quitar**.
- 📝 Cada movimiento: monto, motivo, fecha y opción de recurrencia (mensual/anual + frecuencia). La fecha se elige en un **calendario propio** con los colores de la app. Se puede **editar** y **eliminar**.
- 📈 En el Home, **lo de hoy** (barras de ingresos vs gastos, comparadas con ayer) y la gráfica de **7 días**, lado a lado: 🟢 ingresos, 🔴 gastos, con un esqueleto mientras no hay datos.
- 🎞️ Debajo, una **vista previa del historial con scroll automático** que rellena el resto de la pantalla y termina en «Gráficas e Historial». El Home queda **fijo** (sin scroll) cuando todo cabe.
- 📊 Sección de **Gráficas e Historial**: gráficas **diaria, semanal y mensual** (línea, área o barras), con tooltip al tocar, navegación por periodos e historial con filtro.
- ✨ **Análisis** (botón junto a Ajustes): en qué gastas más, **suscripciones y cobros fijos**, **gasto hormiga**, tendencia y consejos, calculado al instante en tu teléfono. Opcionalmente, una **IA local (Gemma 4)** que se descarga una vez (~2.6 GB) y redacta un informe **sin enviar nada a la nube**.
- 🔔 **Notificaciones**: recordatorio para registrar gastos (cada 1 h por defecto, dentro de un horario) y aviso unos días antes de cada cobro recurrente. Todo editable en Ajustes.
- 🌐 **Idioma**: español, inglés o el del dispositivo.
- 🔤 **Fuente** del texto a elegir entre tres: Sistema, Redondeada o Clásica (con serifas).
- 🎬 **Animaciones** cortas: las pantallas aparecen subiendo, las tarjetas entran una tras otra, la opción elegida de un selector se desliza de una a otra, los botones se encogen un poco al pulsarlos y los bloques que aparecen o se van no empujan de golpe. Respetan «reducir animaciones».
- 🎨 Tema **claro**, **oscuro** (`#151517`) o el del **dispositivo**.
- 💱 **Moneda** automática según tu región (por defecto `$`) o elegida a mano.
- 🔒 Almacenamiento **local** en el dispositivo (sin cuentas ni servidores propios).
- 📤 Exportar/importar datos en JSON.
- ☁️ **Google Drive** (opcional): respaldo y sincronización en una carpeta privada de tu Drive. Necesita configurar las credenciales de Google (ver [Info.md](Info.md#-google-drive-puesta-en-marcha)).

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
| Sincronización | Google Drive `appDataFolder` + `@react-native-google-signin/google-signin` |
| Compilación | EAS Build: APK (`preview`) para pruebas, AAB (`production`) para Google Play |
| Testing | Jest + React Native Testing Library |

## 🚀 Inicio Rápido

Requisitos: **Node.js 24 LTS** (lo necesita el CLI de Expo), [Bun](https://bun.sh), Git y, para el APK, una cuenta gratuita de [Expo](https://expo.dev). Para ver la app en tu celular durante el desarrollo, instala **Expo Go**.

```bash
bun install            # instalar dependencias
bun run start          # servidor de desarrollo (escanea el QR con Expo Go)
bun run typecheck      # TypeScript
bun run lint           # ESLint
bun run test           # pruebas (Jest + React Native Testing Library)
```

### Generar el APK de prueba (Android)

```bash
bunx eas-cli login                                  # una sola vez
bunx eas-cli init                                   # vincula el proyecto a tu cuenta
bunx eas-cli build -p android --profile preview     # genera el .apk en la nube
```

Al terminar, EAS entrega un enlace para descargar e instalar el `.apk`. Para subir a Google Play se usa el perfil `production`, que genera un `.aab`.

## 📁 Estructura del Proyecto

```text
AppHormiga/
├── src/
│   ├── app/            # Pantallas (Expo Router): inicio, estadísticas, movimiento (modal), ajustes, moneda
│   ├── componentes/    # Piezas de interfaz: gráfica, tarjeta de saldo, fila del historial, botones…
│   ├── dominio/        # Lógica pura y probada: fechas, formato, moneda, saldo, series, recurrencia, plan de notificaciones
│   ├── datos/          # Repositorio (SQLite y memoria), migraciones y sincronización
│   │   └── sincronizacion/   # Formato JSON versionado, fusión por id, ProveedorSync y Google Drive (google/)
│   ├── notificaciones/ # Permiso, canal, programador y proveedor de las notificaciones locales
│   ├── i18n/           # Diccionarios es/en, traducción con plurales, calendario y errores traducibles
│   ├── ajustes/        # Preferencias (tema, idioma, moneda, gráfica, notificaciones, Drive) y su proveedor
│   ├── tema/           # Paleta clara/oscura, espaciado y radios
│   ├── logo.ts         # Geometría del logo (la usan el componente Logo y los PNG de assets/images)
│   ├── marca.ts        # Nombre público de la app
│   └── hooks/          # useHoy, useRelleno
├── assets/images/      # Icono, icono adaptativo (color y monocromo), pantalla de carga, favicon y notificaciones
├── assets/branding/    # Fuentes SVG del logo (la geometría vive en src/logo.ts)
├── assets/referencias/ # Imágenes de referencia de diseño (no entran en la app)
├── app.json            # Configuración de Expo
├── eas.json            # Perfiles de compilación (APK de prueba y AAB de producción)
├── Info.md             # Especificaciones, decisiones, modelo de datos y notas de diseño
├── Todo.md             # Lista de tareas y roadmap
└── README.md           # Este archivo
```

## 📚 Documentación Adicional

- [Info.md](Info.md): Especificación detallada, decisiones del proyecto y modelo de datos.
- [Todo.md](Todo.md): Tareas pendientes y avances.
- [AGENTS.md](AGENTS.md): Guía para asistentes de código (viene con la plantilla de Expo).
