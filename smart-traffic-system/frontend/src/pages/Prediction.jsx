import { PredictionChart } from "../components/Charts.jsx";
import { Chip, Empty, Unavailable, LevelGuide, Demo } from "../components/ui.jsx";
import { LEVEL, levelOf, cpct, trendOf } from "../api.js";

export default function Prediction({ data, scope, setScope }) {
  const p = data.prediction;
  if (!p) return <Unavailable title="Prediction is unavailable">{data.ml.error || "The forecasting model could not be loaded, so no predictions are shown. Nothing is being estimated or faked."}</Unavailable>;
  const edge = scope === "network" ? null : data.network.edges.find((e) => String(e.id) === scope);
  const name = edge ? `${edge.road}: ${edge.from} → ${edge.to}` : "Whole network (average of all segments)";
  const history = edge ? edge.hist.map((s, i) => ({ time: p.history[i].time, speed: s })) : p.history;
  const steps = edge ? edge.pred.map((s, i) => ({ min: p.steps[i].min, time: p.steps[i].time, speed: s, level: edge.pred_level[i], congestion: cpct(s / edge.free) })) : p.steps;
  const cur = history[history.length - 1], now = edge ? { speed: cur.speed, level: levelOf(cur.speed / edge.free), congestion: cpct(cur.speed / edge.free) } : p.current;
  const last = steps[5], [word, cls] = trendOf(now.speed, last.speed);
  const m = p.model;
  return (
    <>
      <div className="ch">
        <label style={{ margin: 0, minWidth: 280 }}>Show prediction for
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="network">Whole network</option>
            {data.network.edges.map((e) => <option key={e.id} value={e.id}>{e.road}: {e.from} → {e.to}</option>)}</select></label>
        <div><span className="badge demo">DATA SOURCE: DEMO</span>
          <span className="note" style={{ marginLeft: 10 }}>Issued at demo time {p.issued_at} · generated {new Date(p.generated).toLocaleTimeString()}</span></div>
      </div>

      <section className="grid g3">
        <div className="card kpi"><span className="lbl">Currently observed</span><b>{now.speed}<span> km/h</span></b>
          <Chip level={now.level} /><small>{LEVEL[now.level].d} Latest 5-minute reading ({cur.time}).</small></div>
        <div className="card kpi"><span className="lbl">Predicted in 30 minutes ({last.time})</span><b>{last.speed}<span> km/h</span></b>
          <Chip level={last.level} /><small><span className={cls}>{word}</span> – {LEVEL[last.level].d} Congestion {last.congestion}%.</small></div>
        <div className="card kpi"><span className="lbl">Typical forecast error at +30 min</span><b>±{m.metrics.mae_model_kmh[5]}<span> km/h</span></b>
          <small>Measured on 4 held-out demo days. Assuming “no change” would be off by ±{m.metrics.mae_persistence_kmh[5]} km/h.</small></div>
      </section>

      <section className="card mt">
        <div className="ch"><h3>{name} <Demo /></h3></div>
        <PredictionChart history={history} steps={steps} />
        <p className="note">Solid blue: observed readings every 5 minutes. Dashed cyan: model prediction for the next 30 minutes. Hover a point for details.</p>
      </section>

      <section className="card mt">
        <h3>Next 30 minutes, every 5 minutes</h3>
        <div className="steps">{steps.map((s) => (
          <div key={s.min} className="step"><small>+{s.min} min · {s.time}</small><b>{s.speed}<span style={{ fontSize: 12, color: "var(--mut)" }}> km/h</span></b>
            <Chip level={s.level} /><small>Congestion {s.congestion}%</small></div>))}</div>
        <LevelGuide />
      </section>

      <section className="grid g2 mt">
        <div className="card">
          <h3>Did earlier predictions come true? (whole network)</h3>
          {!p.verification.length ? <Empty>Appears after the next 5-minute reading (about 20 seconds).</Empty> :
            <div className="tablewrap"><table><thead><tr><th>Predicted at</th><th>For</th><th>Predicted</th><th>Actual</th><th>Error</th></tr></thead>
              <tbody>{p.verification.map((v) => <tr key={v.h}><td>{v.issued}</td><td>+{v.h} min</td><td className="num">{v.predicted} km/h</td>
                <td className="num">{v.actual} km/h</td><td className="num">{(v.predicted - v.actual).toFixed(1)}</td></tr>)}</tbody></table></div>}
          <p className="note">Compares past predictions with what the demo traffic actually did.</p>
        </div>
        <div className="card">
          <h3>About the model</h3>
          <p style={{ margin: "0 0 8px" }}><b>{m.name}</b></p>
          <p className="note" style={{ margin: "0 0 6px" }}>Uses: {m.inputs}.</p>
          <p className="note" style={{ margin: "0 0 10px" }}>Trained on: {m.data}.</p>
          <div className="tablewrap"><table><thead><tr><th>Ahead</th>{[5, 10, 15, 20, 25, 30].map((h) => <th key={h}>+{h}</th>)}</tr></thead><tbody>
            <tr><td>Model error (km/h)</td>{m.metrics.mae_model_kmh.map((v, i) => <td key={i} className="num">{v}</td>)}</tr>
            <tr><td>“No change” error</td>{m.metrics.mae_persistence_kmh.map((v, i) => <td key={i} className="num">{v}</td>)}</tr></tbody></table></div>
        </div>
      </section>
    </>
  );
}
