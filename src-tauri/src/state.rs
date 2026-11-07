use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DawState {
    pub playing: bool,
    pub stopped: bool,
    pub recording: bool,
    pub cycle: bool,
    pub metronome: bool,
    pub primary_time: String,
    pub primary_format: String,
    pub secondary_time: String,
    pub left_locator: String,
    pub right_locator: String,
    pub track_name: String,
    pub track_vol_db: String,
    pub track_vol_cc: u8,
    pub track_rec_enable: bool,
    pub track_monitor: bool,
    pub track_mute: bool,
    pub track_solo: bool,
    pub midi_connected: bool,
    pub cubase_ready: bool,
    pub midi_in_port: String,
    pub midi_out_port: String,
    pub last_start_time: String,
}

impl Default for DawState {
    fn default() -> Self {
        Self {
            playing: false,
            stopped: true,
            recording: false,
            cycle: false,
            metronome: false,
            primary_time: "1.1.1.0".to_string(),
            primary_format: "Bars+Beats".to_string(),
            secondary_time: "00:00:00:00".to_string(),
            left_locator: "1.1.1.0".to_string(),
            right_locator: "5.1.1.0".to_string(),
            track_name: "No Track Selected".to_string(),
            track_vol_db: "0.0 dB".to_string(),
            track_vol_cc: 100,
            track_rec_enable: false,
            track_monitor: false,
            track_mute: false,
            track_solo: false,
            midi_connected: false,
            cubase_ready: false,
            midi_in_port: String::new(),
            midi_out_port: String::new(),
            last_start_time: "1.1.1.0".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkerPadConfig {
    /// 1..=16
    pub index: u8,
    pub label: String,
    pub note: String,
    pub color: String,
    /// "marker" (Cubase native Marker 1-9 / Cycle 1-7) or "cue" (Direct time jump via SysEx)
    pub mode: String,
    pub cue_time: String,
}

impl MarkerPadConfig {
    pub fn default_for(index: u8) -> Self {
        let default_color = match index {
            1..=4 => "cyan",
            5..=8 => "emerald",
            9..=12 => "amber",
            _ => "violet",
        };
        Self {
            index,
            label: format!("Marker {}", index),
            note: String::new(),
            color: default_color.to_string(),
            mode: "marker".to_string(),
            cue_time: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongPreset {
    pub id: String,
    pub title: String,
    pub bpm_memo: String,
    pub markers: Vec<MarkerPadConfig>,
}

impl SongPreset {
    pub fn new_default(id: &str, title: &str) -> Self {
        let markers = (1..=16).map(MarkerPadConfig::default_for).collect();
        Self {
            id: id.to_string(),
            title: title.to_string(),
            bpm_memo: String::new(),
            markers,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetlistStore {
    pub active_preset_id: String,
    pub presets: Vec<SongPreset>,
}

impl Default for SetlistStore {
    fn default() -> Self {
        let default_song = SongPreset::new_default("song-1", "Default Project");
        Self {
            active_preset_id: default_song.id.clone(),
            presets: vec![default_song],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerEvent {
    #[serde(rename_all = "camelCase")]
    FullSync {
        daw: DawState,
        setlist: SetlistStore,
    },
    #[serde(rename_all = "camelCase")]
    DawUpdate {
        daw: DawState,
    },
    #[serde(rename_all = "camelCase")]
    TimeUpdate {
        primary_time: String,
        primary_format: String,
        secondary_time: String,
        left_locator: String,
        right_locator: String,
    },
    #[serde(rename_all = "camelCase")]
    SetlistUpdate {
        setlist: SetlistStore,
    },
    #[serde(rename_all = "camelCase")]
    Pong {
        client_ts: u64,
    },
}

pub struct AppSharedState {
    pub daw: RwLock<DawState>,
    pub setlist: RwLock<SetlistStore>,
    pub storage_path: PathBuf,
    pub tx: broadcast::Sender<ServerEvent>,
    pub http_port: RwLock<u16>,
}

impl AppSharedState {
    pub fn new() -> Arc<Self> {
        let storage_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("CubaseWebRemote");
        let _ = fs::create_dir_all(&storage_dir);
        let storage_path = storage_dir.join("setlist_presets.json");

        let setlist = if let Ok(raw) = fs::read_to_string(&storage_path) {
            serde_json::from_str::<SetlistStore>(&raw).unwrap_or_default()
        } else {
            SetlistStore::default()
        };

        let (tx, _) = broadcast::channel(256);

        Arc::new(Self {
            daw: RwLock::new(DawState::default()),
            setlist: RwLock::new(setlist),
            storage_path,
            tx,
            http_port: RwLock::new(3840),
        })
    }

    pub fn save_setlist(&self) {
        let data = self.setlist.read().clone();
        if let Ok(json) = serde_json::to_string_pretty(&data) {
            let _ = fs::write(&self.storage_path, json);
        }
        let _ = self.tx.send(ServerEvent::SetlistUpdate { setlist: data });
    }

    pub fn broadcast_daw(&self) {
        let snapshot = self.daw.read().clone();
        let _ = self.tx.send(ServerEvent::DawUpdate { daw: snapshot });
    }

    pub fn broadcast_time(&self) {
        let d = self.daw.read();
        let _ = self.tx.send(ServerEvent::TimeUpdate {
            primary_time: d.primary_time.clone(),
            primary_format: d.primary_format.clone(),
            secondary_time: d.secondary_time.clone(),
            left_locator: d.left_locator.clone(),
            right_locator: d.right_locator.clone(),
        });
    }
}
