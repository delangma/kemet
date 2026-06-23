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

function App() {
  const [gameSession, setGameSession] = useState(null);

  if (new URLSearchParams(window.location.search).has("creatures")) {
    return <CreatureSpriteDebug />;
  }

  if (!gameSession) {
    return <Lobby onGameStart={setGameSession} />;
  }

  return <GameScreen session={gameSession} />;
}

export default App;