/**
 * Live terminal-style activity log. Mirrors the backend terminal logs.
 */
export default function TerminalLog({ entries = [], height = 220, emptyText = 'Waiting for activity…' }) {
  return (
    <div className="terminal" role="log" aria-label="Terminal activity" style={{ height }}>
      {entries.length === 0 && (
        <div className="terminal-line muted">{emptyText}</div>
      )}
      {entries.slice().reverse().map((e) => (
        <div className="terminal-line" key={`${e.ts}-${e.type}-${Math.random()}`}>
          <span className="terminal-ts">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</span>
          <span className={`terminal-kind kind-${e.type}`}>[{e.type}]</span>
          <span className="terminal-msg">{e.message}</span>
        </div>
      ))}
    </div>
  );
}
