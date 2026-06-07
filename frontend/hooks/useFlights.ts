"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export interface Flight {
  icao24: string;
  callsign: string;
  country: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  on_ground: boolean;
  speed: number | null;
  heading: number | null;
  vrate: number | null;
}

type Status = "connecting" | "live" | "error";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/flights";

export function useFlights() {
  const [flights, setFlights]   = useState<Flight[]>([]);
  const [status, setStatus]     = useState<Status>("connecting");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "flights") {
        setFlights(msg.data);
        setStatus("live");
        setLastUpdate(new Date());
      }
    };

    ws.onclose = () => {
      setStatus("error");
      retryRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const stats = {
    total:    flights.length,
    airborne: flights.filter(f => !f.on_ground).length,
    ground:   flights.filter(f => f.on_ground).length,
  };

  return { flights, status, lastUpdate, stats };
}
