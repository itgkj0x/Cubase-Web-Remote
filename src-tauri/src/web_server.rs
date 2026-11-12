use crate::midi_bridge::{list_midi_ports, MidiBridgeHandle, MidiPortList};
use crate::state::{
    AppSharedState, MarkerPadConfig, ServerEvent, SongItem, SongPreset, SongSection,
};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::{header, HeaderMap, HeaderValue, Method, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use std::fs;
use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;

pub const EMBEDDED_CUBASE_SCRIPT: &str =
    include_str!("../../cubase-script/webremote/cubasectrl/webremote_cubasectrl.js");

#[derive(RustEmbed)]
#[folder = "../dist"]
struct FrontendAssets;

#[derive(Clone)]
pub struct WebAppContext {
    pub state: Arc<AppSharedState>,
    pub midi: MidiBridgeHandle,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfoResponse {
    pub ips: Vec<String>,
    pub port: u16,
    pub midi_ports: MidiPortList,
    pub script_installed: bool,
    pub script_target_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectMidiRequest {
    pub in_port: Option<String>,
    pub out_port: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallScriptResponse {
    pub ok: bool,
    pub path: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientCommand {
    #[serde(rename_all = "camelCase")]
    Ping { client_ts: u64 },
    #[serde(rename_all = "camelCase")]
    Transport { action: String },
    #[serde(rename_all = "camelCase")]
    HoldTransport { action: String, pressed: bool },
    #[serde(rename_all = "camelCase")]
    MarkerNav { action: String },
    #[serde(rename_all = "camelCase")]
    TriggerPad { index: u8 },
    #[serde(rename_all = "camelCase")]
    JumpTime { time: String },
    #[serde(rename_all = "camelCase")]
    Track { action: String },
    #[serde(rename_all = "camelCase")]
    TrackVolume { value: u8 },
    #[serde(rename_all = "camelCase")]
    UpdateMarkerPad {
        preset_id: String,
        pad: MarkerPadConfig,
    },
    #[serde(rename_all = "camelCase")]
    CapturePadCue { preset_id: String, index: u8 },
    #[serde(rename_all = "camelCase")]
    SelectPreset { preset_id: String },
    #[serde(rename_all = "camelCase")]
    CreatePreset { title: String, bpm_memo: String },
    #[serde(rename_all = "camelCase")]
    UpdatePresetMeta {
        preset_id: String,
        title: String,
        bpm_memo: String,
    },
    #[serde(rename_all = "camelCase")]
    DeletePreset { preset_id: String },
    // AbleSet 3 Style Commands:
    #[serde(rename_all = "camelCase")]
    SelectSong { song_id: String },
    #[serde(rename_all = "camelCase")]
    ReorderSongs { song_ids: Vec<String> },
    #[serde(rename_all = "camelCase")]
    CreateSong {
        title: String,
        bpm: String,
        key: String,
    },
    #[serde(rename_all = "camelCase")]
    UpdateSong { song: SongItem },
    #[serde(rename_all = "camelCase")]
    DeleteSong { song_id: String },
    #[serde(rename_all = "camelCase")]
    AddSection {
        song_id: String,
        section: SongSection,
    },
    #[serde(rename_all = "camelCase")]
    UpdateSection {
        song_id: String,
        section: SongSection,
    },
    #[serde(rename_all = "camelCase")]
    DeleteSection {
        song_id: String,
        section_id: String,
    },
    #[serde(rename_all = "camelCase")]
    ToggleAutoStop { song_id: String },
    #[serde(rename_all = "camelCase")]
    ToggleQuickLoop {
        song_id: String,
        section_id: String,
    },
    #[serde(rename_all = "camelCase")]
    ImportSetlist { raw_text: String },
}

pub fn get_cubase_script_target_path() -> PathBuf {
    let docs = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
    docs.join("Steinberg")
        .join("Cubase")
        .join("MIDI Remote")
        .join("Driver Scripts")
        .join("Local")
        .join("webremote")
        .join("cubasectrl")
        .join("webremote_cubasectrl.js")
}

pub fn install_cubase_script_to_disk() -> InstallScriptResponse {
    let target = get_cubase_script_target_path();
    if let Some(parent) = target.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return InstallScriptResponse {
                ok: false,
                path: target.display().to_string(),
                message: format!("フォルダ作成に失敗しました: {}", e),
            };
        }
    }

    match fs::write(&target, EMBEDDED_CUBASE_SCRIPT) {
        Ok(_) => InstallScriptResponse {
            ok: true,
            path: target.display().to_string(),
            message: "Cubase用MIDI Remoteスクリプトを配置しました。Cubase下部ゾーンの「MIDI Remote」→「スクリプトを再読み込み(Reload Scripts)」を押してください。".to_string(),
        },
        Err(e) => InstallScriptResponse {
            ok: false,
            path: target.display().to_string(),
            message: format!("スクリプト書き込みに失敗しました: {}", e),
        },
    }
}

pub fn get_local_ipv4_list() -> Vec<String> {
    let mut primary = Vec::new();
    let mut secondary = Vec::new();

    if let Ok(ifaces) = local_ip_address::list_afinet_netifas() {
        for (name, ip) in ifaces {
            if let IpAddr::V4(v4) = ip {
                if v4.is_loopback() || v4.is_link_local() {
                    continue;
                }
                let octets = v4.octets();
                let ip_str = v4.to_string();
                let lower_name = name.to_lowercase();
                let is_virtual = lower_name.contains("wsl")
                    || lower_name.contains("vethernet")
                    || lower_name.contains("virtual")
                    || lower_name.contains("vmware")
                    || lower_name.contains("vbox");

                // Prioritize standard home/stage Wi-Fi & LAN subnets (192.168.x.x / 10.x.x.x) on physical adapters
                if !is_virtual && (octets[0] == 192 || octets[0] == 10) {
                    if !primary.contains(&ip_str) {
                        primary.push(ip_str);
                    }
                } else if !secondary.contains(&ip_str) && !primary.contains(&ip_str) {
                    secondary.push(ip_str);
                }
            }
        }
    }

    primary.extend(secondary);
    if primary.is_empty() {
        if let Ok(IpAddr::V4(v4)) = local_ip_address::local_ip() {
            primary.push(v4.to_string());
        } else {
            primary.push("127.0.0.1".to_string());
        }
    }
    primary
}

fn cors_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("Content-Type"),
    );
    headers
}

pub fn build_host_info(state: &Arc<AppSharedState>) -> HostInfoResponse {
    let target = get_cubase_script_target_path();
    HostInfoResponse {
        ips: get_local_ipv4_list(),
        port: *state.http_port.read(),
        midi_ports: list_midi_ports(),
        script_installed: target.exists(),
        script_target_path: target.display().to_string(),
    }
}

async fn api_options() -> impl IntoResponse {
    (StatusCode::NO_CONTENT, cors_headers())
}

async fn api_host_info(State(ctx): State<WebAppContext>) -> impl IntoResponse {
    (cors_headers(), Json(build_host_info(&ctx.state)))
}

async fn api_connect_midi(
    State(ctx): State<WebAppContext>,
    Json(req): Json<ConnectMidiRequest>,
) -> impl IntoResponse {
    let in_p = req.in_port.filter(|s| !s.trim().is_empty());
    let out_p = req.out_port.filter(|s| !s.trim().is_empty());
    ctx.midi.connect_ports(in_p, out_p);
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    (cors_headers(), Json(build_host_info(&ctx.state)))
}

async fn api_install_script() -> impl IntoResponse {
    let res = install_cubase_script_to_disk();
    (cors_headers(), Json(res))
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(ctx): State<WebAppContext>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws_connection(socket, ctx))
}

