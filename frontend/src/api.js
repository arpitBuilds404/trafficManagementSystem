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
  status: () => req("/status"),
  route: (src, dst, h) => req(`/route?src=${src}&dst=${dst}&horizon=${h}`),
  analytics: () => req("/analytics"),
  ack: (id) => req(`/alerts/${id}/ack`, send("POST")),
  addIncident: (b) => req("/incidents", send("POST", b)),
  clearIncident: (id) => req(`/incidents/${id}`, send("DELETE")),
  settings: (b) => req("/settings", send("PUT", b)),
  reset: () => req("/reset", send("POST")),
};

export const BOUNDS = [[28.39, 76.98], [28.505, 77.105]]; // whole road network
export const LEVEL = {
  free: { c: "#22c55e", t: "Low", d: "Traffic is moving freely." },
  mod: { c: "#eab308", t: "Moderate", d: "Traffic is a little slower than normal." },
  heavy: { c: "#f97316", t: "High", d: "Traffic is moving slowly." },
  grid: { c: "#ef4444", t: "Severe", d: "Traffic is barely moving." },
};
export const levelOf = (r) => (r >= 0.7 ? "free" : r >= 0.5 ? "mod" : r >= 0.3 ? "heavy" : "grid");
export const cpct = (r) => Math.max(0, Math.min(100, Math.round((100 * (1 - r)) / 0.88)));
export const trendOf = (now, later) => (later < now - 1 ? ["Slowing", "down"] : later > now + 1 ? ["Improving", "up"] : ["Steady", "flat"]);
