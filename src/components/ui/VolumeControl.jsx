export default function VolumeControl({ volume, onChange, label, icon: iconOverride, title, compact = false }) {
  const pct = Math.round(volume * 100);
  const icon = iconOverride ?? (volume === 0 ? '🔇' : volume < 0.4 ? '🔈' : volume < 0.75 ? '🔉' : '🔊');

  return (
    <div
      className="flex items-center gap-2"
      style={{ minWidth: compact ? 90 : label ? 100 : 120 }}
      title={title}
    >
      {label && (
        <span style={{ fontSize: 10, color: '#6B4C1E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      )}
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <input
        type="range"
        min={0} max={1} step={0.01}
        value={volume}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1,
          accentColor: '#C9973A',
          cursor: 'pointer',
          height: 4,
        }}
      />
      {!compact && (
        <span style={{ color: '#6B4C1E', fontSize: 10, minWidth: 28, textAlign: 'right' }}>
          {pct}%
        </span>
      )}
    </div>
  );
}
