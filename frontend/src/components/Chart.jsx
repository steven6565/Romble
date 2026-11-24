import { useEffect, useRef, useState } from 'react';

/**
 * Minimal, dependency-free line chart drawn on <canvas>.
 * Accepts an array of numbers (oldest → newest).
 */
export default function Chart({ series = [], color = '#4ade80', height = 96, fill = true }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const { width, height: H } = size;
      if (width <= 0) { raf = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, width, H);
      const data = Array.isArray(series) ? series.slice(-60) : [];
      if (data.length === 0) { raf = 0; return; }
      const values = data.filter((v) => typeof v === 'number');
      const max = Math.max(...values, 1) || 1;
      const step = width / (values.length - 1 || 1);
      const y = (v) => H - (v / max) * (H - 10) - 5;
      const x = (i) => i * step;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
      ctx.stroke();

      if (fill) {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, color.replace(')', ', 0.35)').replace('rgb', 'rgba'));
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        values.forEach((v, i) => ctx.lineTo(x(i), y(v)));
        ctx.stroke();
      }
      raf = 0;
    };
    const onResize = () => {
      if (canvas.parentElement) {
        const rect = canvas.parentElement.getBoundingClientRect();
        setSize({ w: rect.width, h: H });
      }
    };
    onResize();
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(draw);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, [series, color, height]);

  return (
    <div className="chart-wrap">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: height + 'px' }}
        aria-label="Chart"
        role="img"
      />
    </div>
  );
}
