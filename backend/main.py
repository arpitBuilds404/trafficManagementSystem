"""Smart Traffic API (Gurugram).  Run: uvicorn main:app --reload --port 8000   Docs: /docs"""
import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from engine import SENS, Engine

eng = Engine()


async def ticker():
    while True:
        await asyncio.sleep(2)
        eng.step()


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(ticker())
    yield
    task.cancel()


app = FastAPI(title="Smart Traffic API - Gurugram", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class IncidentIn(BaseModel):
    edge_id: int
    severity: int = Field(2, ge=1, le=3)
    description: str = Field("Reported incident", max_length=120)
    minutes: int = Field(10, ge=1, le=120)


class SettingsIn(BaseModel):
    sensitivity: Optional[str] = None      # low | medium | high
    sim_hour: Optional[float] = Field(None, ge=0, lt=24)
    live_clock: Optional[bool] = None      # true = use the real clock


@app.get("/api/health")
def health():
    return {"status": "ok", "tick": eng.tick}


@app.get("/api/dashboard")
def dashboard():
    return eng.dashboard()


@app.get("/api/nodes")
def nodes():
    return list(eng.nodes.values())


@app.get("/api/route")
def route(src: str, dst: str, horizon: int = Query(0, ge=0, le=60)):
    if src not in eng.nodes or dst not in eng.nodes: raise HTTPException(404, "Unknown junction")
    if src == dst: raise HTTPException(400, "Source and destination must differ")
    return {"src": src, "dst": dst, "horizon": horizon, "routes": eng.alternatives(src, dst, horizon)}


@app.get("/api/analytics")
def analytics(period: str = Query("24h", pattern="^(24h|7d)$")):
    return eng.analytics(period)


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
    del eng.incidents[incident_id]; eng.step()
    return {"cleared": incident_id}


@app.get("/api/settings")
def get_settings():
    return eng.settings


@app.put("/api/settings")
def put_settings(body: SettingsIn):
    if body.sensitivity is not None:
        if body.sensitivity not in SENS: raise HTTPException(400, "sensitivity must be low, medium or high")
        eng.settings["sensitivity"] = body.sensitivity
    if body.live_clock: eng.settings["sim_hour"] = None
    elif body.sim_hour is not None: eng.settings["sim_hour"] = body.sim_hour
    eng.step()
    return eng.settings


@app.post("/api/reset")
def reset():
    eng.reset()
    return {"status": "reset"}
