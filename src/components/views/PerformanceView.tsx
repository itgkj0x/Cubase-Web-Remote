import React, { useMemo } from "react";
import {
  Play,
  Square,
  SkipForward,
  SkipBack,
  RotateCcw,
  Repeat,
  ShieldCheck,
  Music,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Zap,
} from "lucide-react";
import {
  ClientCommand,
  DawState,
  PadColor,
  SongItem,
  SongSection,
} from "../../types/protocol";

interface PerformanceViewProps {
  daw: DawState;
  songs: SongItem[];
  activeSongId: string;
  safeLock: boolean;
  onGuardBlocked: (reason: string) => void;
  sendCommand: (cmd: ClientCommand) => void;
  onSelectSong: (songId: string) => void;
}

const COLOR_CLASSES: Record<
  PadColor,
  { bg: string; border: string; text: string; glow: string; activeBg: string }
> = {
  cyan: {
    bg: "bg-cyan-950/40 hover:bg-cyan-900/50",
    border: "border-cyan-500/40 hover:border-cyan-400",
    text: "text-cyan-300",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.4)] border-cyan-400",
    activeBg: "bg-cyan-500/25",
  },
  emerald: {
    bg: "bg-emerald-950/40 hover:bg-emerald-900/50",
    border: "border-emerald-500/40 hover:border-emerald-400",
    text: "text-emerald-300",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.4)] border-emerald-400",
    activeBg: "bg-emerald-500/25",
  },
  amber: {
    bg: "bg-amber-950/40 hover:bg-amber-900/50",
    border: "border-amber-500/40 hover:border-amber-400",
    text: "text-amber-300",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.4)] border-amber-400",
    activeBg: "bg-amber-500/25",
  },
  rose: {
    bg: "bg-rose-950/40 hover:bg-rose-900/50",
    border: "border-rose-500/40 hover:border-rose-400",
    text: "text-rose-300",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.4)] border-rose-400",
    activeBg: "bg-rose-500/25",
  },
  violet: {
    bg: "bg-violet-950/40 hover:bg-violet-900/50",
    border: "border-violet-500/40 hover:border-violet-400",
    text: "text-violet-300",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.4)] border-violet-400",
    activeBg: "bg-violet-500/25",
  },
  blue: {
    bg: "bg-blue-950/40 hover:bg-blue-900/50",
    border: "border-blue-500/40 hover:border-blue-400",
    text: "text-blue-300",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.4)] border-blue-400",
    activeBg: "bg-blue-500/25",
  },
  slate: {
    bg: "bg-slate-900/50 hover:bg-slate-800/60",
    border: "border-slate-700/60 hover:border-slate-500",
    text: "text-slate-300",
    glow: "shadow-[0_0_20px_rgba(148,163,184,0.3)] border-slate-400",
    activeBg: "bg-slate-800/60",
  },
};

