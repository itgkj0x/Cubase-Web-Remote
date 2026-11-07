pub mod midi_bridge;
pub mod state;
pub mod web_server;

use midi_bridge::MidiBridgeHandle;
use state::AppSharedState;
use std::sync::Arc;
use web_server::{
    build_host_info, install_cubase_script_to_disk, start_web_server, HostInfoResponse,
    InstallScriptResponse, WebAppContext,
};

#[tauri::command]
fn get_host_info_cmd(state: tauri::State<'_, Arc<AppSharedState>>) -> HostInfoResponse {
    build_host_info(&state)
}

#[tauri::command]
fn connect_midi_cmd(
    in_port: Option<String>,
    out_port: Option<String>,
    state: tauri::State<'_, Arc<AppSharedState>>,
    midi: tauri::State<'_, MidiBridgeHandle>,
) -> HostInfoResponse {
    let in_p = in_port.filter(|s| !s.trim().is_empty());
    let out_p = out_port.filter(|s| !s.trim().is_empty());
    midi.connect_ports(in_p, out_p);
    std::thread::sleep(std::time::Duration::from_millis(80));
    build_host_info(&state)
}

#[tauri::command]
fn install_cubase_script_cmd() -> InstallScriptResponse {
    install_cubase_script_to_disk()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shared_state = AppSharedState::new();
    let midi_handle = MidiBridgeHandle::spawn(shared_state.clone());

    let web_ctx = WebAppContext {
        state: shared_state.clone(),
        midi: midi_handle.clone(),
    };

    tauri::Builder::default()
        .manage(shared_state)
        .manage(midi_handle)
        .invoke_handler(tauri::generate_handler![
            get_host_info_cmd,
            connect_midi_cmd,
            install_cubase_script_cmd
        ])
        .setup(move |_app| {
            tauri::async_runtime::spawn(async move {
                start_web_server(web_ctx).await;
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Cubase Web Remote application");
}
