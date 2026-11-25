export function Spark({ data, color }) {
  if (!data || data.length < 2) return <svg className="spark" />;
  const mn = Math.min(...data), rg = Math.max(...data) - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${26 - ((v - mn) / rg) * 22}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="spark" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function AreaChart({ labels, values }) {
  const W = 640, H = 190, L = 34, B = 22, n = values.length;
  const x = (i) => L + (i / (n - 1)) * (W - L - 12), y = (v) => H - B - (Math.min(v, 100) / 100) * (H - B - 14);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const pk = values.indexOf(Math.max(...values)), step = Math.ceil(n / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Congestion index chart">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}><line x1={L} x2={W - 8} y1={y(g)} y2={y(g)} stroke="#e5e9f0" />
          <text x="0" y={y(g) + 4} fontSize="11" fill="#6b7686">{g}%</text></g>
      ))}
      {labels.map((l, i) => i % step === 0 && (
        <text key={i} x={x(i)} y={H - 4} fontSize="11" fill="#6b7686" textAnchor="middle">{l}</text>))}
      <path d={`${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="#2563eb" opacity=".12" />
      <path d={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={x(pk)} cy={y(values[pk])} r="5" fill="#2563eb" stroke="#fff" strokeWidth="2" />
      <rect x={x(pk) - 21} y={y(values[pk]) - 31} width="42" height="21" rx="5" fill="#2563eb" />
      <text x={x(pk)} y={y(values[pk]) - 16} fontSize="12" fill="#fff" textAnchor="middle" fontWeight="600">{values[pk]}%</text>
    </svg>
  );
}

export function Bars({ items }) {
  const col = (v) => (v < 40 ? "#16a34a" : v < 60 ? "#eab308" : "#f97316");
  return (
    <div className="bars">
      {items.map((it) => (
        <div key={it.label} className="bar">
          <span>{it.label}</span>
          <div><i style={{ width: `${Math.min(100, it.value)}%`, background: col(it.value) }} /></div>
          <b>{it.value}%</b>
        </div>
      ))}
    </div>
  );
}
