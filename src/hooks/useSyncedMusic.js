import { useEffect, useRef } from "react";
import { ref, onValue, update, get } from "firebase/database";
import { db } from "../firebase";

/**
 * Musique synchronisée "radio".
 *
 * Synchronisation technique :
 *  - Firebase stocke { playlist, currentIdx, startedAt } où startedAt est un
 *    timestamp ms (Date.now()) enregistré au moment où la piste a commencé.
 *  - Chaque client calcule sa position en temps réel :
 *      position = (Date.now() - startedAt) / 1000
 *    et applique ce seek au moment précis où l'audio est prêt à jouer
 *    (événement "canplay"), pas au moment où Firebase répond.
 *  - Une resynchronisation toutes les 5 s corrige la dérive résiduelle.
 */
export function useSyncedMusic(tracks, path, volume = 0.5) {
  const audioRef = useRef(null);
  const stateRef = useRef(null);

  // Applique le volume dès qu'il change, sans relancer l'audio
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!tracks?.length || !path) return;

    let cancelled = false;
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;
    const isSingle = tracks.length === 1;
    if (isSingle) audio.loop = true;

    const musicRef = ref(db, path);
    let unsubscribe = null;
    let interactionCleanup = null;
    let resyncTimer = null;

    // ── Lecture ──────────────────────────────────────────────────────────────

    function tryPlay() {
      audio.play().catch(() => {
        if (cancelled) return;
        const handler = () => {
          if (cancelled) return;
          cleanup();
          audio.play().catch(() => {});
        };
        const cleanup = () => {
          window.removeEventListener("click",   handler);
          window.removeEventListener("keydown", handler);
        };
        interactionCleanup = cleanup;
        window.addEventListener("click",   handler);
        window.addEventListener("keydown", handler);
      });
    }

    // Calcule la position actuelle d'après l'état Firebase
    function expectedTime(state) {
      return (Date.now() - (state.startedAt ?? Date.now())) / 1000;
    }

    // Resynchronisation périodique (corrige la dérive sans relancer le chargement)
    function startResync(state) {
      if (resyncTimer) clearInterval(resyncTimer);
      resyncTimer = setInterval(() => {
        if (cancelled || audio.paused || !state) return;
        const expected = expectedTime(state);
        if (isSingle && audio.duration) {
          const loop = expected % audio.duration;
          if (Math.abs(audio.currentTime - loop) > 1) audio.currentTime = loop;
        } else if (!isSingle) {
          if (Math.abs(audio.currentTime - expected) > 1) audio.currentTime = expected;
        }
      }, 5000);
    }

    function applyState(state) {
      if (cancelled || !state?.playlist?.length) return;
      stateRef.current = state;

      const idx     = Math.min(state.currentIdx ?? 0, state.playlist.length - 1);
      const src     = state.playlist[idx];
      const fullSrc = new URL(src, window.location.origin).href;

      if (audio.src === fullSrc) {
        // Même piste : juste corriger la dérive éventuelle
        if (!isSingle) {
          const drift = Math.abs(audio.currentTime - expectedTime(state));
          if (drift > 2) audio.currentTime = Math.max(0, expectedTime(state));
        }
        startResync(state);
        return;
      }

      // Nouvelle piste : charger et seeker au bon endroit une fois prêt
      audio.src = src;

      audio.oncanplay = () => {
        if (cancelled) return;
        audio.oncanplay = null;
        // Recalcul MAINTENANT (après chargement) pour annuler le délai de buffering
        const pos = expectedTime(stateRef.current ?? state);
        if (isSingle && audio.duration) {
          audio.currentTime = pos % audio.duration;
        } else {
          audio.currentTime = Math.max(0, pos);
        }
        tryPlay();
        startResync(stateRef.current ?? state);
      };
    }

    // ── Fin de piste → avance dans Firebase ──────────────────────────────────

    function handleEnded() {
      if (cancelled || isSingle) return;
      get(musicRef).then(snap => {
        if (cancelled || !snap.exists()) return;
        const { playlist, currentIdx } = snap.val();
        let nextIdx      = (currentIdx ?? 0) + 1;
        let nextPlaylist = playlist;
        if (nextIdx >= playlist.length) {
          nextIdx      = 0;
          nextPlaylist = [...tracks].sort(() => Math.random() - 0.5);
        }
        update(musicRef, { playlist: nextPlaylist, currentIdx: nextIdx, startedAt: Date.now() });
      });
    }

    audio.addEventListener("ended", handleEnded);

    // ── Init Firebase ─────────────────────────────────────────────────────────

    get(musicRef).then(snap => {
      if (cancelled) return;
      if (!snap.exists()) {
        const playlist = isSingle ? tracks : [...tracks].sort(() => Math.random() - 0.5);
        update(musicRef, { playlist, currentIdx: 0, startedAt: Date.now() });
      }
      unsubscribe = onValue(musicRef, s => { if (s.exists()) applyState(s.val()); });
    });

    return () => {
      cancelled = true;
      audioRef.current = null;
      if (interactionCleanup) interactionCleanup();
      if (resyncTimer) clearInterval(resyncTimer);
      audio.removeEventListener("ended", handleEnded);
      audio.oncanplay = null;
      if (unsubscribe) unsubscribe();
      audio.pause();
      audio.src = "";
    };
  }, [path]);
}
