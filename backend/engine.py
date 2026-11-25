"""Traffic simulation engine for Gurugram: road graph, congestion model,
short-term forecast, routing (Dijkstra + alternatives) and alert generation."""
import heapq, math, random, time
from collections import deque
from datetime import datetime

NODES = {  # id: (name, lat, lng)
    "RC": ("Rajiv Chowk", 28.4595, 77.0266), "SIG": ("Signature Tower", 28.4638, 77.0511),
    "HUDA": ("HUDA City Centre", 28.4592, 77.0725), "IFF": ("IFFCO Chowk", 28.4720, 77.0720),
    "MGM": ("MG Road Metro", 28.4795, 77.0800), "SIK": ("Sikanderpur", 28.4810, 77.0930),
    "CC": ("Cyber City", 28.4950, 77.0890), "UV": ("Udyog Vihar", 28.5014, 77.0770),
    "S54": ("Sector 54 Chowk", 28.4268, 77.1005), "SUB": ("Subhash Chowk", 28.4200, 77.0450),
    "VAT": ("Vatika Chowk", 28.4045, 77.0400), "HH": ("Hero Honda Chowk", 28.4440, 77.0120),
    "KD": ("Kherki Daula Toll", 28.3950, 76.9850),
}
# (from, to, road, free-flow km/h, lanes, typical demand 0..1)
ROADS = [
    ("RC", "SIG", "Sector 29 Road", 40, 2, .6), ("SIG", "HUDA", "MG Road", 40, 3, .95),
    ("HUDA", "IFF", "MG Road", 45, 3, .95), ("IFF", "MGM", "MG Road", 45, 3, .9),
    ("MGM", "SIK", "MG Road", 45, 3, .85), ("MGM", "CC", "Cyber Hub Road", 35, 2, .9),
    ("SIK", "CC", "Cyber City Road", 35, 2, .8), ("HUDA", "S54", "Golf Course Road", 50, 3, .75),
    ("S54", "SIK", "Golf Course Road", 50, 3, .7), ("CC", "UV", "Udyog Vihar Road", 40, 2, .7),
    ("IFF", "UV", "NH-48", 60, 3, .75), ("RC", "SUB", "Sohna Road", 40, 2, .7),
    ("SUB", "VAT", "Sohna Road", 50, 2, .55), ("SUB", "S54", "Golf Course Ext. Road", 50, 3, .6),
    ("RC", "HH", "Railway Road", 40, 2, .5), ("HH", "KD", "NH-48", 70, 3, .55),
    ("HH", "IFF", "NH-48", 60, 3, .65), ("SUB", "HUDA", "Sector 30 Link", 40, 2, .5),
]
DEMAND = .85  # scales typical demand so rush hour is busy but not gridlocked everywhere
BOOST = {1: .25, 2: .4, 3: .6}
SENS = {"low": .35, "medium": .5, "high": .65}
COLORS = ["#2563eb", "#16a34a", "#9333ea", "#ea580c"]


