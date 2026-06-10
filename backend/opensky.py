"""
OpenSky Network client.
Uses HTTP Basic Auth (username:password) — avoids the separate OAuth2
auth.opensky-network.org endpoint which is blocked on some cloud providers.
Falls back to anonymous if credentials are not set.
"""
import os
import base64
import httpx

BOUNDS = dict(lamin=6, lomin=68, lamax=37, lomax=98)
DIRECT_URL = "https://opensky-network.org/api/states/all"


def _proxy_url() -> str:
    """Use Vercel proxy if FRONTEND_URL is set — Vercel IPs aren't blocked by OpenSky."""
    frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
    if frontend and "localhost" not in frontend:
        return f"{frontend}/api/opensky"
    return ""


def _auth_header() -> dict:
    user = os.environ.get("OPENSKY_CLIENT_ID", "")
    pwd  = os.environ.get("OPENSKY_CLIENT_SECRET", "")
    if user and pwd:
        token = base64.b64encode(f"{user}:{pwd}".encode()).decode()
        return {"Authorization": f"Basic {token}"}
    return {}


async def fetch_flights(client: httpx.AsyncClient) -> list[dict]:
    proxy = _proxy_url()
    if proxy:
        # Fetch via Vercel serverless proxy (bypasses OpenSky cloud IP block)
        resp = await client.get(proxy, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
    else:
        # Direct fetch (works locally)
        headers = {"User-Agent": "Mozilla/5.0", **_auth_header()}
        resp = await client.get(DIRECT_URL, params=BOUNDS, headers=headers, timeout=20)

    resp.raise_for_status()
    states = resp.json().get("states") or []

    flights = []
    for s in states:
        if s[6] is None or s[5] is None:
            continue
        flights.append({
            "icao24":    s[0],
            "callsign":  (s[1] or s[0]).strip(),
            "country":   s[2] or "—",
            "longitude": s[5],
            "latitude":  s[6],
            "altitude":  s[7],
            "on_ground": s[8],
            "speed":     s[9],
            "heading":   s[10],
            "vrate":     s[11],
        })
    return flights
