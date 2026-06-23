import { useState } from "react";

const KEY = "kmt_volume";

export function useVolume(defaultVolume = 0.5) {
  const [volume, setVolume] = useState(() => {
    const stored = localStorage.getItem(KEY);
    return stored !== null ? parseFloat(stored) : defaultVolume;
  });

  function setAndSave(v) {
    const clamped = Math.max(0, Math.min(1, v));
    setVolume(clamped);
    localStorage.setItem(KEY, String(clamped));
  }

  return [volume, setAndSave];
}
