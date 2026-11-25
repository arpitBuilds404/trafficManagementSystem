// All calls go to /api (proxied to FastAPI on port 8000 by vite.config.js).
async function req(path, opts = {}) {
  const r = await fetch("/api" + path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) {
    let msg = r.statusText;
    try { const j = await r.json(); msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); } catch {}
    throw new Error(msg);
  }
  return r.json();
}
const send = (method, body) => ({ method, body: body ? JSON.stringify(body) : undefined });

export const api = {
  dashboard: () => req("/dashboard"),
  route: (src, dst, h) => req(`/route?src=${src}&dst=${dst}&horizon=${h}`),
  analytics: (period) => req(`/analytics?period=${period}`),
  ack: (id) => req(`/alerts/${id}/ack`, send("POST")),
  addIncident: (b) => req("/incidents", send("POST", b)),
  clearIncident: (id) => req(`/incidents/${id}`, send("DELETE")),
  settings: (b) => req("/settings", send("PUT", b)),
  reset: () => req("/reset", send("POST")),
};

export const BOUNDS = [[28.39, 76.98], [28.505, 77.105]]; // whole road network
export const LEVEL = {
  free: { c: "#16a34a", t: "Free flow" }, mod: { c: "#eab308", t: "Moderate" },
  heavy: { c: "#f97316", t: "Heavy" }, grid: { c: "#dc2626", t: "Severe" },
};
