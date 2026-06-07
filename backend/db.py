"""
Database helpers — PostgreSQL via psycopg2 (run in asyncio thread pool).
Falls back gracefully if DATABASE_URL is not set (local dev without Postgres).
"""
import os
import asyncio
from functools import partial
from typing import Optional
import psycopg2
import psycopg2.extras

_conn: Optional[psycopg2.extensions.connection] = None
DB_URL = os.environ.get("DATABASE_URL")


def _get_conn():
    global _conn
    if _conn and not _conn.closed:
        return _conn
    if not DB_URL:
        return None
    try:
        _conn = psycopg2.connect(DB_URL)
        _conn.autocommit = True
        return _conn
    except Exception as e:
        print(f"[db] Cannot connect: {e} — running without persistence")
        return None


def _init():
    conn = _get_conn()
    if not conn:
        print("[db] No DATABASE_URL set — running without persistence")
        return
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS flight_snapshots (
                id          BIGSERIAL PRIMARY KEY,
                recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                icao24      TEXT NOT NULL,
                callsign    TEXT,
                country     TEXT,
                latitude    DOUBLE PRECISION,
                longitude   DOUBLE PRECISION,
                altitude    DOUBLE PRECISION,
                on_ground   BOOLEAN,
                speed       DOUBLE PRECISION,
                heading     DOUBLE PRECISION,
                vrate       DOUBLE PRECISION
            );
            CREATE INDEX IF NOT EXISTS idx_snap_time ON flight_snapshots (recorded_at DESC);
            CREATE INDEX IF NOT EXISTS idx_snap_icao ON flight_snapshots (icao24, recorded_at DESC);
        """)
    print("[db] Tables ready")


def _save(flights: list[dict]):
    conn = _get_conn()
    if not conn or not flights:
        return
    rows = [(f["icao24"], f.get("callsign"), f.get("country"), f.get("latitude"),
             f.get("longitude"), f.get("altitude"), f.get("on_ground"),
             f.get("speed"), f.get("heading"), f.get("vrate")) for f in flights]
    with conn.cursor() as cur:
        psycopg2.extras.execute_values(cur, """
            INSERT INTO flight_snapshots
              (icao24,callsign,country,latitude,longitude,altitude,on_ground,speed,heading,vrate)
            VALUES %s
        """, rows)


def _history(icao24: str, limit: int):
    conn = _get_conn()
    if not conn:
        return []
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT recorded_at, latitude, longitude, altitude, speed, heading
            FROM flight_snapshots WHERE icao24=%s ORDER BY recorded_at DESC LIMIT %s
        """, (icao24, limit))
        return [dict(r) for r in cur.fetchall()]


def _stats():
    conn = _get_conn()
    if not conn:
        return {"total_last_hour": 0, "by_country": [], "altitude_dist": []}
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(DISTINCT icao24) FROM flight_snapshots WHERE recorded_at>=NOW()-interval '1 hour'")
        total = cur.fetchone()["count"]
        cur.execute("""
            SELECT country, COUNT(DISTINCT icao24) as cnt FROM flight_snapshots
            WHERE recorded_at>=NOW()-interval '1 hour' AND country IS NOT NULL
            GROUP BY country ORDER BY cnt DESC LIMIT 10
        """)
        by_country = [dict(r) for r in cur.fetchall()]
        cur.execute("""
            SELECT CASE WHEN altitude*3.28084<5000 THEN 'low' WHEN altitude*3.28084<20000 THEN 'mid'
                        WHEN altitude*3.28084<35000 THEN 'high' ELSE 'cruise' END as band, COUNT(*) as cnt
            FROM flight_snapshots
            WHERE recorded_at>=NOW()-interval '10 minutes' AND on_ground=false AND altitude IS NOT NULL
            GROUP BY band
        """)
        alt_dist = [dict(r) for r in cur.fetchall()]
    return {"total_last_hour": total, "by_country": by_country, "altitude_dist": alt_dist}


# Async wrappers
async def init_db():
    await asyncio.get_event_loop().run_in_executor(None, _init)

async def close_db():
    if _conn and not _conn.closed:
        _conn.close()

async def save_snapshot(flights: list[dict]):
    await asyncio.get_event_loop().run_in_executor(None, partial(_save, flights))

async def get_history(icao24: str, limit: int = 200):
    rows = await asyncio.get_event_loop().run_in_executor(None, partial(_history, icao24, limit))
    for r in rows:
        if hasattr(r.get("recorded_at"), "isoformat"):
            r["recorded_at"] = r["recorded_at"].isoformat()
    return rows

async def get_stats():
    return await asyncio.get_event_loop().run_in_executor(None, _stats)
