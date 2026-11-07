import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ClientCommand,
  DawState,
  DEFAULT_DAW_STATE,
  DEFAULT_SETLIST,
  HostInfoResponse,
  ServerEvent,
  SetlistStore,
} from "../types/protocol";

export function isTauriDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export async function resolveApiBaseUrl(): Promise<string> {
  if (isTauriDesktop()) {
    try {
      const info = await invoke<HostInfoResponse>("get_host_info_cmd");
      return `http://127.0.0.1:${info.port}`;
    } catch {
      return "http://127.0.0.1:3840";
    }
  }

  // In Vite dev mode (port 1420), backend axum runs on 3840
  if (window.location.port === "1420") {
    return `http://${window.location.hostname}:3840`;
  }

  // Served directly from axum on mobile/iPad/LAN browser
  return window.location.origin;
}

export function useRemoteSocket() {
  const [wsConnected, setWsConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [daw, setDaw] = useState<DawState>(DEFAULT_DAW_STATE);
  const [setlist, setSetlist] = useState<SetlistStore>(DEFAULT_SETLIST);
  const wsRef = useRef<WebSocket | null>(null);

  const sendCommand = useCallback((cmd: ClientCommand) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(cmd));
    }
  }, []);

  useEffect(() => {
    let unmounted = false;
    let reconnectTimer: number | undefined;
    let pingInterval: number | undefined;

    async function connect() {
      if (unmounted) return;
      const baseHttp = await resolveApiBaseUrl();
      if (unmounted) return;

      const wsUrl = baseHttp.replace(/^http/, "ws") + "/ws";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setWsConnected(true);
        ws.send(JSON.stringify({ type: "ping", clientTs: Date.now() }));

        pingInterval = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping", clientTs: Date.now() }));
          }
        }, 2500);
      };

      ws.onmessage = (ev) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(ev.data) as ServerEvent;
          switch (msg.type) {
            case "fullSync":
              setDaw(msg.daw);
              setSetlist(msg.setlist);
              break;
            case "dawUpdate":
              setDaw(msg.daw);
              break;
            case "timeUpdate":
              setDaw((prev) => ({
                ...prev,
                primaryTime: msg.primaryTime,
                primaryFormat: msg.primaryFormat,
                secondaryTime: msg.secondaryTime,
                leftLocator: msg.leftLocator,
                rightLocator: msg.rightLocator,
              }));
              break;
            case "setlistUpdate":
              setSetlist(msg.setlist);
              break;
            case "pong": {
              const rtt = Math.max(0, Date.now() - msg.clientTs);
              setLatencyMs(rtt);
              break;
            }
          }
        } catch {
          // Ignore malformed payloads
        }
      };

      ws.onclose = () => {
        if (pingInterval) window.clearInterval(pingInterval);
        if (unmounted) return;
        setWsConnected(false);
        setLatencyMs(null);
        reconnectTimer = window.setTimeout(connect, 1200);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (pingInterval) window.clearInterval(pingInterval);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    wsConnected,
    latencyMs,
    daw,
    setlist,
    sendCommand,
  };
}
