import { useEffect, useRef } from "react";

export function useDrawCardSound(gameState, playerId, volume = 0.5) {
  const prevCount = useRef(null);

  useEffect(() => {
    const cards = gameState?.players?.[playerId]?.idCards;
    if (!Array.isArray(cards)) return;
    const count = cards.length;
    if (prevCount.current !== null && count > prevCount.current) {
      const audio = new Audio("/MP3_sound_effect/draw_card.mp3");
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.play().catch(() => {});
    }
    prevCount.current = count;
  });
}