async fn handle_ws_connection(socket: WebSocket, ctx: WebAppContext) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (direct_tx, mut direct_rx) = mpsc::unbounded_channel::<ServerEvent>();
    let mut broadcast_rx = ctx.state.tx.subscribe();

    // Send immediate full sync snapshot to this client
    {
        let daw = ctx.state.daw.read().clone();
        let setlist = ctx.state.setlist.read().clone();
        let _ = direct_tx.send(ServerEvent::FullSync { daw, setlist });
    }
    ctx.midi.request_sync();

    // Writer task: forwards both broadcast events and direct Pong responses
    let write_task = tokio::spawn(async move {
        loop {
            let next_event = tokio::select! {
                Some(ev) = direct_rx.recv() => Some(ev),
                Ok(ev) = broadcast_rx.recv() => Some(ev),
                else => None,
            };

            match next_event {
                Some(ev) => {
                    if let Ok(json_text) = serde_json::to_string(&ev) {
                        if ws_sender.send(Message::Text(json_text)).await.is_err() {
                            break;
                        }
                    }
                }
                None => break,
            }
        }
    });

    // Reader task: handles incoming commands from mobile/iPad WebUI
    while let Some(Ok(msg)) = ws_receiver.next().await {
        if let Message::Text(text) = msg {
            if let Ok(cmd) = serde_json::from_str::<ClientCommand>(&text) {
                process_client_command(cmd, &ctx, &direct_tx);
            }
        }
    }

    write_task.abort();
}

