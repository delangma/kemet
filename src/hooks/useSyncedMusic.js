import { useState, useEffect, useRef } from "react";
import { ref, onValue, update, get } from "firebase/database";
import { db } from "../firebase";

/**
 * Musique synchronisée multi-radio.
 *
 * radios  : { "Nom Radio": ["/chemin/track1.mp3", ...], ... }
 * path    : chemin Firebase où stocker l'état partagé
 * volume  : volume (0-1)
 *
 * Retourne [currentRadio, changeRadio] :
 *   - currentRadio  : nom de la radio en cours (string | null)
 *   - changeRadio   : (radioName) => void  — change la radio pour tous les joueurs
 *
 * Structure Firebase :
 *   { selectedRadio, playlist, currentIdx, startedAt }
 *
 * Synchronisation :
 *   - startedAt = timestamp ms du début de la piste en cours
 *   - Chaque client calcule sa position : (Date.now() - startedAt) / 1000
 *   - Resynchronisation toutes les 5 s
 *   - Quand une piste se termine, le premier client qui le détecte avance dans la playlist
 *   - Quand la playlist est épuisée, elle est remélangée
 */
export function useSyncedMusic(radios, path, volume = 0.5) {
  const audioRef = useRef(null);
  const stateRef = useRef(null);
  const [currentRadio, setCurrentRadio] = useState(null);

  // Applique le volume sans relancer l'audio
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!path || !radios) return;

    let cancelled = false;
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

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
          removeListeners();
          audio.play().catch(() => {});
        };
        const removeListeners = () => {
          window.removeEventListener("click",   handler);
          window.removeEventListener("keydown", handler);
        };
        interactionCleanup = removeListeners;
        window.addEventListener("click",   handler);
        window.addEventListener("keydown", handler);
      });
    }

    function expectedTime(state) {
      return (Date.now() - (state.startedAt ?? Date.now())) / 1000;
    }

    function startResync(state) {
      if (resyncTimer) clearInterval(resyncTimer);
      resyncTimer = setInterval(() => {
        if (cancelled || audio.paused || !state) return;
        const expected = expectedTime(state);
        if (Math.abs(audio.currentTime - expected) > 1) {
          audio.currentTime = Math.max(0, expected);
        }
      }, 5000);
    }

    // ── Réinitialise vers une radio ──────────────────────────────────────────

    function resetToRadio(radioName) {
      if (cancelled) return;
      const tracks = radios[radioName];
      if (!tracks?.length) return;
      const playlist = [...tracks].sort(() => Math.random() - 0.5);
      update(musicRef, { selectedRadio: radioName, playlist, currentIdx: 0, startedAt: Date.now() });
    }

    // ── Applique un état Firebase ────────────────────────────────────────────

    function applyState(state) {
      if (cancelled || !state) return;

      const radioName   = state.selectedRadio;
      const radioTracks = radioName ? radios[radioName] : null;

      // Radio inconnue, vide ou pas de playlist → migrer vers la première radio valide
      if (!radioTracks?.length || !state.playlist?.length) {
        const defaultEntry = Object.entries(radios).find(([, t]) => t.length > 0);
        if (defaultEntry) resetToRadio(defaultEntry[0]);
        return;
      }

      stateRef.current = state;
      setCurrentRadio(radioName);

      const idx     = Math.min(state.currentIdx ?? 0, state.playlist.length - 1);
      const src     = state.playlist[idx];
      const fullSrc = new URL(src, window.location.origin).href;

      if (audio.src === fullSrc) {
        // Même piste — corriger la dérive éventuelle
        const drift = Math.abs(audio.currentTime - expectedTime(state));
        if (drift > 2) audio.currentTime = Math.max(0, expectedTime(state));
        startResync(state);
        return;
      }

      // Nouvelle piste — charger puis seeker au bon endroit
      audio.src = src;
      audio.oncanplay = () => {
        if (cancelled) return;
        audio.oncanplay = null;
        const pos = expectedTime(stateRef.current ?? state);
        audio.currentTime = Math.max(0, pos);
        tryPlay();
        startResync(stateRef.current ?? state);
      };
    }

    // ── Fin de piste → avance dans Firebase ──────────────────────────────────

    function handleEnded() {
      if (cancelled) return;
      get(musicRef).then(snap => {
        if (cancelled || !snap.exists()) return;
        const { selectedRadio, playlist, currentIdx } = snap.val();
        const tracks = radios[selectedRadio] || [];
        if (!tracks.length) return;
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
        const defaultEntry = Object.entries(radios).find(([, t]) => t.length > 0);
        if (defaultEntry) {
          const [name, tracks] = defaultEntry;
          const playlist = [...tracks].sort(() => Math.random() - 0.5);
          update(musicRef, { selectedRadio: name, playlist, currentIdx: 0, startedAt: Date.now() });
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Exposées aux composants — toutes écrivent dans Firebase → effet global
  function changeRadio(radioName) {
    const tracks = radios[radioName];
    if (!tracks?.length) return;
    const playlist = [...tracks].sort(() => Math.random() - 0.5);
    update(ref(db, path), { selectedRadio: radioName, playlist, currentIdx: 0, startedAt: Date.now() });
  }

  function prevTrack() {
    get(ref(db, path)).then(snap => {
      if (!snap.exists()) return;
      const { playlist, currentIdx } = snap.val();
      if (!playlist?.length) return;
      const nextIdx = (currentIdx ?? 0) > 0 ? (currentIdx ?? 0) - 1 : playlist.length - 1;
      update(ref(db, path), { currentIdx: nextIdx, startedAt: Date.now() });
    });
  }

  function nextTrack() {
    get(ref(db, path)).then(snap => {
      if (!snap.exists()) return;
      const { selectedRadio, playlist, currentIdx } = snap.val();
      const tracks = radios[selectedRadio] || [];
      if (!playlist?.length) return;
      let nextIdx      = (currentIdx ?? 0) + 1;
      let nextPlaylist = playlist;
      if (nextIdx >= playlist.length) {
        nextIdx      = 0;
        nextPlaylist = tracks.length ? [...tracks].sort(() => Math.random() - 0.5) : playlist;
      }
      update(ref(db, path), { playlist: nextPlaylist, currentIdx: nextIdx, startedAt: Date.now() });
    });
  }

  return [currentRadio, changeRadio, prevTrack, nextTrack];
}
