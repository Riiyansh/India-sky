/**
 * Vercel EDGE proxy for OpenSky Network.
 * Edge runtime runs on Cloudflare's network — NOT AWS Lambda.
 * Cloudflare IPs are not blocked by OpenSky unlike Railway/Render/Lambda.
 */

export const runtime = "edge";

const OPENSKY_URL =
  "https://opensky-network.org/api/states/all?lamin=6&lomin=68&lamax=37&lomax=98";

export async function GET() {
  const clientId     = process.env.OPENSKY_CLIENT_ID     || "";
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET || "";

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0",
  };

  if (clientId && clientSecret) {
    const creds = btoa(`${clientId}:${clientSecret}`);
    headers["Authorization"] = `Basic ${creds}`;
  }

  try {
    const res = await fetch(OPENSKY_URL, { headers, next: { revalidate: 0 } });
    if (!res.ok) {
      return Response.json({ error: `OpenSky returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return Response.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
