export interface DawState {
  playing: boolean;
  stopped: boolean;
  recording: boolean;
  cycle: boolean;
  metronome: boolean;
  primaryTime: string;
  primaryFormat: string;
  secondaryTime: string;
  leftLocator: string;
  rightLocator: string;
  trackName: string;
  trackVolDb: string;
  trackVolCc: number;
  trackRecEnable: boolean;
  trackMonitor: boolean;
  trackMute: boolean;
  trackSolo: boolean;
  midiConnected: boolean;
  cubaseReady: boolean;
  midiInPort: string;
  midiOutPort: string;
  lastStartTime: string;
}

export type PadColor =
  | "cyan"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "blue"
  | "slate";

export type SectionType =
  | "intro"
  | "verse"
  | "chorus"
  | "bridge"
  | "solo"
  | "outro"
  | "custom";

export interface SongSection {
  id: string;
  name: string;
  startTime: string; // e.g. "1.1.1.0", "17.1.1.0"
  endTime?: string;
  color: PadColor;
  sectionType: SectionType;
  loopEnabled: boolean;
}

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  key: string;
  bpm: string;
  duration: string;
  startTime: string;
  autoStop: boolean;
  color: PadColor;
  notes: string;
  lyrics: string;
  sections: SongSection[];
  markers: MarkerPadConfig[];
}

export interface MarkerPadConfig {
  index: number; // 1..16
  label: string;
  note: string;
  color: PadColor;
  mode: "marker" | "cue";
  cueTime: string;
}

export interface SongPreset {
  id: string;
  title: string;
  bpmMemo: string;
  markers: MarkerPadConfig[];
}

export interface SetlistStore {
  activePresetId: string;
  songs?: SongItem[];
  presets: SongPreset[];
}

export interface MidiPortList {
  inputs: string[];
  outputs: string[];
}

export interface HostInfoResponse {
  ips: string[];
  port: number;
  midiPorts: MidiPortList;
  scriptInstalled: boolean;
  scriptTargetPath: string;
}

export interface InstallScriptResponse {
  ok: boolean;
  path: string;
  message: string;
}

export type ServerEvent =
  | {
      type: "fullSync";
      daw: DawState;
      setlist: SetlistStore;
    }
  | {
      type: "dawUpdate";
      daw: DawState;
    }
  | {
      type: "timeUpdate";
      primaryTime: string;
      primaryFormat: string;
      secondaryTime: string;
      leftLocator: string;
      rightLocator: string;
    }
  | {
      type: "setlistUpdate";
      setlist: SetlistStore;
    }
  | {
      type: "pong";
      clientTs: number;
    };

export type ClientCommand =
  | { type: "ping"; clientTs: number }
  | { type: "transport"; action: string }
  | { type: "holdTransport"; action: "rewind" | "forward"; pressed: boolean }
  | { type: "markerNav"; action: "prev" | "next" | "insert" }
  | { type: "triggerPad"; index: number }
  | { type: "jumpTime"; time: string }
  | {
      type: "track";
      action: "prev" | "next" | "recEnable" | "monitor" | "mute" | "solo";
    }
  | { type: "trackVolume"; value: number }
  | { type: "updateMarkerPad"; presetId: string; pad: MarkerPadConfig }
  | { type: "capturePadCue"; presetId: string; index: number }
  | { type: "selectPreset"; presetId: string }
  | { type: "createPreset"; title: string; bpmMemo: string }
  | {
      type: "updatePresetMeta";
      presetId: string;
      title: string;
      bpmMemo: string;
    }
  | { type: "deletePreset"; presetId: string }
  // AbleSet 3 Commands:
  | { type: "selectSong"; songId: string }
  | { type: "reorderSongs"; songIds: string[] }
  | { type: "createSong"; title: string; bpm: string; key: string }
  | { type: "updateSong"; song: SongItem }
  | { type: "deleteSong"; songId: string }
  | { type: "addSection"; songId: string; section: SongSection }
  | { type: "updateSection"; songId: string; section: SongSection }
  | { type: "deleteSection"; songId: string; sectionId: string }
  | { type: "toggleAutoStop"; songId: string }
  | { type: "toggleQuickLoop"; songId: string; sectionId: string }
  | { type: "importSetlist"; rawText: string };

export const DEFAULT_DAW_STATE: DawState = {
  playing: false,
  stopped: true,
  recording: false,
  cycle: false,
  metronome: false,
  primaryTime: "1.1.1.0",
  primaryFormat: "Bars+Beats",
  secondaryTime: "00:00:00:00",
  leftLocator: "1.1.1.0",
  rightLocator: "5.1.1.0",
  trackName: "No Track Selected",
  trackVolDb: "0.0 dB",
  trackVolCc: 100,
  trackRecEnable: false,
  trackMonitor: false,
  trackMute: false,
  trackSolo: false,
  midiConnected: false,
  cubaseReady: false,
  midiInPort: "",
  midiOutPort: "",
  lastStartTime: "1.1.1.0",
};

