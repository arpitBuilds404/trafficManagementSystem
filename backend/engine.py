"""Traffic simulation engine for Gurugram: road graph, congestion model,
short-term forecast, routing (Dijkstra + alternatives) and alert generation."""
import heapq, math, os, random, time
from collections import deque
from datetime import datetime

try:
    import numpy as np
    import demo_data, ml
    IMPORT_ERROR = None
except Exception as ex:  # e.g. numpy not installed -> predictions are reported as unavailable
    np = demo_data = ml = None
    IMPORT_ERROR = f"{type(ex).__name__}: {ex}"

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
    ("SIG", "IFF", "Sector 29-IFFCO Link", 40, 2, .3), ("HUDA", "MGM", "Sushant Lok Link", 40, 2, .3),
    ("IFF", "SIK", "Sikanderpur Link", 40, 2, .3),
]
DEMAND = .85  # scales typical demand so rush hour is busy but not gridlocked everywhere
BOOST = {1: .25, 2: .4, 3: .6}
SPEED, STEP, CLIP = .5, 5, .2               # demo minutes per tick (tick = 2 s real, so 15x), minutes between observations
PHI5, SD = .8, .1                           # noise memory per 5 min and its stationary spread
PHI_S = PHI5 ** (SPEED / STEP)
SD_S, SD5 = SD * math.sqrt(1 - PHI_S ** 2), SD * math.sqrt(1 - PHI5 ** 2)
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
    hh, mm = divmod(int(round((h % 24) * 60)) % 1440, 60)
    return f"{(hh % 12) or 12}:{mm:02d} {'AM' if hh < 12 else 'PM'}"


def hlabel(h):
    return f"{(h % 12) or 12}{'AM' if h % 24 < 12 else 'PM'}"


def tm(m):
    return clock(m / 60)


def cpct(r):
    return max(0, min(100, round(100 * (1 - r) / .88)))


