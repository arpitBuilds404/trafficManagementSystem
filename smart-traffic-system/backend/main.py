"""Smart Traffic API (Gurugram, DEMO mode).  Run: uvicorn main:app --reload --port 8000   Docs: /docs"""
import asyncio, time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine import SENS, Engine

eng = Engine()
clients: set = set()


async def ticker():
    while True:
        await asyncio.sleep(2)
        eng.step()
        if clients:
            msg = eng.dashboard()
            for ws in list(clients):
                try: await ws.send_json(msg)
                except Exception: clients.discard(ws)


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(ticker())
    yield
    task.cancel()


app = FastAPI(title="Smart Traffic API - Gurugram (DEMO mode)", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class IncidentIn(BaseModel):
    edge_id: int
    severity: int = Field(2, ge=1, le=3)
    description: str = Field("Reported incident", max_length=120)
    minutes: int = Field(20, ge=1, le=120)   # demo-clock minutes


class SettingsIn(BaseModel):
    sensitivity: Optional[str] = None        # low | medium | high
    sim_hour: Optional[float] = Field(None, ge=0, lt=24)   # jump the demo clock to this hour


@app.get("/api/health")
def health():
    return {"status": "ok", "tick": eng.tick}


@app.get("/api/status")
def status():
    m = eng.model
    return {
        "backend": {"status": "connected", "uptime_s": round(time.time() - eng.started)},
        "database": {"status": "unavailable", "detail": "No database is configured. State is held in memory and resets when the backend restarts."},
        "neo4j": {"status": "unavailable", "detail": "Neo4j is not configured. Routing uses the in-memory road graph."},
        "ml": {"status": "available" if eng.pred is not None else "unavailable", "error": eng.ml_error,
               "model": eng.model_info()},
        "websocket": {"status": "available", "clients": len(clients)},
        "data": {"source": "DEMO", "sim_time": eng.dashboard()["sim_time"], "last_update": eng.last_update,
                 "server_time": datetime.now().isoformat(timespec="seconds")},
    }


@app.get("/api/dashboard")
def dashboard():
    return eng.dashboard()


@app.get("/api/nodes")
def nodes():
    return list(eng.nodes.values())


@app.get("/api/route")
def route(src: str, dst: str, horizon: int = Query(0, ge=0, le=30)):
    if src not in eng.nodes or dst not in eng.nodes: raise HTTPException(404, "Unknown junction")
    if src == dst: raise HTTPException(400, "Source and destination must differ")
    if horizon > 0 and eng.pred is None: raise HTTPException(503, "Prediction model unavailable")
    return {"src": src, "dst": dst, "horizon": horizon, "routes": eng.alternatives(src, dst, horizon)}


@app.get("/api/prediction")
def prediction():
    p = eng.prediction()
    if p is None: raise HTTPException(503, eng.ml_error or "Prediction model unavailable")
    return p


@app.get("/api/analytics")
def analytics():
    try: return eng.analytics()
    except RuntimeError as ex: raise HTTPException(503, str(ex))


@app.get("/api/alerts")
def alerts(status: str = "all"):
    return [a for a in eng.alerts if status == "all" or a["active"] == (status == "active")]


@app.post("/api/alerts/{alert_id}/ack")
def ack(alert_id: int):
    a = next((a for a in eng.alerts if a["id"] == alert_id), None)
    if not a: raise HTTPException(404, "Alert not found")
    a["acked"] = True
    return a


@app.get("/api/incidents")
def incidents():
    return eng.dashboard()["incidents"]


@app.post("/api/incidents", status_code=201)
def add_incident(body: IncidentIn):
    if not 0 <= body.edge_id < len(eng.edges): raise HTTPException(404, "Unknown road segment")
    i = eng.add_incident(body.edge_id, body.severity, body.description, body.minutes)
    return {"id": i["id"], "road": i["road"]}


@app.delete("/api/incidents/{incident_id}")
def clear_incident(incident_id: int):
    if incident_id not in eng.incidents: raise HTTPException(404, "Incident not found")
    del eng.incidents[incident_id]; eng.refresh()
    return {"cleared": incident_id}


@app.get("/api/settings")
def get_settings():
    return eng.settings


@app.put("/api/settings")
def put_settings(body: SettingsIn):
    if body.sensitivity is not None:
        if body.sensitivity not in SENS: raise HTTPException(400, "sensitivity must be low, medium or high")
        eng.settings["sensitivity"] = body.sensitivity
        eng.refresh()
    if body.sim_hour is not None: eng.set_clock(body.sim_hour)
    return eng.settings


@app.post("/api/reset")
def reset():
    eng.reset()
    return {"status": "reset"}


@app.websocket("/ws")
async def ws(socket: WebSocket):
    await socket.accept(); clients.add(socket)
    try:
        await socket.send_json(eng.dashboard())
        while True: await socket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(socket)
