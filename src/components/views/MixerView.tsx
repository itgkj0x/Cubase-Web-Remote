import React, { useState } from "react";
import {
  Sliders,
  Volume2,
  VolumeX,
  Mic,
  Headphones,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sparkles,
} from "lucide-react";
import { ClientCommand, DawState } from "../../types/protocol";

interface MixerViewProps {
  daw: DawState;
  sendCommand: (cmd: ClientCommand) => void;
}

// Preset stage stem channels for quick visual balancing
interface StemChannel {
  id: string;
  name: string;
  category: "click" | "guide" | "drums" | "bass" | "music" | "vocals";
  color: string;
  volume: number; // 0..127
  muted: boolean;
  soloed: boolean;
}

const DEFAULT_STEMS: StemChannel[] = [
  { id: "stem-1", name: "CLICK", category: "click", color: "amber", volume: 108, muted: false, soloed: false },
  { id: "stem-2", name: "GUIDE / CUE", category: "guide", color: "cyan", volume: 100, muted: false, soloed: false },
  { id: "stem-3", name: "DRUMS / PERC", category: "drums", color: "rose", volume: 104, muted: false, soloed: false },
  { id: "stem-4", name: "BASS / SYNTH", category: "bass", color: "violet", volume: 100, muted: false, soloed: false },
  { id: "stem-5", name: "GUITARS / KEYS", category: "music", color: "blue", volume: 96, muted: false, soloed: false },
  { id: "stem-6", name: "BACKING VOX", category: "vocals", color: "emerald", volume: 100, muted: false, soloed: false },
];

