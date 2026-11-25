import { useEffect, useState } from "react";
import { api, LEVEL } from "../api.js";
import { AreaChart, Bars } from "../components/Charts.jsx";

export default function Analytics({ data }) {
  const [period, setPeriod] = useState("24h");
  const [a, setA] = useState(null);
  const bucket = Math.floor(data.tick / 10);
  useEffect(() => { api.analytics(period).then(setA).catch(() => {}); }, [period, bucket]);
  if (!a) return <div className="card">Loading analytics…</div>;
  const roads = {};
  data.network.edges.forEach((e) => (roads[e.road] ||= []).push(e));
  return (
    <>
      <section className="kpis">
        <div className="card kpi"><div className="kpi-txt"><b>{a.avg}%</b><span>Average congestion</span></div></div>
        <div className="card kpi"><div className="kpi-txt"><b>{a.peak.value}% at {a.peak.label}</b><span>Busiest {period === "7d" ? "day" : "hour"}</span></div></div>
        <div className="card kpi"><div className="kpi-txt"><b>{a.low.value}% at {a.low.label}</b><span>Quietest {period === "7d" ? "day" : "hour"}</span></div></div>
        <div className="card kpi"><div className="kpi-txt"><b>{data.prediction[0].v}%</b><span>Predicted in 15 min</span></div></div>
      </section>
      <div className="grid">
        <div className="col">
          <section className="card">
            <div className="ch"><h3>Congestion index</h3>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
                <option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select></div>
            <AreaChart labels={a.labels} values={a.values} />
          </section>
          <section className="card">
            <h3 style={{ marginBottom: 12 }}>Speed forecast by segment (km/h)</h3>
            <div className="tablewrap"><table>
              <thead><tr><th>Road</th><th>Segment</th><th>Now</th><th>+15</th><th>+30</th><th>+60</th></tr></thead>
              <tbody>{data.network.edges.map((e) => (
                <tr key={e.id}><td>{e.road}</td><td>{e.from} → {e.to}</td>
                  <td><span className="chip" style={{ background: LEVEL[e.level].c }}>{e.speed}</span></td>
                  {["15", "30", "60"].map((h) => <td key={h}>{e.forecast[h]}</td>)}</tr>))}</tbody>
            </table></div>
          </section>
        </div>
        <div className="col">
          <section className="card">
            <h3 style={{ marginBottom: 12 }}>Busiest roads (typical day)</h3>
            <Bars items={a.roads.map((r) => ({ label: r.road, value: r.avg }))} />
          </section>
          <section className="card">
            <h3 style={{ marginBottom: 12 }}>Right now vs typical peak</h3>
            <div className="tablewrap"><table>
              <thead><tr><th>Road</th><th>Now</th><th>Peak hour</th></tr></thead>
              <tbody>{a.roads.map((r) => <tr key={r.road}><td>{r.road}</td><td>{r.now}%</td><td>{r.peak}</td></tr>)}</tbody>
            </table></div>
          </section>
        </div>
      </div>
    </>
  );
}
