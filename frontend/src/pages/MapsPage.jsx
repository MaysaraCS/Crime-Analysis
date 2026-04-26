import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_BASE_URL;

const LABEL_COLOR = {
  very_dangerous: "#ef4444",
  dangerous: "#f97316",
  moderate: "#eab308",
  safe: "#22c55e",
};

const niceLabel = (label) => (label ? label.replaceAll("_", " ") : "—");

const MapsPage = () => {
  const [riskData, setRiskData] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("ml");

  // Neighbourhood filter for map
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState("all");

  const defaultCenter = [26.4207, 50.0888];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rRes, nRes] = await Promise.all([
          fetch(`${API}/api/risk?year=2025`),
          fetch(`${API}/api/neighborhoods`),
        ]);
        if (!rRes.ok) throw new Error("Failed to load risk data");
        if (!nRes.ok) throw new Error("Failed to load neighbourhood data");
        const rd = await rRes.json();
        const nd = await nRes.json();
        setRiskData(Array.isArray(rd) ? rd : []);
        setNeighborhoods(Array.isArray(nd) ? nd : []);
      } catch (err) {
        toast.error(err.message || "Failed to load map data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const points = useMemo(() => {
    const data =
      selectedNeighbourhood === "all"
        ? riskData
        : riskData.filter((p) => p.name === selectedNeighbourhood);

    return data.map((p) => ({
      ...p,
      displayLabel: mode === "ml" ? p.predicted_label : p.formula_label,
    }));
  }, [riskData, mode, selectedNeighbourhood]);

  // Stats for selected
  const stats = useMemo(() => {
    if (!points.length) return null;
    const avgR = points.reduce((s, p) => s + (Number(p.r) || 0), 0) / points.length;
    const labelCounts = points.reduce((acc, p) => {
      const k = p.displayLabel || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    return { avgR, labelCounts, count: points.length };
  }, [points]);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading map data…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Controls */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-3 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Crime Risk Map — Dammam 2025</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Circles are coloured by risk label. Toggle between ML and formula classification.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMode("formula")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                mode === "formula" ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Formula
            </button>
            <button
              onClick={() => setMode("ml")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                mode === "ml" ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              ML Prediction
            </button>
          </div>

          {/* Neighbourhood filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Filter:</span>
            <select
              value={selectedNeighbourhood}
              onChange={(e) => setSelectedNeighbourhood(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Neighbourhoods</option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.name}>{n.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend + stats */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            {[["safe", "Safe"], ["moderate", "Moderate"], ["dangerous", "Dangerous"], ["very_dangerous", "Very Dangerous"]].map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LABEL_COLOR[key] }} />
                {label}
              </div>
            ))}
          </div>

          {stats && (
            <div className="ml-auto text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
              <span className="font-medium text-gray-700">{stats.count}</span> neighbourhood{stats.count !== 1 ? "s" : ""} ·{" "}
              Avg R: <span className="font-medium text-orange-500">{stats.avgR.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={defaultCenter}
          zoom={selectedNeighbourhood !== "all" ? 14 : 11}
          className="h-full w-full"
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {points.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={selectedNeighbourhood !== "all" ? 18 : 10}
              pathOptions={{
                color: LABEL_COLOR[p.displayLabel] || "#94a3b8",
                fillColor: LABEL_COLOR[p.displayLabel] || "#94a3b8",
                fillOpacity: 0.5,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm" style={{ minWidth: 220 }}>
                  <div className="font-bold text-base mb-2">{p.name}</div>
                  <div className="space-y-1">
                    <div><b>Formula label:</b> {niceLabel(p.formula_label)}</div>
                    <div><b>ML label:</b> {niceLabel(p.predicted_label)}</div>
                    {p.confidence != null && (
                      <div><b>Confidence:</b> {(p.confidence * 100).toFixed(1)}%</div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600 space-y-0.5">
                    <div><b>R1 (crime):</b> {p.r1}</div>
                    <div><b>R2 (demo):</b> {p.r2}</div>
                    <div><b>R (combined):</b> {p.r}</div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapsPage;