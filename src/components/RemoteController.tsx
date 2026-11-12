import React, { useCallback, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ClientCommand, DawState, SetlistStore, SongItem } from "../types/protocol";
import { useWakeLock } from "../hooks/useWakeLock";
import { AbleHeader, AbleViewTab } from "./AbleHeader";
import { PerformanceView } from "./views/PerformanceView";
import { SetlistView } from "./views/SetlistView";
import { MixerView } from "./views/MixerView";
import { LyricsView } from "./views/LyricsView";

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
  // 4 Main AbleSet 3 Views: performance | setlist | mixer | lyrics
  const [currentTab, setCurrentTab] = useState<AbleViewTab>("performance");

  // Stage Safety Lock (enabled by default on stage)
  const [safeLock, setSafeLock] = useState<boolean>(true);

  // Guard blocked toast notification
  const [guardToast, setGuardToast] = useState<string | null>(null);

  // Screen Wake Lock (prevent mobile/iPad screen sleep)
  const { supported: wakeSupported, active: wakeActive, toggleWakeLock } =
    useWakeLock(true);

  const triggerGuardNotice = useCallback((reason: string) => {
    setGuardToast(reason);
    window.setTimeout(() => {
      setGuardToast((curr) => (curr === reason ? null : curr));
    }, 2000);
  }, []);

  // Compute active songs list with fallback to presets
  const songs: SongItem[] = useMemo(() => {
    if (setlist.songs && setlist.songs.length > 0) {
      return setlist.songs;
    }
    // Fallback: convert presets to SongItems
    if (setlist.presets && setlist.presets.length > 0) {
      return setlist.presets.map((p, idx) => ({
        id: p.id,
        title: p.title,
        artist: "Band Live",
        key: "C",
        bpm: p.bpmMemo || "120",
        duration: "03:30",
        startTime: `${idx * 64 + 1}.1.1.0`,
        autoStop: true,
        color: "cyan",
        notes: p.bpmMemo,
        lyrics: "",
        sections: p.markers
          .filter((m) => m.index <= 8 || !m.cueTime)
          .map((m) => ({
            id: `sec-${m.index}`,
            name: m.label || `Section ${m.index}`,
            startTime: m.cueTime || `${(m.index - 1) * 8 + 1}.1.1.0`,
            color: m.color,
            sectionType: "verse" as const,
            loopEnabled: false,
          })),
        markers: p.markers,
      }));
    }
    return [];
  }, [setlist.songs, setlist.presets]);

  const activeSongId = setlist.activePresetId || songs[0]?.id || "";
  const currentSong = songs.find((s) => s.id === activeSongId) || songs[0];

  const handleSelectSong = (songId: string) => {
    sendCommand({ type: "selectSong", songId });
  };

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100 flex flex-col no-select">
      {/* AbleSet 3 Style Global Header */}
      <AbleHeader
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        daw={daw}
        currentBpm={currentSong?.bpm}
        wsConnected={wsConnected}
        latencyMs={latencyMs}
        safeLock={safeLock}
        onToggleSafeLock={() => setSafeLock((prev) => !prev)}
        wakeSupported={wakeSupported}
        wakeActive={wakeActive}
        onToggleWakeLock={toggleWakeLock}
        sendCommand={sendCommand}
        showBackToHost={showBackToHost}
        onBackToHost={onBackToHost}
      />

      {/* Safety Lock Guard Toast */}
      {guardToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 text-xs sm:text-sm font-black shadow-2xl flex items-center gap-2 animate-bounce">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <span>{guardToast}</span>
        </div>
      )}

      {/* Disconnected Warning Banner for Stage Reliability */}
      {!wsConnected && (
        <div className="bg-red-600/90 text-white text-xs sm:text-sm font-black text-center py-2 px-3 shadow-lg">
          PC ホストとの Wi-Fi 通信が切断されました。自動再接続を待機しています...
        </div>
      )}

      {/* Main View Router */}
      <div className="flex-1 flex flex-col">
        {currentTab === "performance" && (
          <PerformanceView
            daw={daw}
            songs={songs}
            activeSongId={activeSongId}
            safeLock={safeLock}
            onGuardBlocked={triggerGuardNotice}
            sendCommand={sendCommand}
            onSelectSong={handleSelectSong}
          />
        )}

        {currentTab === "setlist" && (
          <SetlistView
            daw={daw}
            songs={songs}
            activeSongId={activeSongId}
            sendCommand={sendCommand}
            onSelectSong={handleSelectSong}
          />
        )}

        {currentTab === "mixer" && (
          <MixerView daw={daw} sendCommand={sendCommand} />
        )}

        {currentTab === "lyrics" && (
          <LyricsView
            daw={daw}
            songs={songs}
            activeSongId={activeSongId}
            sendCommand={sendCommand}
          />
        )}
      </div>
    </div>
  );
};
