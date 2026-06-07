"use client";
import type { Flight } from "@/hooks/useFlights";

interface Props {
  flight: Flight;
  follow: boolean;
  onFollow: () => void;
  onClose: () => void;
}

export default function FlightPanel({ flight: f, follow, onFollow, onClose }: Props) {
  const ft     = f.altitude ? Math.round(f.altitude * 3.28084) : 0;
  const kmh    = f.speed ? Math.round(f.speed * 3.6) : 0;
  const altPct = Math.min(100, (ft / 45000) * 100);
  const arcOff = 173 - 173 * Math.min(1, kmh / 1200);
  const vr     = f.vrate != null
    ? (f.vrate > 0.5 ? `↑ ${Math.round(f.vrate)} m/s` : f.vrate < -0.5 ? `↓ ${Math.abs(Math.round(f.vrate))} m/s` : "▶ Level")
    : "—";
  const vrColor = f.vrate != null && f.vrate > 0.5 ? "#6bcb77" : f.vrate != null && f.vrate < -0.5 ? "#ff6b6b" : "#e0ecf8";

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-black/90 border-l border-sky-900/20 backdrop-blur-xl z-50 flex flex-col">
      <div className="h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent" />

      {/* Header */}
      <div className="p-5 border-b border-white/5">
        <button onClick={onClose} className="absolute top-3 right-3 text-sky-700 hover:text-white text-xs px-2 py-1">✕</button>
        <div className="text-xl font-bold tracking-[4px] text-white" style={{ textShadow: "0 0 16px #4fc3f7" }}>
          {f.callsign || f.icao24}
        </div>
        <div className="text-[9px] tracking-[2px] text-sky-400 opacity-60 mt-1">{f.country.toUpperCase()}</div>
        <button
          onClick={onFollow}
          className={`mt-3 w-full py-1.5 rounded border text-[10px] tracking-[2px] transition-all ${
            follow
              ? "border-green-500 text-green-400 bg-green-400/10 shadow-[0_0_12px_rgba(107,203,119,0.2)]"
              : "border-sky-800 text-sky-500 hover:border-sky-400 hover:text-white hover:bg-sky-400/10"
          }`}
        >
          {follow ? "◉ FOLLOWING…" : "⊙ FOLLOW FLIGHT"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-1 text-sm">
        <p className="text-[8px] tracking-[3px] text-sky-500/40 mt-2 mb-1">POSITION</p>
        <Row label="Latitude"  value={`${f.latitude.toFixed(4)}°`} />
        <Row label="Longitude" value={`${f.longitude.toFixed(4)}°`} />

        <p className="text-[8px] tracking-[3px] text-sky-500/40 mt-4 mb-2">ALTITUDE</p>
        {/* Altitude bar */}
        <div className="relative h-20 flex items-stretch">
          <div className="flex flex-col justify-between text-[8px] text-sky-500/40 pr-2">
            <span>45k ft</span><span>0</span>
          </div>
          <div className="relative w-1 bg-white/5 rounded-full flex-shrink-0">
            <div className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-blue-700 to-sky-400 transition-all duration-700"
              style={{ height: `${altPct}%` }} />
            <div className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_#4fc3f7] transition-all duration-700"
              style={{ bottom: `${altPct}%` }} />
          </div>
          <div className="pl-3 flex items-end transition-all duration-700" style={{ paddingBottom: `${altPct * 0.7}%` }}>
            <span className="text-sky-400 font-semibold text-xs">{ft.toLocaleString()} ft</span>
          </div>
        </div>

        <p className="text-[8px] tracking-[3px] text-sky-500/40 mt-4 mb-2">SPEED</p>
        {/* Speed arc */}
        <svg width="120" height="70" viewBox="0 0 120 70" className="mx-auto block">
          <path d="M10 65 A55 55 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round"/>
          <path d="M10 65 A55 55 0 0 1 110 65" fill="none" stroke="#4fc3f7" strokeWidth="6" strokeLinecap="round"
            strokeDasharray="173" strokeDashoffset={arcOff}
            style={{ transition: "stroke-dashoffset 0.6s ease", filter: "drop-shadow(0 0 4px #4fc3f7)" }}/>
          <text x="60" y="52" textAnchor="middle" fill="#fff" fontSize="16" fontFamily="monospace" fontWeight="700">{kmh}</text>
          <text x="60" y="66" textAnchor="middle" fill="rgba(79,195,247,0.5)" fontSize="8" fontFamily="monospace" letterSpacing="1">KM/H</text>
        </svg>

        <p className="text-[8px] tracking-[3px] text-sky-500/40 mt-4 mb-1">FLIGHT DATA</p>
        <Row label="Heading"  value={f.heading != null ? `${Math.round(f.heading)}°` : "—"} accent />
        <Row label="Vertical" value={vr} style={{ color: vrColor }} />
        <Row label="Status"   value={f.on_ground ? "■ ON GROUND" : "▲ AIRBORNE"} accent={!f.on_ground} />
        <Row label="ICAO24"   value={f.icao24} dimmed />
      </div>
    </div>
  );
}

function Row({ label, value, accent, dimmed, style }: {
  label: string; value: string; accent?: boolean; dimmed?: boolean; style?: React.CSSProperties;
}) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-white/[0.04]">
      <span className="text-[9px] tracking-[1px] text-slate-500 uppercase">{label}</span>
      <span className={`text-[13px] font-mono ${accent ? "text-sky-400" : dimmed ? "text-slate-600 text-[10px]" : "text-slate-200"}`}
        style={style}>{value}</span>
    </div>
  );
}
