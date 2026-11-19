# Tiki-Toki (時) — Personal Time & Sink Tracker

> *"Toki is the current of time; Tiki is the carved stone you drop into the river to mark where you stand."*

**Tiki-Toki** is a personal time-tracking web application built to effortlessly capture every time sink throughout your day, while balancing intentional deep work and daily upkeep.

---

## 🗿 The Triple Play on Words

1. **Tiki (Hawaiian / Polynesian Tradition):** Carved figures (*kiʻi*) that serve as tangible vessels. Like dropping a carved stone into a flowing river, Tiki-Toki turns invisible hours into deliberate, immovable markers.
2. **Toki (時 — Japanese / *Final Fantasy V*):** The Japanese word for "time" and the root of **Tokimadōshi** (時魔道士 — *Time Mage*), the classic job class commanding the flow, pace, and speed of time.
3. **Tick-Tock (Onomatopoeia):** The mechanical, universal cadence of time passing.

---

## ⚡ Core Features of the MVP

* **Obligatory 3-Way Classification:** Every activity is classified into one of three core channels:
  * 🟢 **Productive:** Deep work, coding, focused learning, creative flow.
  * 🟡 **Upkeep:** Necessary maintenance, admin, email triage, chores, team syncs.
  * 🔴 **Time Sink:** Procrastination, rabbit holes, mindless doomscrolling, compulsive tab hopping.
* **Hybrid Tracking Model:**
  * **Live Active Totem:** Start a session with one tap or `Space`. Watch the arcane time ring flow, pause/freeze time, or drop the totem into the river when complete.
  * **Retroactive Logging (`R`):** Log time blocks after the fact ("I just spent 35m researching tools" or "Lost 20m to Twitter").
* **"Caught Slipping?" Quick Sink Catcher:**
  * 1-tap presets to log distractions the moment you catch yourself slipping (`Doomscrolling 15m/30m`, `YouTube 20m`, etc.).
* **The River of Time (時流):**
  * Chronological ledger of all totems placed in the river.
  * Daily grouping with total duration calculations.
  * Filter by classification (`All`, `Productive`, `Upkeep`, `Sinks`) and search by text or `#tags`.
  * Inline editing, deletion, and individual re-syncing.
* **Daily Balance & Time Mage Ratios:**
  * Visual segmented river bar showing your balance of Productive vs Upkeep vs Sink.
  * Time Mage Focus Ratio assessment and sink warning alerts.
* **Google Spreadsheets as the Primary Data Repository:**
  * Uses a lightweight **Google Apps Script Web App** bridge.
  * **Zero Google Cloud Console configuration**, zero OAuth client expiration headaches.
  * Syncs timestamp, start/end times, duration, classification, activity name, tags, and notes.
* **Local-First & Offline Tolerant:**
  * Entries save instantly to browser storage (`localStorage`) with zero latency.
  * Automatic background push to Google Sheets with sync status badges (`Local`, `Syncing`, `Synced`, `Failed / Retry`).
  * Full CSV and JSON export/backup anytime.
* **Desktop & Mobile Responsive:**
  * Designed for desktop keyboard shortcuts (`Space`, `Enter`, `R`, `1`, `2`, `3`).
  * Mobile-optimized layout with viewport meta tags, tap targets, and touch-friendly controls.

---

## 🚀 Getting Started

### 1. Install & Run Locally

```bash
# Install dependencies
npm install

# Start the dev server (accessible from your phone on LAN)
npm run dev
```

Open `http://localhost:5173` in your browser.
To access it on your phone, open `http://<YOUR_LOCAL_IP>:5173` while on the same Wi-Fi network.

---

## 📊 Connecting to Google Sheets (60-Second Setup)

1. Create a new Google Spreadsheet at [sheets.new](https://sheets.new).
2. In the Google Sheets menu, click **Extensions > Apps Script**.
3. In Tiki-Toki, open **Settings (gear icon)** > click **"1-Min Setup Guide"** > click **"Copy Script Code"**.
4. Paste the copied code into Google Apps Script and click **Save** (disk icon).
5. Click **Deploy > New deployment**:
   * Type: **Web app**
   * Description: `Tiki-Toki Bridge`
   * Execute as: **Me**
   * Who has access: **Anyone**
6. Click **Deploy**, then click **Authorize access**.
   > **Note on "Google hasn’t verified this app":**
   > Google displays this standard warning for any private Apps Script you write. Because this is your own script running on your own Google account, it is 100% safe.
   > 1. Click the small **"Advanced"** link (bottom-left of the warning popup).
   > 2. Click **"Go to Tiki-Toki Bridge (unsafe)"** (or "Go to Untitled project (unsafe)").
   > 3. Click **"Allow"**.
7. Copy the generated Web app URL (ends in `/exec`).
8. Paste the URL into Tiki-Toki Settings and click **Save Configuration**!

From then on, every totem and time sink you record will automatically sync to your personal Google Sheet!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Pause or Resume the active live totem |
| `Enter` | Drop and complete active totem into the River |
| `R` | Open retroactive log modal ("Log Past") |
| `1` | Select **Productive** classification |
| `2` | Select **Upkeep** classification |
| `3` | Select **Time Sink** classification |
| `Esc` | Close any open modal |

---

## 🛠️ Tech Stack

* **Framework:** React 18 + TypeScript + Vite
* **Styling:** Tailwind CSS (Dark theme with custom Tiki & Toki stone palette)
* **Icons:** Lucide React
* **Data Storage:** LocalStorage (local-first) + Google Apps Script Web App (cloud sheet repository)
