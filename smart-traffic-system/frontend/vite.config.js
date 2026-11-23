import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Forward REST and WebSocket traffic to the FastAPI backend (uvicorn on port 8000).
const proxy = { "/api": "http://127.0.0.1:8000", "/ws": { target: "ws://127.0.0.1:8000", ws: true } };
export default defineConfig({ plugins: [react()], server: { proxy }, preview: { proxy } });
