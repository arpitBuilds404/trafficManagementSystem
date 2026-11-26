import { useState } from "react";
import { api } from "../api.js";
import { Empty } from "../components/ui.jsx";

const SEV = { high: "Severe", mid: "High", low: "Moderate" };

export default function Alerts({ data, refresh }) {
  const [status, setStatus] = useState("active"), [sev, setSev] = useState("all");
  const [f, setF] = useState({ edge_id: 0, severity: 2, minutes: 20, description: "" });
  const [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const list = data.alerts.filter((a) => (status === "all" || (status === "active") === a.active) && (sev === "all" || a.sev === sev));
  const act = async (fn, ok) => { setBusy(true); try { await fn(); setMsg({ ok: true, t: ok }); refresh(); } catch (e) { setMsg({ ok: false, t: e.message }); } setBusy(false); };
  return (
    <div className="grid g2">
      <section className="card">
        <div className="ch"><h3>Alerts</h3>
          <div className="filters" style={{ margin: 0 }}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="active">Active</option><option value="resolved">Resolved</option><option value="all">All</option></select>
            <select value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Severity"><option value="all">All severities</option>{Object.entries(SEV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
        {!list.length ? <Empty>{data.alerts.length ? "No alerts match these filters." : "No alerts have been raised in this session."}</Empty> :
          <div className="list">{list.map((a) => (
            <div key={a.id} className="item"><i className={`dot ${a.active ? a.sev : "off"}`} />
              <div><b>{a.title}</b><small>{a.sub}{a.active && ` · about ${a.speed} km/h`}</small>
                <small>{SEV[a.sev]} · {a.road} · {a.active ? "Active" : `Resolved at ${a.resolved}`}</small></div>
              <div className="aside"><span>{a.time} (demo clock)</span>
                {a.active && (a.acked ? <span>Acknowledged</span> : <button className="btn sm" disabled={busy} onClick={() => act(() => api.ack(a.id), "Alert acknowledged.")}>Acknowledge</button>)}</div>
            </div>))}</div>}
      </section>
      <div className="grid">
        <section className="card">
          <h3>Report an incident</h3>
          <label>Road segment<select value={f.edge_id} onChange={(e) => setF({ ...f, edge_id: +e.target.value })}>
            {data.network.edges.map((e) => <option key={e.id} value={e.id}>{e.road}: {e.from} → {e.to}</option>)}</select></label>
          <label>Severity<select value={f.severity} onChange={(e) => setF({ ...f, severity: +e.target.value })}><option value={1}>Minor</option><option value={2}>Major</option><option value={3}>Severe</option></select></label>
          <label>Duration (demo-clock minutes)<input type="number" min="1" max="120" value={f.minutes} onChange={(e) => setF({ ...f, minutes: +e.target.value })} /></label>
          <label>Description<input type="text" maxLength={120} value={f.description} placeholder="e.g. Truck breakdown" onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
          <button className="btn full" disabled={busy} onClick={() => act(() => api.addIncident(f), "Incident reported. The map updates now; the prediction reflects it at the next 5-minute reading.")}>Report incident</button>
          {msg && <p className={msg.ok ? "ok-note" : "err"} role="status">{msg.t}</p>}
        </section>
        <section className="card">
          <h3>Open incidents</h3>
          {!data.incidents.length ? <Empty>No incidents reported.</Empty> : data.incidents.map((i) => (
            <div key={i.id} className="route"><div><b>{i.road}</b><small>{i.description} · about {i.minutes_left} min left</small></div>
              <button className="btn sm" disabled={busy} onClick={() => act(() => api.clearIncident(i.id), "Incident cleared.")}>Clear</button></div>))}
        </section>
      </div>
    </div>
  );
}
