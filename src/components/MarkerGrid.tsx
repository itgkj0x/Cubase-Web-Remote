import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Grid,
  List,
  Lock,
  MapPin,
  Music,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ClientCommand,
  DawState,
  MarkerPadConfig,
  PadColor,
  SetlistStore,
} from "../types/protocol";

interface MarkerGridProps {
  mode: "live" | "rec";
  daw: DawState;
  setlist: SetlistStore;
  safeLock: boolean;
  onGuardBlocked: (reason: string) => void;
  sendCommand: (cmd: ClientCommand) => void;
}

const COLOR_STYLES: Record<
  PadColor,
  { card: string; badge: string; dot: string; name: string }
> = {
  cyan: {
    card: "bg-cyan-950/40 border-cyan-500/45 text-cyan-100 hover:border-cyan-400",
    badge: "bg-cyan-500/25 text-cyan-300",
    dot: "bg-cyan-400",
    name: "Cyan",
  },
  emerald: {
    card: "bg-emerald-950/40 border-emerald-500/45 text-emerald-100 hover:border-emerald-400",
    badge: "bg-emerald-500/25 text-emerald-300",
    dot: "bg-emerald-400",
    name: "Green",
  },
  amber: {
    card: "bg-amber-950/40 border-amber-500/45 text-amber-100 hover:border-amber-400",
    badge: "bg-amber-500/25 text-amber-300",
    dot: "bg-amber-400",
    name: "Amber",
  },
  rose: {
    card: "bg-rose-950/40 border-rose-500/45 text-rose-100 hover:border-rose-400",
    badge: "bg-rose-500/25 text-rose-300",
    dot: "bg-rose-400",
    name: "Rose",
  },
  violet: {
    card: "bg-violet-950/40 border-violet-500/45 text-violet-100 hover:border-violet-400",
    badge: "bg-violet-500/25 text-violet-300",
    dot: "bg-violet-400",
    name: "Violet",
  },
  blue: {
    card: "bg-blue-950/40 border-blue-500/45 text-blue-100 hover:border-blue-400",
    badge: "bg-blue-500/25 text-blue-300",
    dot: "bg-blue-400",
    name: "Blue",
  },
  slate: {
    card: "bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-slate-500",
    badge: "bg-slate-800 text-slate-300",
    dot: "bg-slate-400",
    name: "Gray",
  },
};

const ALL_COLORS: PadColor[] = [
  "cyan",
  "emerald",
  "amber",
  "rose",
  "violet",
  "blue",
  "slate",
];

