import React, { useState } from "react";
import {
  Play,
  Square,
  Circle,
  Repeat,
  RotateCcw,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  FastForward,
  Rewind,
  Undo2,
  Redo2,
  Bell,
  Timer,
  PlusCircle,
  Lock,
  Crosshair,
} from "lucide-react";
import { ClientCommand, DawState } from "../types/protocol";

interface TransportPanelProps {
  mode: "live" | "rec";
  daw: DawState;
  safeLock: boolean;
  onGuardBlocked: (reason: string) => void;
  sendCommand: (cmd: ClientCommand) => void;
}

export const TransportPanel: React.FC<TransportPanelProps> = ({
  mode,
  daw,
  safeLock,
  onGuardBlocked,
  sendCommand,
}) => {
  const [jumpModalOpen, setJumpModalOpen] = useState(false);
  const [jumpInput, setJumpInput] = useState("");

  const isJumpLocked = mode === "live" && safeLock && daw.playing;

  const guardedTransport = (action: string) => {
    if (isJumpLocked) {
      onGuardBlocked("再生中セーフティロックが有効なため位置移動をブロックしました");
      return;
    }
    sendCommand({ type: "transport", action });
  };

  const guardedMarkerNav = (action: "prev" | "next" | "insert") => {
    if (isJumpLocked && action !== "insert") {
      onGuardBlocked("再生中セーフティロックが有効なためマーカー移動をブロックしました");
      return;
    }
    sendCommand({ type: "markerNav", action });
  };

  const openJumpModal = () => {
    if (isJumpLocked) {
      onGuardBlocked("再生中セーフティロックが有効です");
      return;
    }
    setJumpInput(daw.primaryTime);
    setJumpModalOpen(true);
  };

  const submitJump = (e: React.FormEvent) => {
    e.preventDefault();
    if (jumpInput.trim()) {
      sendCommand({ type: "jumpTime", time: jumpInput.trim() });
    }
    setJumpModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-3 no-select">
      {/* Digital Timecode & Position Counter */}
      <div
        onClick={openJumpModal}
        title="タップして指定位置へ直接ジャンプ"
        className={`relative overflow-hidden rounded-2xl border px-4 py-3 transition cursor-pointer active:scale-[0.99] ${
          daw.recording
            ? "bg-red-950/35 border-red-500/60 shadow-[0_0_25px_rgba(239,68,68,0.2)]"
            : daw.playing
              ? "bg-emerald-950/25 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
              : "bg-slate-900/90 border-slate-800"
        }`}
      >
        <div className="flex items-center justify-between text-[11px] font-medium tracking-wider uppercase text-slate-400 mb-1">
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                daw.recording
                  ? "bg-red-500 animate-ping"
                  : daw.playing
                    ? "bg-emerald-400"
                    : "bg-slate-500"
              }`}
            />
            {daw.recording
              ? "RECORDING"
              : daw.playing
                ? "PLAYING"
                : "STOPPED"}{" "}
            <span className="text-slate-600">|</span>{" "}
            <span>{daw.primaryFormat || "Bars+Beats"}</span>
          </span>
          <span className="flex items-center gap-1 text-cyan-400/80">
            <Crosshair className="w-3 h-3" />
            位置指定
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <div
            className={`font-mono font-bold tracking-tight leading-none ${
              mode === "live"
                ? "text-4xl sm:text-5xl text-white"
                : "text-3xl sm:text-4xl text-white"
            }`}
          >
            {daw.primaryTime}
          </div>
          <div className="font-mono text-sm sm:text-base text-slate-400 shrink-0">
            {daw.secondaryTime}
          </div>
        </div>

        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>
            LOOP L:{" "}
            <strong className="text-slate-200">{daw.leftLocator}</strong>
          </span>
          <span>
            R: <strong className="text-slate-200">{daw.rightLocator}</strong>
          </span>
        </div>
      </div>

      {/* Primary Transport Buttons */}
      {mode === "live" ? (
        /* ================= LIVE MODE TRANSPORT ================= */
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-12 gap-2.5">
            {/* Giant PLAY Button */}
            <button
              type="button"
              onClick={() => sendCommand({ type: "transport", action: "play" })}
              className={`col-span-5 h-20 rounded-2xl font-bold text-lg flex flex-col items-center justify-center gap-1 border transition active:scale-95 ${
                daw.playing
                  ? "bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.55)]"
                  : "bg-slate-800/90 text-emerald-400 border-slate-700 hover:bg-slate-800"
              }`}
            >
              <Play className="w-7 h-7 fill-current" />
              <span className="text-xs tracking-widest">PLAY</span>
            </button>

            {/* Giant STOP Button */}
            <button
              type="button"
              onClick={() => sendCommand({ type: "transport", action: "stop" })}
              className={`col-span-5 h-20 rounded-2xl font-bold text-lg flex flex-col items-center justify-center gap-1 border transition active:scale-95 ${
                daw.stopped && !daw.playing
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/60"
                  : "bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-800"
              }`}
            >
              <Square className="w-7 h-7 fill-current" />
              <span className="text-xs tracking-widest">STOP</span>
            </button>

            {/* Cycle Toggle */}
            <button
              type="button"
              onClick={() =>
                sendCommand({ type: "transport", action: "cycle" })
              }
              className={`col-span-2 h-20 rounded-2xl font-semibold flex flex-col items-center justify-center gap-1 border transition active:scale-95 ${
                daw.cycle
                  ? "bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.45)]"
                  : "bg-slate-800/90 text-slate-300 border-slate-700"
              }`}
            >
              <Repeat className="w-6 h-6" />
              <span className="text-[10px] tracking-wider">LOOP</span>
            </button>
          </div>

          {/* Live Safe Navigation Bar */}
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => guardedTransport("rtz")}
              className="h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 flex items-center justify-center gap-1 text-xs font-medium active:scale-95 relative"
            >
              {isJumpLocked && (
                <Lock className="w-3 h-3 text-amber-400 absolute top-1 right-1" />
              )}
              <SkipBack className="w-4 h-4" />
              曲頭
            </button>
            <button
              type="button"
              onClick={() => guardedMarkerNav("prev")}
              className="h-12 rounded-xl bg-slate-900 border border-slate-800 text-cyan-300 flex items-center justify-center gap-1 text-xs font-semibold active:scale-95 relative"
            >
              {isJumpLocked && (
                <Lock className="w-3 h-3 text-amber-400 absolute top-1 right-1" />
              )}
              <ChevronLeft className="w-4 h-4" />
              前Mkr
            </button>
            <button
              type="button"
              onClick={() => guardedMarkerNav("next")}
              className="h-12 rounded-xl bg-slate-900 border border-slate-800 text-cyan-300 flex items-center justify-center gap-1 text-xs font-semibold active:scale-95 relative"
            >
              {isJumpLocked && (
                <Lock className="w-3 h-3 text-amber-400 absolute top-1 right-1" />
              )}
              次Mkr
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => guardedTransport("barBack")}
              className="h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-center text-xs font-mono active:scale-95 relative"
            >
              {isJumpLocked && (
                <Lock className="w-3 h-3 text-amber-400 absolute top-1 right-1" />
              )}
              -1 Bar
            </button>
            <button
              type="button"
              onClick={() => guardedTransport("barForward")}
              className="h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-center text-xs font-mono active:scale-95 relative"
            >
              {isJumpLocked && (
                <Lock className="w-3 h-3 text-amber-400 absolute top-1 right-1" />
              )}
              +1 Bar
            </button>
          </div>
        </div>
      ) : (
        /* ================= STUDIO REC MODE TRANSPORT ================= */
        <div className="flex flex-col gap-2.5">
          {/* Main Row: PLAY / STOP / REC / 1-TAP RETAKE */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => sendCommand({ type: "transport", action: "play" })}
              className={`h-16 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 border transition active:scale-95 ${
                daw.playing && !daw.recording
                  ? "bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                  : "bg-slate-800/90 text-emerald-400 border-slate-700"
              }`}
            >
              <Play className="w-6 h-6 fill-current" />
              <span className="text-[11px]">PLAY</span>
            </button>

            <button
              type="button"
              onClick={() => sendCommand({ type: "transport", action: "stop" })}
              className={`h-16 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 border transition active:scale-95 ${
                daw.stopped && !daw.playing
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/60"
                  : "bg-slate-800/90 text-slate-200 border-slate-700"
              }`}
            >
              <Square className="w-6 h-6 fill-current" />
              <span className="text-[11px]">STOP</span>
            </button>

            <button
              type="button"
              onClick={() =>
                sendCommand({ type: "transport", action: "record" })
              }
              className={`h-16 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 border transition active:scale-95 ${
                daw.recording
                  ? "bg-red-500 text-white border-red-300 shadow-[0_0_24px_rgba(239,68,68,0.65)] animate-pulse"
                  : "bg-slate-800/90 text-red-400 border-slate-700"
              }`}
            >
              <Circle className="w-6 h-6 fill-current" />
              <span className="text-[11px]">REC</span>
            </button>

            {/* 1-Tap Retake Macro Button */}
            <button
              type="button"
              onClick={() =>
                sendCommand({ type: "transport", action: "retake" })
              }
              title="停止 → 直前テイクUndo → 開始位置へ戻って再録音"
              className="h-16 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 border bg-gradient-to-br from-orange-500/25 to-rose-600/25 border-orange-500/50 text-orange-200 hover:border-orange-400 transition active:scale-95"
            >
              <RotateCcw className="w-6 h-6 text-orange-400" />
              <span className="text-[11px]">リテイク</span>
            </button>
          </div>

          {/* Recording Helpers Row: Cycle, Click, Precount, Undo, Redo */}
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() =>
                sendCommand({ type: "transport", action: "cycle" })
              }
              className={`h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition active:scale-95 ${
                daw.cycle
                  ? "bg-cyan-500 text-slate-950 border-cyan-300"
                  : "bg-slate-900 text-slate-300 border-slate-800"
              }`}
            >
              <Repeat className="w-4 h-4" />
              Loop
            </button>

            <button
              type="button"
              onClick={() =>
                sendCommand({ type: "transport", action: "metronome" })
              }
              className={`h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition active:scale-95 ${
                daw.metronome
                  ? "bg-teal-400 text-slate-950 border-teal-200"
                  : "bg-slate-900 text-slate-300 border-slate-800"
              }`}
            >
              <Bell className="w-4 h-4" />
              Click
            </button>

            <button
              type="button"
              onClick={() =>
                sendCommand({ type: "transport", action: "precount" })
              }
              className="h-11 rounded-xl text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800 flex items-center justify-center gap-1 active:scale-95"
            >
              <Timer className="w-4 h-4 text-slate-400" />
              PreCnt
            </button>

            <button
              type="button"
              onClick={() => sendCommand({ type: "transport", action: "undo" })}
              className="h-11 rounded-xl text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800 flex items-center justify-center gap-1 active:scale-95"
            >
              <Undo2 className="w-4 h-4" />
              Undo
            </button>

            <button
              type="button"
              onClick={() => sendCommand({ type: "transport", action: "redo" })}
              className="h-11 rounded-xl text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800 flex items-center justify-center gap-1 active:scale-95"
            >
              <Redo2 className="w-4 h-4" />
              Redo
            </button>
          </div>

          {/* Cursor & Locator & Marker Insert Row */}
          <div className="grid grid-cols-6 gap-1.5">
            <button
              type="button"
              onClick={() => sendCommand({ type: "transport", action: "rtz" })}
              className="h-10 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center justify-center gap-1 text-[11px] active:scale-95"
            >
              <SkipBack className="w-3.5 h-3.5" />
              曲頭
            </button>

            <button
              type="button"
              onPointerDown={() =>
                sendCommand({
                  type: "holdTransport",
                  action: "rewind",
                  pressed: true,
                })
              }
              onPointerUp={() =>
                sendCommand({
                  type: "holdTransport",
                  action: "rewind",
                  pressed: false,
                })
              }
              onPointerLeave={() =>
                sendCommand({
                  type: "holdTransport",
                  action: "rewind",
                  pressed: false,
                })
              }
              className="h-10 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center justify-center active:bg-slate-800"
            >
              <Rewind className="w-4 h-4" />
            </button>

            <button
              type="button"
              onPointerDown={() =>
                sendCommand({
                  type: "holdTransport",
                  action: "forward",
                  pressed: true,
                })
              }
              onPointerUp={() =>
                sendCommand({
                  type: "holdTransport",
                  action: "forward",
                  pressed: false,
                })
              }
              onPointerLeave={() =>
                sendCommand({
                  type: "holdTransport",
                  action: "forward",
                  pressed: false,
                })
              }
              className="h-10 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 flex items-center justify-center active:bg-slate-800"
            >
              <FastForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                sendCommand({ type: "transport", action: "setLeftLocator" })
              }
              className="h-10 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 text-[11px] font-mono active:scale-95"
            >
              Set L
            </button>

            <button
              type="button"
              onClick={() =>
                sendCommand({ type: "transport", action: "setRightLocator" })
              }
              className="h-10 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 text-[11px] font-mono active:scale-95"
            >
              Set R
            </button>

            <button
              type="button"
              onClick={() => sendCommand({ type: "markerNav", action: "insert" })}
              className="h-10 rounded-xl bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 flex items-center justify-center gap-1 text-[11px] font-semibold active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Mkr追加
            </button>
          </div>
        </div>
      )}

      {/* Direct Time Jump Modal */}
      {jumpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={submitJump}
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white mb-1">
              指定位置へダイレクトジャンプ
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              小節.拍（例: <code className="text-cyan-300">17.1.1.0</code>
              ）またはタイムコードを入力してください
            </p>
            <input
              type="text"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              autoFocus
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 font-mono text-lg text-white focus:outline-none focus:border-cyan-400"
              placeholder="17.1.1.0"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setJumpModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-sm font-bold"
              >
                ジャンプ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
