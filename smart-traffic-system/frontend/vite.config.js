
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND_URL = "https://trafficmanagementsystem-eu1b.onrender.com";

const proxy = {
  "/api": {
    target: BACKEND_URL,
    changeOrigin: true,
    secure: true,
  },
  "/ws": {
    target: BACKEND_URL,
    changeOrigin: true,
    secure: true,
    ws: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