export const MarkerGrid: React.FC<MarkerGridProps> = ({
  mode,
  daw,
  setlist,
  safeLock,
  onGuardBlocked,
  sendCommand,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<"grid4" | "list2">("grid4");
  const [editingPad, setEditingPad] = useState<MarkerPadConfig | null>(null);
  const [songModalMode, setSongModalMode] = useState<"create" | "edit" | null>(
    null
  );
  const [songTitleInput, setSongTitleInput] = useState("");
  const [songBpmInput, setSongBpmInput] = useState("");

  const activePreset =
    setlist.presets.find((p) => p.id === setlist.activePresetId) ||
    setlist.presets[0];

  const activePresetIndex = setlist.presets.findIndex(
    (p) => p.id === activePreset?.id
  );

  const isJumpLocked = mode === "live" && safeLock && daw.playing;

  const handlePadClick = (pad: MarkerPadConfig) => {
    if (editMode) {
      setEditingPad({ ...pad });
      return;
    }
    if (isJumpLocked) {
      onGuardBlocked("再生中セーフティロックが有効なためマーカー移動をブロックしました");
      return;
    }
    sendCommand({ type: "triggerPad", index: pad.index });
  };

  const handlePrevSong = () => {
    if (setlist.presets.length <= 1) return;
    const prevIdx =
      (activePresetIndex - 1 + setlist.presets.length) % setlist.presets.length;
    sendCommand({
      type: "selectPreset",
      presetId: setlist.presets[prevIdx].id,
    });
  };

  const handleNextSong = () => {
    if (setlist.presets.length <= 1) return;
    const nextIdx = (activePresetIndex + 1) % setlist.presets.length;
    sendCommand({
      type: "selectPreset",
      presetId: setlist.presets[nextIdx].id,
    });
  };

  const openCreateSong = () => {
    setSongTitleInput("");
    setSongBpmInput("");
    setSongModalMode("create");
  };

  const openEditSong = () => {
    if (!activePreset) return;
    setSongTitleInput(activePreset.title);
    setSongBpmInput(activePreset.bpmMemo);
    setSongModalMode("edit");
  };

  const submitSongModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (songModalMode === "create") {
      sendCommand({
        type: "createPreset",
        title: songTitleInput || "New Song",
        bpmMemo: songBpmInput,
      });
    } else if (songModalMode === "edit" && activePreset) {
      sendCommand({
        type: "updatePresetMeta",
        presetId: activePreset.id,
        title: songTitleInput || activePreset.title,
        bpmMemo: songBpmInput,
      });
    }
    setSongModalMode(null);
  };

  const savePadEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPad || !activePreset) return;
    sendCommand({
      type: "updateMarkerPad",
      presetId: activePreset.id,
      pad: editingPad,
    });
    setEditingPad(null);
  };

  const captureCurrentPositionToPad = () => {
    if (!editingPad) return;
    setEditingPad({
      ...editingPad,
      mode: "cue",
      cueTime: daw.primaryTime,
    });
  };

  return (
    <div className="flex flex-col gap-2.5 no-select">
      {/* Setlist / Song Preset Selector Bar */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={handlePrevSong}
            disabled={setlist.presets.length <= 1}
            className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-40 active:scale-95 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={activePreset?.id || ""}
                onChange={(e) =>
                  sendCommand({
                    type: "selectPreset",
                    presetId: e.target.value,
                  })
                }
                className="w-full bg-transparent text-sm font-bold text-white truncate focus:outline-none cursor-pointer"
              >
                {setlist.presets.map((p, idx) => (
                  <option
                    key={p.id}
                    value={p.id}
                    className="bg-slate-900 text-white"
                  >
                    {idx + 1}. {p.title}
                    {p.bpmMemo ? ` (${p.bpmMemo})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {activePreset?.bpmMemo && (
              <div className="text-[11px] text-cyan-300/80 truncate pl-5">
                {activePreset.bpmMemo}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextSong}
            disabled={setlist.presets.length <= 1}
            className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center disabled:opacity-40 active:scale-95 shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Song & Pad Edit Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={openEditSong}
            title="曲名・BPMメモ編集"
            className="h-9 px-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium hover:text-white active:scale-95"
          >
            曲編集
          </button>
          <button
            type="button"
            onClick={openCreateSong}
            title="新しい曲プリセットを追加"
            className="h-9 w-9 rounded-xl bg-slate-800/80 border border-slate-700 text-cyan-300 flex items-center justify-center active:scale-95"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Marker Toolbar: Title + Layout Toggle + Memo Edit Mode */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-2">
          <span>MARKERS 1–16</span>
          {editMode && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] animate-pulse">
              パッドをタップして編集
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              setLayout((prev) => (prev === "grid4" ? "list2" : "grid4"))
            }
            className="h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1 text-xs active:scale-95"
          >
            {layout === "grid4" ? (
              <>
                <List className="w-3.5 h-3.5" />
                2列大文字
              </>
            ) : (
              <>
                <Grid className="w-3.5 h-3.5" />
                4×4パッド
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setEditMode((prev) => !prev)}
            className={`h-8 px-3 rounded-lg border flex items-center gap-1 text-xs font-semibold transition active:scale-95 ${
              editMode
                ? "bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.45)]"
                : "bg-slate-900 text-slate-300 border-slate-800"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            {editMode ? "編集完了" : "メモ編集"}
          </button>
        </div>
      </div>

      {/* 16 Marker Pads Grid */}
      <div
        className={
          layout === "grid4"
            ? "grid grid-cols-4 gap-2"
            : "grid grid-cols-2 gap-2"
        }
      >
        {(activePreset?.markers || []).map((pad) => {
          const style = COLOR_STYLES[pad.color] || COLOR_STYLES.cyan;
          const nativeTag =
            pad.mode === "cue"
              ? "CUE"
              : pad.index <= 9
                ? `M${pad.index}`
                : `C${pad.index - 9}`;

          return (
            <button
              key={pad.index}
              type="button"
              onClick={() => handlePadClick(pad)}
              onContextMenu={(e) => {
                e.preventDefault();
                setEditingPad({ ...pad });
              }}
              className={`relative rounded-2xl border p-2.5 text-left flex flex-col justify-between transition active:scale-95 ${
                layout === "grid4" ? "min-h-[76px]" : "min-h-[68px]"
              } ${style.card} ${
                editMode ? "ring-2 ring-amber-400/70 border-dashed" : ""
              }`}
            >
              {/* Top Row: Pad Number + Mode Badge + Lock/Edit Indicator */}
              <div className="flex items-center justify-between gap-1 w-full">
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${style.badge}`}
                >
                  {pad.index} · {nativeTag}
                </span>

                {editMode ? (
                  <Edit3 className="w-3 h-3 text-amber-300 shrink-0" />
                ) : isJumpLocked ? (
                  <Lock className="w-3 h-3 text-amber-400/80 shrink-0" />
                ) : null}
              </div>

              {/* Center: Custom Label */}
              <div
                className={`mt-1 font-bold leading-tight truncate w-full ${
                  layout === "grid4" ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                }`}
              >
                {pad.label || `Marker ${pad.index}`}
              </div>

              {/* Bottom: Note or Cue Time */}
              {(pad.note || (pad.mode === "cue" && pad.cueTime)) && (
                <div className="mt-0.5 text-[10px] text-slate-300/80 truncate w-full font-mono">
                  {pad.note
                    ? pad.note
                    : pad.mode === "cue"
                      ? `@ ${pad.cueTime}`
                      : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= PAD EDIT MODAL ================= */}
      {editingPad && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={savePadEdit}
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl flex flex-col gap-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                パッド #{editingPad.index} のメモ・動作設定
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {editingPad.index <= 9
                  ? `標準: Marker ${editingPad.index}`
                  : `標準: Cycle Marker ${editingPad.index - 9}`}
              </span>
            </div>

            {/* Label Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                表示ラベル名（例: Intro, 1A, サビ, Gt Solo）
              </label>
              <input
                type="text"
                value={editingPad.label}
                onChange={(e) =>
                  setEditingPad({ ...editingPad, label: e.target.value })
                }
                autoFocus
                placeholder={`Marker ${editingPad.index}`}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Sub Memo Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                サブメモ（例: Clickのみ, ブレイク注意, Key:Am）
              </label>
              <input
                type="text"
                value={editingPad.note}
                onChange={(e) =>
                  setEditingPad({ ...editingPad, note: e.target.value })
                }
                placeholder="任意のメモ"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                パッドカラー
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditingPad({ ...editingPad, color: c })}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 ${
                      editingPad.color === c
                        ? "border-white bg-slate-800 text-white"
                        : "border-slate-800 bg-slate-950 text-slate-400"
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${COLOR_STYLES[c].dot}`}
                    />
                    {COLOR_STYLES[c].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Jump Mode: Cubase Marker vs Direct Time Cue */}
            <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 flex flex-col gap-2">
              <div className="text-xs font-semibold text-slate-300">
                ジャンプ方式
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditingPad({ ...editingPad, mode: "marker" })
                  }
                  className={`py-2 px-2 rounded-lg text-xs font-semibold border ${
                    editingPad.mode === "marker"
                      ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                  }`}
                >
                  {editingPad.index <= 9
                    ? `Marker ${editingPad.index} 連動`
                    : `Cycle Marker ${editingPad.index - 9}`}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPad({ ...editingPad, mode: "cue" })}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold border ${
                    editingPad.mode === "cue"
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-200"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                  }`}
                >
                  位置記憶ジャンプ (Cue)
                </button>
              </div>

              {editingPad.mode === "cue" && (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editingPad.cueTime}
                    onChange={(e) =>
                      setEditingPad({ ...editingPad, cueTime: e.target.value })
                    }
                    placeholder="例: 33.1.1.0"
                    className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 font-mono text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={captureCurrentPositionToPad}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-1 shrink-0 active:scale-95"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    現在位置 ({daw.primaryTime}) を記憶
                  </button>
                </div>
              )}
            </div>

            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPad(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 text-sm font-bold"
              >
                保存する
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= SONG CREATE / EDIT MODAL ================= */}
      {songModalMode && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={submitSongModal}
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl flex flex-col gap-3.5"
          >
            <h3 className="text-base font-bold text-white">
              {songModalMode === "create"
                ? "セットリストに新しい曲を追加"
                : "曲プリセット情報の編集"}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                曲名 / プロジェクト名
              </label>
              <input
                type="text"
                value={songTitleInput}
                onChange={(e) => setSongTitleInput(e.target.value)}
                autoFocus
                placeholder="例: M1. Starlight Overture"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                BPM / 拍子 / ステージメモ
              </label>
              <input
                type="text"
                value={songBpmInput}
                onChange={(e) => setSongBpmInput(e.target.value)}
                placeholder="例: BPM 132 / 4/4 / 先行クリック2小節"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              {songModalMode === "edit" &&
              setlist.presets.length > 1 &&
              activePreset ? (
                <button
                  type="button"
                  onClick={() => {
                    sendCommand({
                      type: "deletePreset",
                      presetId: activePreset.id,
                    });
                    setSongModalMode(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-red-950/60 border border-red-700/50 text-red-300 text-xs font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  削除
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSongModalMode(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-sm font-bold"
                >
                  保存
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
