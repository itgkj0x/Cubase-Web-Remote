import React, { useCallback, useState } from "react";
import {
  Mic,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Wifi,
  WifiOff,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { ClientCommand, DawState, SetlistStore } from "../types/protocol";
import { useWakeLock } from "../hooks/useWakeLock";
import { TransportPanel } from "./TransportPanel";
import { MarkerGrid } from "./MarkerGrid";
import { TrackStrip } from "./TrackStrip";

interface RemoteControllerProps {
  wsConnected: boolean;
  latencyMs: number | null;
  daw: DawState;
  setlist: SetlistStore;
  sendCommand: (cmd: ClientCommand) => void;
  showBackToHost?: boolean;
  onBackToHost?: () => void;
}

export const RemoteController: React.FC<RemoteControllerProps> = ({
  wsConnected,
  latencyMs,
  daw,
  setlist,
  sendCommand,
  showBackToHost,
  onBackToHost,
}) => {
  const [mode, setMode] = useState<"live" | "rec">("live");
  const [safeLock, setSafeLock] = useState<boolean>(true);
  const [guardToast, setGuardToast] = useState<string | null>(null);
  const { supported: wakeSupported, active: wakeActive, toggleWakeLock } =
    useWakeLock(true);

  const triggerGuardNotice = useCallback((reason: string) => {
    setGuardToast(reason);
    window.setTimeout(() => {
      setGuardToast((curr) => (curr === reason ? null : curr));
    }, 2000);
  }, []);

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 flex flex-col">
      {/* Top Status & Mode Bar */}
      <header className="sticky top-0 z-30 bg-[#090b10]/95 backdrop-blur-md border-b border-slate-800/90 px-3 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Left: LIVE / REC Mode Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode("live")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                mode === "live"
                  ? "bg-cyan-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              LIVE 同期
            </button>
            <button
              type="button"
              onClick={() => setMode("rec")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                mode === "rec"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              REC 宅録
            </button>
          </div>

          {/* Right: Safety Lock, WakeLock, Connection Status, Host Switch */}
          <div className="flex items-center gap-1.5">
            {mode === "live" && (
              <button
                type="button"
                onClick={() => setSafeLock((prev) => !prev)}
                title="ONのとき再生中の誤ジャンプを防止します"
                className={`h-8 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition active:scale-95 ${
                  safeLock
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                {safeLock ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className="hidden sm:inline">再生中保護</span>
                <span>{safeLock ? "ON" : "OFF"}</span>
              </button>
            )}

            {wakeSupported && (
              <button
                type="button"
                onClick={toggleWakeLock}
                title="画面スリープ防止 (Wake Lock)"
                className={`h-8 px-2 rounded-xl border text-xs flex items-center gap-1 ${
                  wakeActive
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-900 border-slate-800 text-slate-500"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => sendCommand({ type: "transport", action: "sync" })}
              title="Cubaseの状態を再同期"
              className="h-8 px-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Network & MIDI Link Badge */}
            <div
              className={`h-8 px-2.5 rounded-xl border text-[11px] font-mono font-semibold flex items-center gap-1.5 ${
                !wsConnected
                  ? "bg-red-950/80 border-red-500 text-red-200 animate-pulse"
                  : !daw.midiConnected
                    ? "bg-amber-950/60 border-amber-600/60 text-amber-300"
                    : "bg-emerald-950/50 border-emerald-600/50 text-emerald-300"
              }`}
            >
              {wsConnected ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              <span>
                {!wsConnected
                  ? "切断"
                  : !daw.midiConnected
                    ? "MIDI未接続"
                    : latencyMs !== null
                      ? `${latencyMs}ms`
                      : "OK"}
              </span>
            </div>

            {showBackToHost && onBackToHost && (
              <button
                type="button"
                onClick={onBackToHost}
                className="h-8 px-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1 hover:bg-cyan-500/25"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PC管理・QR</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Safety Lock Guard Toast */}
      {guardToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold shadow-xl flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{guardToast}</span>
        </div>
      )}

      {/* Disconnected Warning Banner for Stage Reliability */}
      {!wsConnected && (
        <div className="bg-red-600/90 text-white text-xs font-bold text-center py-1.5 px-3">
          PCサーバーとのWi-Fi通信が切断されました。自動再接続を試みています...
        </div>
      )}

      {/* Main Responsive Workspace: 1-col on Phone Portrait, 2-pane Console on iPad Landscape */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 lg:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Transport + Selected Track Strip */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <TransportPanel
            mode={mode}
            daw={daw}
            safeLock={safeLock}
            onGuardBlocked={triggerGuardNotice}
            sendCommand={sendCommand}
          />

          {mode === "rec" && (
            <TrackStrip daw={daw} sendCommand={sendCommand} />
          )}
        </section>

        {/* Right Column: Setlist + 16 Marker Pads */}
        <section className="lg:col-span-7">
          <MarkerGrid
            mode={mode}
            daw={daw}
            setlist={setlist}
            safeLock={safeLock}
            onGuardBlocked={triggerGuardNotice}
            sendCommand={sendCommand}
          />
        </section>
      </main>
    </div>
  );
};
