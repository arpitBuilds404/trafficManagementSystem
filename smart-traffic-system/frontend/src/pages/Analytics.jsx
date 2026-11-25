import { useEffect, useState } from "react";
import { api } from "../api.js";
import { HourBars, StackBar } from "../components/Charts.jsx";
import { Empty, Unavailable, Demo } from "../components/ui.jsx";
import { LEVEL } from "../api.js";

export default function Analytics({ data }) {
  const [a, setA] = useState(null), [err, setErr] = useState(null);
  const bucket = Math.floor(data.tick / 20);
  useEffect(() => { api.analytics().then((r) => { setA(r); setErr(null); }).catch((e) => setErr(e.message)); }, [bucket]);
  if (err) return <Unavailable title="Analytics unavailable">{err}</Unavailable>;
  if (!a) return <Empty>Loading analytics…</Empty>;
  const diff = a.now - a.typical_now;
  const colors = Object.fromEntries(Object.entries(LEVEL).map(([k, v]) => [k, v.c])), names = Object.fromEntries(Object.entries(LEVEL).map(([k, v]) => [k, v.t]));
  return (
    <>
      <p className="note" style={{ marginTop: 0 }}>Source: {a.source} ({a.days} days of simulated 5-minute readings). It shows typical patterns, not real measurements. <Demo /></p>
      <section className="grid g3">
        <div className="card kpi"><span className="lbl">Congestion now</span><b>{a.now}%</b><small>0% = free flowing, 100% = at a standstill</small></div>
        <div className="card kpi"><span className="lbl">Typical for this hour</span><b>{a.typical_now}%</b><small>Average at {a.labels[a.current_hour]} in the demo history</small></div>
        <div className="card kpi"><span className="lbl">Compared with typical</span><b className={diff > 5 ? "down" : diff < -5 ? "up" : "flat"}>{diff > 5 ? "Busier" : diff < -5 ? "Quieter" : "About normal"}</b><small>{diff > 0 ? "+" : ""}{Math.round(diff)} percentage points</small></div>
      </section>
      <section className="grid g2 mt">
        <div className="card"><h3>Typical congestion by hour of day</h3><HourBars labels={a.labels} values={a.hourly} current={a.current_hour} />
          <p className="note">The cyan bar is the current hour. Morning and evening peaks are visible.</p></div>
        <div className="card"><h3>How often each level occurs</h3><StackBar dist={a.distribution} colors={colors} names={names} />
          <p className="note">Share of all segment readings in the demo history.</p></div>
      </section>
      <section className="card mt"><h3>Roads compared</h3>
        <div className="tablewrap"><table><thead><tr><th>Road</th><th>Segments</th><th>Average speed</th><th>Time congested</th><th>Busiest hour</th></tr></thead>
          <tbody>{a.roads.map((r) => <tr key={r.road}><td>{r.road}</td><td>{r.segments}</td><td className="num">{r.avg_speed} of {r.free} km/h</td>
            <td className="num">{r.congested_pct}%</td><td>{r.peak} ({r.peak_congestion}%)</td></tr>)}</tbody></table></div>
        <p className="note">“Time congested” = share of readings where traffic moved at less than half of free-flow speed.</p>
      </section>
    </>
  );
}
