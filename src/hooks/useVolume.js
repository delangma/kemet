import { useState } from "react";
import { getCookie, setCookie } from "../utils/cookies";

export function useVolume(key = "kmt_volume", defaultVolume = 0.5) {
  const [volume, setVolume] = useState(() => {
    const stored = getCookie(key);
    return stored !== null ? parseFloat(stored) : defaultVolume;
  });

  function setAndSave(v) {
    const clamped = Math.max(0, Math.min(1, v));
    setVolume(clamped);
    setCookie(key, String(clamped));
  }

  return [volume, setAndSave];
}