export const PerformanceView: React.FC<PerformanceViewProps> = ({
  daw,
  songs,
  activeSongId,
  safeLock,
  onGuardBlocked,
  sendCommand,
  onSelectSong,
}) => {
  // Current active song & next song
  const { currentSong, nextSong, currentSongIndex } = useMemo(() => {
    const idx = songs.findIndex((s) => s.id === activeSongId);
    const validIdx = idx >= 0 ? idx : 0;
    const cur = songs[validIdx] || null;
    const nxt = validIdx + 1 < songs.length ? songs[validIdx + 1] : null;
    return { currentSong: cur, nextSong: nxt, currentSongIndex: validIdx };
  }, [songs, activeSongId]);

  // Current bar parsed from Cubase primaryTime
  const currentBar = useMemo(() => {
    const raw = daw.primaryTime.replace(/\s+/g, "");
    const parts = raw.split(".");
    return parseInt(parts[0] || "1", 10) || 1;
  }, [daw.primaryTime]);

  // Determine which section is currently playing
  const { activeSectionIndex, activeSection, songProgressPercent, sectionProgressPercent } =
    useMemo(() => {
      if (!currentSong || currentSong.sections.length === 0) {
        return {
          activeSectionIndex: -1,
          activeSection: null,
          songProgressPercent: 0,
          sectionProgressPercent: 0,
        };
      }

      // Parse start bar for each section
      const parsedSections = currentSong.sections.map((sec) => {
        const p = sec.startTime.replace(/\s+/g, "").split(".");
        const bar = parseInt(p[0] || "1", 10) || 1;
        return { ...sec, startBar: bar };
      });

      // Find current section
      let activeIdx = -1;
      for (let i = 0; i < parsedSections.length; i++) {
        const curStart = parsedSections[i].startBar;
        const nextStart =
          i + 1 < parsedSections.length
            ? parsedSections[i + 1].startBar
            : curStart + 16;

        if (currentBar >= curStart && currentBar < nextStart) {
          activeIdx = i;
          break;
        }
      }

      // If past the last section, cap to last section
      if (
        activeIdx === -1 &&
        parsedSections.length > 0 &&
        currentBar >= parsedSections[0].startBar
      ) {
        activeIdx = parsedSections.length - 1;
      }

      const activeSec = activeIdx >= 0 ? parsedSections[activeIdx] : null;

      // Calculate song progress
      const songStartBar = parsedSections[0]?.startBar || 1;
      const lastSec = parsedSections[parsedSections.length - 1];
      const songEndBar = lastSec ? lastSec.startBar + 16 : songStartBar + 64;
      const songTotalBars = Math.max(1, songEndBar - songStartBar);
      const songElapsedBars = Math.max(0, currentBar - songStartBar);
      const songPct = Math.min(
        100,
        Math.max(0, Math.round((songElapsedBars / songTotalBars) * 100))
      );

      // Calculate section progress
      let secPct = 0;
      if (activeSec && activeIdx >= 0) {
        const nextStart =
          activeIdx + 1 < parsedSections.length
            ? parsedSections[activeIdx + 1].startBar
            : activeSec.startBar + 16;
        const secTotalBars = Math.max(1, nextStart - activeSec.startBar);
        const secElapsedBars = Math.max(0, currentBar - activeSec.startBar);
        secPct = Math.min(
          100,
          Math.max(0, Math.round((secElapsedBars / secTotalBars) * 100))
        );
      }

      return {
        activeSectionIndex: activeIdx,
        activeSection: activeSec,
        songProgressPercent: songPct,
        sectionProgressPercent: secPct,
      };
    }, [currentSong, currentBar]);

  // Jump to section with safety lock
  const handleSectionClick = (sec: SongSection) => {
    if (safeLock && daw.playing) {
      onGuardBlocked("再生中セーフティロックが有効なためセクションジャンプを制限しました");
      return;
    }
    if (sec.startTime) {
      sendCommand({ type: "jumpTime", time: sec.startTime });
    }
  };

  // Jump to next / prev song
  const handleNextSong = () => {
    if (!nextSong) return;
    if (safeLock && daw.playing) {
      onGuardBlocked("再生中セーフティロックが有効です");
      return;
    }
    onSelectSong(nextSong.id);
    if (nextSong.startTime) {
      sendCommand({ type: "jumpTime", time: nextSong.startTime });
    }
  };

  const handlePrevSong = () => {
    if (currentSongIndex <= 0) return;
    const prev = songs[currentSongIndex - 1];
    if (!prev) return;
    if (safeLock && daw.playing) {
      onGuardBlocked("再生中セーフティロックが有効です");
      return;
    }
    onSelectSong(prev.id);
    if (prev.startTime) {
      sendCommand({ type: "jumpTime", time: prev.startTime });
    }
  };

  return (
    <div className="flex-1 w-full max-w-[1600px] mx-auto p-3 sm:p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start no-select">
      {/* =========================================================================
          LEFT PANE (iPad Landscape Split Console: ~35% on Desktop/Tablet)
          Setlist Overview & Fast Song Navigation
         ========================================================================= */}
      <aside className="lg:col-span-4 flex flex-col gap-3 lg:sticky lg:top-20">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-cyan-400" />
            SETLIST ({songs.length})
          </span>
          <span className="text-[11px] font-mono font-bold text-slate-500">
            {currentSongIndex + 1} / {songs.length}
          </span>
        </div>

        {/* Setlist Song Cards (iPad scrollable drawer) */}
        <div className="flex flex-col gap-2 max-h-[280px] sm:max-h-[360px] lg:max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
          {songs.map((song, idx) => {
            const isActive = song.id === activeSongId;
            const isNext = nextSong?.id === song.id;

            return (
              <div
                key={song.id}
                onClick={() => {
                  if (safeLock && daw.playing && !isActive) {
                    onGuardBlocked("再生中セーフティロックが有効です");
                    return;
                  }
                  onSelectSong(song.id);
                  if (song.startTime && !isActive) {
                    sendCommand({ type: "jumpTime", time: song.startTime });
                  }
                }}
                className={`group relative p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 ${
                  isActive
                    ? "bg-slate-900/95 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40"
                    : isNext
                      ? "bg-slate-900/60 border-amber-500/40 hover:border-amber-400/80"
                      : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/70 hover:border-slate-700"
                }`}
              >
                {/* Left: Number & Song Title */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                      isActive
                        ? "bg-cyan-500 text-slate-950"
                        : isNext
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm sm:text-base font-bold truncate ${
                          isActive
                            ? "text-white"
                            : isNext
                              ? "text-amber-200"
                              : "text-slate-300"
                        }`}
                      >
                        {song.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
                      {song.key && (
                        <span className="text-amber-300/90 font-semibold">
                          Key: {song.key}
                        </span>
                      )}
                      {song.bpm && (
                        <span>
                          {song.bpm} BPM
                        </span>
                      )}
                      {song.duration && <span>{song.duration}</span>}
                    </div>
                  </div>
                </div>

                {/* Right: Badges (Active / Auto-Stop) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {song.autoStop && (
                    <span
                      title="曲終わり自動停止 (Auto-Stop)"
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    >
                      STOP
                    </span>
                  )}
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* =========================================================================
          RIGHT PANE (iPad Landscape: ~65% / Full Width on Mobile)
          Live Performance Console: Current Song, Next Up, Section Blocks
         ========================================================================= */}
      <main className="lg:col-span-8 flex flex-col gap-4 lg:gap-5">
        {/* Top: Current Song & Next Up Stage Banners */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
          {/* CURRENT SONG BANNER (Takes 8 cols on iPad) */}
          <div className="md:col-span-8 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900/90 via-[#0e131d] to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col justify-between gap-3">
            {/* Top Row: Tag & Metadata */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] sm:text-xs font-black tracking-widest text-cyan-400 uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                CURRENT SONG
              </span>

              <div className="flex items-center gap-2">
                {currentSong?.autoStop && (
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    +AUTO-STOP
                  </span>
                )}
                {currentSong?.key && (
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-slate-800 text-amber-300 border border-slate-700">
                    KEY {currentSong.key}
                  </span>
                )}
                {currentSong?.bpm && (
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {currentSong.bpm} BPM
                  </span>
                )}
              </div>
            </div>

            {/* Song Title (Big Stage Readout) */}
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight line-clamp-1">
                {currentSong?.title || "No Song Selected"}
              </h1>
              {currentSong?.notes && (
                <p className="text-xs sm:text-sm text-slate-400 mt-1 line-clamp-1 font-medium">
                  {currentSong.notes}
                </p>
              )}
            </div>

            {/* Song Progress Bar */}
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-400">
                <span className="flex items-center gap-1 text-cyan-300">
                  <Clock className="w-3 h-3" />
                  Bar {currentBar}
                </span>
                <span>{songProgressPercent}% Complete</span>
              </div>

              <div className="h-2.5 sm:h-3 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${songProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* NEXT UP BANNER (Takes 4 cols on iPad) */}
          <div
            onClick={handleNextSong}
            title={nextSong ? "タップで次曲へ頭出しジャンプ" : ""}
            className={`md:col-span-4 p-4 rounded-2xl sm:rounded-3xl border transition-all flex flex-col justify-between gap-2.5 ${
              nextSong
                ? "bg-slate-900/60 border-amber-500/40 hover:border-amber-400/80 cursor-pointer active:scale-[0.98]"
                : "bg-slate-900/20 border-slate-800/40 text-slate-600"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] sm:text-xs font-black tracking-widest uppercase">
              <span className="text-amber-400/90 flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5" />
                NEXT UP
              </span>
              {nextSong && (
                <span className="text-[10px] font-mono text-amber-300/80">
                  CUE &gt;
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-slate-200 line-clamp-2">
                {nextSong?.title || "End of Setlist"}
              </h2>
              {nextSong && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-1">
                  {nextSong.key && <span>Key: {nextSong.key}</span>}
                  {nextSong.bpm && <span>{nextSong.bpm} BPM</span>}
                </div>
              )}
            </div>

            {nextSong ? (
              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                <Zap className="w-3.5 h-3.5" />
                <span>スタンバイ完了 (タップで次曲)</span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-600">全曲完了</div>
            )}
          </div>
        </div>

        {/* =====================================================================
            INTERACTIVE SECTION BLOCKS (AbleSet 3 Signature Tile Grid)
           ===================================================================== */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              SONG SECTIONS ({currentSong?.sections.length || 0})
            </span>
            {activeSection && (
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1 font-mono">
                Now: {activeSection.name} (Bar {activeSection.startTime})
              </span>
            )}
          </div>

          {/* Section Tiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
            {currentSong?.sections.map((sec, idx) => {
              const isCurrent = activeSectionIndex === idx;
              const colorInfo = COLOR_CLASSES[sec.color] || COLOR_CLASSES.cyan;

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => handleSectionClick(sec)}
                  className={`relative p-3.5 sm:p-4 rounded-2xl border transition-all text-left flex flex-col justify-between gap-3 min-h-[90px] sm:min-h-[105px] active:scale-95 ${
                    isCurrent
                      ? `${colorInfo.activeBg} ${colorInfo.glow} active-section-glow border-2`
                      : `${colorInfo.bg} ${colorInfo.border}`
                  }`}
                >
                  {/* Top: Section Type Badge & Start Bar */}
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                        isCurrent
                          ? "bg-white text-slate-950 border-white font-extrabold"
                          : `${colorInfo.text} bg-slate-900/80 border-slate-700/60`
                      }`}
                    >
                      {sec.name}
                    </span>

                    <span className="text-[11px] font-mono font-bold text-slate-400">
                      m.{sec.startTime.split(".")[0] || "1"}
                    </span>
                  </div>

                  {/* Middle / Bottom: Active Pulse & Section Progress */}
                  <div className="w-full flex items-end justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isCurrent ? (
                        <div className="flex items-center gap-1.5 text-xs font-black text-cyan-200">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                          <span>PLAYING</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {sec.startTime}
                        </span>
                      )}
                    </div>

                    {sec.loopEnabled && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                        LOOP
                      </span>
                    )}
                  </div>

                  {/* Intra-Section Progress Line (if playing) */}
                  {isCurrent && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-950 overflow-hidden rounded-b-2xl">
                      <div
                        className="h-full bg-cyan-400 transition-all duration-300"
                        style={{ width: `${sectionProgressPercent}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* =====================================================================
            STAGE CONTROL ACTION BAR
           ===================================================================== */}
        <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Quick Retake Macro for Rehearsal / Studio */}
          <button
            type="button"
            onClick={() => sendCommand({ type: "transport", action: "retake" })}
            title="ワンタップ録り直しマクロ (停止→直前テイク削除→開始位置復帰→再録音)"
            className="h-10 px-3.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span>1タップ・リテイク</span>
          </button>

          {/* Center: Prev / Next Song Jump Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={handlePrevSong}
              disabled={currentSongIndex <= 0}
              className="h-8 px-3 rounded-lg text-xs font-bold text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 flex items-center gap-1 active:scale-95 transition"
            >
              <SkipBack className="w-3.5 h-3.5" />
              <span>PREV SONG</span>
            </button>

            <div className="h-4 w-px bg-slate-800" />

            <button
              type="button"
              onClick={handleNextSong}
              disabled={!nextSong}
              className="h-8 px-3 rounded-lg text-xs font-bold text-amber-300 hover:text-amber-200 disabled:opacity-40 disabled:hover:text-amber-300 flex items-center gap-1 active:scale-95 transition"
            >
              <span>NEXT SONG</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Quick Loop Toggle (+LOOP) */}
          <button
            type="button"
            onClick={() => sendCommand({ type: "transport", action: "cycle" })}
            title="Cubase サイクルループ切替"
            className={`h-10 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 active:scale-95 transition ${
              daw.cycle
                ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>+LOOP: {daw.cycle ? "ON" : "OFF"}</span>
          </button>
        </div>
      </main>
    </div>
  );
};
