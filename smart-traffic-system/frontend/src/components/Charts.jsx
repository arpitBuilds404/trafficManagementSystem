import { useState } from "react";

export function PredictionChart({ history, steps, height = 280 }) {
  const [hv, setHv] = useState(null);
  const pts = [...history.map((p) => ({ ...p, kind: "Observed" })), ...steps.map((p) => ({ ...p, kind: "Predicted" }))];
  const n = pts.length, hn = history.length, W = 760, H = height, L = 46, R = 16, T = 16, B = 32;
  const v = pts.map((p) => p.speed);
  let lo = Math.min(...v), hi = Math.max(...v);
  const pad = Math.max(3, (hi - lo) * 0.25);
  lo = Math.max(0, Math.floor(lo - pad)); hi = Math.ceil(hi + pad);
  const x = (i) => L + (i * (W - L - R)) / (n - 1), y = (s) => T + (1 - (s - lo) / (hi - lo)) * (H - T - B);
  const path = (ix) => ix.map((i, k) => `${k ? "L" : "M"}${x(i)},${y(pts[i].speed)}`).join(" ");
  const obs = Array.from({ length: hn }, (_, i) => i), prd = Array.from({ length: n - hn + 1 }, (_, i) => hn - 1 + i);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    setHv(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1)))));
  };
  const h = hv != null ? pts[hv] : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" onMouseMove={move} onMouseLeave={() => setHv(null)}
      aria-label="Average speed: observed readings followed by the 30-minute prediction">
      <rect x={x(hn - 1)} y={T} width={x(n - 1) - x(hn - 1)} height={H - T - B} fill="var(--blue)" opacity=".07" />
      {[0, 1, 2, 3, 4].map((k) => { const val = lo + ((hi - lo) * k) / 4; return (
        <g key={k}><line x1={L} x2={W - R} y1={y(val)} y2={y(val)} stroke="var(--line)" />
          <text x={L - 8} y={y(val) + 4} fontSize="11" fill="var(--mut)" textAnchor="end">{Math.round(val)}</text></g>); })}
      <text x="4" y="12" fontSize="11" fill="var(--mut)">km/h</text>
      {pts.map((p, i) => i % 3 === 0 && <text key={i} x={x(i)} y={H - 10} fontSize="11" fill="var(--mut)" textAnchor="middle">{p.time.replace(" ", "")}</text>)}
      <line x1={x(hn - 1)} x2={x(hn - 1)} y1={T} y2={H - B} stroke="var(--mut)" strokeDasharray="3 3" />
      <text x={x(hn - 1) - 6} y={T + 12} fontSize="11" fill="var(--mut)" textAnchor="end">Observed</text>
      <text x={x(hn - 1) + 6} y={T + 12} fontSize="11" fill="var(--cyan)">Predicted</text>
      <path d={path(obs)} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={path(prd)} fill="none" stroke="var(--cyan)" strokeWidth="2.5" strokeDasharray="6 5" />
      {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.speed)} r={i === hv ? 5 : 3} fill={p.kind === "Observed" ? "var(--blue)" : "var(--surf)"}
        stroke={p.kind === "Observed" ? "var(--blue)" : "var(--cyan)"} strokeWidth="2" />)}
      {h && (() => { const tx = Math.min(x(hv) + 10, W - 150), ty = Math.max(T, y(h.speed) - 56); return (
        <g pointerEvents="none"><rect x={tx} y={ty} width="140" height="50" rx="6" fill="var(--bg)" stroke="var(--line)" />
          <text x={tx + 8} y={ty + 16} fontSize="11" fill="var(--mut)">{h.kind} · {h.time}</text>
          <text x={tx + 8} y={ty + 36} fontSize="15" fontWeight="600" fill="var(--ink)">{h.speed} km/h</text></g>); })()}
    </svg>
  );
}

export function HourBars({ labels, values, current }) {
  const W = 720, H = 190, L = 34, B = 24, bw = (W - L - 6) / values.length;
  const y = (v) => H - B - (Math.min(v, 100) / 100) * (H - B - 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Typical congestion by hour of day">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}><line x1={L} x2={W - 4} y1={y(g)} y2={y(g)} stroke="var(--line)" /><text x={L - 6} y={y(g) + 4} fontSize="11" textAnchor="end" fill="var(--mut)">{g}%</text></g>))}
      {values.map((v, i) => (
        <g key={i}><rect x={L + i * bw + 2} y={y(v)} width={bw - 4} height={H - B - y(v)} rx="2" fill={i === current ? "var(--cyan)" : "var(--blue)"} opacity={i === current ? 1 : 0.65}>
          <title>{labels[i]}: {v}% congestion{i === current ? " (current hour)" : ""}</title></rect>
          {i % 3 === 0 && <text x={L + i * bw + bw / 2} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--mut)">{labels[i]}</text>}</g>))}
    </svg>
  );
}

export function StackBar({ dist, colors, names }) {
  return (
    <>
      <div className="stack">{Object.keys(names).map((k) => <i key={k} style={{ width: `${dist[k]}%`, background: colors[k] }} title={`${names[k]}: ${dist[k]}%`} />)}</div>
      <div className="stackkey">{Object.keys(names).map((k) => <span key={k}><i style={{ background: colors[k] }} />{names[k]} {dist[k]}%</span>)}</div>
    </>
  );
}
