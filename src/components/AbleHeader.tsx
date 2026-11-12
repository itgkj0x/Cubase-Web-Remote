import React, { useMemo } from "react";
import {
  Play,
  Square,
  Circle,
  Radio,
  ListMusic,
  Sliders,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Sun,
  RefreshCw,
  Wifi,
  WifiOff,
  QrCode,
  Lock,
} from "lucide-react";
import { ClientCommand, DawState } from "../types/protocol";

export type AbleViewTab = "performance" | "setlist" | "mixer" | "lyrics";

interface AbleHeaderProps {
  currentTab: AbleViewTab;
  onSelectTab: (tab: AbleViewTab) => void;
  daw: DawState;
  currentBpm?: string;
  wsConnected: boolean;
  latencyMs: number | null;
  safeLock: boolean;
  onToggleSafeLock: () => void;
  wakeSupported: boolean;
  wakeActive: boolean;
  onToggleWakeLock: () => void;
  sendCommand: (cmd: ClientCommand) => void;
  showBackToHost?: boolean;
  onBackToHost?: () => void;
}

export const AbleHeader: React.FC<AbleHeaderProps> = ({
  currentTab,
  onSelectTab,
  daw,
  currentBpm = "120",
  wsConnected,
  latencyMs,
  safeLock,
  onToggleSafeLock,
  wakeSupported,
  wakeActive,
  onToggleWakeLock,
  sendCommand,
  showBackToHost,
  onBackToHost,
}) => {
  // Parse Bars+Beats (e.g., "12. 3. 1. 0" or "12.3.1.0")
  const parsedTime = useMemo(() => {
    const raw = daw.primaryTime.replace(/\s+/g, "");
    const parts = raw.split(".");
    const bar = parts[0] || "1";
    const beat = parts[1] || "1";
    const div = parts[2] || "1";
    const beatNum = parseInt(beat, 10) || 1;
    return { bar, beat, div, beatNum };
  }, [daw.primaryTime]);

  return (
    <header className="sticky top-0 z-40 bg-[#0b0e14]/95 backdrop-blur-md border-b border-slate-800/90 safe-top no-select">
      <div className="max-w-[1600px] mx-auto px-3 py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Left: Brand + Navigation Tabs */}
        <div className="flex items-center justify-between md:justify-start gap-2 sm:gap-3">
          {/* Brand Logo / Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800">
            <span className="font-black text-sm tracking-tighter bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              ABLE
            </span>
            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
              SET 3
            </span>
          </div>

          {/* 4 View Switcher Tabs */}
          <nav className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => onSelectTab("performance")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                currentTab === "performance"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">PERFORMANCE</span>
              <span className="xs:hidden">LIVE</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("setlist")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                currentTab === "setlist"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ListMusic className="w-3.5 h-3.5 shrink-0" />
              <span>SETLIST</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("mixer")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                currentTab === "mixer"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>MIXER</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab("lyrics")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                currentTab === "lyrics"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>LYRICS</span>
            </button>
          </nav>
        </div>

        {/* Center: Stage Large Timecode & Beat Pulse Indicator */}
        <div className="flex items-center justify-center gap-3 py-0.5 px-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 shadow-inner">
          {/* Bars / Beats Readout */}
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {parsedTime.bar.padStart(3, "0")}
            </span>
            <span className="text-xs text-slate-500 font-bold">:</span>
            <span className="text-lg sm:text-xl font-bold text-cyan-400">
              {parsedTime.beat}
            </span>
            <span className="text-xs text-slate-500 font-bold">:</span>
            <span className="text-sm font-semibold text-slate-400">
              {parsedTime.div}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Timecode / Secondary Time */}
          <div className="hidden sm:flex flex-col text-left font-mono">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 leading-none">
              TIMECODE
            </span>
            <span className="text-xs font-semibold text-slate-300 mt-0.5">
              {daw.secondaryTime || "00:00:00:00"}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* BPM & Beat Indicator (1, 2, 3, 4) */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col text-left font-mono">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 leading-none">
                BPM
              </span>
              <span className="text-xs font-bold text-amber-300 mt-0.5">
                {currentBpm || "120"}
              </span>
            </div>

            {/* 4 Beat Lamps */}
            <div className="flex items-center gap-1 pl-1">
              {[1, 2, 3, 4].map((b) => {
                const isActive = daw.playing && parsedTime.beatNum === b;
                const isDownbeat = b === 1;
                return (
                  <div
                    key={b}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-75 ${
                      isActive
                        ? isDownbeat
                          ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] scale-125"
                          : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] scale-110"
                        : "bg-slate-800 border border-slate-700/60"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Stage Controls, Safety Lock, Wake Lock & Status */}
        <div className="flex items-center justify-between md:justify-end gap-1.5 sm:gap-2">
          {/* Global Big Transport: Play / Stop */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            {daw.playing ? (
              <button
                type="button"
                onClick={() => sendCommand({ type: "transport", action: "stop" })}
                title="Stop (Space)"
                className="h-9 px-3.5 sm:px-4 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 transition shadow-lg shadow-red-600/30"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>STOP</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => sendCommand({ type: "transport", action: "play" })}
                title="Play (Space)"
                className="h-9 px-3.5 sm:px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/30"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>PLAY</span>
              </button>
            )}

            {/* Rec Button for Instant Retakes */}
            <button
              type="button"
              onClick={() => sendCommand({ type: "transport", action: "record" })}
              title="Record"
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition active:scale-95 ${
                daw.recording
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-slate-800 text-slate-400 hover:text-red-400"
              }`}
            >
              <Circle className={`w-3.5 h-3.5 ${daw.recording ? "fill-white" : ""}`} />
            </button>
          </div>

          {/* Stage Safety Lock */}
          <button
            type="button"
            onClick={onToggleSafeLock}
            title={safeLock ? "安全ロックON: 演奏中の誤ジャンプを防止" : "安全ロックOFF"}
            className={`h-9 px-2 sm:px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition active:scale-95 ${
              safeLock
                ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
            }`}
          >
            {safeLock ? (
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span className="hidden xl:inline">LOCK</span>
          </button>

          {/* Screen Wake Lock */}
          {wakeSupported && (
            <button
              type="button"
              onClick={onToggleWakeLock}
              title="画面スリープ防止 (Wake Lock)"
              className={`h-9 w-9 rounded-xl border flex items-center justify-center transition active:scale-95 ${
                wakeActive
                  ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                  : "bg-slate-900 border-slate-800 text-slate-500"
              }`}
            >
              <Sun className="w-4 h-4" />
            </button>
          )}

          {/* Refresh / Re-Sync */}
          <button
            type="button"
            onClick={() => sendCommand({ type: "transport", action: "sync" })}
            title="Cubase状態を再取得"
            className="h-9 w-9 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Link Status Badge */}
          <div
            className={`h-9 px-2.5 rounded-xl border text-[11px] font-mono font-semibold flex items-center gap-1.5 ${
              !wsConnected
                ? "bg-red-950/80 border-red-500 text-red-200 animate-pulse"
                : !daw.midiConnected
                  ? "bg-amber-950/60 border-amber-600/60 text-amber-300"
                  : "bg-emerald-950/50 border-emerald-600/50 text-emerald-300"
            }`}
          >
            {wsConnected ? <Wifi className="w-3.5 h-3.5 shrink-0" /> : <WifiOff className="w-3.5 h-3.5 shrink-0" />}
            <span className="hidden xs:inline">
              {!wsConnected ? "切断" : !daw.midiConnected ? "MIDI待機" : latencyMs !== null ? `${latencyMs}ms` : "OK"}
            </span>
          </div>

          {/* Back to Host / QR Code Modal Switcher */}
          {showBackToHost && onBackToHost && (
            <button
              type="button"
              onClick={onBackToHost}
              className="h-9 px-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1 hover:bg-cyan-500/25 active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden xl:inline">QR</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
