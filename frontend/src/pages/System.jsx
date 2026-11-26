import { useEffect, useState } from "react";
import { api } from "../api.js";

const Row = ({ name, state, tone, children }) => (
  <div className="statusrow"><b>{name}</b><span className={`chip ${tone}`}>{state}</span><span>{children}</span></div>);

export default function System({ data, refresh, ws, labels, setLabels, desktop, setDesktop }) {
  const [st, setSt] = useState(null), [err, setErr] = useState(null), [msg, setMsg] = useState(null), [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { api.status().then((s) => { setSt(s); setErr(null); }).catch((e) => setErr(e.message)); }, [Math.floor(data.tick / 5)]);
  const run = async (fn, ok) => { try { await fn(); setMsg({ ok: true, t: ok }); refresh(); } catch (e) { setMsg({ ok: false, t: e.message }); } };
  const age = Math.max(0, Math.round((now - new Date(data.last_update).getTime()) / 1000));
  return (
    <div className="grid g2">
      <section className="card">
        <h3>Component status</h3>
        {err && <p className="err">Could not read status: {err}</p>}
        <Row name="Backend API" state={err ? "Disconnected" : "Connected"} tone={err ? "bad" : "ok"}>FastAPI service{st && `, running for ${Math.round(st.backend.uptime_s / 60)} min`}.</Row>
        <Row name="Database" state="Unavailable" tone="bad">{st ? st.database.detail : "No database is configured."}</Row>
        <Row name="Neo4j graph DB" state="Unavailable" tone="bad">{st ? st.neo4j.detail : "Not configured."}</Row>
        <Row name="Prediction model" state={data.ml.available ? "Available" : "Unavailable"} tone={data.ml.available ? "ok" : "bad"}>
          {data.ml.available ? (st?.ml.model?.name || "Loaded") + "." : data.ml.error || "Model not loaded."}</Row>
        <Row name="WebSocket" state={ws === "connected" ? "Connected" : "Disconnected"} tone={ws === "connected" ? "ok" : "bad"}>
          {ws === "connected" ? "Receiving pushes every 2 seconds." : "The page falls back to polling every 4 seconds and retries automatically."}</Row>
        <Row name="Data source" state="DEMO" tone="warn">Simulated traffic, accelerated 15× (5 demo minutes ≈ 20 seconds).</Row>
        <Row name="Last data update" state={age > 10 ? "Stale" : "Fresh"} tone={age > 10 ? "bad" : "ok"}>{new Date(data.last_update).toLocaleTimeString()} ({age}s ago) · demo clock {data.sim_time}.</Row>
      </section>
      <section className="card">
        <h3>Controls</h3>
        <label>Alert sensitivity
          <select value={data.settings.sensitivity} onChange={(e) => run(() => api.settings({ sensitivity: e.target.value }), "Alert sensitivity saved.")}>
            <option value="low">Low – only severe slowdowns</option><option value="medium">Medium</option><option value="high">High – alert early</option></select></label>
        <label className="check"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Show junction names on maps</label>
        <label className="check"><input type="checkbox" checked={desktop} onChange={async (e) => {
          if (!e.target.checked) { setDesktop(false); return; }
          if (!("Notification" in window)) { setMsg({ ok: false, t: "This browser does not support desktop notifications." }); return; }
          const p = await Notification.requestPermission();
          if (p === "granted") { setDesktop(true); setMsg({ ok: true, t: "Desktop notifications on." }); } else setMsg({ ok: false, t: "Permission was blocked in the browser." });
        }} /> Desktop notifications for severe congestion</label>
        <button className="btn full" style={{ marginTop: 8 }} onClick={() => run(api.reset, "Demo reset: incidents and alerts cleared.")}>Reset demo</button>
        {msg && <p className={msg.ok ? "ok-note" : "err"} role="status">{msg.t}</p>}
        <h3 style={{ marginTop: 20 }}>About</h3>
        <p className="note" style={{ marginTop: 0 }}>Detects congestion on 21 road segments across 13 Gurugram junctions, forecasts speed 30 minutes ahead in 5-minute steps, raises alerts and suggests faster routes. The forecast model is trained and tested on simulated demo history; connect real sensor data to use it for live operations.</p>
      </section>
    </div>
  );
}
