import React, { useState } from "react";
import {
  ListMusic,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Clock,
  Sparkles,
  ClipboardCopy,
  ClipboardPaste,
  Check,
  X,
  Target,
  Repeat,
  Music,
} from "lucide-react";
import {
  ClientCommand,
  DawState,
  PadColor,
  SectionType,
  SongItem,
  SongSection,
} from "../../types/protocol";

interface SetlistViewProps {
  daw: DawState;
  songs: SongItem[];
  activeSongId: string;
  sendCommand: (cmd: ClientCommand) => void;
  onSelectSong: (songId: string) => void;
}

const SECTION_COLORS: PadColor[] = [
  "cyan",
  "emerald",
  "amber",
  "rose",
  "violet",
  "blue",
  "slate",
];

const SECTION_TYPES: SectionType[] = [
  "intro",
  "verse",
  "chorus",
  "bridge",
  "solo",
  "outro",
  "custom",
];

export const SetlistView: React.FC<SetlistViewProps> = ({
  daw,
  songs,
  activeSongId,
  sendCommand,
  onSelectSong,
}) => {
  // Expanded song id for viewing/editing sections
  const [expandedSongId, setExpandedSongId] = useState<string | null>(
    activeSongId || (songs[0]?.id ?? null)
  );

  // Modals state
  const [songModalOpen, setSongModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<SongItem | null>(null);

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [targetSongId, setTargetSongId] = useState<string>("");
  const [editingSection, setEditingSection] = useState<SongSection | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Form states for song
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songKey, setSongKey] = useState("C");
  const [songBpm, setSongBpm] = useState("120");
  const [songStartTime, setSongStartTime] = useState("1.1.1.0");
  const [songDuration, setSongDuration] = useState("03:30");
  const [songNotes, setSongNotes] = useState("");
  const [songAutoStop, setSongAutoStop] = useState(true);

  // Form states for section
  const [secName, setSecName] = useState("");
  const [secStart, setSecStart] = useState("1.1.1.0");
  const [secColor, setSecColor] = useState<PadColor>("cyan");
  const [secType, setSecType] = useState<SectionType>("verse");

  // Reorder song up/down
  const moveSong = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= songs.length) return;
    const newSongs = [...songs];
    const [removed] = newSongs.splice(index, 1);
    newSongs.splice(targetIdx, 0, removed);
    sendCommand({
      type: "reorderSongs",
      songIds: newSongs.map((s) => s.id),
    });
  };

  // Open Song Edit Modal
  const openEditSong = (song: SongItem) => {
    setEditingSong(song);
    setSongTitle(song.title);
    setSongArtist(song.artist || "");
    setSongKey(song.key || "C");
    setSongBpm(song.bpm || "120");
    setSongStartTime(song.startTime || "1.1.1.0");
    setSongDuration(song.duration || "03:30");
    setSongNotes(song.notes || "");
    setSongAutoStop(song.autoStop);
    setSongModalOpen(true);
  };

  // Open New Song Modal
  const openNewSong = () => {
    setEditingSong(null);
    setSongTitle("");
    setSongArtist("");
    setSongKey("C");
    setSongBpm("120");
    setSongStartTime(daw.primaryTime || "1.1.1.0");
    setSongDuration("03:30");
    setSongNotes("");
    setSongAutoStop(true);
    setSongModalOpen(true);
  };

  // Save Song (New or Update)
  const saveSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim()) return;

    if (editingSong) {
      const updated: SongItem = {
        ...editingSong,
        title: songTitle.trim(),
        artist: songArtist.trim(),
        key: songKey.trim(),
        bpm: songBpm.trim(),
        startTime: songStartTime.trim(),
        duration: songDuration.trim(),
        notes: songNotes.trim(),
        autoStop: songAutoStop,
      };
      sendCommand({ type: "updateSong", song: updated });
    } else {
      sendCommand({
        type: "createSong",
        title: songTitle.trim(),
        bpm: songBpm.trim(),
        key: songKey.trim(),
      });
    }
    setSongModalOpen(false);
  };

  // Open New Section Modal
  const openNewSection = (songId: string) => {
    setTargetSongId(songId);
    setEditingSection(null);
    setSecName("");
    setSecStart(daw.primaryTime || "1.1.1.0");
    setSecColor("cyan");
    setSecType("verse");
    setSectionModalOpen(true);
  };

  // Open Edit Section Modal
  const openEditSection = (songId: string, sec: SongSection) => {
    setTargetSongId(songId);
    setEditingSection(sec);
    setSecName(sec.name);
    setSecStart(sec.startTime);
    setSecColor(sec.color);
    setSecType(sec.sectionType);
    setSectionModalOpen(true);
  };

  // Save Section
  const saveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secName.trim() || !targetSongId) return;

    if (editingSection) {
      const updated: SongSection = {
        ...editingSection,
        name: secName.trim(),
        startTime: secStart.trim(),
        color: secColor,
        sectionType: secType,
      };
      sendCommand({
        type: "updateSection",
        songId: targetSongId,
        section: updated,
      });
    } else {
      const newSec: SongSection = {
        id: `sec-${Date.now()}`,
        name: secName.trim(),
        startTime: secStart.trim(),
        color: secColor,
        sectionType: secType,
        loopEnabled: false,
      };
      sendCommand({
        type: "addSection",
        songId: targetSongId,
        section: newSec,
      });
    }
    setSectionModalOpen(false);
  };

  // Export Setlist to Clipboard
  const exportToClipboard = () => {
    const lines = songs.map((s, idx) => `${idx + 1}. ${s.title} [Key: ${s.key || "C"}, ${s.bpm || "120"}BPM]`);
    const fullText = lines.join("\n");
    navigator.clipboard.writeText(fullText).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  // Submit Text Import
  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (importText.trim()) {
      sendCommand({ type: "importSetlist", rawText: importText });
      setImportModalOpen(false);
      setImportText("");
    }
  };

  return (
    <div className="flex-1 w-full max-w-[1400px] mx-auto p-3 sm:p-4 lg:p-6 flex flex-col gap-5 no-select">
      {/* Top Header: Actions & Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-cyan-400" />
            SETLIST MANAGER
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            曲順の並び替え・セクション編集・曲間オートストップ（+STOP）の管理
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Clipboard Export */}
          <button
            type="button"
            onClick={exportToClipboard}
            className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 active:scale-95 transition"
          >
            {copyFeedback ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ClipboardCopy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{copyFeedback ? "コピー完了!" : "エクスポート"}</span>
          </button>

          {/* Clipboard Import */}
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 active:scale-95 transition"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-slate-400" />
            <span>テキスト一括導入</span>
          </button>

          {/* Add New Song */}
          <button
            type="button"
            onClick={openNewSong}
            className="h-9 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span>新規楽曲追加</span>
          </button>
        </div>
      </div>

      {/* Main Song List & Accordion Section Editors */}
      <div className="flex flex-col gap-3">
        {songs.map((song, idx) => {
          const isExpanded = expandedSongId === song.id;
          const isActive = activeSongId === song.id;

          return (
            <div
              key={song.id}
              className={`rounded-2xl border transition-all ${
                isActive
                  ? "bg-slate-900/95 border-cyan-500 shadow-md ring-1 ring-cyan-500/30"
                  : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700"
              }`}
            >
              {/* Song Row Bar */}
              <div className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                {/* Left: Reorder Arrows, Number, Title & Meta */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Reorder Up/Down */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveSong(idx, "up")}
                      disabled={idx === 0}
                      title="曲順を上に"
                      className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSong(idx, "down")}
                      disabled={idx === songs.length - 1}
                      title="曲順を下に"
                      className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Song Order Badge */}
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-mono font-black text-xs sm:text-sm shrink-0 ${
                      isActive
                        ? "bg-cyan-500 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base sm:text-lg font-black text-white truncate">
                        {song.title}
                      </span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                      {song.artist && <span>{song.artist}</span>}
                      {song.key && (
                        <span className="text-amber-300/90 font-bold">
                          Key: {song.key}
                        </span>
                      )}
                      {song.bpm && <span>{song.bpm} BPM</span>}
                      {song.duration && <span>{song.duration}</span>}
                      <span>Start: m.{song.startTime.split(".")[0] || "1"}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Auto-Stop Toggle, Edit, Accordion Expand */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Auto-Stop Toggle (+STOP) */}
                  <button
                    type="button"
                    onClick={() =>
                      sendCommand({
                        type: "toggleAutoStop",
                        songId: song.id,
                      })
                    }
                    title="曲終わり自動停止 (+STOP) の切替"
                    className={`h-8 px-2.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-1 transition ${
                      song.autoStop
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-slate-800/60 border-slate-700/60 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <Repeat className="w-3 h-3" />
                    <span>+STOP: {song.autoStop ? "ON" : "OFF"}</span>
                  </button>

                  {/* Jump to Song Start */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSong(song.id);
                      if (song.startTime) {
                        sendCommand({
                          type: "jumpTime",
                          time: song.startTime,
                        });
                      }
                    }}
                    title="この曲の先頭へジャンプ"
                    className="h-8 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 active:scale-95"
                  >
                    <span>頭出し</span>
                  </button>

                  {/* Edit Song Button */}
                  <button
                    type="button"
                    onClick={() => openEditSong(song)}
                    title="楽曲の情報を編集"
                    className="h-8 w-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center active:scale-95"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Song Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (songs.length <= 1) return;
                      if (confirm(`曲「${song.title}」を削除しますか？`)) {
                        sendCommand({ type: "deleteSong", songId: song.id });
                      }
                    }}
                    disabled={songs.length <= 1}
                    title="曲を削除"
                    className="h-8 w-8 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:border-red-500/50 text-slate-400 hover:text-red-300 border border-slate-700 flex items-center justify-center disabled:opacity-30 disabled:hover:bg-slate-800 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Expand / Collapse Sections Drawer */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSongId((prev) =>
                        prev === song.id ? null : song.id
                      )
                    }
                    title="セクション一覧を開く / 閉じる"
                    className="h-8 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1"
                  >
                    <span className="font-mono text-cyan-400">
                      {song.sections.length} Sec
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Accordion: Sections Editor Drawer */}
              {isExpanded && (
                <div className="border-t border-slate-800/80 p-3.5 sm:p-4 bg-slate-950/50 rounded-b-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      SONG SECTIONS ({song.sections.length})
                    </span>

                    <button
                      type="button"
                      onClick={() => openNewSection(song.id)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1 active:scale-95 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>セクション追加</span>
                    </button>
                  </div>

                  {/* Sections List */}
                  {song.sections.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      セクションが登録されていません。「セクション追加」から作成してください。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {song.sections.map((sec) => (
                        <div
                          key={sec.id}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-white truncate">
                              {sec.name}
                            </span>
                            <span className="text-[11px] font-mono text-cyan-400">
                              Bar {sec.startTime}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectSong(song.id);
                                sendCommand({
                                  type: "jumpTime",
                                  time: sec.startTime,
                                });
                              }}
                              title="このセクションへジャンプ"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <Target className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditSection(song.id, sec)}
                              title="セクション編集"
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`セクション「${sec.name}」を削除しますか？`)) {
                                  sendCommand({
                                    type: "deleteSection",
                                    songId: song.id,
                                    sectionId: sec.id,
                                  });
                                }
                              }}
                              title="セクション削除"
                              className="p-1 rounded bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          MODALS: Song Edit / Section Edit / Text Import
         ========================================================================= */}

      {/* 1. Song Edit / Create Modal */}
      {songModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                {editingSong ? "楽曲情報の編集" : "新規楽曲の登録"}
              </h3>
              <button
                type="button"
                onClick={() => setSongModalOpen(false)}
                className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveSong} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  曲名 (Title) *
                </label>
                <input
                  type="text"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="01. Eclipse"
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    Key
                  </label>
                  <input
                    type="text"
                    value={songKey}
                    onChange={(e) => setSongKey(e.target.value)}
                    placeholder="Em / C"
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    BPM
                  </label>
                  <input
                    type="text"
                    value={songBpm}
                    onChange={(e) => setSongBpm(e.target.value)}
                    placeholder="128"
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    開始位置 (Bars+Beats)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={songStartTime}
                      onChange={(e) => setSongStartTime(e.target.value)}
                      placeholder="1.1.1.0"
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setSongStartTime(daw.primaryTime || "1.1.1.0")}
                      title="現在のCubase位置を代入"
                      className="h-10 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 font-bold"
                    >
                      現在位置
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    演奏時間目安
                  </label>
                  <input
                    type="text"
                    value={songDuration}
                    onChange={(e) => setSongDuration(e.target.value)}
                    placeholder="03:45"
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  ステージメモ (Notes)
                </label>
                <input
                  type="text"
                  value={songNotes}
                  onChange={(e) => setSongNotes(e.target.value)}
                  placeholder="サビ前ブレイク注意、ギターソロ8小節"
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 mt-1">
                <div>
                  <span className="font-bold text-white block">
                    曲間自動停止 (+STOP)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    曲終わりにCubaseを自動停止し、次曲で待機
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={songAutoStop}
                  onChange={(e) => setSongAutoStop(e.target.checked)}
                  className="w-5 h-5 rounded accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setSongModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-md shadow-cyan-500/20"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Section Edit / Create Modal */}
      {sectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                {editingSection ? "セクション編集" : "新規セクション追加"}
              </h3>
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveSection} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  セクション名 *
                </label>
                <input
                  type="text"
                  value={secName}
                  onChange={(e) => setSecName(e.target.value)}
                  placeholder="Intro / Verse 1 / Chorus..."
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  開始位置 (Bars+Beats) *
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={secStart}
                    onChange={(e) => setSecStart(e.target.value)}
                    placeholder="1.1.1.0"
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setSecStart(daw.primaryTime || "1.1.1.0")}
                    title="現在のCubase位置を代入"
                    className="h-10 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 font-bold"
                  >
                    現在位置
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  セクション種別
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {SECTION_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSecType(t)}
                      className={`py-1.5 rounded-lg font-mono uppercase text-[10px] font-bold border transition ${
                        secType === t
                          ? "bg-cyan-500 text-slate-950 border-cyan-400"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">
                  カラーバッジ
                </label>
                <div className="flex items-center gap-2">
                  {SECTION_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSecColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition ${
                        c === "cyan"
                          ? "bg-cyan-400"
                          : c === "emerald"
                            ? "bg-emerald-400"
                            : c === "amber"
                              ? "bg-amber-400"
                              : c === "rose"
                                ? "bg-rose-400"
                                : c === "violet"
                                  ? "bg-violet-400"
                                  : c === "blue"
                                    ? "bg-blue-400"
                                    : "bg-slate-400"
                      } ${
                        secColor === c ? "border-white scale-110 shadow-md" : "border-transparent opacity-60"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setSectionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black shadow-md shadow-cyan-500/20"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Text Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <ClipboardPaste className="w-5 h-5 text-cyan-400" />
                セットリスト テキスト一括導入
              </h3>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              メモ帳などから曲名を1行ずつ貼り付けてください。自動的に曲リストへ変換されます。
            </p>

            <form onSubmit={handleImportSubmit} className="flex flex-col gap-3">
              <textarea
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="01. Eclipse&#10;02. Midnight Runner&#10;03. Starlight (Encore)"
                className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-white font-mono text-xs resize-none"
                required
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-md shadow-cyan-500/20"
                >
                  一括インポート実行
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