export const MixerView: React.FC<MixerViewProps> = ({ daw, sendCommand }) => {
  const [stems, setStems] = useState<StemChannel[]>(DEFAULT_STEMS);

  const updateStemVolume = (id: string, val: number) => {
    setStems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, volume: val } : s))
    );
  };

  const toggleStemMute = (id: string) => {
    setStems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, muted: !s.muted } : s))
    );
  };

  const toggleStemSolo = (id: string) => {
    setStems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, soloed: !s.soloed } : s))
    );
  };

  return (
    <div className="flex-1 w-full max-w-[1400px] mx-auto p-3 sm:p-4 lg:p-6 flex flex-col gap-5 no-select">
      {/* Top Header: Mixer Overview */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            STAGE REMOTE MIXER
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cubase 選択トラックの直接操作 ＆ ステージ用ステムバランス調整
          </p>
        </div>

        {/* Global Click / Metronome Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => sendCommand({ type: "transport", action: "metronome" })}
            className={`h-9 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
              daw.metronome
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>CLICK: {daw.metronome ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: CUBASE SELECTED TRACK (HARDWARE DIRECT LINK)
         ========================================================================= */}
      <section className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-cyan-500/40 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            CUBASE SELECTED TRACK (双方向連動)
          </span>

          {/* Prev / Next Track Selectors */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => sendCommand({ type: "track", action: "prev" })}
              title="前のトラックを選択"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white active:scale-95 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-500 px-1">
              TRACK
            </span>
            <button
              type="button"
              onClick={() => sendCommand({ type: "track", action: "next" })}
              title="次のトラックを選択"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white active:scale-95 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Track Info & Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Left: Track Name & Volume dB Display */}
          <div className="md:col-span-5 flex flex-col gap-1">
            <h3 className="text-xl sm:text-2xl font-black text-white truncate">
              {daw.trackName || "No Track Selected"}
            </h3>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-cyan-400 font-bold text-sm">
                {daw.trackVolDb || "0.0 dB"}
              </span>
              <span className="text-slate-500">
                (CC: {daw.trackVolCc})
              </span>
            </div>
          </div>

          {/* Center: Large Volume Slider */}
          <div className="md:col-span-4 flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-slate-500 shrink-0" />
            <input
              type="range"
              min={0}
              max={127}
              value={daw.trackVolCc}
              onChange={(e) =>
                sendCommand({
                  type: "trackVolume",
                  value: parseInt(e.target.value, 10),
                })
              }
              className="w-full h-3 rounded-lg bg-slate-950 accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Right: Mute, Solo, Rec, Monitor Buttons */}
          <div className="md:col-span-3 flex items-center justify-start md:justify-end gap-2">
            {/* Mute */}
            <button
              type="button"
              onClick={() => sendCommand({ type: "track", action: "mute" })}
              className={`h-10 px-3 rounded-xl border text-xs font-black transition active:scale-95 ${
                daw.trackMute
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
            >
              MUTE
            </button>

            {/* Solo */}
            <button
              type="button"
              onClick={() => sendCommand({ type: "track", action: "solo" })}
              className={`h-10 px-3 rounded-xl border text-xs font-black transition active:scale-95 ${
                daw.trackSolo
                  ? "bg-yellow-400 text-slate-950 border-yellow-300 shadow-md shadow-yellow-400/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
            >
              SOLO
            </button>

            {/* Rec Enable */}
            <button
              type="button"
              onClick={() => sendCommand({ type: "track", action: "recEnable" })}
              className={`h-10 px-3 rounded-xl border text-xs font-black transition active:scale-95 flex items-center gap-1 ${
                daw.trackRecEnable
                  ? "bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30 animate-pulse"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-red-400"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>REC</span>
            </button>

            {/* Monitor */}
            <button
              type="button"
              onClick={() => sendCommand({ type: "track", action: "monitor" })}
              className={`h-10 px-3 rounded-xl border text-xs font-black transition active:scale-95 flex items-center gap-1 ${
                daw.trackMonitor
                  ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/30"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-400"
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: STAGE STEM BALANCER (6-CHANNEL CONSOLE)
         ========================================================================= */}
      <section className="flex flex-col gap-3">
        <span className="text-xs font-black tracking-wider text-slate-400 uppercase px-1">
          STAGE STEM CHANNELS (ステージ用バランス調整)
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stems.map((stem) => {
            const isPlaying = daw.playing && !stem.muted;
            // Simulated meter level for stage visual feedback
            const meterHeight = isPlaying
              ? Math.min(100, Math.max(15, Math.round((stem.volume / 127) * 90) + (stem.volume % 15)))
              : 0;

            return (
              <div
                key={stem.id}
                className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between gap-3 shadow-md"
              >
                {/* Channel Header */}
                <div className="flex flex-col text-center">
                  <span className="text-[11px] font-black tracking-tight text-white truncate">
                    {stem.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase mt-0.5">
                    {stem.category}
                  </span>
                </div>

                {/* Vertical Fader & Meter Visualizer */}
                <div className="flex items-center justify-center gap-3 py-2 h-36">
                  {/* Fader Slider (rotated vertically) */}
                  <input
                    type="range"
                    min={0}
                    max={127}
                    value={stem.volume}
                    onChange={(e) =>
                      updateStemVolume(stem.id, parseInt(e.target.value, 10))
                    }
                    className="w-28 h-2 rounded-lg bg-slate-950 accent-cyan-400 -rotate-90 cursor-pointer"
                  />

                  {/* Level Meter Bar */}
                  <div className="w-2 h-28 rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative flex items-end">
                    <div
                      className={`w-full rounded-full transition-all duration-100 ${
                        meterHeight > 80
                          ? "bg-red-500"
                          : meterHeight > 50
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                      }`}
                      style={{ height: `${meterHeight}%` }}
                    />
                  </div>
                </div>

                {/* Volume Readout */}
                <div className="text-center font-mono font-bold text-xs text-slate-300">
                  {Math.round((stem.volume / 127) * 100)}%
                </div>

                {/* Mute & Solo Buttons */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => toggleStemMute(stem.id)}
                    className={`py-1.5 rounded-lg text-[10px] font-black border transition active:scale-95 ${
                      stem.muted
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-extrabold"
                        : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
                    }`}
                  >
                    MUTE
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleStemSolo(stem.id)}
                    className={`py-1.5 rounded-lg text-[10px] font-black border transition active:scale-95 ${
                      stem.soloed
                        ? "bg-yellow-400 text-slate-950 border-yellow-300 font-extrabold"
                        : "bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200"
                    }`}
                  >
                    SOLO
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
