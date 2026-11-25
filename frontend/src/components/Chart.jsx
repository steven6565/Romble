import { useEffect, useRef } from 'react';

/**
 * Dependency-free line/area chart on <canvas>.
 *
 * Fixes carried over from V4:
 *   - `H` was referenced inside the resize handler but only existed in draw scope.
 *   - canvas.width/height were never set, so the bitmap was 300x150 and the
 *     drawing was stretched/blurred.
 *   - gradient stops used `color.replace(...)`, which produces invalid colors
 *     for named/hex colors and made addColorStop throw.
 */
function toRgba(color, alpha) {
  if (typeof color !== 'string') return `rgba(74, 222, 128, ${alpha})`;
  const c = color.trim();
  // #rgb / #rrggbb
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].every((n) => Number.isFinite(n))) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(74, 222, 128, ${alpha})`;
  }
  // rgb(...) / rgba(...)
  const m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
  return `rgba(74, 222, 128, ${alpha})`;
}

export default function Chart({ series = [], color = '#4ade80', height = 96, fill = true, label = 'Chart' }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const draw = () => {
      const cssWidth = Math.max(1, wrap.clientWidth || 300);
      const cssHeight = Math.max(1, height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Set the real bitmap size (this was the main V4 rendering bug).
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = '100%';
      canvas.style.height = `${cssHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const W = cssWidth;
      const H = cssHeight;
      ctx.clearRect(0, 0, W, H);

      const values = (Array.isArray(series) ? series : []).filter((v) => typeof v === 'number' && Number.isFinite(v)).slice(-60);

      // Empty state: draw a flat baseline so the card never looks broken.
      if (values.length === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H - 1);
        ctx.lineTo(W, H - 1);
        ctx.stroke();
        return;
      }

      const max = Math.max(...values, 1);
      const step = values.length > 1 ? W / (values.length - 1) : W;
      const px = (i) => (values.length > 1 ? i * step : W / 2);
      const py = (v) => H - (v / max) * (H - 10) - 5;

      if (fill) {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, toRgba(color, 0.35));
        grad.addColorStop(1, toRgba(color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px(0), H);
        values.forEach((v, i) => ctx.lineTo(px(i), py(v)));
        ctx.lineTo(px(values.length - 1), H);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      values.forEach((v, i) => {
        if (i === 0) ctx.moveTo(px(i), py(v));
        else ctx.lineTo(px(i), py(v));
      });
      ctx.stroke();
    };

    draw();
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    window.addEventListener('resize', onResize);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (observer) observer.observe(wrap);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
    };
  }, [series, color, height, fill]);

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} aria-label={label} role="img" />
    </div>
  );
}
