export default function About() {
  return (
    <section className="card narrow">
      <h3 style={{ marginBottom: 8 }}>About this system</h3>
      <p>Smart Traffic Management System for Gurugram detects congestion, forecasts it 15, 30 and 60 minutes ahead and suggests faster routes for public transport and private vehicles.</p>
      <p><b>Backend (FastAPI):</b> a road graph of 13 junctions and 18 segments, a time-of-day congestion simulation, a short-term forecast, Dijkstra routing with alternatives, and automatic alerts.</p>
      <p><b>Frontend (React):</b> live map with React Leaflet and OpenStreetMap, charts, route planner, alert centre and settings.</p>
      <p className="note">Traffic data is simulated. The forecast combines the typical daily demand pattern with a decaying short-term deviation, so it can be replaced with a trained model such as a graph neural network later.</p>
    </section>
  );
}
