import React, { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  RefreshCw,
  Smartphone,
  Cable,
  Cpu,
} from "lucide-react";
import {
  ClientCommand,
  DawState,
  HostInfoResponse,
  InstallScriptResponse,
} from "../types/protocol";
import { isTauriDesktop, resolveApiBaseUrl } from "../hooks/useRemoteSocket";

interface HostDashboardProps {
  daw: DawState;
  wsConnected: boolean;
  sendCommand: (cmd: ClientCommand) => void;
  onOpenRemoteView: () => void;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  daw,
  wsConnected,
  sendCommand,
  onOpenRemoteView,
}) => {
  const [hostInfo, setHostInfo] = useState<HostInfoResponse | null>(null);
  const [selectedIp, setSelectedIp] = useState<string>("");
  const [inPortSel, setInPortSel] = useState<string>("");
  const [outPortSel, setOutPortSel] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [installMsg, setInstallMsg] = useState<InstallScriptResponse | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const fetchHostInfo = useCallback(async () => {
    try {
      let info: HostInfoResponse;
      if (isTauriDesktop()) {
        info = await invoke<HostInfoResponse>("get_host_info_cmd");
      } else {
        const base = await resolveApiBaseUrl();
        const res = await fetch(`${base}/api/host-info`);
        info = (await res.json()) as HostInfoResponse;
      }
      setHostInfo(info);
      setSelectedIp((prev) =>
        prev && info.ips.includes(prev) ? prev : info.ips[0] || "127.0.0.1"
      );
    } catch {
      // Ignore transient startup race
    }
  }, []);

  useEffect(() => {
    fetchHostInfo();
  }, [fetchHostInfo, daw.midiConnected]);

  useEffect(() => {
    if (daw.midiInPort && !inPortSel) setInPortSel(daw.midiInPort);
    if (daw.midiOutPort && !outPortSel) setOutPortSel(daw.midiOutPort);
  }, [daw.midiInPort, daw.midiOutPort, inPortSel, outPortSel]);

  const remoteUrl = hostInfo
    ? `http://${selectedIp || "127.0.0.1"}:${hostInfo.port}/?view=remote`
    : "http://127.0.0.1:3840/?view=remote";

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(remoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleConnectMidi = async () => {
    setBusy(true);
    try {
      let info: HostInfoResponse;
      const inArg = inPortSel || null;
      const outArg = outPortSel || null;
      if (isTauriDesktop()) {
        info = await invoke<HostInfoResponse>("connect_midi_cmd", {
          inPort: inArg,
          outPort: outArg,
        });
      } else {
        const base = await resolveApiBaseUrl();
        const res = await fetch(`${base}/api/connect-midi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inPort: inArg, outPort: outArg }),
        });
        info = (await res.json()) as HostInfoResponse;
      }
      setHostInfo(info);
    } finally {
      setBusy(false);
    }
  };

  const handleInstallScript = async () => {
    setBusy(true);
    try {
      let result: InstallScriptResponse;
      if (isTauriDesktop()) {
        result = await invoke<InstallScriptResponse>(
          "install_cubase_script_cmd"
        );
      } else {
        const base = await resolveApiBaseUrl();
        const res = await fetch(`${base}/api/install-script`, {
          method: "POST",
        });
        result = (await res.json()) as InstallScriptResponse;
      }
      setInstallMsg(result);
      await fetchHostInfo();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100 p-5 sm:p-7">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              Cubase Web Remote — Host Server
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Cubase 15 Pro 対応 · 低遅延 Live 同期 & 宅録リモートサーバー
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenRemoteView}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center gap-2 transition shadow-lg shadow-cyan-500/20"
          >
            <Smartphone className="w-4 h-4" />
            このPCでリモコン画面を開く
          </button>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Card: QR Code for iPhone / iPad / Android */}
          <div className="md:col-span-5 rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col items-center text-center gap-4">
            <div className="text-sm font-bold text-white">
              スマホ / iPad カメラで読み取って接続
            </div>

            <div className="p-4 rounded-2xl bg-white shadow-xl">
              <QRCodeSVG value={remoteUrl} size={196} level="M" />
            </div>

            {/* LAN IP Selector */}
            {hostInfo && hostInfo.ips.length > 1 && (
              <div className="w-full text-left">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Wi-Fi / LAN ネットワークアダプタ選択
                </label>
                <select
                  value={selectedIp}
                  onChange={(e) => setSelectedIp(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-mono text-white"
                >
                  {hostInfo.ips.map((ip) => (
                    <option key={ip} value={ip}>
                      {ip}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* URL Copy Box */}
            <div className="w-full flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <span className="font-mono text-xs text-cyan-300 truncate flex-1 text-left">
                {remoteUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    コピー済
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    URLコピー
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              ※ PCとスマホ/iPadを同じWi-Fiに接続してください。初回起動時にWindowsファイアウォールの確認が出た場合は「プライベートネットワーク」を許可してください。
            </p>
          </div>

          {/* Right Column: 3-Step Setup & Live Diagnostics */}
          <div className="md:col-span-7 flex flex-col gap-4">
            {/* Step 1: Cubase MIDI Remote Script Install */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <Download className="w-4 h-4 text-cyan-400" />
                  1. Cubase 15 Pro スクリプト導入
                </div>
                {hostInfo?.scriptInstalled ? (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    配置済み
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    未配置
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400">
                ボタンを押すと Cubase の{" "}
                <code className="text-slate-300">Driver Scripts/Local</code>{" "}
                フォルダへ専用スクリプトを自動配置します。
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleInstallScript}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white transition"
                >
                  {hostInfo?.scriptInstalled
                    ? "スクリプトを最新に上書き更新"
                    : "Cubaseにスクリプトを自動インストール"}
                </button>
              </div>

              {installMsg && (
                <div
                  className={`rounded-xl p-2.5 text-xs ${
                    installMsg.ok
                      ? "bg-emerald-950/50 border border-emerald-700/50 text-emerald-200"
                      : "bg-red-950/50 border border-red-700/50 text-red-200"
                  }`}
                >
                  {installMsg.message}
                </div>
              )}
            </div>

            {/* Step 2: loopMIDI Virtual Port Connection */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <Cable className="w-4 h-4 text-cyan-400" />
                  2. 仮想MIDIポート接続 (loopMIDI)
                </div>
                {daw.midiConnected ? (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    MIDI接続完了
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    ポート待機中
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400">
                <strong>loopMIDI</strong> で{" "}
                <code className="text-cyan-300">CubaseWeb_In</code> と{" "}
                <code className="text-cyan-300">CubaseWeb_Out</code>{" "}
                の2つのポートを作成すると自動認識されます。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    受信ポート (Cubase Out → Server)
                  </label>
                  <select
                    value={inPortSel}
                    onChange={(e) => setInPortSel(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white"
                  >
                    <option value="">自動検出 (CubaseWeb_Out)</option>
                    {hostInfo?.midiPorts.inputs.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    送信ポート (Server → Cubase In)
                  </label>
                  <select
                    value={outPortSel}
                    onChange={(e) => setOutPortSel(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-white"
                  >
                    <option value="">自動検出 (CubaseWeb_In)</option>
                    {hostInfo?.midiPorts.outputs.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] font-mono text-slate-400">
                  現在: In={daw.midiInPort || "未接続"} / Out=
                  {daw.midiOutPort || "未接続"}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleConnectMidi}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  再スキャン・接続
                </button>
              </div>
            </div>

            {/* Step 3: Live Cubase Telemetry Monitor */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm text-white">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  3. Cubase リアルタイム同期ステータス
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      daw.cubaseReady && wsConnected
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    {daw.cubaseReady
                      ? "● Cubase 双方向リンク稼働中"
                      : "Cubase 応答待ち"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      sendCommand({ type: "transport", action: "sync" })
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-200 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    状態取得
                  </button>
                </div>
              </div>

              {daw.midiConnected && !daw.cubaseReady && (
                <div className="rounded-xl bg-amber-950/40 border border-amber-700/50 p-2.5 text-xs text-amber-200 leading-relaxed">
                  <strong>操作は動くのに現在位置が表示されない場合：</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-0.5 text-[11px] text-amber-100/90">
                    <li>
                      上の <strong>「スクリプトを最新に上書き更新」</strong> を押す
                    </li>
                    <li>
                      <strong>Cubase を一度終了して再起動</strong>する（または下部ゾーン「MIDI Remote」右上の歯車「ツールバーを設定」→「スクリプトツール」にチェックを入れて「スクリプトを再読み込み」を押す）
                    </li>
                  </ol>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono">
                <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800">
                  <div className="text-[10px] text-slate-500">POSITION</div>
                  <div className="text-white font-bold mt-0.5">
                    {daw.primaryTime}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800">
                  <div className="text-[10px] text-slate-500">TRANSPORT</div>
                  <div className="text-white font-bold mt-0.5">
                    {daw.recording
                      ? "REC"
                      : daw.playing
                        ? "PLAY"
                        : "STOP"}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800">
                  <div className="text-[10px] text-slate-500">TRACK</div>
                  <div className="text-white font-bold mt-0.5 truncate">
                    {daw.trackName}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
