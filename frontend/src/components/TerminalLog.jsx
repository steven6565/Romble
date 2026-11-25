/**
 * Live terminal-style activity log.
 * Messages wrap instead of overflowing, and entries are appended newest-last.
 */
export default function TerminalLog({ entries = [], height = 220, emptyText = 'Waiting for activity…' }) {
  return (
    <div className="terminal" role="log" aria-label="Terminal activity" style={{ maxHeight: height }}>
      {entries.length === 0 && <div className="terminal-line muted">{emptyText}</div>}
      {entries
        .slice()
        .reverse()
        .map((e, i) => (
          <div className="terminal-line" key={`${e.ts || ''}-${e.type || ''}-${i}`}>
            <span className="terminal-ts">{formatTime(e.ts)}</span>
            <span className={`terminal-kind kind-${e.type || 'info'}`}>[{e.type || 'info'}]</span>
            <span className="terminal-msg">{e.message}</span>
          </div>
        ))}
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString([], { hour12: false });
}
