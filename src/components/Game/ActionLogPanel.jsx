import { useState, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { ref, onValue } from "firebase/database";

const COLOR_TEXT = {
  Rouge: "text-red-400",
  Bleu:  "text-blue-400",
  Vert:  "text-emerald-400",
  Blanc: "text-gray-100",
  Noir:  "text-gray-400",
};

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function ActionLogPanel({ roomCode }) {
  const [entries, setEntries] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `rooms/${roomCode}/actionLog`), snapshot => {
      if (!snapshot.exists()) { setEntries([]); return; }
      const data = snapshot.val();
      const sorted = Object.values(data).sort((a, b) => a.time - b.time);
      setEntries(sorted.slice(-80));
    });
    return () => unsubscribe();
  }, [roomCode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
        {entries.length === 0 && (
          <p className="text-gray-600 text-xs italic">Aucune action pour l'instant.</p>
        )}
        {entries.map((entry, i) => (
          <div key={i} className="text-xs leading-snug">
            <span className="text-gray-600 mr-1">{formatTime(entry.time)}</span>
            <span className={`font-bold ${COLOR_TEXT[entry.color] || "text-gray-300"}`}>
              {entry.playerName}
            </span>
            <span className="text-gray-300"> {entry.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
