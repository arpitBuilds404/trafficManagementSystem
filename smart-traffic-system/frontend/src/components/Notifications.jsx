import { useEffect, useState } from "react";
import { Bell as BellIcon, X } from "lucide-react";

export const advice = (a) =>
  a.alt && a.alt.faster
    ? `Take ${a.alt.name}: about ${a.alt.min} min instead of ${a.stay_min} min (saves ${a.alt.saved} min).`
    : `No faster detour right now. Allow about ${a.delay} extra min.`;
export const headline = (a) => `${a.sev === "high" ? "Severe congestion" : "Heavy traffic"} on ${a.road}`;
export const detail = (a) => `${a.from} → ${a.to}: ${a.speed} km/h (normal ${a.free}).`;

export function NotifBell({ advisories, onView }) {
  const [open, setOpen] = useState(false);
  const n = advisories.length;
  return (
    <div className="bellwrap">
      <button className="bell" onClick={() => setOpen(!open)} aria-label={`Notifications, ${n} congested segments`} aria-expanded={open}>
        <BellIcon size={20} />{n > 0 && <em>{n}</em>}</button>
      {open && (
        <div className="panel" role="dialog" aria-label="Congestion notifications">
          <h4>Congestion notifications</h4>
          {!n && <p className="note">No congested roads right now.</p>}
          {advisories.map((a) => (
            <div key={a.id} className="adv">
              <i className={a.sev === "high" ? "high" : "mid"} />
              <div><b>{headline(a)}</b><small>{detail(a)}</small><small className="rec">{advice(a)}</small>
                <button className="mini" onClick={() => { onView(a.id); setOpen(false); }}>Show on map</button></div>
            </div>))}
        </div>)}
    </div>
  );
}

function Toast({ a, onClose, onView }) {
  useEffect(() => { const t = setTimeout(onClose, 14000); return () => clearTimeout(t); }, []); // eslint-disable-line
  return (
    <div className="toast" role="alert">
      <i className={a.sev === "high" ? "high" : "mid"} />
      <div><b>{headline(a)}</b><small>{detail(a)}</small><small className="rec">{advice(a)}</small>
        <button className="mini" onClick={() => { onView(a.id); onClose(); }}>View route on map</button></div>
      <button className="x" onClick={onClose} aria-label="Dismiss"><X size={16} /></button>
    </div>
  );
}

export function Toasts({ toasts, close, onView }) {
  return <div className="toasts">{toasts.map((t) => <Toast key={t.key} a={t} onClose={() => close(t.key)} onView={onView} />)}</div>;
}
