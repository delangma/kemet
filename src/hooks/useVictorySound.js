import { useEffect, useRef } from "react";

/**
 * Joue Victory_Sound.wav quand playerId remporte un combat (une seule fois
 * par combat, dès que postCombat.winnerId lui est attribué).
 */
export function useVictorySound(combatData, playerId, volume = 0.6) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!combatData) {
      firedRef.current = false;
      return;
    }
    const winnerId = combatData?.postCombat?.winnerId;
    if (!firedRef.current && winnerId && winnerId === playerId) {
      firedRef.current = true;
      const audio = new Audio("/MP3_sound_effect/Victory_Sound.wav");
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.play().catch(() => {});
    }
  });
}
