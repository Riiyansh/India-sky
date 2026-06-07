"""
OpenSky Network client — OAuth2 token management + flight fetching.
"""
import os
import time
import httpx

BOUNDS = dict(lamin=6, lomin=68, lamax=37, lomax=98)
TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
API_URL   = "https://opensky-network.org/api/states/all"

_token: str | None = None
_token_expiry: float = 0


async def get_token(client: httpx.AsyncClient) -> str:
    global _token, _token_expiry
    if _token and time.time() < _token_expiry - 30:
        return _token
    print("[opensky] Refreshing OAuth2 token...")
    resp = await client.post(TOKEN_URL, data={
        "grant_type":    "client_credentials",
        "client_id":     os.environ["OPENSKY_CLIENT_ID"],
        "client_secret": os.environ["OPENSKY_CLIENT_SECRET"],
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    _token        = data["access_token"]
    _token_expiry = time.time() + data.get("expires_in", 300)
    print(f"[opensky] Token valid for {data.get('expires_in', 300)}s")
    return _token


async def fetch_flights(client: httpx.AsyncClient) -> list[dict]:
    token = await get_token(client)
    resp  = await client.get(API_URL, params=BOUNDS,
                             headers={"Authorization": f"Bearer {token}"}, timeout=14)
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
