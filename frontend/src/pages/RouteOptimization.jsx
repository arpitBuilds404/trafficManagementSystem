import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { api, LEVEL } from "../api.js";
import MapView, { Legend } from "../components/MapView.jsx";

const HZ = [[0, "Now"], [15, "+15 min"], [30, "+30 min"], [60, "+60 min"]];

export default function RouteOptimization({ data, labels }) {
  const nodes = data.network.nodes;
  const [src, setSrc] = useState("RC"), [dst, setDst] = useState("CC"), [h, setH] = useState(0);
  const [routes, setRoutes] = useState([]), [sel, setSel] = useState(null), [err, setErr] = useState("");

  const find = useCallback(async () => {
    if (src === dst) { setErr("Choose two different junctions."); setRoutes([]); return; }
    try {
      const r = await api.route(src, dst, h);
      setErr(""); setRoutes(r.routes);
      setSel((s) => (r.routes.some((x) => x.id === s) ? s : r.routes[0]?.id));
    } catch (e) { setErr(e.message); setRoutes([]); }
  }, [src, dst, h]);
  useEffect(() => { find(); }, [find, Math.floor(data.tick / 3)]); // eslint-disable-line

  const best = routes[0], shortest = routes.reduce((m, r) => (!m || r.km < m.km ? r : m), null);
  return (
    <div className="grid">
      <div className="col">
        <section className="card">
          <div className="row">
            <select value={src} onChange={(e) => setSrc(e.target.value)} aria-label="From">{nodes.map((n) => <option key={n.id} value={n.id}>From: {n.name}</option>)}</select>
            <button className="icon" title="Swap" onClick={() => { setSrc(dst); setDst(src); }}><ArrowLeftRight size={18} /></button>
            <select value={dst} onChange={(e) => setDst(e.target.value)} aria-label="To">{nodes.map((n) => <option key={n.id} value={n.id}>To: {n.name}</option>)}</select>
          </div>
          <div className="seg" role="group" aria-label="Forecast horizon">
            {HZ.map(([v, l]) => <button key={v} aria-pressed={h === v} onClick={() => setH(v)}>{l}</button>)}
          </div>
          {err && <p className="err">{err}</p>}
        </section>
        <section className="card">
          <MapView network={data.network} routes={routes} selected={sel} labels={labels} height={420} />
          <Legend />
        </section>
      </div>
      <div className="col">
        <section className="card">
          <h3 style={{ marginBottom: 6 }}>Route options</h3>
          {best && shortest && best.id !== shortest.id && (
            <p className="note" style={{ marginTop: 0 }}>The fastest route saves <b>{shortest.min - best.min} min</b> compared with the shortest-distance route.</p>)}
          {routes.map((r) => (
            <div key={r.id} className={`route big ${sel === r.id ? "sel" : ""}`}>
              <div>
                <b><i className="sw" style={{ background: r.color }} />{r.name}</b>
                <small>{r.km} km • ~{r.min} min • free-flow {r.free_min} min {r.delay > 0 && `• +${r.delay} min delay`}</small>
                <small>{r.tag} • <span style={{ color: LEVEL[r.level].c }}>●</span> {LEVEL[r.level].t}</small>
                <small>{r.nodes.join(" → ")}</small>
              </div>
              <button onClick={() => setSel(r.id)}>{sel === r.id ? "Shown" : "Select"}</button>
            </div>))}
          {!routes.length && !err && <p className="note">Finding routes…</p>}
        </section>
      </div>
    </div>
  );
}
