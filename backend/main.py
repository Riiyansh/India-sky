"""
India Sky — FastAPI backend
  GET  /api/health          — health check
  GET  /api/flights         — current snapshot (REST fallback)
  WS   /ws/flights          — live push every 10s via WebSocket
  GET  /api/history/{icao}  — position history for one flight
  GET  /api/replay          — last N minutes of all traffic
  GET  /api/stats           — dashboard aggregates
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from db import init_db, close_db, save_snapshot, get_history, get_stats
from opensky import fetch_flights

# ── State ──────────────────────────────────────────────────────────────
latest_flights: list[dict] = []
connected_ws:   set[WebSocket] = set()
http_client:    httpx.AsyncClient | None = None

PUSH_INTERVAL = 10   # seconds between WebSocket pushes
FETCH_INTERVAL = 10  # seconds between OpenSky fetches


# ── Background poller ──────────────────────────────────────────────────
async def poll_loop():
    global latest_flights
    while True:
        try:
            flights = await fetch_flights(http_client)
            latest_flights = flights
            await save_snapshot(flights)

            payload = json.dumps({"type": "flights", "data": flights})
            dead = set()
            for ws in connected_ws:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.add(ws)
            connected_ws.difference_update(dead)

            print(f"[poll] {len(flights)} flights → {len(connected_ws)} clients")
        except Exception as e:
            print(f"[poll] Error: {e}")
        await asyncio.sleep(FETCH_INTERVAL)


# ── Lifespan ───────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient()
    await init_db()
    task = asyncio.create_task(poll_loop())
    yield
    task.cancel()
    await http_client.aclose()
    await close_db()


# ── App ────────────────────────────────────────────────────────────────
app = FastAPI(title="India Sky API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ─────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "flights": len(latest_flights)}


@app.get("/api/debug")
async def debug():
    """Manually trigger a fetch and return result — for diagnosing Railway issues."""
    client_id = os.environ.get("OPENSKY_CLIENT_ID", "NOT SET")
    client_secret = os.environ.get("OPENSKY_CLIENT_SECRET", "NOT SET")
    try:
        flights = await fetch_flights(http_client)
        global latest_flights
        latest_flights = flights
        return {
            "client_id": client_id,
            "client_secret_set": client_secret != "NOT SET",
            "flights_fetched": len(flights),
            "sample": flights[0] if flights else None
        }
    except Exception as e:
        return {
            "client_id": client_id,
            "client_secret_set": client_secret != "NOT SET",
            "error": str(e)
        }


@app.get("/api/flights")
async def flights_rest():
    return {"flights": latest_flights, "count": len(latest_flights)}


@app.websocket("/ws/flights")
async def ws_flights(ws: WebSocket):
    await ws.accept()
    connected_ws.add(ws)
    # Send current snapshot immediately on connect
    try:
        await ws.send_text(json.dumps({"type": "flights", "data": latest_flights}))
        while True:
            await ws.receive_text()   # keep alive / handle pings
    except WebSocketDisconnect:
        pass
    finally:
        connected_ws.discard(ws)


@app.get("/api/history/{icao24}")
async def flight_history(icao24: str, limit: int = 200):
    rows = await get_history(icao24, limit)
    # Make datetimes JSON-serialisable
    for r in rows:
        r["recorded_at"] = r["recorded_at"].isoformat()
    return {"icao24": icao24, "history": rows}



@app.get("/api/stats")
async def stats():
    return await get_stats()
