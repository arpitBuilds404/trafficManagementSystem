import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import { BOUNDS, LEVEL } from "../api.js";

function Fit({ route, fit }) {
  const map = useMap();
  const key = route ? route.id : "";
  useEffect(() => { if (route && fit) map.fitBounds(route.path, { padding: [50, 50] }); }, [key]); // eslint-disable-line
  return null;
}

export default function MapView({ network, routes = [], selected, incidents = [], labels = true, height = 340, fit = true }) {
  const route = routes.find((r) => r.id === selected);
  return (
    <MapContainer bounds={BOUNDS} boundsOptions={{ padding: [20, 20] }} scrollWheelZoom className="map" style={{ height }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {route && <Polyline positions={route.path} pathOptions={{ color: "#1d4ed8", weight: 14, opacity: 0.4 }} />}
      {network.edges.map((e) => (
        <Polyline key={e.id} positions={e.pos} pathOptions={{ color: LEVEL[e.level].c, weight: 6, opacity: 0.9 }}>
          <Popup>
            <b>{e.road}</b><br />{e.from} → {e.to} · {e.km} km<br />
            Now: <b>{e.speed} km/h</b> ({LEVEL[e.level].t})<br />
            +15 min: {e.forecast["15"]} · +30 min: {e.forecast["30"]} · +60 min: {e.forecast["60"]} km/h<br />
            ~{e.vehicles} vehicles on segment
          </Popup>
        </Polyline>
      ))}
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
      <Fit route={route} fit={fit} />
    </MapContainer>
  );
}

export function Legend() {
  return (
    <div className="legend">
      {Object.values(LEVEL).map((l) => <span key={l.t}><i style={{ background: l.c }} />{l.t}</span>)}
      <span>⚠ Incident</span><span>Click a road for details</span>
    </div>
  );
}
