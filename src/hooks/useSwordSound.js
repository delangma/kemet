import { useEffect, useRef } from "react";

export function useSwordSound(combatData, volume = 0.6) {
  const prevCombatId = useRef(null);

  useEffect(() => {
    const id = combatData?.id ?? combatData?.zoneId ?? null;
    if (id && id !== prevCombatId.current) {
      const audio = new Audio("/MP3_sound_effect/sword.mp3");
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.play().catch(() => {});
    }
    prevCombatId.current = id;
  });
}
