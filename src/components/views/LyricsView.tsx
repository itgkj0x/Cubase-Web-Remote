import React, { useMemo, useState } from "react";
import {
  FileText,
  Edit3,
  Check,
  Type,
  Music,
  Sparkles,
} from "lucide-react";
import { ClientCommand, DawState, SongItem } from "../../types/protocol";

interface LyricsViewProps {
  daw: DawState;
  songs: SongItem[];
  activeSongId: string;
  sendCommand: (cmd: ClientCommand) => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  daw,
  songs,
  activeSongId,
  sendCommand,
}) => {
  const currentSong = useMemo(() => {
    return songs.find((s) => s.id === activeSongId) || songs[0] || null;
  }, [songs, activeSongId]);

  // Font size state (normal, medium, large)
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("large");

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const startEdit = () => {
    setEditText(currentSong?.lyrics || "");
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!currentSong) return;
    const updated: SongItem = {
      ...currentSong,
      lyrics: editText,
    };
    sendCommand({ type: "updateSong", song: updated });
    setIsEditing(false);
  };

  // Current bar parsed from Cubase primaryTime
  const currentBar = useMemo(() => {
    const raw = daw.primaryTime.replace(/\s+/g, "");
    const parts = raw.split(".");
    return parseInt(parts[0] || "1", 10) || 1;
  }, [daw.primaryTime]);

  // Current section name
  const currentSectionName = useMemo(() => {
    if (!currentSong || currentSong.sections.length === 0) return "";
    const parsedSections = currentSong.sections.map((sec) => {
      const p = sec.startTime.replace(/\s+/g, "").split(".");
      return { ...sec, startBar: parseInt(p[0] || "1", 10) || 1 };
    });

    let name = "";
    for (let i = 0; i < parsedSections.length; i++) {
      const curStart = parsedSections[i].startBar;
      const nextStart =
        i + 1 < parsedSections.length
          ? parsedSections[i + 1].startBar
          : curStart + 16;
      if (currentBar >= curStart && currentBar < nextStart) {
        name = parsedSections[i].name;
        break;
      }
    }
    return name;
  }, [currentSong, currentBar]);

  // Parse lyrics into section blocks (e.g. [Intro], [Verse 1], etc.)
  const lyricsBlocks = useMemo(() => {
    if (!currentSong || !currentSong.lyrics) return [];
    const lines = currentSong.lyrics.split("\n");
    const blocks: Array<{ title: string; lines: string[] }> = [];
    let currentBlock: { title: string; lines: string[] } = {
      title: "Lyrics",
      lines: [],
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        if (currentBlock.lines.length > 0 || currentBlock.title !== "Lyrics") {
          blocks.push(currentBlock);
        }
        currentBlock = {
          title: trimmed.slice(1, -1),
          lines: [],
        };
      } else {
        currentBlock.lines.push(line);
      }
    }
    if (currentBlock.lines.length > 0) {
      blocks.push(currentBlock);
    }
    return blocks;
  }, [currentSong]);

  const fontSizeClass =
    fontSize === "xlarge"
      ? "text-2xl leading-relaxed"
      : fontSize === "large"
        ? "text-lg sm:text-xl leading-relaxed"
        : "text-sm sm:text-base leading-normal";

  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto p-3 sm:p-4 lg:p-6 flex flex-col gap-4 no-select">
      {/* Top Header: Song Info & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            {currentSong?.title || "No Song Selected"}
          </h2>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
            {currentSong?.key && (
              <span className="text-amber-300 font-bold">
                Key: {currentSong.key}
              </span>
            )}
            {currentSong?.bpm && <span>{currentSong.bpm} BPM</span>}
            {currentSectionName && (
              <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/40">
                Playing: {currentSectionName}
              </span>
            )}
          </div>
        </div>

        {/* Font Size & Edit Toggle */}
        <div className="flex items-center gap-2">
          {/* Font Size Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => setFontSize("normal")}
              className={`px-2 py-1 rounded text-xs font-bold transition ${
                fontSize === "normal"
                  ? "bg-cyan-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              標準
            </button>
            <button
              type="button"
              onClick={() => setFontSize("large")}
              className={`px-2 py-1 rounded text-xs font-bold transition ${
                fontSize === "large"
                  ? "bg-cyan-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              大
            </button>
            <button
              type="button"
              onClick={() => setFontSize("xlarge")}
              className={`px-2 py-1 rounded text-xs font-bold transition ${
                fontSize === "xlarge"
                  ? "bg-cyan-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              特大
            </button>
          </div>

          {/* Edit / Save Button */}
          {isEditing ? (
            <button
              type="button"
              onClick={saveEdit}
              className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>保存</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 active:scale-95 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>歌詞編集</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Lyrics / Chords Viewer & Editor */}
      <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/50 border border-slate-800 min-h-[500px] shadow-xl">
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <span className="text-xs text-slate-400 font-mono">
              ※ [Intro] や [Verse 1]、[Chorus] のように角括弧で囲むと自動的にセクションブロック化されます。
            </span>
            <textarea
              rows={18}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="[Intro]&#10;ギターリフ...&#10;&#10;[Verse 1]&#10;歌い出し歌詞...&#10;&#10;[Chorus]&#10;サビ歌詞..."
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-base resize-none"
            />
          </div>
        ) : lyricsBlocks.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <FileText className="w-12 h-12 stroke-1 text-slate-600" />
            <p className="text-sm font-medium">
              歌詞またはコード進行メモが登録されていません。
            </p>
            <button
              type="button"
              onClick={startEdit}
              className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>歌詞を入力する</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {lyricsBlocks.map((block, idx) => {
              const isSectionActive =
                currentSectionName &&
                block.title.toLowerCase().includes(currentSectionName.toLowerCase());

              return (
                <div
                  key={idx}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isSectionActive
                      ? "bg-cyan-950/30 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400"
                      : "bg-slate-950/60 border-slate-800/80"
                  }`}
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
                    <span
                      className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${
                        isSectionActive
                          ? "bg-cyan-400 text-slate-950 border-cyan-300 font-black"
                          : "bg-slate-900 text-slate-400 border-slate-700/60"
                      }`}
                    >
                      {block.title}
                    </span>

                    {isSectionActive && (
                      <span className="text-xs font-bold text-cyan-300 font-mono flex items-center gap-1 animate-pulse">
                        <Sparkles className="w-3.5 h-3.5" />
                        PLAYING NOW
                      </span>
                    )}
                  </div>

                  {/* Block Lines */}
                  <div className={`font-medium ${fontSizeClass} text-slate-200 whitespace-pre-wrap`}>
                    {block.lines.join("\n")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
