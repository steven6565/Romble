import { useEffect, useRef, useState } from 'react';

/**
 * Animated stat card. Counts animate from 0 to the value once per change.
 */
export function StatCard({ title, value, unit = '', icon = '●', color, loading, subtitle }) {
  const [counted, setCounted] = useState(0);
  const [valueObj, setValueObj] = useState(value);
  const doneRef = useRef(false);

  useEffect(() => {
    const numeric = typeof value === 'number' ? value : 0;
    doneRef.current = false;
    setCounted(0);
    setValueObj(value);
    let frames = 0;
    const target = typeof value === 'number' ? value : 0;
    const step = () => {
      frames += 1;
      const t = Math.min(1, frames / 30);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCounted(Math.round(target * ease));
      if (t < 1 && !doneRef.current) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return () => { doneRef.current = true; };
  }, [value, unit]);

  const display = typeof value === 'number'
    ? (unit ? `${counted.toLocaleString()}${unit}` : `${counted.toLocaleString()}`)
    : (valueObj ?? '—');

  return (
    <article className="stat-card glass" data-color={color}>
      <div className="stat-card-head">
        <span className="stat-icon" data-color={color}>{icon}</span>
        <span className="stat-title">{title}</span>
      </div>
      <div className="stat-value">
        {loading ? <span className="skeleton-line" style={{ width: '60%' }} /> : <span className="stat-number">{display}</span>}
      </div>
      {subtitle && <div className="stat-sub">{subtitle}</div>}
    </article>
  );
}

export default StatCard;
