"use client";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ALT_COLORS: Record<string, string> = {
  low:    "#ff6b6b",
  mid:    "#ffd93d",
  high:   "#6bcb77",
  cruise: "#4fc3f7",
};

export default function StatsPanel({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(console.error);
    const t = setInterval(() => {
      fetch(`${API}/api/stats`).then(r => r.json()).then(setStats).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="absolute top-16 right-4 z-50 w-72 bg-black/90 border border-sky-900/40 rounded-xl overflow-hidden backdrop-blur-xl">
      <div className="h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent" />
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs tracking-[3px] text-sky-400 opacity-70">LIVE STATS</span>
          <button onClick={onClose} className="text-sky-700 hover:text-white text-xs px-2">✕</button>
        </div>

        {!stats ? (
          <p className="text-sky-600 text-xs text-center py-4">Loading…</p>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-[9px] tracking-[2px] text-sky-500/50 mb-2">LAST HOUR</p>
              <p className="text-3xl font-bold text-white" style={{ textShadow: "0 0 10px #4fc3f7" }}>
                {stats.total_last_hour?.toLocaleString() || "—"}
                <span className="text-xs text-sky-400 ml-2 tracking-widest">FLIGHTS</span>
              </p>
            </div>

            {/* Altitude distribution pie */}
            {stats.altitude_dist?.length > 0 && (
              <div className="mb-4">
                <p className="text-[9px] tracking-[2px] text-sky-500/50 mb-2">ALTITUDE DISTRIBUTION</p>
                <div className="flex items-center gap-3">
                  <PieChart width={90} height={90}>
                    <Pie data={stats.altitude_dist} dataKey="cnt" nameKey="band" cx="50%" cy="50%" outerRadius={40} innerRadius={20}>
                      {stats.altitude_dist.map((d: any) => (
                        <Cell key={d.band} fill={ALT_COLORS[d.band] || "#888"} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="flex flex-col gap-1">
                    {stats.altitude_dist.map((d: any) => (
                      <div key={d.band} className="flex items-center gap-1.5 text-[9px]">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ALT_COLORS[d.band] }} />
                        <span className="text-slate-400 capitalize">{d.band}</span>
                        <span className="text-white ml-auto">{d.cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top countries bar chart */}
            {stats.by_country?.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[2px] text-sky-500/50 mb-2">TOP COUNTRIES</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={stats.by_country.slice(0, 6)} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="country" tick={{ fill: "#64748b", fontSize: 9 }} width={36} />
                    <Tooltip
                      contentStyle={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 6, fontSize: 11 }}
                      labelStyle={{ color: "#4fc3f7" }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Bar dataKey="cnt" fill="#4fc3f7" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
