import { useState } from "react";
import { api } from "../api.js";

export default function Settings({ data, refresh, refreshMs, setRefreshMs, labels, setLabels }) {
  const [msg, setMsg] = useState("");
  const s = data.settings;
  const run = async (fn, ok) => { try { await fn(); setMsg(ok); refresh(); } catch (e) { setMsg("Error: " + e.message); } };
  return (
    <section className="card narrow">
      <h3 style={{ marginBottom: 12 }}>Settings</h3>
      <label>Alert sensitivity
        <select value={s.sensitivity} onChange={(e) => run(() => api.settings({ sensitivity: e.target.value }), "Alert sensitivity saved.")}>
          <option value="low">Low – only severe slowdowns</option><option value="medium">Medium</option><option value="high">High – alert early</option></select></label>
      <label>Refresh interval
        <select value={refreshMs} onChange={(e) => { setRefreshMs(+e.target.value); setMsg("Refresh interval saved."); }}>
          <option value={2000}>2 seconds</option><option value={4000}>4 seconds</option><option value={10000}>10 seconds</option></select></label>
      <label className="check"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Show junction names on the map</label>
      <button className="go" style={{ marginTop: 14 }} onClick={() => run(api.reset, "Simulation reset: incidents and alerts cleared.")}>Reset simulation</button>
      {msg && <p className="note" role="status">{msg}</p>}
      <p className="note">Use the “Time of day” menu in the top bar to jump to rush hour or late night.</p>
    </section>
  );
}
