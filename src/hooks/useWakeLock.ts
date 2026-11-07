import { useCallback, useEffect, useRef, useState } from "react";

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
}

export function useWakeLock(enabledByDefault = true) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [wantLock, setWantLock] = useState(enabledByDefault);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  const requestLock = useCallback(async () => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        setActive(true);
        return;
      }
      const sentinel = await nav.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener("release", () => {
        setActive(false);
      });
    } catch {
      // Browser may require a user gesture first; we also retry on pointerdown
      setActive(false);
    }
  }, []);

  const releaseLock = useCallback(async () => {
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        await sentinelRef.current.release();
      }
    } catch {
      // Ignore release errors
    } finally {
      sentinelRef.current = null;
      setActive(false);
    }
  }, []);

  useEffect(() => {
    const hasApi = "wakeLock" in navigator;
    setSupported(hasApi);
    if (!hasApi) return;

    if (wantLock) {
      requestLock();
    } else {
      releaseLock();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && wantLock) {
        requestLock();
      }
    };

    const onFirstTap = () => {
      if (wantLock && (!sentinelRef.current || sentinelRef.current.released)) {
        requestLock();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointerdown", onFirstTap, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointerdown", onFirstTap);
    };
  }, [wantLock, requestLock, releaseLock]);

  const toggleWakeLock = useCallback(() => {
    setWantLock((prev) => !prev);
  }, []);

  return {
    supported,
    active,
    wantLock,
    toggleWakeLock,
  };
}
