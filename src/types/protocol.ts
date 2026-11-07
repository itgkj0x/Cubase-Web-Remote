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
  | { type: "deletePreset"; presetId: string };

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
