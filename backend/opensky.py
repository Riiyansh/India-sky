"""
OpenSky Network client.
Uses HTTP Basic Auth (username:password) — avoids the separate OAuth2
auth.opensky-network.org endpoint which is blocked on some cloud providers.
Falls back to anonymous if credentials are not set.
"""
import os
import base64
import httpx

import urllib.parse

BOUNDS      = dict(lamin=6, lomin=68, lamax=37, lomax=98)
DIRECT_URL  = "https://opensky-network.org/api/states/all"
OPENSKY_URL = DIRECT_URL + "?" + urllib.parse.urlencode(BOUNDS)

# Proxy via Vercel Edge (Cloudflare network — not blocked by OpenSky)
def _proxies() -> list[str]:
    frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
    if frontend and "localhost" not in frontend:
        return [f"{frontend}/api/opensky"]
    return []


def _auth_header() -> dict:
    user = os.environ.get("OPENSKY_CLIENT_ID", "")
    pwd  = os.environ.get("OPENSKY_CLIENT_SECRET", "")
    if user and pwd:
        token = base64.b64encode(f"{user}:{pwd}".encode()).decode()
        return {"Authorization": f"Basic {token}"}
    return {}


async def fetch_flights(client: httpx.AsyncClient) -> list[dict]:
    # Try direct first (works locally), then fall back to proxies
    endpoints = []

    # Direct with auth (local dev)
    if not os.environ.get("USE_PROXY"):
        endpoints.append(("direct", DIRECT_URL, {"User-Agent": "Mozilla/5.0", **_auth_header()}, BOUNDS))

    # Proxy via Vercel Edge (for cloud deployments where OpenSky blocks the IP)
    for proxy_url in _proxies():
        endpoints.append(("proxy", proxy_url, {"User-Agent": "Mozilla/5.0"}, {}))

    last_err = None
    for kind, url, headers, params in endpoints:
        try:
            resp = await client.get(url, params=params, headers=headers, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            states = data.get("states") or []
            if states:
                print(f"[opensky] {kind} → {len(states)} flights")
                break
        except Exception as e:
            print(f"[opensky] {kind} failed: {e}")
            last_err = e
            states = []
            continue

    if not states and last_err:
        raise last_err

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
