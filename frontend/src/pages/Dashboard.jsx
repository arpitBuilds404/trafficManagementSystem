import { useState } from "react";
import { Car, CheckCircle2, Clock, AlertTriangle, MapPin, TrendingUp, Route as RouteIcon, Bell, BarChart3 } from "lucide-react";
import MapView, { Legend } from "../components/MapView.jsx";
import { Spark, AreaChart } from "../components/Charts.jsx";

const arrow = (n) => (n > 0 ? `↑ ${n}%` : n < 0 ? `↓ ${Math.abs(n)}%` : "– 0%");

function Kpi({ icon: Icon, tone, value, label, delta, goodWhenUp = true, color, trend }) {
  const good = delta === undefined || delta === 0 ? true : goodWhenUp ? delta > 0 : delta < 0;
  return (
    <div className="card kpi">
      <div className={`ico ${tone}`}><Icon size={24} /></div>
      <div className="kpi-txt"><b>{value}</b><span>{label}</span>
        {delta !== undefined && <small className={good ? "up" : "down"}>{arrow(delta)}</small>}</div>
      <Spark color={color} data={trend} />
    </div>
  );
}

export default function Dashboard({ data, go, labels }) {
  const [sel, setSel] = useState(null);
  const selected = data.routes.some((r) => r.id === sel) ? sel : data.routes[0]?.id;
  const active = data.alerts.filter((a) => a.active).slice(0, 4);
  const k = data.kpis;
  return (
    <>
      <section className="kpis">
        <Kpi icon={Car} tone="blue" value={k.vehicles.toLocaleString()} label="Total Vehicles (Live)" delta={k.d_vehicles} color="#2563eb" trend={k.t_vehicles} />
        <Kpi icon={CheckCircle2} tone="green" value={`${k.flow}%`} label="Avg Traffic Flow" delta={k.d_flow} color="#16a34a" trend={k.t_flow} />
        <Kpi icon={Clock} tone="orange" value={`${k.travel} min`} label="Avg Travel Time" delta={k.d_travel} goodWhenUp={false} color="#f97316" trend={k.t_travel} />
        <Kpi icon={AlertTriangle} tone="red" value={k.alerts} label="Active Alerts" color="#dc2626" trend={k.t_index} />
      </section>

      <div className="grid">
        <div className="col">
          <section className="card">
            <div className="ch"><h3><MapPin size={20} color="#2563eb" /> Traffic Overview – Gurugram</h3>
              <span className="live sm"><i />Live • {data.sim_time}</span></div>
            <MapView network={data.network} routes={data.routes} selected={selected} incidents={data.incidents} labels={labels} height={360} fit={sel !== null} />
            <Legend />
          </section>
          <section className="card">
            <div className="ch"><h3><BarChart3 size={20} color="#2563eb" /> Traffic Analytics</h3>
              <a href="#analytics">View Details →</a></div>
            <AreaChart labels={data.analytics.labels} values={data.analytics.values} />
          </section>
        </div>

        <div className="col">
          <section className="card">
            <div className="ch"><h3><TrendingUp size={20} color="#2563eb" /> Traffic Prediction</h3><a href="#analytics">View Details →</a></div>
            <div className="pred">{data.prediction.map((p) => (
              <div key={p.h}><span>{p.h} Min</span><b>{p.v}%</b><em className={p.level}>{p.label}</em></div>))}</div>
            <p className="note">Predicted congestion index for the whole network.</p>
          </section>
          <section className="card">
            <div className="ch"><h3><RouteIcon size={20} color="#2563eb" /> Optimized Routes</h3><a href="#routes">View All →</a></div>
            <p className="note" style={{ marginTop: 0 }}>Rajiv Chowk → Cyber City</p>
            {data.routes.slice(0, 3).map((r) => (
              <div key={r.id} className={`route ${selected === r.id ? "sel" : ""}`}>
                <div><b>{r.name}</b><small>{r.km} km • ~{r.min} min {r.delay > 0 && `(+${r.delay} min delay)`}</small></div>
                <button onClick={() => setSel(r.id)}>{selected === r.id ? "Shown" : "Select"}</button>
              </div>))}
          </section>
          <section className="card alerts">
            <div className="ch"><h3><Bell size={20} color="#dc2626" /> Recent Alerts</h3><a href="#alerts" className="red">View All →</a></div>
            {active.length === 0 && <p className="note">No active alerts. Traffic is flowing normally.</p>}
            {active.map((a) => (
              <div key={a.id} className="alert"><i className={a.sev} /><div><b>{a.title}</b><small>{a.sub}</small></div><time>{a.time}</time></div>))}
          </section>
        </div>
      </div>
    </>
  );
}
