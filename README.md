# ✈️ India Sky — Live Flight Tracker

A real-time flight tracking dashboard for Indian airspace, built as a full-stack portfolio project. Watch 200+ live flights move across India with 60fps smooth animation, click any plane for details, and explore live stats.

**Live demo:** _coming soon_ · **Backend:** Railway · **Frontend:** Vercel

---

## 🎥 Preview

> 200+ live flights over India, color-coded by altitude, with comet trails and velocity vectors

---

## ✨ Features

### 🗺️ Live Map
- **200+ real-time flights** over India fetched from [OpenSky Network](https://opensky-network.org/)
- **60fps smooth movement** using dead-reckoning — planes glide continuously between 10s data updates using their real speed + heading
- **Velocity vectors** — dashed line ahead of each plane showing its projected path
- **Comet trails** — fading trail behind each plane showing recent flight path
- **Color-coded by altitude:**
  - 🔴 `< 5,000 ft` — low altitude
  - 🟡 `5,000 – 20,000 ft` — mid altitude
  - 🟢 `20,000 – 35,000 ft` — high altitude
  - 🔵 `> 35,000 ft` — cruise altitude
  - ⚫ On ground

### 🛫 Flight Detail Panel
Click any plane to open a detail panel with:
- Callsign & origin country
- **Altitude bar** — animated vertical gauge
- **Speed arc** — speedometer-style gauge (km/h)
- Heading, vertical rate (climbing ↑ / descending ↓ / level)
- Live lat/lon coordinates
- Flight status (airborne / on ground)
- ICAO24 transponder code

### 🎯 Follow Mode
- Click **⊙ FOLLOW FLIGHT** in the detail panel to lock the map onto a selected flight
- Map continuously pans to track the plane in real time
- Toggle off anytime

### 🔍 Search
- Type any callsign (e.g. `IGO`, `AIC`, `IX`) or ICAO24 code
- Live dropdown with altitude and country info
- Click a result to jump to the flight and open its panel

### 🏢 Airport Markers
20 major Indian airports shown as gold markers:
`DEL` `BOM` `BLR` `MAA` `HYD` `CCU` `GOI` `AMD` `PNQ` `COK`
`JAI` `LKO` `IXC` `GAU` `TRV` `VTZ` `BHO` `PAT` `IXB` `BBI`

### 📊 Live Stats Dashboard
Click **STATS** in the top-right to open:
- Total unique flights in the last hour
- **Altitude distribution** pie chart (low / mid / high / cruise)
- **Top countries** by number of active flights (bar chart)

### 🔧 Filters
- **ALL** — show every flight
- **AIRBORNE** — only in-flight planes
- **GROUND** — only planes on the ground at airports

### ⚡ WebSocket Push
- Backend pushes new flight data every **10 seconds** via WebSocket
- No browser polling — connection is persistent
- Auto-reconnects on disconnect with 3s backoff

### 🌐 HUD Interface
- Live **UTC clock** top-right
- **Flight counters** — total / airborne / ground
- **Status indicator** — green (live) / orange (fetching) / red (error)
- CRT scanline overlay for a radar aesthetic
- Star field background

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Map | Leaflet.js + Canvas API |
| Charts | Recharts |
| Backend | FastAPI (Python) |
| Real-time | WebSockets |
| Database | PostgreSQL (flight history) |
| Data source | OpenSky Network REST API (OAuth2) |
| Deploy (frontend) | Vercel |
| Deploy (backend) | Railway |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL (optional — app runs without it, just no history)
- [OpenSky Network account](https://opensky-network.org/my-opensky/account) (free)

### 1. Clone
```bash
git clone https://github.com/Riiyansh/india-sky.git
cd india-sky
```

### 2. Environment variables
```bash
cp .env.example .env
# Fill in your OpenSky client_id and client_secret
# Optionally add a PostgreSQL DATABASE_URL
```

### 3. Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** 🎉

---

## 📁 Project Structure

```
india-sky/
├── .env.example          # Safe env template (copy to .env)
├── .gitignore
├── backend/
│   ├── main.py           # FastAPI app — REST + WebSocket endpoints
│   ├── opensky.py        # OAuth2 token management + flight fetching
│   ├── db.py             # PostgreSQL helpers (flight history, stats)
│   ├── requirements.txt
│   └── railway.toml      # Railway deploy config
└── frontend/
    ├── app/
    │   ├── page.tsx       # Main dashboard page
    │   ├── layout.tsx
    │   └── globals.css
    ├── components/
    │   ├── FlightMap.tsx  # Leaflet map + canvas animation + dead reckoning
    │   ├── FlightPanel.tsx # Selected flight detail panel
    │   └── StatsPanel.tsx  # Recharts stats dashboard
    ├── hooks/
    │   └── useFlights.ts  # WebSocket hook with auto-reconnect
    └── vercel.json        # Vercel deploy config
```

---

## 🌐 Deployment

### Backend → Railway
1. Push repo to GitHub
2. New project on [railway.app](https://railway.app) → Deploy from GitHub → select `backend/` root
3. Add environment variables: `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `DATABASE_URL`, `FRONTEND_URL`
4. Railway auto-detects Python + uses `railway.toml`

### Frontend → Vercel
1. New project on [vercel.com](https://vercel.com) → Import from GitHub → set **Root Directory** to `frontend/`
2. Add environment variables: `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_API_URL`
3. Deploy

---

## 📡 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check + live flight count |
| `/api/flights` | GET | Current snapshot of all flights (REST fallback) |
| `/ws/flights` | WS | Live flight push every 10s |
| `/api/history/{icao24}` | GET | Position history for a single flight |
| `/api/stats` | GET | Aggregated stats for dashboard |

---

## 🔑 OpenSky Network Setup

1. Sign up free at [opensky-network.org](https://opensky-network.org)
2. Go to **My OpenSky → Account**
3. Click **Create & Download Credential**
4. Copy `clientId` and `clientSecret` to your `.env`

---

## 📄 License

MIT — free to use, modify, and deploy.

---

<p align="center">Built with ❤️ by <a href="https://github.com/Riiyansh">Riyansh Chouhan</a></p>
