import { useEffect, useRef } from "react";

/**
 * Joue Coin.mp3 dès qu'un joueur gagne de l'ank.
 * Comparaison ref-based : pas de dépendance explicite → s'exécute à chaque render
 * mais ne joue le son que si une valeur a réellement augmenté.
 */
export function useCoinSound(gameState, volume = 0.5) {
  const prevAnk = useRef(null);

  useEffect(() => {
    const players = gameState?.players;
    if (!players) return;

    const snapshot = {};
    for (const [pid, pState] of Object.entries(players)) {
      snapshot[pid] = pState.ank ?? 0;
    }

    if (prevAnk.current !== null) {
      const gained = Object.entries(snapshot).some(
        ([pid, ank]) => ank > (prevAnk.current[pid] ?? ank)
      );
      if (gained) {
        const audio = new Audio("/MP3_sound_effect/Coin.mp3");
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.play().catch(() => {});
      }
    }

    prevAnk.current = snapshot;
  });
}
