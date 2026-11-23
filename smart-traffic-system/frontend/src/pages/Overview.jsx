import { PredictionChart } from "../components/Charts.jsx";
import { Chip, Empty, Unavailable, LevelGuide, Demo } from "../components/ui.jsx";
import { LEVEL, trendOf } from "../api.js";

function Kpi({ label, children, sub }) {
  return <div className="card kpi"><span className="lbl">{label}</span>{children}<small>{sub}</small></div>;
}

export default function Overview({ data, go }) {
  const k = data.kpis, p = data.prediction;
  const worst = [...data.network.edges].sort((a, b) => a.speed / a.free - b.speed / b.free).slice(0, 6);
  const [word, cls] = p ? trendOf(k.speed, k.p30_speed) : ["", "flat"];
  return (
    <>
      <section className="grid g5">
        <Kpi label="Monitored locations" sub={`${k.junctions} junctions`}><b>{k.segments}<span> road segments</span></b></Kpi>
        <Kpi label="Congestion now" sub={LEVEL[k.level].d}><b>{LEVEL[k.level].t}</b></Kpi>
        <Kpi label="Average speed" sub="Across all segments"><b>{k.speed}<span> km/h</span></b></Kpi>
        <Kpi label="Active alerts" sub={k.alerts ? "Needs attention" : "Nothing needs attention"}><b>{k.alerts}</b></Kpi>
        <Kpi label="Expected in 30 min" sub={p ? <span className={cls}>{word} · {k.p30_speed} km/h</span> : "Prediction unavailable"}>
          <b>{p ? LEVEL[k.p30_level].t : "—"}</b></Kpi>
      </section>
      <LevelGuide />
      <section className="grid g2 mt">
        <div className="card">
          <div className="ch"><h3>Average speed: observed and predicted <Demo /></h3><a href="#prediction">Open prediction →</a></div>
          {p ? <PredictionChart history={p.history} steps={p.steps} height={240} />
            : <Unavailable title="Prediction unavailable">{data.ml.error || "The forecasting model is not available."}</Unavailable>}
        </div>
        <div className="card">
          <div className="ch"><h3>Slowest segments now</h3><a href="#monitoring">All segments →</a></div>
          <div className="tablewrap"><table><thead><tr><th>Segment</th><th>Speed</th><th>Level</th></tr></thead>
            <tbody>{worst.map((e) => <tr key={e.id}><td>{e.road}<br /><small className="flat">{e.from} → {e.to}</small></td>
              <td className="num">{e.speed} km/h</td><td><Chip level={e.level} /></td></tr>)}</tbody></table></div>
        </div>
      </section>
      <section className="card mt">
        <div className="ch"><h3>Recent traffic activity</h3><a href="#alerts">Alerts & incidents →</a></div>
        {!data.alerts.length ? <Empty>No alerts have been raised yet in this session.</Empty> :
          <div className="list">{data.alerts.slice(0, 6).map((a) => (
            <div key={a.id} className="item"><i className={`dot ${a.active ? a.sev : "off"}`} />
              <div><b>{a.title}</b><small>{a.sub} · {a.active ? "Active" : `Resolved at ${a.resolved}`}</small></div>
              <div className="aside">{a.time}</div></div>))}</div>}
      </section>
    </>
  );
}
