import { useState } from "react";
import Lobby from "./components/Lobby/Lobby";
import GameScreen from "./components/Game/GameScreen";
import { CREATURE_NAMES, getCreatureSpriteStyle } from "./constants/creatures";

function CreatureSpriteDebug() {
  return (
    <div style={{ padding: 24, background: "#111", minHeight: "100vh", color: "#fff" }}>
      <h1>Vérification des sprites de créatures</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {CREATURE_NAMES.map(name => (
          <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 100 }}>
            <div style={getCreatureSpriteStyle(name, 96)} />
            <span style={{ fontSize: 12, textAlign: "center", marginTop: 4 }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SplashScreen({ onEnter }) {
  function handleClick() {
    // Débloque le contexte audio du navigateur
    try { new AudioContext().resume(); } catch (_) {}
    onEnter();
  }
  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed", inset: 0,
        background: "radial-gradient(ellipse at center, #1a0a00 0%, #000 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer", userSelect: "none", zIndex: 9999,
      }}
    >
      <div style={{ fontSize: 72, marginBottom: 16 }}>𓂀</div>
      <h1 style={{
        color: "#c9a84c", fontFamily: "serif", fontSize: 48,
        letterSpacing: 8, margin: 0, textTransform: "uppercase",
      }}>
        KEMET
      </h1>
      <p style={{ color: "#a07840", fontSize: 14, marginTop: 24, letterSpacing: 3 }}>
        CLIQUEZ POUR ENTRER
      </p>
    </div>
  );
}

function App() {
  const [ready, setReady] = useState(false);
  const [gameSession, setGameSession] = useState(null);

  if (new URLSearchParams(window.location.search).has("creatures")) {
    return <CreatureSpriteDebug />;
  }

  if (!ready) {
    return <SplashScreen onEnter={() => setReady(true)} />;
  }

  if (!gameSession) {
    return <Lobby onGameStart={setGameSession} />;
  }

  return <GameScreen session={gameSession} />;
}

export default App;