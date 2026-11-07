import React from "react";
import { ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import { ClientCommand, DawState } from "../types/protocol";

interface TrackStripProps {
  daw: DawState;
  sendCommand: (cmd: ClientCommand) => void;
}

export const TrackStrip: React.FC<TrackStripProps> = ({ daw, sendCommand }) => {
  return (
    <div className="rounded-2xl bg-slate-900/85 border border-slate-800 p-3 flex flex-col gap-2.5 no-select">
      {/* Track Selector Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => sendCommand({ type: "track", action: "prev" })}
          className="h-9 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1 text-xs font-medium active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
          前Trk
        </button>

        <div className="flex-1 min-w-0 text-center px-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            SELECTED TRACK
          </div>
          <div className="text-sm font-bold text-white truncate">
            {daw.trackName || "No Track Selected"}
          </div>
        </div>

        <button
          type="button"
          onClick={() => sendCommand({ type: "track", action: "next" })}
          className="h-9 px-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1 text-xs font-medium active:scale-95"
        >
          次Trk
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Arm / Monitor / Mute / Solo Buttons */}
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => sendCommand({ type: "track", action: "recEnable" })}
          className={`h-10 rounded-xl font-bold text-xs border transition active:scale-95 ${
            daw.trackRecEnable
              ? "bg-red-500 text-white border-red-300 shadow-[0_0_14px_rgba(239,68,68,0.45)]"
              : "bg-slate-950/70 text-slate-400 border-slate-800"
          }`}
        >
          REC待機
        </button>

        <button
          type="button"
          onClick={() => sendCommand({ type: "track", action: "monitor" })}
          className={`h-10 rounded-xl font-bold text-xs border transition active:scale-95 ${
            daw.trackMonitor
              ? "bg-amber-400 text-slate-950 border-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.4)]"
              : "bg-slate-950/70 text-slate-400 border-slate-800"
          }`}
        >
          MONITOR
        </button>

        <button
          type="button"
          onClick={() => sendCommand({ type: "track", action: "mute" })}
          className={`h-10 rounded-xl font-bold text-xs border transition active:scale-95 ${
            daw.trackMute
              ? "bg-orange-500 text-white border-orange-300"
              : "bg-slate-950/70 text-slate-400 border-slate-800"
          }`}
        >
          MUTE
        </button>

        <button
          type="button"
          onClick={() => sendCommand({ type: "track", action: "solo" })}
          className={`h-10 rounded-xl font-bold text-xs border transition active:scale-95 ${
            daw.trackSolo
              ? "bg-yellow-400 text-slate-950 border-yellow-200"
              : "bg-slate-950/70 text-slate-400 border-slate-800"
          }`}
        >
          SOLO
        </button>
      </div>

      {/* Volume Fader */}
      <div className="flex items-center gap-3 pt-0.5">
        <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="range"
          min={0}
          max={127}
          value={daw.trackVolCc}
          onChange={(e) =>
            sendCommand({
              type: "trackVolume",
              value: Number(e.target.value),
            })
          }
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
        <span className="font-mono text-xs text-cyan-300 w-16 text-right shrink-0">
          {daw.trackVolDb}
        </span>
      </div>
    </div>
  );
};
