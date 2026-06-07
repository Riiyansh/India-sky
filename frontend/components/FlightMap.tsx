"use client";
import { useEffect, useRef } from "react";
import type { Flight } from "@/hooks/useFlights";

const AIRPORTS = [
  { iata: "DEL", lat: 28.5562, lon: 77.1000 }, { iata: "BOM", lat: 19.0896, lon: 72.8656 },
  { iata: "BLR", lat: 13.1986, lon: 77.7066 }, { iata: "MAA", lat: 12.9941, lon: 80.1709 },
  { iata: "HYD", lat: 17.2403, lon: 78.4294 }, { iata: "CCU", lat: 22.6547, lon: 88.4467 },
  { iata: "GOI", lat: 15.3808, lon: 73.8314 }, { iata: "AMD", lat: 23.0772, lon: 72.6347 },
  { iata: "PNQ", lat: 18.5822, lon: 73.9197 }, { iata: "COK", lat: 10.1520, lon: 76.4019 },
  { iata: "JAI", lat: 26.8242, lon: 75.8122 }, { iata: "LKO", lat: 26.7606, lon: 80.8893 },
  { iata: "IXC", lat: 30.6735, lon: 76.7885 }, { iata: "GAU", lat: 26.1061, lon: 91.5859 },
  { iata: "TRV", lat: 8.4821,  lon: 76.9201 }, { iata: "VTZ", lat: 17.7212, lon: 83.2245 },
  { iata: "BHO", lat: 23.2875, lon: 77.3374 }, { iata: "PAT", lat: 25.5913, lon: 85.0880 },
  { iata: "IXB", lat: 26.6812, lon: 88.3286 }, { iata: "BBI", lat: 20.2444, lon: 85.8178 },
];

