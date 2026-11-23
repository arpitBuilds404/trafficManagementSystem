import { useMemo, useState } from "react";
import MapView, { Legend } from "../components/MapView.jsx";
import { Chip, Empty, LevelGuide, Demo } from "../components/ui.jsx";
import { LEVEL, trendOf } from "../api.js";
import { advice, headline, detail } from "../components/Notifications.jsx";

export default function Monitoring({ data, labels, focusId, setFocusId, openSegment }) {
  const [q, setQ] = useState(""), [lv, setLv] = useState("all"), [road, setRoad] = useState("all");
  const roads = [...new Set(data.network.edges.map((e) => e.road))].sort();
  const rows = useMemo(() => data.network.edges.filter((e) =>
    (lv === "all" || e.level === lv) && (road === "all" || e.road === road) &&
    (`${e.road} ${e.from} ${e.to}`.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => a.speed / a.free - b.speed / b.free), [data, q, lv, road]);
  const adv = focusId ? data.advisories.find((a) => a.id === focusId) : null;
  const net = { nodes: data.network.nodes, edges: rows };
  return (
    <>
      <section className="card">
        <div className="ch"><h3>Map <Demo /></h3>
          <span className="note" style={{ margin: 0 }}>Updated {new Date(data.last_update).toLocaleTimeString()} · demo clock {data.sim_time}</span></div>
        {focusId && (
          <div className="focus" role="status">
            {adv ? <div><b>{headline(adv)}</b> — {detail(adv)}<br /><span className="rec">{advice(adv)}</span>
              {adv.alt && adv.alt.faster && <small>Route: {adv.alt.nodes.join(" → ")}</small>}</div>
              : <div><b>This congestion has cleared.</b> Normal routes are fine again.</div>}
            <button className="mini" onClick={() => setFocusId(null)}>Dismiss</button>
          </div>)}
        <MapView network={net} incidents={data.incidents} labels={labels} height={500} highlight={adv} fit={false} />
        <Legend />
      </section>
      <section className="card mt">
        <div className="ch"><h3>Road segments ({rows.length} of {data.network.edges.length})</h3></div>
        <div className="filters">
          <input type="search" placeholder="Search road or junction" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          <select value={lv} onChange={(e) => setLv(e.target.value)} aria-label="Congestion level">
            <option value="all">All levels</option>{Object.entries(LEVEL).map(([k, l]) => <option key={k} value={k}>{l.t}</option>)}</select>
          <select value={road} onChange={(e) => setRoad(e.target.value)} aria-label="Road">
            <option value="all">All roads</option>{roads.map((r) => <option key={r}>{r}</option>)}</select>
          {(q || lv !== "all" || road !== "all") && <button className="btn sec" onClick={() => { setQ(""); setLv("all"); setRoad("all"); }}>Clear filters</button>}
        </div>
        {!rows.length ? <Empty>No segments match these filters.</Empty> :
          <div className="tablewrap"><table>
            <thead><tr><th>Road</th><th>Segment</th><th>Speed now</th><th>Level</th><th>In 30 min</th><th>Trend</th></tr></thead>
            <tbody>{rows.map((e) => { const [w, c] = e.pred ? trendOf(e.speed, e.pred[5]) : ["–", "flat"]; return (
              <tr key={e.id} className="click" onClick={() => openSegment(e.id)} title="Open the prediction for this segment">
                <td>{e.road}{e.incident && " ⚠"}</td><td>{e.from} → {e.to}</td>
                <td className="num">{e.speed} <small className="flat">of {e.free} km/h</small></td><td><Chip level={e.level} /></td>
                <td className="num">{e.pred ? <>{e.pred[5]} km/h <Chip level={e.pred_level[5]} /></> : "Unavailable"}</td><td className={c}>{w}</td></tr>); })}</tbody></table></div>}
        <p className="note">Traffic volume (vehicle counts) is not available in the demo data, so it is not shown. Click a row to see its 30-minute prediction.</p>
        <LevelGuide />
      </section>
    </>
  );
}
