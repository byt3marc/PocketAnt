# <img src="assets/images/icon.png" alt="Pocketant logo" width="56" align="center" /> Pocketant

A mobile app (Android and iPhone) to track your **small daily expenses** (*gastos hormiga*), keep an eye on your balance, and visualize income and spending in charts. Everything is stored on your device.

> **Status:** **preparing the Google Play release** (2026-10-15). The app is complete (Home, charts, AI-powered Analysis with a local model, notifications, languages, fonts, animations) and has been reviewed for Play: privacy policy, AI report forms, permissions, backup, and the store listing in [`tienda/`](tienda/ficha.md). Verified with types, lint, and 483 tests. Still to do: test the final APK on a phone, set up the contact email and report form, and complete Play Console.

---

## Description

When you open the app, your balance is **0**. With two buttons you can **add** or **remove** balance by entering an amount and a reason, and mark whether the entry is **recurring** (monthly or yearly) and how often it's billed.

## Features

- Current balance with **Add** and **Remove** buttons.
- Each entry: amount, reason, date, and a recurrence option (monthly/yearly + frequency). The date is picked in a **custom calendar** using the app's colors. Entries can be **edited** and **deleted**.
- On the Home screen, **today at a glance** (income vs. spending bars and the **day balance**: "You're $8.00 up today" in green or "down" in red) alongside the **7-day chart**: income in green, spending in red, with a skeleton while there's no data.
- Below that, a **history preview with auto-scroll** that fills the rest of the screen (the "Charts and History" card just above it leads to the detail view). The Home stays **fixed** (no scroll) when everything fits.
- **Charts and History** section: **daily, weekly, and monthly** charts (line, area, or bars), with a touch tooltip, period navigation, and a filterable history.
- **Analysis** (button next to Settings): where you spend the most, **subscriptions and fixed charges**, **small daily expenses**, trend, and tips — computed instantly on your phone. Optionally, a **local AI (Gemma 4)** is downloaded once (~2.6 GB) and writes a report **without sending anything to the cloud** (on 64-bit phones with 4 GB of RAM or more). Each answer can be **reported** without leaving the app.
- **Notifications**: a reminder to log expenses (enabled in Settings; every 1 hour by default, within a set time window) and a heads-up a few days before each recurring charge. The permission is asked in context: when enabling an alert or after the first recurring expense.
- **Language**: Spanish, English, or the device language.
- **Font** of your choice among three options: System, Rounded, or Classic (serif).
- Short **animations**: screens slide up as they appear, cards enter one after another, a selector's chosen option slides from one to another, buttons shrink slightly when pressed, and blocks appearing or disappearing don't push the layout abruptly. They respect "reduce motion".
- **Light** or **dark** (`#151517`) theme, or follow the **device**.
- **Currency** automatically set by your region (default `$`) or chosen manually.
- **Local** storage on the device (no accounts, ads, analytics, or own servers). **Privacy policy** inside the app (Settings → About).
- Export/import data as JSON.
- **Google Drive** (optional): backup and sync in a private folder of your Drive, using Google's current API. Hidden until you register the app in Google Cloud and set `driveActivado: true`.
