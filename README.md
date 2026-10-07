# Gastos Hormiga

App móvil (Android e iPhone) para registrar tus **gastos hormiga**, llevar tu saldo y visualizar tus ingresos y gastos en gráficas. Todo se guarda en tu dispositivo.

> 🚧 Estado: en planeación (sin código todavía).

---

## 📌 Descripción

Al abrir la app tu saldo es **0**. Con dos botones puedes **agregar** o **quitar** saldo indicando monto y motivo, y marcar si el movimiento es **recurrente** (mensual o anual) y cada cuánto se factura.

## ✨ Funcionalidades

- 💰 Saldo actual con botones **Agregar** y **Quitar**.
- 📝 Cada movimiento: monto, motivo y opción de recurrencia (mensual/anual + frecuencia).
- 📈 Dos gráficas lineales (semanal y mensual): 🟢 ingresos, 🔴 gastos.
- 👆 Preview del movimiento diario al tocar o deslizar el dedo sobre la gráfica.
- 📊 Sección de **Gráficas e Historial**: gráficas detalladas, cambio de tipo de visualización e historial completo.
- 🔒 Almacenamiento **local** en el dispositivo (sin cuentas ni servidores).
- 📤 Exportar/importar datos en JSON; sincronización opcional con Google Drive (V2).

## 🛠️ Stack

| Componente | Tecnología |
| :--- | :--- |
| Framework | React Native + Expo (TypeScript), una sola base de código para Android e iOS |
| Navegación | Expo Router |
| Gráficas | `react-native-gifted-charts` |
| Base de datos local | `expo-sqlite` |
| Exportar/importar | `expo-file-system`, `expo-sharing`, `expo-document-picker` |
| Sincronización (V2) | Google Drive `appDataFolder` |
| Notificaciones | `expo-notifications` |
| Compilación | EAS Build |
| Testing | Jest + React Native Testing Library |

## 🚀 Inicio Rápido

Pendiente de crear el proyecto. Requisitos previos: Node.js, Git y la app **Expo Go** en tu celular.

```bash
cd Testing
# Próximamente: npx create-expo-app y npx expo start
```

## 📁 Estructura del Proyecto

```text
Testing/
├── .agents/        # Configuraciones de agentes y personalizaciones
├── Info.md         # Especificaciones, modelo de datos y notas de diseño
├── Todo.md         # Lista de tareas y roadmap
└── README.md       # Documentación principal del proyecto
```

## 📚 Documentación Adicional

- [Info.md](file:///c:/Users/MarC/Desktop/Todo/Proyectos/Programacion/Testing/Info.md): Especificación detallada de la app.
- [Todo.md](file:///c:/Users/MarC/Desktop/Todo/Proyectos/Programacion/Testing/Todo.md): Tareas pendientes y avances.
