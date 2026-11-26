import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutDashboard, Map as MapIcon, TrendingUp, Bell, BarChart3, Route as RouteIcon, Activity, Menu } from "lucide-react";
import { api } from "./api.js";
import Overview from "./pages/Overview.jsx";
import Monitoring from "./pages/Monitoring.jsx";
import Prediction from "./pages/Prediction.jsx";
import Alerts from "./pages/Alerts.jsx";
import Analytics from "./pages/Analytics.jsx";
import RoutePlanner from "./pages/RoutePlanner.jsx";
import System from "./pages/System.jsx";
import { NotifBell, Toasts, headline, detail, advice } from "./components/Notifications.jsx";

const PAGES = [
  ["overview", "Overview", "Current traffic across Gurugram at a glance.", LayoutDashboard],
  ["monitoring", "Traffic Monitoring", "Speed and congestion on every monitored road segment.", MapIcon],
  ["prediction", "Prediction", "What the model expects over the next 30 minutes.", TrendingUp],
  ["alerts", "Alerts & Incidents", "Problems that need attention.", Bell],
  ["analytics", "Analytics", "How traffic usually behaves, based on demo history.", BarChart3],
  ["routes", "Route Planner", "Fastest route using current and predicted speeds.", RouteIcon],
  ["system", "System Status", "Health of each component, and demo controls.", Activity],
];
const JUMPS = [["8", "8:00 AM – morning build-up"], ["9.3", "9:20 AM – morning peak"], ["13", "1:00 PM – midday"], ["18.3", "6:20 PM – evening peak"], ["23", "11:00 PM – night"]];
const readPage = () => { const p = location.hash.slice(1); return PAGES.some((x) => x[0] === p) ? p : "overview"; };

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [ws, setWs] = useState("connecting");
  const [page, setPage] = useState(readPage);
  const [nav, setNav] = useState(false);
  const [labels, setLabels] = useState(() => localStorage.getItem("labels") !== "0");
  const [desktop, setDesktop] = useState(() => localStorage.getItem("desktop") === "1");
  const [scope, setScope] = useState("network");
  const [toasts, setToasts] = useState([]);
  const [focusId, setFocusId] = useState(null);
  const seen = useRef(new Set());

  const refresh = useCallback(async () => {
    try { setData(await api.dashboard()); setErr(null); } catch (e) { setErr(e.message || "offline"); }
  }, []);

  useEffect(() => { // WebSocket for live pushes; reconnects automatically
    let sock, retry, stop = false;
    const open = () => {
      sock = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      sock.onopen = () => setWs("connected");
      sock.onmessage = (m) => { setData(JSON.parse(m.data)); setErr(null); };
      sock.onclose = () => { setWs("disconnected"); if (!stop) retry = setTimeout(open, 3000); };
      sock.onerror = () => sock.close();
    };
    open();
    return () => { stop = true; clearTimeout(retry); sock && sock.close(); };
  }, []);
  useEffect(() => { // fall back to polling whenever the WebSocket is not connected
    if (ws === "connected") return;
    refresh(); const t = setInterval(refresh, 4000); return () => clearInterval(t);
  }, [ws, refresh]);
  useEffect(() => { const f = () => setPage(readPage()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  useEffect(() => { localStorage.setItem("labels", labels ? "1" : "0"); }, [labels]);
  useEffect(() => { localStorage.setItem("desktop", desktop ? "1" : "0"); }, [desktop]);
  useEffect(() => { // notify when a road turns severe
    if (!data) return;
    const fresh = data.advisories.filter((a) => a.sev === "high" && !seen.current.has(a.id));
    seen.current = new Set(data.advisories.map((a) => a.id));
    if (!fresh.length) return;
    setToasts((t) => [...fresh.map((a) => ({ ...a, key: a.id + "-" + Date.now() })), ...t].slice(0, 3));
    if (desktop && "Notification" in window && Notification.permission === "granted")
      fresh.slice(0, 2).forEach((a) => new Notification(headline(a), { body: detail(a) + " " + advice(a) }));
  }, [data]); // eslint-disable-line

  if (!data) {
    return (
      <div className="offline card">
        <h2>{err ? "Cannot reach the traffic backend" : "Connecting to the traffic backend…"}</h2>
        {err && <><p className="note">Start the FastAPI backend in a separate terminal, then retry:</p>
          <pre>cd backend{"\n"}uvicorn main:app --reload --port 8000</pre>
          <button className="btn" onClick={refresh}>Retry</button></>}
      </div>
    );
  }

  const go = (p) => { location.hash = p; setNav(false); };
  const viewAdvisory = (id) => { setFocusId(id); go("monitoring"); };
  const openSegment = (id) => { setScope(String(id)); go("prediction"); };
  const jump = async (v) => { if (!v) return; try { await api.settings({ sim_hour: +v }); refresh(); } catch (e) { setErr(e.message); } };
  const connState = ws === "connected" ? "connected" : err ? "offline" : ws === "connecting" ? "connecting" : "polling";
  const connText = { connected: "Connected", connecting: "Connecting…", polling: "Reconnecting (polling)", offline: "Backend offline" }[connState];
  const [, title, sub] = PAGES.find((p) => p[0] === page);
  const props = { data, refresh, labels, go, ws };

  return (
    <div className={`app ${nav ? "nav-open" : ""}`}>
      <aside className="side">
        <div className="brand"><b>Smart Traffic Management</b><span>Gurugram · Congestion detection & prediction</span></div>
        <nav>{PAGES.map(([id, name, , Icon]) => (
          <a key={id} href={`#${id}`} className={page === id ? "on" : ""} onClick={() => setNav(false)}>
            <Icon size={18} />{name}{id === "alerts" && data.kpis.alerts > 0 && <em>{data.kpis.alerts}</em>}</a>))}
        </nav>
        <div className="foot">B.Tech project · demo build</div>
      </aside>
      {nav && <div className="scrim" onClick={() => setNav(false)} />}

      <main>
        <div className="top">
          <button className="burger" onClick={() => setNav(!nav)} aria-label="Toggle menu"><Menu size={22} /></button>
          <span className="badge demo" title="All traffic data is simulated and replayed on an accelerated clock">DEMO MODE</span>
          <span className={`conn ${connState}`}><i />{connText}</span>
          <span className="clock" title="Demo clock (runs 15× faster than real time)">Demo clock {data.sim_time}</span>
          <select className="jump" value="" onChange={(e) => jump(e.target.value)} aria-label="Jump the demo clock">
            <option value="">Jump demo clock to…</option>{JUMPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <NotifBell advisories={data.advisories} onView={viewAdvisory} />
        </div>
        <div className="head"><h1>{title}</h1><p>{sub}</p></div>
        <div className="notice">Demo mode: the traffic readings are simulated, not measured by sensors. Predictions are produced by the real forecasting model from that demo data.</div>

        {page === "overview" && <Overview {...props} setScope={setScope} />}
        {page === "monitoring" && <Monitoring {...props} focusId={focusId} setFocusId={setFocusId} openSegment={openSegment} />}
        {page === "prediction" && <Prediction {...props} scope={scope} setScope={setScope} />}
        {page === "alerts" && <Alerts {...props} />}
        {page === "analytics" && <Analytics {...props} />}
        {page === "routes" && <RoutePlanner {...props} />}
        {page === "system" && <System {...props} labels={labels} setLabels={setLabels} desktop={desktop} setDesktop={setDesktop} />}
      </main>
      <Toasts toasts={toasts} close={(k) => setToasts((t) => t.filter((x) => x.key !== k))} onView={viewAdvisory} />
    </div>
  );
}