function altColorRgb(alt: number | null, onGround: boolean): [number, number, number] {
  if (onGround) return [80, 80, 80];
  const ft = (alt || 0) * 3.28084;
  if (ft < 5000)  return [255, 107, 107];
  if (ft < 20000) return [255, 217, 61];
  if (ft < 35000) return [107, 203, 119];
  return [79, 195, 247];
}
function altHex(alt: number | null, onGround: boolean) {
  const [r, g, b] = altColorRgb(alt, onGround);
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`;
}

interface Props {
  flights: Flight[];
  onSelect: (f: Flight) => void;
  selectedIcao: string | null;
  filter: "all" | "air" | "gnd";
  follow: boolean;
}

export default function FlightMap({ flights, onSelect, selectedIcao, filter, follow }: Props) {
  const mapDivRef  = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const mapRef     = useRef<any>(null);
  const LRef       = useRef<any>(null);

  // Kept in refs so animation loop always reads latest without re-creating effects
  const markersRef   = useRef<Record<string, any>>({});
  const markerStateRef = useRef<Record<string, { heading: number|null; selected: boolean }>>({});
  const trailsRef    = useRef<Record<string, { lat: number; lon: number }[]>>({});
  const lastSeenRef  = useRef<Record<string, { time: number; lat: number; lon: number }>>({});
  const flightsRef   = useRef<Flight[]>([]);
  const selectedRef  = useRef<string | null>(null);
  const filterRef    = useRef<"all" | "air" | "gnd">("all");
  const followRef    = useRef(false);
  const onSelectRef  = useRef(onSelect);
  const animRef      = useRef<number | undefined>(undefined);

  // Keep refs up to date on every render — no effect needed
  flightsRef.current  = flights;
  selectedRef.current = selectedIcao;
  filterRef.current   = filter;
  followRef.current   = follow;
  onSelectRef.current = onSelect;

  // ── Init map ONCE ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current) return;

    import("leaflet").then(L => {
      LRef.current = L;

      // Guard against double-init (StrictMode)
      const el = mapDivRef.current as any;
      if (el._leaflet_id) return;

      const map = L.map(el, {
        center: [22, 82], zoom: 5,
        zoomControl: true, attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 100);

      // Airport markers
      AIRPORTS.forEach(a => {
        L.marker([a.lat, a.lon], {
          icon: L.divIcon({
            html: `<div style="text-align:center">
              <div style="width:6px;height:6px;background:#ffd166;border-radius:50%;box-shadow:0 0 6px #ffd166;margin:0 auto"></div>
              <div style="font-family:monospace;font-size:9px;color:rgba(255,209,102,0.85);letter-spacing:1px;text-shadow:0 0 4px #000">${a.iata}</div>
            </div>`,
            className: "", iconSize: [30, 20], iconAnchor: [15, 3],
          }),
          zIndexOffset: -100, interactive: false,
        }).addTo(map);
      });

      // Start animation loop
      startLoop();
    });

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Canvas resize ──────────────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Animation loop ─────────────────────────────────────────────────
  function startLoop() {
    function makePlaneIcon(heading: number | null, color: string, onGround: boolean, selected: boolean) {
      const L = LRef.current;
      const rot = heading || 0;
      const sz  = onGround ? 12 : 17;
      const glow = selected
        ? `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 12px ${color})`
        : `drop-shadow(0 0 3px ${color})`;
      return L.divIcon({
        html: `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24"
          style="transform:rotate(${rot}deg);filter:${glow}">
          <path fill="${color}" d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
        </svg>`,
        className: "", iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
      });
    }

    function deadReckon(f: Flight, elapsedSec: number) {
      if (f.on_ground || !f.speed || f.heading == null) return { lat: f.latitude, lon: f.longitude };
      const hdg = (f.heading * Math.PI) / 180;
      return {
        lat: f.latitude + (f.speed * Math.cos(hdg) * elapsedSec) / 111320,
        lon: f.longitude + (f.speed * Math.sin(hdg) * elapsedSec) / (111320 * Math.cos((f.latitude * Math.PI) / 180)),
      };
    }

    function projectPos(lat: number, lon: number, speed: number, heading: number, sec: number) {
      const hdg = (heading * Math.PI) / 180;
      return {
        lat: lat + (speed * Math.cos(hdg) * sec) / 111320,
        lon: lon + (speed * Math.sin(hdg) * sec) / (111320 * Math.cos((lat * Math.PI) / 180)),
      };
    }

    function frame() {
      const map    = mapRef.current;
      const canvas = canvasRef.current;
      const L      = LRef.current;
      if (!map || !canvas || !L) { animRef.current = requestAnimationFrame(frame); return; }

      const ctx     = canvas.getContext("2d")!;
      const now     = Date.now();
      const fs      = flightsRef.current;
      const selIcao = selectedRef.current;
      const flt     = filterRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const seen = new Set<string>();

      fs.forEach(f => {
        seen.add(f.icao24);
        const color      = altHex(f.altitude, f.on_ground);
        const [cr, cg, cb] = altColorRgb(f.altitude, f.on_ground);
        const isSelected = f.icao24 === selIcao;

        // Dead reckoning
        const ls = lastSeenRef.current[f.icao24];
        if (!ls || ls.lat !== f.latitude || ls.lon !== f.longitude) {
          lastSeenRef.current[f.icao24] = { time: now, lat: f.latitude, lon: f.longitude };
        }
        const elapsed = (now - (lastSeenRef.current[f.icao24]?.time ?? now)) / 1000;
        const pos = deadReckon(f, elapsed);

        // Filter
        const vis = flt === "air" ? !f.on_ground : flt === "gnd" ? f.on_ground : true;

        // Marker — only call setIcon when heading or selection changes (prevents 60fps DOM churn)
        if (markersRef.current[f.icao24]) {
          const m    = markersRef.current[f.icao24];
          const prev = markerStateRef.current[f.icao24];
          m.setLatLng([pos.lat, pos.lon]);
          if (!prev || prev.heading !== f.heading || prev.selected !== isSelected) {
            m.setIcon(makePlaneIcon(f.heading, color, f.on_ground, isSelected));
            markerStateRef.current[f.icao24] = { heading: f.heading, selected: isSelected };
          }
          if (vis && !map.hasLayer(m)) m.addTo(map);
          if (!vis && map.hasLayer(m)) map.removeLayer(m);
        } else {
          const icao = f.icao24;
          const m = L.marker([pos.lat, pos.lon], {
            icon: makePlaneIcon(f.heading, color, f.on_ground, isSelected),
            zIndexOffset: f.on_ground ? 0 : 200,
          });
          m.on("click", () => {
            const current = flightsRef.current.find(x => x.icao24 === icao);
            if (current) onSelectRef.current(current);
          });
          markerStateRef.current[icao] = { heading: f.heading, selected: isSelected };
          if (vis) m.addTo(map);
          markersRef.current[icao] = m;
        }

        // Follow
        if (followRef.current && isSelected) {
          map.panTo([pos.lat, pos.lon], { animate: false });
        }

        // Trail
        if (!trailsRef.current[f.icao24]) trailsRef.current[f.icao24] = [];
        const tr = trailsRef.current[f.icao24];
        const lastTr = tr[tr.length - 1];
        if (!lastTr || lastTr.lat !== f.latitude || lastTr.lon !== f.longitude) {
          tr.push({ lat: f.latitude, lon: f.longitude });
          if (tr.length > 20) tr.shift();
        }

        const curPx = map.latLngToContainerPoint(L.latLng(pos.lat, pos.lon));

        // Draw trail
        for (let i = 1; i < tr.length; i++) {
          const p0 = map.latLngToContainerPoint(L.latLng(tr[i-1].lat, tr[i-1].lon));
          const p1 = map.latLngToContainerPoint(L.latLng(tr[i].lat, tr[i].lon));
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(i / tr.length) * 0.5})`;
          ctx.lineWidth = (i / tr.length) * 2.5;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // Velocity vector
        if (!f.on_ground && f.speed && f.heading != null) {
          const lookahead = 60 + map.getZoom() * 15;
          const tip = projectPos(pos.lat, pos.lon, f.speed, f.heading, lookahead);
          const tipPx = map.latLngToContainerPoint(L.latLng(tip.lat, tip.lon));
          ctx.save();
          ctx.setLineDash([4, 5]);
          ctx.beginPath();
          ctx.moveTo(curPx.x, curPx.y);
          ctx.lineTo(tipPx.x, tipPx.y);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.3)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
          const angle = Math.atan2(tipPx.y - curPx.y, tipPx.x - curPx.x);
          ctx.beginPath();
          ctx.moveTo(tipPx.x, tipPx.y);
          ctx.lineTo(tipPx.x - 6 * Math.cos(angle - 0.4), tipPx.y - 6 * Math.sin(angle - 0.4));
          ctx.lineTo(tipPx.x - 6 * Math.cos(angle + 0.4), tipPx.y - 6 * Math.sin(angle + 0.4));
          ctx.closePath();
          ctx.fillStyle = `rgba(${cr},${cg},${cb},0.45)`;
          ctx.fill();
        }

        // Glow dot
        const g = ctx.createRadialGradient(curPx.x, curPx.y, 0, curPx.x, curPx.y, 7);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},0.4)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(curPx.x, curPx.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });

      // Remove stale markers
      Object.keys(markersRef.current).forEach(icao => {
        if (!seen.has(icao)) {
          map.removeLayer(markersRef.current[icao]);
          delete markersRef.current[icao];
          delete markerStateRef.current[icao];
          delete trailsRef.current[icao];
          delete lastSeenRef.current[icao];
        }
      });

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
  }

  return (
    <>
      <div ref={mapDivRef} style={{ position: "fixed", inset: 0, zIndex: 1, background: "#000" }} />
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none" }} />
    </>
  );
}