export const DEFAULT_SETLIST: SetlistStore = {
  activePresetId: "song-1",
  songs: [
    {
      id: "song-1",
      title: "01. Eclipse (Opening)",
      artist: "Band Live",
      key: "Em",
      bpm: "128",
      duration: "03:45",
      startTime: "1.1.1.0",
      autoStop: true,
      color: "cyan",
      notes: "Intro: シンセ先行、サビ前キメあり",
      lyrics: "[Intro]\n(Synth Arp fade in...)\n\n[Verse 1]\n闇を裂いて 光が射す\n加速する鼓動を 抱きしめて\n\n[Chorus 1]\nFly into the eclipse\n解き放て 叫ぶ夜の果てへ",
      sections: [
        { id: "sec-1", name: "Intro", startTime: "1.1.1.0", color: "amber", sectionType: "intro", loopEnabled: false },
        { id: "sec-2", name: "Verse 1", startTime: "9.1.1.0", color: "cyan", sectionType: "verse", loopEnabled: false },
        { id: "sec-3", name: "Chorus 1", startTime: "25.1.1.0", color: "rose", sectionType: "chorus", loopEnabled: false },
        { id: "sec-4", name: "Verse 2", startTime: "41.1.1.0", color: "cyan", sectionType: "verse", loopEnabled: false },
        { id: "sec-5", name: "Chorus 2", startTime: "57.1.1.0", color: "rose", sectionType: "chorus", loopEnabled: false },
        { id: "sec-6", name: "Guitar Solo", startTime: "73.1.1.0", color: "violet", sectionType: "solo", loopEnabled: false },
        { id: "sec-7", name: "Last Chorus", startTime: "89.1.1.0", color: "rose", sectionType: "chorus", loopEnabled: false },
        { id: "sec-8", name: "Outro", startTime: "105.1.1.0", color: "emerald", sectionType: "outro", loopEnabled: false },
      ],
      markers: [],
    },
    {
      id: "song-2",
      title: "02. Midnight Runner",
      artist: "Band Live",
      key: "Am",
      bpm: "135",
      duration: "04:12",
      startTime: "121.1.1.0",
      autoStop: true,
      color: "emerald",
      notes: "4カウントハイハットスタート、間奏ソロ回し",
      lyrics: "[Intro]\nOne, Two, Three, Four!\n\n[Verse 1]\n夜のハイウェイ 駆け抜ける風\n誰も追いつけない スピードで",
      sections: [
        { id: "sec-21", name: "Count In", startTime: "121.1.1.0", color: "amber", sectionType: "intro", loopEnabled: false },
        { id: "sec-22", name: "Verse", startTime: "125.1.1.0", color: "cyan", sectionType: "verse", loopEnabled: false },
        { id: "sec-23", name: "Chorus", startTime: "141.1.1.0", color: "rose", sectionType: "chorus", loopEnabled: false },
        { id: "sec-24", name: "Bridge", startTime: "157.1.1.0", color: "violet", sectionType: "bridge", loopEnabled: false },
        { id: "sec-25", name: "Outro", startTime: "173.1.1.0", color: "emerald", sectionType: "outro", loopEnabled: false },
      ],
      markers: [],
    },
    {
      id: "song-3",
      title: "03. Starlight (Encore)",
      artist: "Band Live",
      key: "D",
      bpm: "96",
      duration: "05:00",
      startTime: "189.1.1.0",
      autoStop: false,
      color: "rose",
      notes: "バラード曲、ピアノとアコギからイン",
      lyrics: "[Intro]\n(Piano solo...)\n\n[Verse]\n見上げた星空に 誓ったあの日\nずっと変わらない 輝きを",
      sections: [
        { id: "sec-31", name: "Intro", startTime: "189.1.1.0", color: "amber", sectionType: "intro", loopEnabled: false },
        { id: "sec-32", name: "Verse", startTime: "197.1.1.0", color: "cyan", sectionType: "verse", loopEnabled: false },
        { id: "sec-33", name: "Chorus", startTime: "213.1.1.0", color: "rose", sectionType: "chorus", loopEnabled: false },
        { id: "sec-34", name: "Outro", startTime: "229.1.1.0", color: "emerald", sectionType: "outro", loopEnabled: false },
      ],
      markers: [],
    },
  ],
  presets: [
    {
      id: "song-1",
      title: "Default Project",
      bpmMemo: "",
      markers: Array.from({ length: 16 }, (_, idx) => ({
        index: idx + 1,
        label: `Marker ${idx + 1}`,
        note: "",
        color:
          idx < 4
            ? "cyan"
            : idx < 8
              ? "emerald"
              : idx < 12
                ? "amber"
                : "violet",
        mode: "marker",
        cueTime: "",
      })),
    },
  ],
};
