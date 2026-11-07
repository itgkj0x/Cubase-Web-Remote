use crate::state::AppSharedState;
use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiPortList {
    /// Available system MIDI input ports (Server receives FROM Cubase here, e.g. "CubaseWeb_Out")
    pub inputs: Vec<String>,
    /// Available system MIDI output ports (Server sends TO Cubase here, e.g. "CubaseWeb_In")
    pub outputs: Vec<String>,
}

pub fn list_midi_ports() -> MidiPortList {
    let mut inputs = Vec::new();
    let mut outputs = Vec::new();

    if let Ok(midi_in) = MidiInput::new("CubaseWebRemote_Scanner_In") {
        for p in midi_in.ports() {
            if let Ok(name) = midi_in.port_name(&p) {
                inputs.push(name);
            }
        }
    }

    if let Ok(midi_out) = MidiOutput::new("CubaseWebRemote_Scanner_Out") {
        for p in midi_out.ports() {
            if let Ok(name) = midi_out.port_name(&p) {
                outputs.push(name);
            }
        }
    }

    MidiPortList { inputs, outputs }
}

#[derive(Default)]
struct PacketAssembler {
    msg_type: u8,
    ascii_buf: Vec<u8>,
    nibbles: Vec<u8>,
}

impl PacketAssembler {
    fn decode_utf16(&self) -> String {
        let mut units = Vec::with_capacity(self.nibbles.len() / 4);
        for chunk in self.nibbles.chunks_exact(4) {
            let code = ((chunk[0] as u16 & 0x0F) << 12)
                | ((chunk[1] as u16 & 0x0F) << 8)
                | ((chunk[2] as u16 & 0x0F) << 4)
                | (chunk[3] as u16 & 0x0F);
            units.push(code);
        }
        String::from_utf16_lossy(&units)
    }

    fn decode_ascii(&self) -> String {
        String::from_utf8_lossy(&self.ascii_buf).trim().to_string()
    }
}

#[derive(Debug, Clone)]
pub enum MidiCmd {
    Connect {
        in_port: Option<String>,
        out_port: Option<String>,
    },
    RawSend(Vec<u8>),
    JumpToTime(String),
    RequestSync,
}

#[derive(Clone)]
pub struct MidiBridgeHandle {
    tx: Sender<MidiCmd>,
    state: Arc<AppSharedState>,
}

