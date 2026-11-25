import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import { BOUNDS, LEVEL } from "../api.js";

function Fit({ target }) {
  const map = useMap();
  const key = target ? target.id : "";
  useEffect(() => { if (target) map.fitBounds(target.pts, { padding: [60, 60], maxZoom: 14 }); }, [key]); // eslint-disable-line
  return null;
}

export default function MapView({ network, routes = [], selected, incidents = [], labels = true, height = 340, fit = true, highlight = null }) {
  const route = routes.find((r) => r.id === selected);
  const alt = highlight && highlight.alt;
  const target = highlight ? { id: "h" + highlight.id, pts: [...highlight.pos, ...(alt ? alt.path : [])] }
    : route && fit ? { id: route.id, pts: route.path } : null;
  return (
    <MapContainer bounds={BOUNDS} boundsOptions={{ padding: [20, 20] }} scrollWheelZoom className="map" style={{ height }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {route && <Polyline positions={route.path} pathOptions={{ color: "#1d4ed8", weight: 14, opacity: 0.4 }} />}
      {network.edges.filter((e) => e.level === "grid").map((e) => (
        <Polyline key={"p" + e.id} positions={e.pos} interactive={false} pathOptions={{ color: "#dc2626", weight: 16, opacity: 0.4, className: "pulse" }} />
      ))}
      {network.edges.map((e) => (
        <Polyline key={e.id} positions={e.pos} pathOptions={{ color: LEVEL[e.level].c, weight: 6, opacity: 0.95 }}>
          <Popup>
            <b>{e.road}</b><br />{e.from} → {e.to} · {e.km} km<br />
            Now: <b>{e.speed} km/h</b> ({LEVEL[e.level].t})<br />
            {e.pred ? <>In 15 min: {e.pred[2]} km/h · in 30 min: {e.pred[5]} km/h</> : "Prediction unavailable"}<br />
          </Popup>
        </Polyline>
      ))}
      {alt && <Polyline positions={alt.path} interactive={false} pathOptions={{ color: "#fff", weight: 13, opacity: 0.95 }} />}
      {alt && <Polyline positions={alt.path} interactive={false} pathOptions={{ color: alt.faster ? "#0d9f4f" : "#64748b", weight: 7, opacity: 1 }}>
        <Tooltip sticky>{alt.name} · {alt.min} min</Tooltip></Polyline>}
      {routes.filter((r) => r.id !== selected).map((r) => (
        <Polyline key={r.id} positions={r.path} pathOptions={{ color: r.color, weight: 3, opacity: 0.8, dashArray: "2 8" }} />
      ))}
      {network.nodes.map((n) => (
        <CircleMarker key={n.id} center={n.pos} radius={7}
          pathOptions={{ color: LEVEL[n.level].c, weight: 3, fillColor: "#fff", fillOpacity: 1 }}>
          <Tooltip permanent={labels} direction="top" offset={[0, -6]} className="nlabel">{n.name}</Tooltip>
        </CircleMarker>
      ))}
      {incidents.map((i) => (
        <CircleMarker key={i.id} center={i.pos} radius={13}
          pathOptions={{ color: "#dc2626", weight: 2, fillColor: "#dc2626", fillOpacity: 0.25, dashArray: "4 3" }}>
          <Tooltip>⚠ {i.description} ({i.road})</Tooltip>
        </CircleMarker>
      ))}
      {route && [route.path[0], route.path[route.path.length - 1]].map((p, k) => (
        <CircleMarker key={k} center={p} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: k ? "#16a34a" : "#1d4ed8", fillOpacity: 1 }}>
          <Tooltip>{k ? "Destination" : "Start"}</Tooltip>
        </CircleMarker>
      ))}
      <Fit target={target} />
    </MapContainer>
  );
}

export function Legend() {
  return (
    <div className="legend">
      {Object.values(LEVEL).map((l) => <span key={l.t}><i style={{ background: l.c }} />{l.t}</span>)}
      <span><i style={{ background: "#0d9f4f" }} />Suggested detour</span><span>⚠ Incident</span><span>Click a road for details</span>
    </div>
  );
}