fn process_client_command(
    cmd: ClientCommand,
    ctx: &WebAppContext,
    direct_tx: &mpsc::UnboundedSender<ServerEvent>,
) {
    match cmd {
        ClientCommand::Ping { client_ts } => {
            let _ = direct_tx.send(ServerEvent::Pong { client_ts });
        }
        ClientCommand::Transport { action } => match action.as_str() {
            "play" => ctx.midi.trigger_cc(10),
            "stop" => ctx.midi.trigger_cc(11),
            "record" => ctx.midi.trigger_cc(12),
            "cycle" => ctx.midi.trigger_cc(13),
            "metronome" => ctx.midi.trigger_cc(14),
            "precount" => ctx.midi.trigger_cc(15),
            "rtz" => ctx.midi.trigger_cc(16),
            "barBack" => ctx.midi.trigger_cc(17),
            "barForward" => ctx.midi.trigger_cc(18),
            "setLeftLocator" => ctx.midi.trigger_cc(21),
            "setRightLocator" => ctx.midi.trigger_cc(22),
            "toLeftLocator" => ctx.midi.trigger_cc(23),
            "undo" => ctx.midi.trigger_cc(24),
            "redo" => ctx.midi.trigger_cc(25),
            "retake" => ctx.midi.execute_retake(),
            "sync" => ctx.midi.request_sync(),
            _ => {}
        },
        ClientCommand::HoldTransport { action, pressed } => match action.as_str() {
            "rewind" => ctx.midi.set_momentary_cc(19, pressed),
            "forward" => ctx.midi.set_momentary_cc(20, pressed),
            _ => {}
        },
        ClientCommand::MarkerNav { action } => match action.as_str() {
            "prev" => ctx.midi.trigger_cc(30),
            "next" => ctx.midi.trigger_cc(31),
            "insert" => ctx.midi.trigger_cc(32),
            _ => {}
        },
        ClientCommand::TriggerPad { index } => {
            if !(1..=16).contains(&index) {
                return;
            }
            // Check if this pad is configured in Memory Cue mode with a target time
            let cue_override = {
                let store = ctx.state.setlist.read();
                store
                    .presets
                    .iter()
                    .find(|p| p.id == store.active_preset_id)
                    .and_then(|p| p.markers.iter().find(|m| m.index == index))
                    .and_then(|m| {
                        if m.mode == "cue" && !m.cue_time.trim().is_empty() {
                            Some(m.cue_time.trim().to_string())
                        } else {
                            None
                        }
                    })
            };

            if let Some(target_time) = cue_override {
                ctx.midi.jump_to_time(target_time);
            } else {
                // CC 41..49 -> Marker 1..9, CC 50..56 -> Cycle Marker 1..7
                ctx.midi.trigger_cc(40 + index);
            }
        }
        ClientCommand::JumpTime { time } => {
            if !time.trim().is_empty() {
                ctx.midi.jump_to_time(time.trim().to_string());
            }
        }
        ClientCommand::Track { action } => match action.as_str() {
            "prev" => ctx.midi.trigger_cc(60),
            "next" => ctx.midi.trigger_cc(61),
            "recEnable" => ctx.midi.trigger_cc(62),
            "monitor" => ctx.midi.trigger_cc(63),
            "mute" => ctx.midi.trigger_cc(64),
            "solo" => ctx.midi.trigger_cc(65),
            _ => {}
        },
        ClientCommand::TrackVolume { value } => {
            ctx.midi.set_fader_cc(66, value);
        }
        ClientCommand::UpdateMarkerPad { preset_id, pad } => {
            {
                let mut store = ctx.state.setlist.write();
                if let Some(preset) = store.presets.iter_mut().find(|p| p.id == preset_id) {
                    if let Some(existing) = preset.markers.iter_mut().find(|m| m.index == pad.index)
                    {
                        *existing = pad;
                    }
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::CapturePadCue { preset_id, index } => {
            let current_pos = ctx.state.daw.read().primary_time.clone();
            {
                let mut store = ctx.state.setlist.write();
                if let Some(preset) = store.presets.iter_mut().find(|p| p.id == preset_id) {
                    if let Some(existing) = preset.markers.iter_mut().find(|m| m.index == index) {
                        existing.cue_time = current_pos;
                        existing.mode = "cue".to_string();
                    }
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::SelectPreset { preset_id } => {
            {
                let mut store = ctx.state.setlist.write();
                if store.presets.iter().any(|p| p.id == preset_id) {
                    store.active_preset_id = preset_id;
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::CreatePreset { title, bpm_memo } => {
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(1);
            let new_id = format!("song-{}", ts);
            let clean_title = if title.trim().is_empty() {
                "New Song".to_string()
            } else {
                title.trim().to_string()
            };
            let mut preset = SongPreset::new_default(&new_id, &clean_title);
            preset.bpm_memo = bpm_memo.trim().to_string();
            let mut song = SongItem::new_default(&new_id, &clean_title);
            song.bpm = bpm_memo.trim().to_string();
            song.notes = bpm_memo.trim().to_string();
            {
                let mut store = ctx.state.setlist.write();
                store.presets.push(preset);
                store.songs.push(song);
                store.active_preset_id = new_id;
            }
            ctx.state.save_setlist();
        }
        ClientCommand::UpdatePresetMeta {
            preset_id,
            title,
            bpm_memo,
        } => {
            {
                let mut store = ctx.state.setlist.write();
                if let Some(p) = store.presets.iter_mut().find(|p| p.id == preset_id) {
                    if !title.trim().is_empty() {
                        p.title = title.trim().to_string();
                    }
                    p.bpm_memo = bpm_memo.trim().to_string();
                }
                if let Some(s) = store.songs.iter_mut().find(|s| s.id == preset_id) {
                    if !title.trim().is_empty() {
                        s.title = title.trim().to_string();
                    }
                    s.bpm = bpm_memo.trim().to_string();
                    s.notes = bpm_memo.trim().to_string();
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::DeletePreset { preset_id } => {
            {
                let mut store = ctx.state.setlist.write();
                if store.presets.len() > 1 {
                    store.presets.retain(|p| p.id != preset_id);
                    store.songs.retain(|s| s.id != preset_id);
                    if store.active_preset_id == preset_id {
                        if let Some(first) = store.songs.first() {
                            store.active_preset_id = first.id.clone();
                        } else if let Some(first) = store.presets.first() {
                            store.active_preset_id = first.id.clone();
                        }
                    }
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::SelectSong { song_id } => {
            {
                let mut store = ctx.state.setlist.write();
                if store.songs.iter().any(|s| s.id == song_id) {
                    store.active_preset_id = song_id.clone();
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::ReorderSongs { song_ids } => {
            {
                let mut store = ctx.state.setlist.write();
                let mut new_songs = Vec::new();
                for id in &song_ids {
                    if let Some(song) = store.songs.iter().find(|s| &s.id == id).cloned() {
                        new_songs.push(song);
                    }
                }
                // Append any unmentioned songs
                for song in &store.songs {
                    if !song_ids.contains(&song.id) {
                        new_songs.push(song.clone());
                    }
                }
                store.songs = new_songs;
            }
            ctx.state.save_setlist();
        }
        ClientCommand::CreateSong { title, bpm, key } => {
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(1);
            let new_id = format!("song-{}", ts);
            let clean_title = if title.trim().is_empty() {
                "New Song".to_string()
            } else {
                title.trim().to_string()
            };
            let mut song = SongItem::new_default(&new_id, &clean_title);
            song.bpm = bpm.trim().to_string();
            song.notes = bpm.trim().to_string();
            if !key.trim().is_empty() {
                song.key = key.trim().to_string();
            }
            {
                let mut store = ctx.state.setlist.write();
                store.songs.push(song);
                store.active_preset_id = new_id;
            }
            ctx.state.save_setlist();
        }
        ClientCommand::UpdateSong { song } => {
            {
                let mut store = ctx.state.setlist.write();
                if let Some(pos) = store.songs.iter().position(|s| s.id == song.id) {
                    store.songs[pos] = song;
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::DeleteSong { song_id } => {
            {
                let mut store = ctx.state.setlist.write();
                if store.songs.len() > 1 {
                    store.songs.retain(|s| s.id != song_id);
                    store.presets.retain(|p| p.id != song_id);
                    if store.active_preset_id == song_id {
                        if let Some(first) = store.songs.first() {
                            store.active_preset_id = first.id.clone();
                        }
                    }
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::AddSection { song_id, section } => {
            {
                let mut store = ctx.state.setlist.write();
                if let Some(song) = store.songs.iter_mut().find(|s| s.id == song_id) {
                    song.sections.push(section);
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::UpdateSection { song_id, section } => {
            {
                let mut store = ctx.state.setlist.write();
                if let Some(song) = store.songs.iter_mut().find(|s| s.id == song_id) {
                    if let Some(pos) = song.sections.iter().position(|sec| sec.id == section.id) {
                        song.sections[pos] = section;
                    }
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::DeleteSection {
            song_id,
            section_id,
        } => {
            {
                let mut store = ctx.state.setlist.write();
                if let Some(song) = store.songs.iter_mut().find(|s| s.id == song_id) {
                    song.sections.retain(|sec| sec.id != section_id);
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::ToggleAutoStop { song_id } => {
            {
                let mut store = ctx.state.setlist.write();
                if let Some(song) = store.songs.iter_mut().find(|s| s.id == song_id) {
                    song.auto_stop = !song.auto_stop;
                }
            }
            ctx.state.save_setlist();
        }
        ClientCommand::ToggleQuickLoop {
            song_id,
            section_id,
        } => {
            let mut will_loop = false;
            let mut target_start = String::new();
            {
                let mut store = ctx.state.setlist.write();
                if let Some(song) = store.songs.iter_mut().find(|s| s.id == song_id) {
                    if let Some(sec) = song.sections.iter_mut().find(|sec| sec.id == section_id) {
                        sec.loop_enabled = !sec.loop_enabled;
                        will_loop = sec.loop_enabled;
                        target_start = sec.start_time.clone();
                    }
                }
            }
            ctx.state.save_setlist();
            if will_loop && !target_start.is_empty() {
                // Engage cycle loop on Cubase
                ctx.midi.trigger_cc(13); // Cycle toggle
            }
        }
        ClientCommand::ImportSetlist { raw_text } => {
            let lines: Vec<&str> = raw_text.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
            if !lines.is_empty() {
                let mut new_songs = Vec::new();
                for (i, line) in lines.iter().enumerate() {
                    let clean_title = line
                        .trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == '-' || c == '、' || c == ' ')
                        .trim();
                    let final_title = if clean_title.is_empty() {
                        format!("Song {}", i + 1)
                    } else {
                        clean_title.to_string()
                    };
                    let song_id = format!("imported-{}", i + 1);
                    let mut song = SongItem::new_default(&song_id, &final_title);
                    song.start_time = format!("{}.1.1.0", i * 64 + 1);
                    new_songs.push(song);
                }
                {
                    let mut store = ctx.state.setlist.write();
                    if let Some(first) = new_songs.first() {
                        store.active_preset_id = first.id.clone();
                    }
                    store.songs = new_songs;
                }
                ctx.state.save_setlist();
            }
        }
    }
}

async fn static_handler(uri: Uri, method: Method) -> Response {
    if method == Method::OPTIONS {
        return (StatusCode::NO_CONTENT, cors_headers()).into_response();
    }

    let raw_path = uri.path().trim_start_matches('/');
    let requested = if raw_path.is_empty() {
        "index.html"
    } else {
        raw_path
    };

    if let Some(content) = FrontendAssets::get(requested) {
        let mime = mime_guess::from_path(requested).first_or_octet_stream();
        return (
            [(header::CONTENT_TYPE, mime.as_ref())],
            content.data.into_owned(),
        )
            .into_response();
    }

    // SPA fallback to index.html
    if let Some(index) = FrontendAssets::get("index.html") {
        return (
            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
            index.data.into_owned(),
        )
            .into_response();
    }

    (StatusCode::NOT_FOUND, "Frontend assets not built yet.").into_response()
}

pub async fn start_web_server(ctx: WebAppContext) {
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/api/host-info", get(api_host_info).options(api_options))
        .route(
            "/api/connect-midi",
            post(api_connect_midi).options(api_options),
        )
        .route(
            "/api/install-script",
            post(api_install_script).options(api_options),
        )
        .fallback(static_handler)
        .with_state(ctx.clone());

    // Try binding to port 3840..=3850 on 0.0.0.0 so LAN devices (iPhone/iPad/Android) can connect
    for port in 3840..=3850 {
        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
            *ctx.state.http_port.write() = port;
            let _ = axum::serve(listener, app).await;
            break;
        }
    }
}
