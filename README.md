# Smart Traffic Management System – Gurugram

React + Leaflet/OpenStreetMap frontend, FastAPI backend (simulated traffic, no API keys).

## Run (Windows)
Install Python 3.10+ (tick "Add to PATH") and Node.js 18+ LTS, then double-click **start-all.bat**.
It opens the backend (port 8000) and frontend (port 5173) and launches the browser.
Or run them separately: `start-backend.bat`, then `start-frontend.bat`.

Manual: 
    cd backend  && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
    cd frontend && npm install && npm run dev      -> http://localhost:5173

API docs: http://localhost:8000/docs

## Features
- Dashboard: live KPIs, map with congestion-coloured roads, 15/30/60-min prediction, route options, alerts, 24h chart
- Traffic Analytics: 24h / 7-day congestion, busiest roads, per-segment speed forecast
- Route Optimization: pick any two junctions + horizon, get fastest/shortest/alternative routes drawn on the map
- Alerts: automatic alerts, acknowledge, resolved history, report/clear incidents (affects map, forecasts and routes)
- Settings: alert sensitivity, refresh rate, junction labels, reset simulation
- "Time of day" menu (top bar): jump to rush hour or late night for demos

## API
GET /api/dashboard · GET /api/route?src=RC&dst=CC&horizon=30 · GET /api/analytics?period=24h|7d
GET /api/alerts · POST /api/alerts/{id}/ack · GET/POST /api/incidents · DELETE /api/incidents/{id}
GET/PUT /api/settings · POST /api/reset · GET /api/health
