import { useCallback, useEffect, useState } from "react";
import { LayoutDashboard, BarChart3, Route as RouteIcon, Bell, Settings as Cog, Info, Menu, MapPin, ChevronDown } from "lucide-react";
import { api } from "./api.js";
import Dashboard from "./pages/Dashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import RouteOptimization from "./pages/RouteOptimization.jsx";
import Alerts from "./pages/Alerts.jsx";
import Settings from "./pages/Settings.jsx";
import About from "./pages/About.jsx";

const PAGES = [
  ["dashboard", "Dashboard", LayoutDashboard], ["analytics", "Traffic Analytics", BarChart3],
  ["routes", "Route Optimization", RouteIcon], ["alerts", "Alerts", Bell], ["settings", "Settings", Cog], ["about", "About", Info],
];
const TIMES = [["live", "Live clock"], ["9", "9:00 AM – morning rush"], ["13", "1:00 PM – afternoon"], ["18.5", "6:30 PM – evening rush"], ["23", "11:00 PM – late night"]];
const readPage = () => { const p = location.hash.slice(1); return PAGES.some((x) => x[0] === p) ? p : "dashboard"; };

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(readPage);
  const [nav, setNav] = useState(false);
  const [refreshMs, setRefreshMs] = useState(() => +localStorage.getItem("refreshMs") || 4000);
  const [labels, setLabels] = useState(() => localStorage.getItem("labels") !== "0");
  const [now, setNow] = useState(new Date());

  const refresh = useCallback(async () => {
    try { setData(await api.dashboard()); setErr(null); } catch (e) { setErr(e.message || "offline"); }
  }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, refreshMs); return () => clearInterval(t); }, [refresh, refreshMs]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => { const f = () => setPage(readPage()); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  useEffect(() => { localStorage.setItem("refreshMs", refreshMs); }, [refreshMs]);
  useEffect(() => { localStorage.setItem("labels", labels ? "1" : "0"); }, [labels]);

  if (!data) {
    return (
      <div className="offline card">
        <h2>{err ? "Cannot reach the traffic backend" : "Loading traffic data…"}</h2>
        {err && <>
          <p>Start the FastAPI backend in a separate terminal, then retry:</p>
          <pre>cd backend{"\n"}uvicorn main:app --reload --port 8000</pre>
          <button className="go" onClick={refresh}>Retry</button></>}
      </div>
    );
  }

  const setTime = async (v) => { await api.settings(v === "live" ? { live_clock: true } : { sim_hour: +v }); refresh(); };
  const timeVal = data.settings.sim_hour == null ? "live" : String(data.settings.sim_hour);
  const props = { data, refresh, labels };
  const date = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const go = (p) => { location.hash = p; setNav(false); };

  return (
    <div className={`app ${nav ? "nav-open" : ""}`}>
      <aside className="side">
        <div className="brand"><div className="logo">🏙️</div><h2>Smart Traffic<br />Management System</h2><p>Gurugram</p></div>
        <nav>{PAGES.map(([id, name, Icon]) => (
          <a key={id} href={`#${id}`} className={page === id ? "on" : ""} onClick={() => setNav(false)}>
            <Icon size={20} />{name}{id === "alerts" && data.kpis.alerts > 0 && <em>{data.kpis.alerts}</em>}</a>))}
        </nav>
        <div className="tag">Smarter Roads.<br />A Better Gurugram.</div>
      </aside>
      {nav && <div className="scrim" onClick={() => setNav(false)} />}

      <main>
        <div className="top">
          <button className="burger" onClick={() => setNav(!nav)} aria-label="Toggle menu"><Menu size={22} /></button>
          {err && <span className="warn">Connection lost – retrying…</span>}
          <label className="tsel">Time of day
            <select value={timeVal} onChange={(e) => setTime(e.target.value)}>{TIMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <span className="live"><i />{err ? "Offline" : "Live Data"}</span>
          <span className="date">{date} • {data.sim_time}</span><span className="avatar">A</span>
        </div>

        <div className="hello">
          <div><h1>{PAGES.find((p) => p[0] === page)[1] === "Dashboard" ? "Welcome to Smart Traffic Management System" : PAGES.find((p) => p[0] === page)[1]}</h1>
            <p>Real-time traffic monitoring and route optimization for Gurugram</p></div>
          <span className="pill"><MapPin size={16} color="#2563eb" /> Gurugram, Haryana <ChevronDown size={16} /></span>
        </div>

        {page === "dashboard" && <Dashboard {...props} go={go} />}
        {page === "analytics" && <Analytics {...props} />}
        {page === "routes" && <RouteOptimization {...props} />}
        {page === "alerts" && <Alerts {...props} />}
        {page === "settings" && <Settings {...props} refreshMs={refreshMs} setRefreshMs={setRefreshMs} setLabels={setLabels} />}
        {page === "about" && <About />}
      </main>
    </div>
  );
}
