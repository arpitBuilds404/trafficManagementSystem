import { useState } from "react";
import { api } from "../api.js";

export default function Alerts({ data, refresh }) {
  const [tab, setTab] = useState("active");
  const [f, setF] = useState({ edge_id: 0, severity: 2, minutes: 10, description: "" });
  const [msg, setMsg] = useState("");
  const list = data.alerts.filter((a) => (tab === "active" ? a.active : !a.active));
  const act = async (fn, ok) => { try { await fn(); setMsg(ok); refresh(); } catch (e) { setMsg("Error: " + e.message); } };
  return (
    <div className="grid">
      <div className="col">
        <section className="card alerts">
          <div className="ch"><h3>Alerts</h3>
            <div className="seg" role="group">
              <button aria-pressed={tab === "active"} onClick={() => setTab("active")}>Active ({data.alerts.filter((a) => a.active).length})</button>
              <button aria-pressed={tab === "resolved"} onClick={() => setTab("resolved")}>Resolved</button></div></div>
          {!list.length && <p className="note">{tab === "active" ? "No active alerts. Traffic is flowing normally." : "No resolved alerts yet."}</p>}
          {list.map((a) => (
            <div key={a.id} className="alert"><i className={a.sev} />
              <div><b>{a.title}</b><small>{a.sub}{a.active && ` • ~${a.speed} km/h`}</small>
                {!a.active && <small>Resolved at {a.resolved}</small>}</div>
              <div className="aside"><time>{a.time}</time>
                {a.active && (a.acked ? <small>Acknowledged</small> :
                  <button className="mini" onClick={() => act(() => api.ack(a.id), "Alert acknowledged.")}>Acknowledge</button>)}</div>
            </div>))}
        </section>
      </div>
      <div className="col">
        <section className="card">
          <h3 style={{ marginBottom: 10 }}>Report an incident</h3>
          <label>Road segment
            <select value={f.edge_id} onChange={(e) => setF({ ...f, edge_id: +e.target.value })}>
              {data.network.edges.map((e) => <option key={e.id} value={e.id}>{e.road}: {e.from} → {e.to}</option>)}</select></label>
          <label>Severity
            <select value={f.severity} onChange={(e) => setF({ ...f, severity: +e.target.value })}>
              <option value={1}>Minor</option><option value={2}>Major</option><option value={3}>Severe</option></select></label>
          <label>Duration (minutes)
            <input type="number" min="1" max="120" value={f.minutes} onChange={(e) => setF({ ...f, minutes: +e.target.value })} /></label>
          <label>Description
            <input value={f.description} maxLength={120} placeholder="e.g. Truck breakdown" onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
          <button className="go" onClick={() => act(() => api.addIncident(f), "Incident reported. Watch the map and forecasts update.")}>Report incident</button>
          {msg && <p className="note" role="status">{msg}</p>}
        </section>
        <section className="card">
          <h3 style={{ marginBottom: 6 }}>Open incidents</h3>
          {!data.incidents.length && <p className="note">No incidents reported.</p>}
          {data.incidents.map((i) => (
            <div key={i.id} className="route">
              <div><b>{i.road}</b><small>{i.description} • {i.minutes_left} min left</small></div>
              <button onClick={() => act(() => api.clearIncident(i.id), "Incident cleared.")}>Clear</button></div>))}
        </section>
      </div>
    </div>
  );
}
