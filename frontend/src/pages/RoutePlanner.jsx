import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { api, LEVEL } from "../api.js";
import MapView, { Legend } from "../components/MapView.jsx";
import { Chip, Empty } from "../components/ui.jsx";

export default function RoutePlanner({ data, labels }) {
  const nodes = data.network.nodes, canPredict = !!data.prediction;
  const [src, setSrc] = useState("RC"), [dst, setDst] = useState("CC"), [h, setH] = useState(0);
  const [routes, setRoutes] = useState([]), [sel, setSel] = useState(null), [err, setErr] = useState("");
  const find = useCallback(async () => {
    if (src === dst) { setErr("Choose two different junctions."); setRoutes([]); return; }
    try { const r = await api.route(src, dst, h); setErr(""); setRoutes(r.routes); setSel((s) => (r.routes.some((x) => x.id === s) ? s : r.routes[0]?.id)); }
    catch (e) { setErr(e.message); setRoutes([]); }
  }, [src, dst, h]);
  useEffect(() => { find(); }, [find, Math.floor(data.tick / 3)]); // eslint-disable-line
  const best = routes[0], shortest = routes.reduce((m, r) => (!m || r.km < m.km ? r : m), null);
  return (
    <div className="grid g2">
      <div className="grid">
        <section className="card">
          <div className="row">
            <select value={src} onChange={(e) => setSrc(e.target.value)} aria-label="From">{nodes.map((n) => <option key={n.id} value={n.id}>From: {n.name}</option>)}</select>
            <button className="btn sec" title="Swap" aria-label="Swap" onClick={() => { setSrc(dst); setDst(src); }}><ArrowLeftRight size={16} /></button>
            <select value={dst} onChange={(e) => setDst(e.target.value)} aria-label="To">{nodes.map((n) => <option key={n.id} value={n.id}>To: {n.name}</option>)}</select>
          </div>
          <div className="seg" role="group" aria-label="Travel time">
            {[[0, "Now"], [15, "In 15 min"], [30, "In 30 min"]].map(([v, l]) => <button key={v} aria-pressed={h === v} disabled={v > 0 && !canPredict} onClick={() => setH(v)}>{l}</button>)}</div>
          {!canPredict && <p className="note">Future travel times need the prediction model, which is unavailable.</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </section>
        <section className="card"><MapView network={data.network} routes={routes} selected={sel} labels={labels} height={420} /><Legend /></section>
      </div>
      <section className="card">
        <h3>Route options</h3>
        {best && shortest && best.id !== shortest.id && <p className="note" style={{ marginTop: 0 }}>The fastest route saves <b>{shortest.min - best.min} min</b> compared with the shortest-distance route.</p>}
        {!routes.length && !err && <Empty>Finding routes…</Empty>}
        {routes.map((r) => (
          <div key={r.id} className={`route ${sel === r.id ? "sel" : ""}`}>
            <div><b><i className="sw" style={{ background: r.color }} />{r.name}</b>
              <small>{r.km} km · about {r.min} min · {r.free_min} min with no traffic{r.delay > 0 && ` · +${r.delay} min delay`}</small>
              <small>{r.tag} · <Chip level={r.level} /></small><small>{r.nodes.join(" → ")}</small></div>
            <button className="btn sm" onClick={() => setSel(r.id)}>{sel === r.id ? "Shown" : "Show"}</button>
          </div>))}
      </section>
    </div>
  );
}