impl MidiBridgeHandle {
    pub fn spawn(state: Arc<AppSharedState>) -> Self {
        let (tx, rx) = mpsc::channel::<MidiCmd>();
        let worker_state = state.clone();

        thread::spawn(move || {
            let mut active_in: Option<MidiInputConnection<()>> = None;
            let mut active_out: Option<MidiOutputConnection> = None;

            while let Ok(cmd) = rx.recv() {
                match cmd {
                    MidiCmd::Connect { in_port, out_port } => {
                        // Drop previous connections first so Windows releases handles cleanly
                        drop(active_in.take());
                        drop(active_out.take());

                        let mut connected_in_name = String::new();
                        let mut connected_out_name = String::new();

                        // 1. Open MIDI Input (Receiving from Cubase Output, default "CubaseWeb_Out")
                        if let Ok(mut midi_in) = MidiInput::new("CubaseWebRemote_In") {
                            midi_in.ignore(Ignore::None);
                            let ports = midi_in.ports();
                            let target = ports.into_iter().find(|p| {
                                if let Ok(name) = midi_in.port_name(p) {
                                    if let Some(ref req) = in_port {
                                        name == *req || name.contains(req)
                                    } else {
                                        name.to_lowercase().contains("cubaseweb_out")
                                    }
                                } else {
                                    false
                                }
                            });

                            if let Some(port) = target {
                                if let Ok(port_name) = midi_in.port_name(&port) {
                                    let cb_state = worker_state.clone();
                                    let assembler = Arc::new(Mutex::new(PacketAssembler::default()));
                                    if let Ok(conn) = midi_in.connect(
                                        &port,
                                        "cubase-web-in-conn",
                                        move |_stamp, message, _| {
                                            handle_incoming_midi(&cb_state, &assembler, message);
                                        },
                                        (),
                                    ) {
                                        connected_in_name = port_name;
                                        active_in = Some(conn);
                                    }
                                }
                            }
                        }

                        // 2. Open MIDI Output (Sending to Cubase Input, default "CubaseWeb_In")
                        if let Ok(midi_out) = MidiOutput::new("CubaseWebRemote_Out") {
                            let ports = midi_out.ports();
                            let target = ports.into_iter().find(|p| {
                                if let Ok(name) = midi_out.port_name(p) {
                                    if let Some(ref req) = out_port {
                                        name == *req || name.contains(req)
                                    } else {
                                        name.to_lowercase().contains("cubaseweb_in")
                                    }
                                } else {
                                    false
                                }
                            });

                            if let Some(port) = target {
                                if let Ok(port_name) = midi_out.port_name(&port) {
                                    if let Ok(mut conn) =
                                        midi_out.connect(&port, "cubase-web-out-conn")
                                    {
                                        connected_out_name = port_name;
                                        // Trigger CC 29 (Sync Ping) so Cubase sends full state dump immediately
                                        let _ = conn.send(&[0xB0, 29, 127]);
                                        thread::sleep(Duration::from_millis(15));
                                        let _ = conn.send(&[0xB0, 29, 0]);
                                        active_out = Some(conn);
                                    }
                                }
                            }
                        }

                        let both_ok = active_in.is_some() && active_out.is_some();
                        {
                            let mut d = worker_state.daw.write();
                            d.midi_connected = both_ok;
                            if !both_ok {
                                d.cubase_ready = false;
                            }
                            d.midi_in_port = connected_in_name;
                            d.midi_out_port = connected_out_name;
                        }
                        worker_state.broadcast_daw();
                    }

                    MidiCmd::RawSend(bytes) => {
                        if let Some(ref mut out) = active_out {
                            let _ = out.send(&bytes);
                        }
                    }

                    MidiCmd::JumpToTime(time_str) => {
                        if let Some(ref mut out) = active_out {
                            // Pure 3-byte CC stream on Ch3 (0xB2) so MIDI SysEx Filters never block it:
                            // CC 10 = Reset buffer, CC 11 = Append ASCII char, CC 12 = Commit setTime
                            let _ = out.send(&[0xB2, 10, 127]);
                            thread::sleep(Duration::from_millis(2));
                            let _ = out.send(&[0xB2, 10, 0]);

                            for b in time_str.bytes() {
                                if (0x20..=0x7E).contains(&b) {
                                    let _ = out.send(&[0xB2, 11, b]);
                                    thread::sleep(Duration::from_millis(2));
                                    let _ = out.send(&[0xB2, 11, 0]);
                                    thread::sleep(Duration::from_millis(2));
                                }
                            }

                            let _ = out.send(&[0xB2, 12, 127]);
                            thread::sleep(Duration::from_millis(2));
                            let _ = out.send(&[0xB2, 12, 0]);
                        }
                    }

                    MidiCmd::RequestSync => {
                        if let Some(ref mut out) = active_out {
                            // Send Ch1 CC 29 momentary press to request full state dump from Cubase
                            let _ = out.send(&[0xB0, 29, 127]);
                            thread::sleep(Duration::from_millis(15));
                            let _ = out.send(&[0xB0, 29, 0]);
                        }
                    }
                }
            }
        });

        let handle = Self { tx, state };
        handle.connect_ports(None, None);

        // Background auto-discovery & handshake loop:
        // If loopMIDI or Cubase is launched AFTER this app, automatically link up without manual clicks!
        let bg_handle = handle.clone();
        thread::spawn(move || loop {
            thread::sleep(Duration::from_secs(3));
            let (midi_ok, cubase_ok) = {
                let d = bg_handle.state.daw.read();
                (d.midi_connected, d.cubase_ready)
            };
            if !midi_ok {
                bg_handle.connect_ports(None, None);
            } else if !cubase_ok {
                bg_handle.request_sync();
            }
        });

        handle
    }

    pub fn connect_ports(&self, in_port: Option<String>, out_port: Option<String>) {
        let _ = self.tx.send(MidiCmd::Connect { in_port, out_port });
    }

    /// Press (127) and release (0) momentary CC on Channel 1 (0xB0)
    pub fn trigger_cc(&self, cc: u8) {
        if cc == 10 || cc == 12 {
            let mut d = self.state.daw.write();
            if !d.playing && !d.recording {
                d.last_start_time = d.primary_time.clone();
            }
        }

        let _ = self.tx.send(MidiCmd::RawSend(vec![0xB0, cc & 0x7F, 127]));
        let tx_clone = self.tx.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(25)).await;
            let _ = tx_clone.send(MidiCmd::RawSend(vec![0xB0, cc & 0x7F, 0]));
        });
    }

    pub fn set_momentary_cc(&self, cc: u8, pressed: bool) {
        let val = if pressed { 127 } else { 0 };
        let _ = self.tx.send(MidiCmd::RawSend(vec![0xB0, cc & 0x7F, val]));
    }

    pub fn set_fader_cc(&self, cc: u8, value: u8) {
        let _ = self
            .tx
            .send(MidiCmd::RawSend(vec![0xB0, cc & 0x7F, value.min(127)]));
    }

    pub fn jump_to_time(&self, time_str: String) {
        let _ = self.tx.send(MidiCmd::JumpToTime(time_str));
    }

    pub fn request_sync(&self) {
        let _ = self.tx.send(MidiCmd::RequestSync);
    }

    /// 1-Tap Studio Retake Macro:
    /// Stop -> Undo (if recording was active) -> Return to take start time -> Record
    pub fn execute_retake(&self) {
        let handle = self.clone();
        let (was_recording, start_time) = {
            let d = self.state.daw.read();
            (d.recording, d.last_start_time.clone())
        };

        tauri::async_runtime::spawn(async move {
            handle.trigger_cc(11);
            tokio::time::sleep(Duration::from_millis(140)).await;

            if was_recording {
                handle.trigger_cc(24);
                tokio::time::sleep(Duration::from_millis(150)).await;
            }

            if !start_time.is_empty() {
                handle.jump_to_time(start_time);
            } else {
                handle.trigger_cc(23);
            }
            tokio::time::sleep(Duration::from_millis(130)).await;

            handle.trigger_cc(12);
        });
    }
}