def hav(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def profile(h):
    """Typical city-wide demand by hour of day (0..1): morning and evening rush."""
    g = lambda m, s: math.exp(-(((h - m + 12) % 24 - 12) ** 2) / (2 * s * s))
    return min(1.0, .1 + .75 * g(9.3, 1.6) + .85 * g(18.3, 1.9) + .25 * g(13, 2.5))


def level(r):
    return "free" if r >= .7 else "mod" if r >= .5 else "heavy" if r >= .3 else "grid"


def clock(h):
    h = h % 24
    hh, mm = int(h), int((h % 1) * 60)
    return f"{(hh % 12) or 12}:{mm:02d} {'AM' if hh < 12 else 'PM'}"


def hlabel(h):
    return f"{(h % 12) or 12}{'AM' if h % 24 < 12 else 'PM'}"


class Engine:
    def __init__(self):
        self.nodes = {k: {"id": k, "name": v[0], "pos": [v[1], v[2]]} for k, v in NODES.items()}
        self.edges, self.adj = [], {k: [] for k in NODES}
        for i, (a, b, road, free, lanes, w) in enumerate(ROADS):
            e = dict(id=i, a=a, b=b, road=road, len=round(hav(self.nodes[a]["pos"], self.nodes[b]["pos"]) * 1.25, 2),
                     free=free, lanes=lanes, w=w, noise=0.0, c=0.0, ratio=1.0)
            self.edges.append(e)
            self.adj[a].append((b, e)); self.adj[b].append((a, e))
        self.rng = random.Random(7)
        self.settings = {"sensitivity": "medium", "sim_hour": None}
        self.hist = deque(maxlen=40)
        self.reset()

    def reset(self):
        self.incidents, self.alerts, self.active = {}, [], {}
        self.next_inc, self.next_alert, self.tick = 1, 1, 0
        self.hist.clear()
        for e in self.edges: e["noise"] = self.rng.uniform(-.1, .1)
        self.step()

    # ---------- model ----------
    def hour(self):
        h = self.settings["sim_hour"]
        if h is not None: return float(h)
        n = datetime.now()
        return n.hour + n.minute / 60 + n.second / 3600

    def inc_boost(self, e, hmin=0):
        t, total = time.time() + hmin * 60, 0.0
        for i in self.incidents.values():
            rem = i["expires"] - t
            if rem <= 0: continue
            share = 1 if i["edge"] == e["id"] else .35 if (e["a"] in (i["a"], i["b"]) or e["b"] in (i["a"], i["b"])) else 0
            total += BOOST[i["severity"]] * min(1, rem / 120) * share
        return total

    def cong(self, e, hmin=0):
        """Congestion 0..1 = time-of-day demand + mean-reverting noise + incident effect."""
        base = min(1, profile((self.hour() + hmin / 60) % 24) * e["w"] * DEMAND)
        return max(0.0, min(1.0, base + e["noise"] * math.exp(-hmin / 25) + self.inc_boost(e, hmin)))

    def speed(self, e, hmin=0):
        return e["free"] * (e["ratio"] if hmin == 0 else 1 - .88 * self.cong(e, hmin))

    def index(self, hmin=0):
        return 100 * sum(self.cong(e, hmin) for e in self.edges) / len(self.edges)

    def step(self):
        self.tick += 1
        now = time.time()
        for k in [k for k, i in self.incidents.items() if i["expires"] <= now]: del self.incidents[k]
        for e in self.edges:
            e["noise"] = max(-.2, min(.2, e["noise"] * .92 + self.rng.gauss(0, .035)))
            e["c"] = self.cong(e); e["ratio"] = 1 - .88 * e["c"]
        self.update_alerts()
        r = self.dijkstra("RC", "CC", lambda e: e["len"] / max(self.speed(e), 3) * 60)
        self.hist.append({
            "vehicles": sum(round(e["len"] * e["lanes"] * (2 + 10 * e["c"])) for e in self.edges),
            "flow": round(100 * sum(e["ratio"] for e in self.edges) / len(self.edges)),
            "travel": round(sum(e["len"] / max(self.speed(e), 3) * 60 for e in r[1])),
            "index": round(self.index())})

    # ---------- routing ----------
    def dijkstra(self, src, dst, wfn):
        dist, prev, pq = {src: 0}, {}, [(0, src)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == dst: break
            if d > dist.get(u, 1e18): continue
            for v, e in self.adj[u]:
                nd = d + wfn(e)
                if nd < dist.get(v, 1e18): dist[v], prev[v] = nd, (u, e); heapq.heappush(pq, (nd, v))
        if src != dst and dst not in prev: return None
        path, es = [dst], []
        while path[-1] != src:
            u, e = prev[path[-1]]; es.append(e); path.append(u)
        return path[::-1], es[::-1]

    def alternatives(self, src, dst, h=0, k=3):
        mins = lambda e: e["len"] / max(self.speed(e, h), 3) * 60
        found, pen = {}, {}
        for _ in range(6):
            r = self.dijkstra(src, dst, lambda e: mins(e) * pen.get(e["id"], 1))
            if not r: return []
            found.setdefault(tuple(r[0]), r)
            for e in r[1]: pen[e["id"]] = pen.get(e["id"], 1) * 1.7
            if len(found) >= k: break
        s = self.dijkstra(src, dst, lambda e: e["len"]); found.setdefault(tuple(s[0]), s)
        out = []
        for path, es in found.values():
            km = sum(e["len"] for e in es); mn = sum(mins(e) for e in es); fm = sum(e["len"] / e["free"] * 60 for e in es)
            by = {}
            for e in es: by[e["road"]] = by.get(e["road"], 0) + e["len"]
            top = sorted(by, key=by.get, reverse=True)
            name = "Via " + top[0] + (f" & {top[1]}" if len(top) > 1 and by[top[1]] > .25 * km else "")
            ratio = fm / mn if mn else 1
            out.append(dict(id="-".join(path), name=name, km=round(km, 1), min=round(mn), free_min=round(fm),
                            delay=max(0, round(mn - fm)), level=level(ratio), ratio=round(ratio, 2),
                            nodes=[self.nodes[p]["name"] for p in path], roads=top,
                            path=[self.nodes[p]["pos"] for p in path]))
        out.sort(key=lambda r: r["min"])
        shortest = min(out, key=lambda r: r["km"])
        for i, r in enumerate(out):
            r["color"] = COLORS[i % len(COLORS)]
            r["tag"] = ("Fastest" if i == 0 else "Alternative") + (" · Shortest" if r is shortest else "")
        return out

    # ---------- alerts & incidents ----------
    def update_alerts(self):
        thr = SENS[self.settings["sensitivity"]]
        roads = {}
        for e in self.edges: roads.setdefault(e["road"], []).append(e)
        now = clock(self.hour())
        for road, es in roads.items():
            r = min(e["ratio"] for e in es); a = self.active.get(road)
            if a is None and r >= thr: continue
            if a is not None and r > thr + .08:
                a["active"] = False; a["resolved"] = now; del self.active[road]; continue
            delay = max(1, round(sum(e["len"] / (e["free"] * e["ratio"]) * 60 - e["len"] / e["free"] * 60 for e in es)))
            inc = next((i["description"] for i in self.incidents.values() if i["road"] == road), None)
            sev = "high" if r < .3 else "mid" if r < .45 else "low"
            title = {"high": "Severe Congestion on ", "mid": "High Traffic on ", "low": "Moderate Traffic on "}[sev] + road
            sub = inc or {"high": "Due to high traffic volume", "mid": f"Expect delays of ~{delay} min",
                          "low": "Traffic is moving slower than usual"}[sev]
            if a is None:
                a = dict(id=self.next_alert, road=road, acked=False, active=True, time=now, resolved=None)
                self.next_alert += 1; self.alerts.insert(0, a); self.active[road] = a
                del self.alerts[60:]
            a.update(sev=sev, title=title, sub=sub, delay=delay, speed=round(min(e["free"] * e["ratio"] for e in es)))

    def add_incident(self, edge_id, severity, description, minutes):
        e = self.edges[edge_id]
        i = dict(id=self.next_inc, edge=edge_id, a=e["a"], b=e["b"], road=e["road"], severity=severity,
                 description=description or "Reported incident", expires=time.time() + minutes * 60)
        self.incidents[i["id"]] = i; self.next_inc += 1; self.step()
        return i

    # ---------- payloads ----------
    def network(self):
        inc_edges = {i["edge"] for i in self.incidents.values()}
        nodes = []
        for n in self.nodes.values():
            rs = [e["ratio"] for e in self.edges if n["id"] in (e["a"], e["b"])]
            nodes.append({**n, "level": level(sum(rs) / len(rs))})
        edges = [dict(id=e["id"], road=e["road"], **{"from": self.nodes[e["a"]]["name"], "to": self.nodes[e["b"]]["name"]},
                      pos=[self.nodes[e["a"]]["pos"], self.nodes[e["b"]]["pos"]], km=e["len"], free=e["free"],
                      lanes=e["lanes"], speed=round(e["free"] * e["ratio"]), ratio=round(e["ratio"], 2),
                      level=level(e["ratio"]), vehicles=round(e["len"] * e["lanes"] * (2 + 10 * e["c"])),
                      forecast={str(h): round(self.speed(e, h)) for h in (15, 30, 60)}, incident=e["id"] in inc_edges)
                 for e in self.edges]
        return {"nodes": nodes, "edges": edges}

    def analytics(self, period="24h"):
        idx = lambda h: 100 * sum(min(1, profile(h % 24) * e["w"] * DEMAND) for e in self.edges) / len(self.edges)
        today = datetime.now().toordinal()
        if period == "7d":
            days = [datetime.fromordinal(today - 6 + i) for i in range(7)]
            avg = sum(idx(h) for h in range(6, 22)) / 16
            vals = [round(avg * (1 if d.weekday() < 5 else .75 if d.weekday() == 5 else .6)
                          + random.Random(d.toordinal()).gauss(0, 2)) for d in days]
            labels = [d.strftime("%a") for d in days]
        else:
            now_h = int(self.hour()); hs = [(now_h - 23 + i) % 24 for i in range(24)]
            vals = [round(idx(h) + random.Random(h * 97 + today).gauss(0, 2)) for h in hs]
            vals[-1] = round(self.index()); labels = [hlabel(h) for h in hs]
        pk, lo = vals.index(max(vals)), vals.index(min(vals))
        roads = {}
        for e in self.edges: roads.setdefault(e["road"], []).append(e)
        busiest = []
        for road, es in roads.items():
            hrs = [sum(min(1, profile(h) * e["w"] * DEMAND) for e in es) / len(es) for h in range(24)]
            busiest.append(dict(road=road, avg=round(100 * sum(hrs) / 24), peak=hlabel(hrs.index(max(hrs))),
                                now=round(100 * sum(e["c"] for e in es) / len(es))))
        busiest.sort(key=lambda r: -r["avg"])
        return dict(period=period, labels=labels, values=vals, avg=round(sum(vals) / len(vals)),
                    peak=dict(label=labels[pk], value=vals[pk]), low=dict(label=labels[lo], value=vals[lo]), roads=busiest)

    def dashboard(self):
        k = self.hist[-1]; old = self.hist[0] if len(self.hist) >= 5 else k
        d = lambda key: round((k[key] - old[key]) / old[key] * 100) if old[key] else 0
        preds = []
        for h in (15, 30, 60):
            v = round(self.index(h)); lab, lv = ("Normal", "ok") if v < 40 else ("Moderate", "mid") if v < 60 else ("High", "high")
            preds.append(dict(h=h, v=v, label=lab, level=lv))
        h = self.settings["sim_hour"]
        trend = lambda key: [x[key] for x in list(self.hist)[-20:]]
        return dict(
            tick=self.tick, sim_time=clock(self.hour()), settings=self.settings,
            kpis=dict(vehicles=k["vehicles"], flow=k["flow"], travel=k["travel"], alerts=len(self.active),
                      d_vehicles=d("vehicles"), d_flow=d("flow"), d_travel=d("travel"),
                      t_vehicles=trend("vehicles"), t_flow=trend("flow"), t_travel=trend("travel"), t_index=trend("index")),
            prediction=preds, network=self.network(), routes=self.alternatives("RC", "CC"),
            alerts=self.alerts[:40],
            incidents=[dict(id=i["id"], edge_id=i["edge"], road=i["road"], severity=i["severity"],
                            description=i["description"], minutes_left=max(1, round((i["expires"] - time.time()) / 60)),
                            pos=[(self.nodes[i["a"]]["pos"][0] + self.nodes[i["b"]]["pos"][0]) / 2,
                                 (self.nodes[i["a"]]["pos"][1] + self.nodes[i["b"]]["pos"][1]) / 2])
                       for i in self.incidents.values()],
            analytics=self.analytics("24h"))
