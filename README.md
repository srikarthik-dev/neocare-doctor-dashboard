# NEOCARE Doctor Dashboard

> **⚠️ DEMO / PORTFOLIO PROTOTYPE**
> This is a non-functional frontend prototype built for portfolio purposes only.
> It is **not** a certified medical device, does **not** process real patient data,
> and must **not** be used for any clinical decision-making.

---

## Project Status

🚧 **Work in Progress** — Stage 4 (App Shell & Navigation) complete.

| Stage | Description                              | Status      |
|-------|------------------------------------------|-------------|
| 1     | Project scaffolding & design system       | ✅ Complete |
| 2     | Demo authentication & login page          | ✅ Complete |
| 3     | Synthetic data & data access layer        | ✅ Complete |
| 4     | App shell, sidebar & navigation           | ✅ Complete |
| 5     | Dashboard KPIs, patient list & charts     | ⬜ Planned  |
| 6     | Reports, alerts & export                  | ⬜ Planned  |
| 7     | Firebase backend integration              | ⬜ Planned  |

---

## About

**NEOCARE** is a fictional IoT pregnancy-monitoring ecosystem.
This dashboard is the doctor-facing interface — a portfolio
prototype demonstrating a modern healthcare SaaS UI built with
pure web technologies, no heavy frameworks.

---

## Technology Stack

| Layer        | Technology                    |
|--------------|-------------------------------|
| Markup       | HTML5 (semantic)              |
| Styling      | CSS3 (custom design system)   |
| Logic        | Vanilla JavaScript (ES6+)     |
| Charts       | Chart.js (CDN)                |
| Typography   | Inter (Google Fonts)          |
| Backend-ready| Firebase (future integration) |

---

## Project Structure

```
neocare-doctor-dashboard/
├── index.html              ← Login / entry point
├── pages/                  ← Application pages
├── css/                    ← Design system & page styles
├── js/                     ← Page controllers & utilities
│   └── data/               ← Data access layer
├── data/                   ← Synthetic JSON data fixtures
├── assets/                 ← Images and icons
├── scripts/                ← Demo data generator (Node.js)
├── README.md
└── LICENSE
```

---

## Data Layer

The application currently uses **synthetic local JSON files** as its data source:

| File | Contents |
|------|----------|
| `data/patients.json` | 12 synthetic patient records |
| `data/sensor-data.json` | 416 algorithmically generated sensor readings |
| `data/alerts.json` | 20 synthetic alerts (mixed severity/status) |
| `data/doctor.json` | 1 synthetic doctor profile |

All data access is centralised in **`js/data/dataService.js`** (`NeoCareData` module).
Page controllers call `NeoCareData.getPatients()`, `getAlerts()`, etc.
and never access `data/*.json` directly.

This abstraction means **Firebase / Firestore** can be integrated in a future
stage by replacing only `dataService.js` — no page controller changes required.

---

## Disclaimer

> This application is a **portfolio and demonstration prototype only**.
> All patient names, medical readings, and clinical data shown are
> **entirely synthetic and randomly generated**. No real patient
> information is used. This project is not affiliated with any
> healthcare provider, does not constitute medical advice,
> and is not a certified medical device under any jurisdiction.
