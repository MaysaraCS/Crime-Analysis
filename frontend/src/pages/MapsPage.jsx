

import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_BASE_URL;

const labelColor = (label) => {
  if (label === "very_dangerous") return "red";
  if (label === "dangerous") return "orange";
  if (label === "moderate") return "yellow";
  return "green"; // safe
};

const niceLabel = (label) => {
  if (!label) return "-";
  return label.replaceAll("_", " ");
};

const MapsPage = () => {
  const [riskData, setRiskData] = useState([]);
  const [loading, setLoading] = useState(true);

  // "ml" => predicted_label, "formula" => formula_label
  const [mode, setMode] = useState("ml");

  const defaultCenter = [26.4207, 50.0888];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/risk?year=2025`);
        if (!res.ok) throw new Error("Failed to load risk data");
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid API response");
        setRiskData(data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load risk data from backend");
        setRiskData([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const points = useMemo(() => {
    return riskData.map((p) => {
      const displayLabel = mode === "ml" ? p.predicted_label : p.formula_label;
      return { ...p, displayLabel };
    });
  }, [riskData, mode]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading map data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-auto" style={{ height: "calc(120vh - 56px)" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-3">
        <h2 className="text-2xl font-semibold text-gray-800">Crime Risk Map (Dammam) — 2025</h2>
        <p className="text-sm text-gray-600">
          Map shows neighborhood risk as circles. You can color by Formula risk or ML prediction.
        </p>

        {/* Toggle */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-700 font-medium">Color by:</span>

          <button
            onClick={() => setMode("formula")}
            className={`px-4 py-2 rounded-lg border transition ${
              mode === "formula" ? "bg-gray-200 border-gray-300" : "bg-white border-gray-300"
            }`}
          >
            Formula
          </button>

          <button
            onClick={() => setMode("ml")}
            className={`px-4 py-2 rounded-lg border transition ${
              mode === "ml" ? "bg-gray-200 border-gray-300" : "bg-white border-gray-300"
            }`}
          >
            ML Prediction
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-700">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div> Safe
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div> Moderate
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div> Dangerous
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div> Very Dangerous
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative" style={{ height: "650px", minHeight: "450px" }}>
        <MapContainer center={defaultCenter} zoom={11} className="h-full w-full" zoomControl={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {points.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={10}
              pathOptions={{
                color: labelColor(p.displayLabel),
                fillColor: labelColor(p.displayLabel),
                fillOpacity: 0.45,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm" style={{ minWidth: 220 }}>
                  <div className="font-semibold">{p.name}</div>

                  <div className="mt-2">
                    <div>
                      <b>Formula:</b> {niceLabel(p.formula_label)}
                    </div>
                    <div>
                      <b>ML:</b> {niceLabel(p.predicted_label)}
                    </div>
                    {p.confidence != null && (
                      <div>
                        <b>Confidence:</b> {(p.confidence * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-700">
                    <div>
                      <b>R1:</b> {p.r1}
                    </div>
                    <div>
                      <b>R2:</b> {p.r2}
                    </div>
                    <div>
                      <b>R:</b> {p.r}
                    </div>
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