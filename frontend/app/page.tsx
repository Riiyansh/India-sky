"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import { useFlights, type Flight } from "@/hooks/useFlights";
import FlightPanel from "@/components/FlightPanel";
import StatsPanel from "@/components/StatsPanel";

const FlightMap = dynamic(() => import("@/components/FlightMap"), { ssr: false });

type Filter = "all" | "air" | "gnd";

export default function Home() {
  const { flights, status, lastUpdate, stats } = useFlights();
  const [selected, setSelected] = useState<Flight | null>(null);
  const [follow,   setFollow]   = useState(false);
  const [filter,   setFilter]   = useState<Filter>("all");
  const [showStats, setShowStats] = useState(false);
  const [search,   setSearch]   = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [clock,    setClock]    = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().slice(17, 25) + " UTC");
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const handleSelect = useCallback((f: Flight) => {
    setSelected(f);
    setFollow(false);
  }, []);

  const handleClose = () => { setSelected(null); setFollow(false); };

  const searchResults = search.length >= 1
    ? flights
        .filter(f =>
          f.callsign.toUpperCase().includes(search.toUpperCase()) ||
          f.icao24.toUpperCase().includes(search.toUpperCase())
        )
        .slice(0, 8)
    : [];

  const statusDot =
    status === "live"  ? "bg-green-500 shadow-[0_0_8px_#4caf50]" :
    status === "error" ? "bg-red-500" : "bg-orange-400 animate-pulse";

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-mono">

      {/* Map fills entire background */}
      <FlightMap
        flights={flights}
        onSelect={handleSelect}
        selectedIcao={selected?.icao24 ?? null}
        filter={filter}
        follow={follow}
      />

      {/* ── HUD Header ── */}
      <header
        className="absolute top-0 left-0 right-0 z-30 pointer-events-none"
        style={{ background: "linear-gradient(180deg,rgba(0,0,0,0.92) 0%,transparent 100%)" }}
      >
        <div className="flex items-center justify-between px-5 py-3 gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <div className="text-sm font-bold tracking-[4px] text-white" style={{ textShadow: "0 0 12px #4fc3f7" }}>
              INDIA SKY
            </div>
            <div className="text-[9px] tracking-[3px] text-sky-400 opacity-60">LIVE · OPENSKY NETWORK</div>
          </div>

          {/* Search — rendered outside header overflow so dropdown is never clipped */}
          <div className="flex-shrink-0 w-48" />

          {/* Stats */}
          <div className="flex gap-6">
            {([ ["TOTAL", stats.total], ["AIRBORNE", stats.airborne], ["GROUND", stats.ground] ] as const).map(([k, v]) => (
              <div key={k} className="text-center">
                <div className="text-2xl font-bold text-white leading-none tabular-nums" style={{ textShadow: "0 0 10px #4fc3f7" }}>
                  {v || "—"}
                </div>
                <div className="text-[8px] tracking-[2px] text-sky-400 opacity-60 mt-0.5">{k}</div>
              </div>
            ))}
          </div>

          {/* Right */}
          <div className="flex items-center gap-3 pointer-events-auto flex-shrink-0">
            <button
              onClick={() => setShowStats(s => !s)}
              className={`text-[9px] tracking-[2px] px-3 py-1 rounded border transition-all ${
                showStats
                  ? "border-sky-400 text-sky-300 bg-sky-400/10"
                  : "border-sky-900/40 text-sky-600 hover:border-sky-500 hover:text-sky-300"
              }`}
            >
              STATS
            </button>
            <span className="text-[10px] tracking-[2px] text-sky-400 opacity-60">{clock}</span>
            <div className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
          </div>
        </div>
      </header>

      {/* ── Search (outside header so dropdown never gets clipped) ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 w-52">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sky-500/40 text-xs pointer-events-none">⌕</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            placeholder="SEARCH CALLSIGN..."
            className="w-full bg-black/80 border border-sky-900/50 rounded-full text-white text-[10px] tracking-[1px] pl-7 pr-3 py-1.5 outline-none focus:border-sky-400 placeholder-sky-500/30 backdrop-blur"
          />
          {/* Dropdown — rendered in a portal-like div so z-index works */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-black/98 border border-sky-800/50 rounded-lg overflow-hidden shadow-2xl">
              {searchResults.map(f => (
                <button
                  key={f.icao24}
                  onMouseDown={e => {
                    e.preventDefault(); // prevent blur from firing first
                    handleSelect(f);
                    setSearch("");
                    setSearchOpen(false);
                  }}
                  className="w-full flex justify-between items-center px-3 py-2 hover:bg-sky-400/10 text-left border-b border-white/5 last:border-0"
                >
                  <span className="text-white text-[11px] font-bold tracking-wider">{f.callsign}</span>
                  <span className="text-sky-500/50 text-[9px]">
                    {f.altitude ? `${Math.round(f.altitude * 3.28084).toLocaleString()} ft` : "Ground"} · {f.country}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter pills ── */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {(["all", "air", "gnd"] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1 rounded-full border text-[10px] tracking-[2px] backdrop-blur transition-all ${
              filter === f
                ? "border-sky-400 text-white bg-sky-400/15 shadow-[0_0_12px_rgba(79,195,247,0.2)]"
                : "border-sky-900/30 text-sky-500/50 bg-black/60 hover:border-sky-600 hover:text-sky-300"
            }`}
          >
            {f === "all" ? "ALL" : f === "air" ? "AIRBORNE" : "GROUND"}
          </button>
        ))}
      </div>

      {/* ── Stats panel ── */}
      {showStats && <StatsPanel onClose={() => setShowStats(false)} />}

      {/* ── Flight detail panel — slides in from right ── */}
      <div
        className={`absolute inset-y-0 right-0 z-40 transition-transform duration-300 ease-out ${
          selected ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selected && (
          <FlightPanel
            flight={selected}
            follow={follow}
            onFollow={() => setFollow(f => !f)}
            onClose={handleClose}
          />
        )}
      </div>

      {/* ── Legend ── */}
      <div className="absolute bottom-6 left-4 z-30 flex flex-col gap-1.5 pointer-events-none">
        {([
          ["#ff6b6b", "< 5,000 ft"],
          ["#ffd93d", "5k – 20k ft"],
          ["#6bcb77", "20k – 35k ft"],
          ["#4fc3f7", "> 35,000 ft"],
          ["#555",    "On Ground"],
          ["#ffd166", "Airport"],
        ] as const).map(([color, label]) => (
          <div key={label} className="flex items-center gap-2 text-[9px] tracking-[1px] text-slate-500">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: color, boxShadow: color !== "#555" ? `0 0 4px ${color}` : "none" }}
            />
            {label}
          </div>
        ))}
      </div>

      {/* Last update */}
      {lastUpdate && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 text-[10px] tracking-[1px] text-sky-500/25 pointer-events-none">
          Last update: {lastUpdate.toLocaleTimeString()}
        </div>
      )}

      {/* CRT scanlines */}
      <div
        className="fixed inset-0 z-[9998] pointer-events-none"
        style={{ background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px)" }}
      />
    </div>
  );
}
