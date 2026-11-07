import React, { useState } from "react";
import { isTauriDesktop, useRemoteSocket } from "./hooks/useRemoteSocket";
import { HostDashboard } from "./components/HostDashboard";
import { RemoteController } from "./components/RemoteController";

export const App: React.FC = () => {
  const { wsConnected, latencyMs, daw, setlist, sendCommand } =
    useRemoteSocket();

  // Default to Host Dashboard on PC Tauri window unless ?view=remote is set;
  // Default to Remote Controller WebUI on smartphones / iPads / LAN browsers.
  const isHostDefault =
    isTauriDesktop() &&
    !window.location.search.includes("view=remote");

  const [view, setView] = useState<"host" | "remote">(
    isHostDefault ? "host" : "remote"
  );

  if (view === "host") {
    return (
      <HostDashboard
        daw={daw}
        wsConnected={wsConnected}
        sendCommand={sendCommand}
        onOpenRemoteView={() => setView("remote")}
      />
    );
  }

  return (
    <RemoteController
      wsConnected={wsConnected}
      latencyMs={latencyMs}
      daw={daw}
      setlist={setlist}
      sendCommand={sendCommand}
      showBackToHost={isTauriDesktop() || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"}
      onBackToHost={() => setView("host")}
    />
  );
};

export default App;
