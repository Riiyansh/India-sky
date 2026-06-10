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
API_URL = "https://opensky-network.org/api/states/all"

def _auth_header() -> dict:
    user = os.environ.get("OPENSKY_USERNAME", "")
    pwd  = os.environ.get("OPENSKY_PASSWORD", "")
    # Also support client_id/secret as username/password (same credentials)
    if not user:
        user = os.environ.get("OPENSKY_CLIENT_ID", "")
    if not pwd:
        pwd = os.environ.get("OPENSKY_CLIENT_SECRET", "")
    if user and pwd:
        token = base64.b64encode(f"{user}:{pwd}".encode()).decode()
        return {"Authorization": f"Basic {token}"}
    return {}


async def fetch_flights(client: httpx.AsyncClient) -> list[dict]:
    headers = {"User-Agent": "Mozilla/5.0", **_auth_header()}
    resp = await client.get(
        API_URL,
        params=BOUNDS,
        headers=headers,
        timeout=20,
        follow_redirects=True,
    )
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