fn handle_incoming_midi(
    state: &Arc<AppSharedState>,
    assembler: &Arc<Mutex<PacketAssembler>>,
    msg: &[u8],
) {
    if msg.is_empty() {
        return;
    }

    // Native output-binding wake heartbeat on Channel 16 CC 127 (0xBF, 127, val)
    if msg.len() >= 3 && msg[0] == 0xBF && msg[1] == 127 {
        let was_ready = {
            let mut d = state.daw.write();
            let prev = d.cubase_ready;
            d.cubase_ready = true;
            prev
        };
        if !was_ready {
            state.broadcast_daw();
        }
        return;
    }

    // 1. Channel 2 Control Change Feedback (0xB1, cc, val) -> Discrete states & Volume
    if msg.len() >= 3 && msg[0] == 0xB1 {
        let cc = msg[1];
        let val = msg[2];
        let is_on = val >= 64;

        let mut changed = true;
        {
            let mut d = state.daw.write();
            d.cubase_ready = true;
            match cc {
                10 => {
                    if !d.playing && is_on {
                        d.last_start_time = d.primary_time.clone();
                    }
                    d.playing = is_on;
                    d.stopped = !is_on;
                }
                11 => {
                    d.stopped = is_on;
                    if is_on {
                        d.playing = false;
                        d.recording = false;
                    }
                }
                12 => d.recording = is_on,
                13 => d.cycle = is_on,
                14 => d.metronome = is_on,
                62 => d.track_rec_enable = is_on,
                63 => d.track_monitor = is_on,
                64 => d.track_mute = is_on,
                65 => d.track_solo = is_on,
                66 => d.track_vol_cc = val,
                _ => changed = false,
            }
        }
        if changed {
            state.broadcast_daw();
        }
        return;
    }

    // 2. Channel 3 Control Change Mini-Packet Stream (0xB2, cmd, val) -> Timecode & Text
    if msg.len() >= 3 && msg[0] == 0xB2 {
        let cmd = msg[1];
        let val = msg[2];

        let mut asm = assembler.lock();
        match cmd {
            0x00 => {
                asm.msg_type = val;
                asm.ascii_buf.clear();
                asm.nibbles.clear();
            }
            0x01 => {
                if asm.ascii_buf.len() < 128 {
                    asm.ascii_buf.push(val);
                }
            }
            0x02 => {
                if asm.nibbles.len() < 256 {
                    asm.nibbles.push(val & 0x0F);
                }
            }
            0x03 => {
                let mtype = asm.msg_type;
                match mtype {
                    // 1 = Primary Time
                    1 => {
                        let text = asm.decode_ascii();
                        if !text.is_empty() {
                            let mut d = state.daw.write();
                            d.cubase_ready = true;
                            d.primary_time = text;
                        }
                        drop(asm);
                        state.broadcast_time();
                    }
                    // 2 = Primary Format (UTF-16)
                    2 => {
                        let fmt = asm.decode_utf16();
                        if !fmt.trim().is_empty() {
                            let mut d = state.daw.write();
                            d.cubase_ready = true;
                            d.primary_format = fmt;
                        }
                        drop(asm);
                        state.broadcast_time();
                    }
                    // 3 = Secondary Time
                    3 => {
                        let sec = asm.decode_ascii();
                        if !sec.is_empty() {
                            let mut d = state.daw.write();
                            d.cubase_ready = true;
                            d.secondary_time = sec;
                        }
                        drop(asm);
                        state.broadcast_time();
                    }
                    // 4 = Left Locator
                    4 => {
                        let left = asm.decode_ascii();
                        if !left.is_empty() {
                            let mut d = state.daw.write();
                            d.left_locator = left;
                        }
                        drop(asm);
                        state.broadcast_time();
                    }
                    // 5 = Right Locator
                    5 => {
                        let right = asm.decode_ascii();
                        if !right.is_empty() {
                            let mut d = state.daw.write();
                            d.right_locator = right;
                        }
                        drop(asm);
                        state.broadcast_time();
                    }
                    // 6 = Selected Track Name (UTF-16)
                    6 => {
                        let name = asm.decode_utf16();
                        {
                            let mut d = state.daw.write();
                            d.cubase_ready = true;
                            d.track_name = if name.trim().is_empty() {
                                "No Track Selected".to_string()
                            } else {
                                name
                            };
                        }
                        drop(asm);
                        state.broadcast_daw();
                    }
                    // 7 = Track Volume dB Text
                    7 => {
                        let vol_str = asm.decode_ascii();
                        if !vol_str.is_empty() {
                            let mut d = state.daw.write();
                            d.track_vol_db = vol_str;
                        }
                        drop(asm);
                        state.broadcast_daw();
                    }
                    // 15 = READY Pong
                    15 => {
                        {
                            let mut d = state.daw.write();
                            d.cubase_ready = true;
                        }
                        drop(asm);
                        state.broadcast_daw();
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
}
