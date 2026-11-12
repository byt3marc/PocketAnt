<p align="center">
  <img src="assets/images/android-icon-foreground.png" alt="Pocketant logo" width="128" />
</p>

<h1 align="center">Pocketant</h1>

A mobile app (Android and iPhone) to track your **small daily expenses** (*gastos hormiga*), keep an eye on your balance, and visualize income and spending in charts. Everything is stored on your device.

> **Status:** **preparing the Google Play release** (2026-10-15). The app is complete (Home, charts, AI-powered Analysis with a local model, notifications, languages, fonts, animations) and has been reviewed for Play: privacy policy, AI report forms, permissions, backup, and the store listing in [`tienda/`](tienda/ficha.md). Verified with types, lint, and 681 tests. Still to do: test the final APK on a phone, set up the contact email and report form, and complete Play Console.

---

## Description

When you open the app, your balance is **0**. With two buttons you can **add** or **remove** balance by entering an amount and a reason, and mark whether the entry is **recurring** (monthly or yearly) and how often it's billed.

## Features

- Current balance with **Add** and **Remove** buttons.
- Each entry: amount, reason, date, and a recurrence option (monthly/yearly + frequency). The date is picked in a **custom calendar** using the app's colors, or moved a day at a time with ◀ ▶. Entries can be **edited**, **duplicated**, and **deleted**, and you can switch between expense and income inside the form.
- **Quick entry**: your most-used reasons appear as chips under the reason field (one tap fills the reason and, if empty, the amount), the keyboard's Next/Done move to the next field and save, and Save is also in the header. A short confirmation appears after saving, with an **Edit** shortcut.
- **Photos** attached to an entry open in a full-screen viewer with swipe, pinch, and double-tap zoom.
- On the Home screen, **today at a glance** (income vs. spending bars and the **day balance**: "You're $8.00 up today" in green or "down" in red) alongside the **7-day chart**: income in green, spending in red, with a skeleton while there's no data.
- Below that, a **history preview with auto-scroll** that fills the rest of the screen; tapping an entry opens it for editing (the "Charts and History" card just above it leads to the detail view). The Home stays **fixed** (no scroll) when everything fits.
- **Recurring charges**: when a recurring charge is due and not logged yet, a compact row on the Home ("Netflix · charged yesterday · $40.00") lets you **add** it in one tap or skip it. Analysis lists upcoming charges, and the charge notification opens the form ready to log it.
- **Charts and History** section: a **Charts | History** switch at the top (remembered). Charts: **daily, weekly, and monthly** (line, area, or bars), with a touch tooltip, period navigation, and a tap on the range to jump back to today. History: **search** by reason, filter by type, and entries **grouped by day** with each day's net.
- **Import from an image** (in Analysis): pick a screenshot or receipt from the gallery or take a photo; text recognition and the local AI propose entries to review before saving. Everything runs on the phone.
- **Analysis** (button next to Settings): where you spend the most, **subscriptions and fixed charges**, **small daily expenses**, trend, and tips — computed instantly on your phone. Optionally, a **local AI (Gemma 4)** is downloaded once (~2.6 GB) and writes a report **without sending anything to the cloud** (on 64-bit phones with 4 GB of RAM or more). Each answer can be **reported** without leaving the app.
- **Notifications**: a reminder to log expenses (enabled in Settings; every 1 hour by default, within a set time window) and a heads-up a few days before each recurring charge. The permission is asked in context: when enabling an alert or after the first recurring expense.
- **Language**: Spanish, English, or the device language.
- **Font** of your choice among three options: System, Rounded, or Classic (serif).
- Short **animations**: screens slide up as they appear, cards enter one after another, a selector's chosen option slides from one to another, buttons shrink slightly when pressed, and blocks appearing or disappearing don't push the layout abruptly. They respect "reduce motion".
- Light **haptic feedback** when changing options, saving, or deleting.
- **Light** or **dark** (`#151517`) theme, or follow the **device**.
- **Currency** automatically set by your region (default `$`) or chosen manually.
- **Local** storage on the device (no accounts, ads, analytics, or own servers). **Privacy policy** inside the app (Settings → About).
- Export/import data as JSON.
- **Google Drive** (optional): backup and sync in a private folder of your Drive, using Google's current API. Hidden until you register the app in Google Cloud and set `driveActivado: true`.


## About AI:
I use AI for debugging and better code practices, this is a hobby proyect so please if you found something that i can do better, please contact me or send a pull!
