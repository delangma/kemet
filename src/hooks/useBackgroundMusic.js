import { useEffect } from "react";

export function useBackgroundMusic(tracks) {
  useEffect(() => {
    if (!tracks?.length) return;

    let cancelled = false;
    const audio = new Audio();
    audio.volume = 0.5;

    const isSingle = tracks.length === 1;
    let playlist = isSingle ? [] : [...tracks].sort(() => Math.random() - 0.5);
    let idx = 0;

    function playNext() {
      if (cancelled) return;
      if (idx >= playlist.length) {
        playlist = [...tracks].sort(() => Math.random() - 0.5);
        idx = 0;
      }
      audio.src = playlist[idx++];
      audio.play().catch(() => {});
    }

    // Configure l'audio avant toute tentative de play
    if (isSingle) {
      audio.src = tracks[0];
      audio.loop = true;
    } else {
      audio.addEventListener("ended", playNext);
      audio.src = playlist[idx++];
    }

    function onInteraction() {
      if (cancelled) return;
      removeListeners();
      audio.play().catch(() => {});
    }

    function removeListeners() {
      window.removeEventListener("click",      onInteraction);
      window.removeEventListener("keydown",    onInteraction);
      window.removeEventListener("touchstart", onInteraction);
    }

    audio.play().catch(() => {
      if (cancelled) return;
      window.addEventListener("click",      onInteraction);
      window.addEventListener("keydown",    onInteraction);
      window.addEventListener("touchstart", onInteraction);
    });

    return () => {
      cancelled = true;
      removeListeners();
      if (!isSingle) audio.removeEventListener("ended", playNext);
      audio.pause();
      audio.src = "";
    };
  }, []);
}