class Engine:
    """DEMO-mode traffic engine. The demo clock runs 15x faster than real time.
    Every 5 demo minutes a reading of all segments is recorded and the model forecasts the next 30 minutes."""

    def __init__(self):
        self.nodes = {k: {"id": k, "name": v[0], "pos": [v[1], v[2]]} for k, v in NODES.items()}
        self.edges, self.adj = [], {k: [] for k in NODES}
        for i, (a, b, road, free, lanes, w) in enumerate(ROADS):
            e = dict(id=i, a=a, b=b, road=road, len=round(hav(self.nodes[a]["pos"], self.nodes[b]["pos"]) * 1.25, 2),
                     free=free, lanes=lanes, w=w, noise=0.0, c=0.0, ratio=1.0)
            self.edges.append(e)
            self.adj[a].append((b, e)); self.adj[b].append((a, e))
        self.rng = random.Random(7)
        self.settings = {"sensitivity": "medium"}
        self.clock, self.started, self.last_update = 8 * 60.0, time.time(), datetime.now().isoformat(timespec="seconds")
        self.model, self.history, self.ml_error = None, None, IMPORT_ERROR
        self.init_model()
        self.reset()

    def init_model(self):
        if IMPORT_ERROR: return
        try:
            E = len(self.edges)
            w, free = np.array([e["w"] for e in self.edges]), np.array([e["free"] for e in self.edges], float)
            S = np.eye(E)
            for i, a in enumerate(self.edges):
                for j, b in enumerate(self.edges):
                    if i != j and {a["a"], a["b"]} & {b["a"], b["b"]}: S[i, j] = .35
            R, hours = demo_data.generate(w, S, profile, DEMAND, BOOST)
            self.history = (R, hours)
            self.model = ml.load_or_train(R, hours, w, free, os.path.join(os.path.dirname(os.path.abspath(__file__)), "model.npz"))
        except Exception as ex:
            self.model, self.ml_error = None, f"{type(ex).__name__}: {ex}"

    # ---------- simulation ----------
    def hour(self):
        return (self.clock / 60) % 24

    def base(self, e, off=0):
        return min(1, profile(((self.clock + off) / 60) % 24) * e["w"] * DEMAND)

    def inc_boost(self, e, off=0):
        t, total = self.clock + off, 0.0
        for i in self.incidents.values():
            rem = i["expires"] - t
            if rem <= 0: continue
            share = 1 if i["edge"] == e["id"] else .35 if (e["a"] in (i["a"], i["b"]) or e["b"] in (i["a"], i["b"])) else 0
            total += BOOST[i["severity"]] * min(1, rem / 2) * share
        return total

    def reset(self):
        self.incidents, self.alerts, self.active = {}, [], {}
        self.next_inc, self.next_alert, self.tick = 1, 1, 0
        self.seed(); self.refresh()

    def set_clock(self, hour):
        self.clock = float(hour) * 60
        self.reset()

    def seed(self):
        """Back-fill the six readings before 'now' (DEMO data) so the model has its inputs immediately."""
        self.obs, self.obs_t, self.issued, self.verification = deque(maxlen=12), deque(maxlen=12), deque(maxlen=6), []
        n = {e["id"]: self.rng.gauss(0, SD) for e in self.edges}
        for j in range(5, -1, -1):
            row = []
            for e in self.edges:
                n[e["id"]] = max(-CLIP, min(CLIP, PHI5 * n[e["id"]] + self.rng.gauss(0, SD5)))
                row.append(1 - .88 * max(0, min(1, self.base(e, -STEP * j) + n[e["id"]])))
            self.obs.append(row); self.obs_t.append(self.clock - STEP * j)
        for e in self.edges: e["noise"] = n[e["id"]]
        self.next_obs = self.clock + STEP
        self.refresh(); self.predict()

    def refresh(self):
        for e in self.edges:
            e["c"] = max(0.0, min(1.0, self.base(e) + e["noise"] + self.inc_boost(e)))
            e["ratio"] = 1 - .88 * e["c"]
        self.update_alerts()

    def step(self):
        self.tick += 1
        self.clock += SPEED
        for k in [k for k, i in self.incidents.items() if i["expires"] <= self.clock]: del self.incidents[k]
        for e in self.edges:
            e["noise"] = max(-CLIP, min(CLIP, PHI_S * e["noise"] + self.rng.gauss(0, SD_S)))
        self.refresh()
        if self.clock >= self.next_obs: self.observe()
        self.last_update = datetime.now().isoformat(timespec="seconds")

    # ---------- observation & prediction ----------
    def net_speed(self, ratios):
        return sum(r * e["free"] for r, e in zip(ratios, self.edges)) / len(self.edges)

    def observe(self):
        self.obs.append([e["ratio"] for e in self.edges]); self.obs_t.append(self.clock); self.next_obs += STEP
        actual = self.net_speed(self.obs[-1]); ver = []
        for t0, ps in self.issued:
            k = round((self.clock - t0) / STEP)
            if 1 <= k <= 6: ver.append(dict(h=STEP * k, issued=tm(t0), predicted=round(ps[k - 1], 1), actual=round(actual, 1)))
        self.verification = sorted(ver, key=lambda v: v["h"])
        self.predict()

    def predict(self):
        self.pred = None
        if not self.model or len(self.obs) < 6: return
        try:
            lags = np.array(list(self.obs)[-6:][::-1]).T                      # (segments, 6), most recent first
            P = ml.predict(self.model["B"], lags, (self.obs_t[-1] / 60) % 24, np.array([e["w"] for e in self.edges]))
        except Exception as ex:
            self.ml_error = f"{type(ex).__name__}: {ex}"; return
        self.pred, self.issued_at, self.issued_real = P.tolist(), self.obs_t[-1], datetime.now().isoformat(timespec="seconds")
        self.issued.append((self.issued_at, [self.net_speed([row[k] for row in self.pred]) for k in range(6)]))

    def pratio(self, e, h):
        """Speed ratio expected h minutes from now (0-30), interpolated from the latest forecast."""
        if h <= 0 or self.pred is None: return e["ratio"]
        ys = [self.obs[-1][e["id"]]] + self.pred[e["id"]]
        x = min(30, max(0, self.clock - self.issued_at) + h)
        i = min(5, int(x // STEP))
        return ys[i] + (ys[i + 1] - ys[i]) * (x - STEP * i) / STEP

    def speed(self, e, h=0):
        return e["free"] * self.pratio(e, h)

    # ---------- routing ----------
    def dijkstra(self, src, dst, wfn, banned=()):
        dist, prev, pq = {src: 0}, {}, [(0, src)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == dst: break
            if d > dist.get(u, 1e18): continue
            for v, e in self.adj[u]:
                if e["id"] in banned: continue
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
        now = tm(self.clock)
        for road, es in roads.items():
            r = min(e["ratio"] for e in es); a = self.active.get(road)
            if a is None and r >= thr: continue
            if a is not None and r > thr + .08:
                a["active"] = False; a["resolved"] = now; del self.active[road]; continue
            delay = max(1, round(sum(e["len"] / (e["free"] * e["ratio"]) * 60 - e["len"] / e["free"] * 60 for e in es)))
            inc = next((i["description"] for i in self.incidents.values() if i["road"] == road), None)
            sev = "high" if r < .3 else "mid" if r < .45 else "low"
            title = {"high": "Severe congestion on ", "mid": "High traffic on ", "low": "Moderate traffic on "}[sev] + road
            sub = inc or {"high": "Traffic is barely moving", "mid": f"Expect delays of about {delay} min",
                          "low": "Traffic is moving slower than usual"}[sev]
            if a is None:
                a = dict(id=self.next_alert, road=road, acked=False, active=True, time=now, resolved=None)
                self.next_alert += 1; self.alerts.insert(0, a); self.active[road] = a
                del self.alerts[60:]
            a.update(sev=sev, title=title, sub=sub, delay=delay, speed=round(min(e["free"] * e["ratio"] for e in es)))

    def add_incident(self, edge_id, severity, description, minutes):
        e = self.edges[edge_id]
        i = dict(id=self.next_inc, edge=edge_id, a=e["a"], b=e["b"], road=e["road"], severity=severity,
                 description=description or "Reported incident", expires=self.clock + minutes)
        self.incidents[i["id"]] = i; self.next_inc += 1; self.refresh()
        return i

    def advisories(self):
        """Congested segments (ratio < .45) with the best detour that avoids them."""
        mins = lambda x: x["len"] / max(self.speed(x), 3) * 60
        out = []
        for e in sorted(self.edges, key=lambda x: x["ratio"]):
            if e["ratio"] >= .45: continue
            stay, free_min = mins(e), e["len"] / e["free"] * 60
            alt, r = None, self.dijkstra(e["a"], e["b"], mins, banned={e["id"]})
            if r:
                path, es = r
                m, km, by = sum(mins(x) for x in es), sum(x["len"] for x in es), {}
                for x in es: by[x["road"]] = by.get(x["road"], 0) + x["len"]
                top = sorted(by, key=by.get, reverse=True)
                alt = dict(name="Via " + " & ".join(top[:2]), km=round(km, 1), min=max(1, round(m)),
                           saved=round(stay - m), faster=m < stay - .5, roads=top,
                           nodes=[self.nodes[p]["name"] for p in path], path=[self.nodes[p]["pos"] for p in path])
            out.append(dict(id=f"seg-{e['id']}", edge_id=e["id"], road=e["road"], sev="high" if e["ratio"] < .3 else "mid",
                            level=level(e["ratio"]), speed=round(e["free"] * e["ratio"]), free=e["free"],
                            delay=max(1, round(stay - free_min)), stay_min=max(1, round(stay)), alt=alt,
                            pos=[self.nodes[e["a"]]["pos"], self.nodes[e["b"]]["pos"]],
                            **{"from": self.nodes[e["a"]]["name"], "to": self.nodes[e["b"]]["name"]}))
        return out[:8]

    # ---------- payloads ----------
    def network(self):
        inc_edges = {i["edge"] for i in self.incidents.values()}
        nodes = []
        for n in self.nodes.values():
            rs = [e["ratio"] for e in self.edges if n["id"] in (e["a"], e["b"])]
            nodes.append({**n, "level": level(sum(rs) / len(rs))})
        edges = []
        for e in self.edges:
            i = e["id"]
            edges.append(dict(id=i, road=e["road"], **{"from": self.nodes[e["a"]]["name"], "to": self.nodes[e["b"]]["name"]},
                              pos=[self.nodes[e["a"]]["pos"], self.nodes[e["b"]]["pos"]], km=e["len"], free=e["free"],
                              lanes=e["lanes"], speed=round(e["free"] * e["ratio"]), ratio=round(e["ratio"], 2),
                              level=level(e["ratio"]), incident=i in inc_edges,
                              pred=[round(e["free"] * r, 1) for r in self.pred[i]] if self.pred else None,
                              pred_level=[level(r) for r in self.pred[i]] if self.pred else None,
                              hist=[round(e["free"] * o[i], 1) for o in self.obs]))
        return {"nodes": nodes, "edges": edges}

    def model_info(self):
        if not self.model: return None
        return dict(**ml.INFO, metrics=self.model["metrics"], cached=self.model["cached"],
                    data="21 days of synthetic DEMO history (17 days for training, 4 held out for testing)")

    def prediction(self):
        if self.pred is None: return None
        E, t0 = len(self.edges), self.issued_at
        mean = lambda col: sum(col) / E
        hist = [dict(time=tm(t), speed=round(self.net_speed(o), 1), level=level(mean(o)), congestion=cpct(mean(o)))
                for t, o in zip(self.obs_t, self.obs)]
        steps = []
        for k in range(6):
            col = [self.pred[i][k] for i in range(E)]
            steps.append(dict(min=STEP * (k + 1), time=tm(t0 + STEP * (k + 1)), speed=round(self.net_speed(col), 1),
                              level=level(mean(col)), congestion=cpct(mean(col))))
        return dict(source="DEMO", issued_at=tm(t0), generated=self.issued_real, current=hist[-1], history=hist,
                    steps=steps, verification=self.verification, model=self.model_info())

    def analytics(self):
        if self.history is None: raise RuntimeError(self.ml_error or "Demo history unavailable")
        R, hours = self.history
        free, hrs = np.array([e["free"] for e in self.edges], float), hours.astype(int)
        cp = lambda r: float(np.clip((1 - r) / .88 * 100, 0, 100))
        hourly = [round(cp(R[hrs == h].mean()), 1) for h in range(24)]
        flat, cur = R.ravel(), int(self.hour())
        dist = dict(free=(flat >= .7).mean(), mod=((flat >= .5) & (flat < .7)).mean(),
                    heavy=((flat >= .3) & (flat < .5)).mean(), grid=(flat < .3).mean())
        by = {}
        for i, e in enumerate(self.edges): by.setdefault(e["road"], []).append(i)
        rows = []
        for road, ix in by.items():
            sub = R[:, ix]; hh = [cp(sub[hrs == h].mean()) for h in range(24)]
            rows.append(dict(road=road, segments=len(ix), free=round(float(free[ix].mean())),
                             avg_speed=round(float((sub * free[ix]).mean()), 1), congested_pct=round(float((sub < .5).mean() * 100), 1),
                             peak=hlabel(int(np.argmax(hh))), peak_congestion=round(max(hh))))
        rows.sort(key=lambda r: -r["congested_pct"])
        return dict(source="DEMO history", days=R.shape[0] // 288, labels=[hlabel(h) for h in range(24)], hourly=hourly,
                    current_hour=cur, typical_now=hourly[cur], now=cpct(sum(e["ratio"] for e in self.edges) / len(self.edges)),
                    distribution={k: round(float(v) * 100, 1) for k, v in dist.items()}, roads=rows)

    def dashboard(self):
        E = len(self.edges); mean = sum(e["ratio"] for e in self.edges) / E
        pred = self.prediction(); p30 = pred["steps"][5] if pred else None
        return dict(
            tick=self.tick, mode="DEMO", sim_time=tm(self.clock), last_update=self.last_update, settings=self.settings,
            ml=dict(available=self.pred is not None, error=self.ml_error),
            kpis=dict(segments=E, junctions=len(self.nodes), speed=round(sum(e["free"] * e["ratio"] for e in self.edges) / E, 1),
                      level=level(mean), congestion=cpct(mean), alerts=len(self.active),
                      p30_speed=p30["speed"] if p30 else None, p30_level=p30["level"] if p30 else None),
            network=self.network(), prediction=pred, alerts=self.alerts[:40], advisories=self.advisories(),
            incidents=[dict(id=i["id"], edge_id=i["edge"], road=i["road"], severity=i["severity"], description=i["description"],
                            minutes_left=max(1, round(i["expires"] - self.clock)),
                            pos=[(self.nodes[i["a"]]["pos"][0] + self.nodes[i["b"]]["pos"][0]) / 2,
                                 (self.nodes[i["a"]]["pos"][1] + self.nodes[i["b"]]["pos"][1]) / 2])
                       for i in self.incidents.values()])
