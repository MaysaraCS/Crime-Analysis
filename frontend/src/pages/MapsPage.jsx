import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_BASE_URL;

// ── Exact same colour map used in ReportPage ─────────────────────────────────
const LABEL_COLOR = {
  very_dangerous: "#ef4444",
  dangerous:      "#f97316",
  moderate:       "#eab308",
  safe:           "#22c55e",
  unknown:        "#94a3b8",
};

const LABEL_ORDER = ["safe", "moderate", "dangerous", "very_dangerous"];

const niceLabel = (label) =>
  label ? label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

// ── Download CSV (same helper as ReportPage) ──────────────────────────────────
function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

const MapsPage = () => {
  const [riskData,   setRiskData]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [mode,       setMode]       = useState("formula");
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState("all");
  const [showTable,  setShowTable]  = useState(false);

  const defaultCenter = [26.4207, 50.0888];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/risk?year=2025`);
        if (!res.ok) throw new Error("Failed to load risk data");
        const rd = await res.json();
        setRiskData(Array.isArray(rd) ? rd : []);
      } catch (err) {
        toast.error(err.message || "Failed to load map data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Points shown on map ───────────────────────────────────────────────────
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

  // ── Table rows — same columns as ReportPage Detailed Report Table ─────────
  const tableRows = useMemo(() =>
    [...points]
      .sort((a, b) => (Number(b.r) || 0) - (Number(a.r) || 0))
      .map((p) => ({
        neighborhood:       p.name,
        r1:                 Number(p.r1 || 0).toFixed(2),
        r2:                 Number(p.r2 || 0).toFixed(2),
        R:                  Number(p.r  || 0).toFixed(2),
        formula_label:      p.formula_label   || "—",
        ml_label:           p.predicted_label || "—",
        confidence:         p.confidence != null
                              ? (Number(p.confidence) * 100).toFixed(1) + "%"
                              : "—",
        unemployment_score: p.scores?.unemployment  ?? "—",
        income_score:       p.scores?.income         ?? "—",
        vitality_score:     p.scores?.vitality       ?? "—",
      })),
  [points]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!points.length) return null;
    const avgR = points.reduce((s, p) => s + (Number(p.r) || 0), 0) / points.length;
    const labelCounts = LABEL_ORDER.reduce((acc, k) => {
      acc[k] = points.filter((p) => p.displayLabel === k).length;
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

  const allNames = riskData.map((n) => n.name);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── Controls bar ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Crime Risk Map — Dammam 2025</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Circles coloured by risk label · same R values as the Seasonal Report table
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTable((v) => !v)}
              className="px-4 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              {showTable ? "Hide Table" : "Show Table"}
            </button>
            <button
              onClick={() => downloadCSV("crime_map_risk_2025.csv", tableRows)}
              className="px-4 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Download CSV
            </button>
          </div>
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
              {allNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend + stats */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            {[
              ["safe",           "Safe (<40)"],
              ["moderate",       "Moderate (40–59)"],
              ["dangerous",      "Dangerous (60–79)"],
              ["very_dangerous", "Very Dangerous (>80)"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LABEL_COLOR[key] }} />
                {label}
              </div>
            ))}
          </div>

          {stats && (
            <div className="ml-auto text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200 flex gap-3">
              <span>
                <span className="font-medium text-gray-700">{stats.count}</span> neighbourhood{stats.count !== 1 ? "s" : ""}
              </span>
              <span>Avg R: <span className="font-medium text-orange-500">{stats.avgR.toFixed(2)}</span></span>
              {LABEL_ORDER.map((k) => stats.labelCounts[k] > 0 && (
                <span key={k} style={{ color: LABEL_COLOR[k] }} className="font-medium">
                  {niceLabel(k)}: {stats.labelCounts[k]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Map + optional table split ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className={`relative ${showTable ? "w-1/2" : "w-full"} transition-all duration-300`}>
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
                  color:       LABEL_COLOR[p.displayLabel] || "#94a3b8",
                  fillColor:   LABEL_COLOR[p.displayLabel] || "#94a3b8",
                  fillOpacity: 0.55,
                  weight: 2,
                }}
              >
                <Popup minWidth={240}>
                  <div className="text-sm">
                    <div className="font-bold text-base mb-2 text-gray-800">{p.name}</div>

                    {/* Risk scores — identical fields to Detailed Report Table */}
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1 mb-2 text-xs">
                      <div className="text-gray-400">R1 (crime)</div>
                      <div className="text-gray-400">R2 (demo)</div>
                      <div className="text-gray-400">R (combined)</div>
                      <div className="font-semibold text-gray-700">{p.r1}</div>
                      <div className="font-semibold text-gray-700">{p.r2}</div>
                      <div className="font-bold text-orange-600">{p.r}</div>
                    </div>

                    {/* Labels */}
                    <div className="space-y-1 text-xs mb-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">Formula Label:</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                          style={{ backgroundColor: LABEL_COLOR[p.formula_label] || "#94a3b8" }}
                        >
                          {niceLabel(p.formula_label)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">ML Label:</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                          style={{ backgroundColor: LABEL_COLOR[p.predicted_label] || "#94a3b8" }}
                        >
                          {niceLabel(p.predicted_label)}
                        </span>
                      </div>
                      {p.confidence != null && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-500">Confidence:</span>
                          <span className="font-medium text-gray-700">
                            {(p.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Demographic scores — same as table columns */}
                    {p.scores && (
                      <div className="border-t border-gray-100 pt-2 text-xs text-gray-500 space-y-0.5">
                        <div className="font-medium text-gray-600 mb-1">Demographic Scores</div>
                        {[
                          ["Unemployment",   p.scores.unemployment],
                          ["Income",         p.scores.income],
                          ["Vitality",       p.scores.vitality],
                          ["Pop Density",    p.scores.population_density],
                          ["Divorce Ratio",  p.scores.divorce_ratio],
                          ["Unmarried >30",  p.scores.unmarried_over_30],
                          ["Univ Education", p.scores.university_education],
                        ].map(([label, val]) => (
                          <div key={label} className="flex justify-between">
                            <span>{label}:</span>
                            <span className="font-medium text-gray-700">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* ── Side table (same columns as ReportPage Detailed Report Table) ── */}
        {showTable && (
          <div className="w-1/2 overflow-auto bg-white border-l border-gray-200">
            <div className="p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-gray-700 text-sm">
                Detailed Risk Table
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {tableRows.length} neighbourhood(s) · sorted by R descending · full-year (2025)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      "Neighbourhood","R1","R2","R",
                      "Formula Label","ML Label","Confidence",
                      "Unemp","Income","Vitality",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap sticky top-0 bg-gray-50"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => (
                    <tr
                      key={r.neighborhood}
                      className={`border-b border-gray-100 ${
                        i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                        {r.neighborhood}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.r1}</td>
                      <td className="px-3 py-2 text-gray-600">{r.r2}</td>
                      <td className="px-3 py-2 font-bold text-orange-600">{r.R}</td>
                      <td className="px-3 py-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-white text-xs font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: LABEL_COLOR[r.formula_label] || "#94a3b8",
                          }}
                        >
                          {niceLabel(r.formula_label)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-white text-xs font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: LABEL_COLOR[r.ml_label] || "#94a3b8",
                          }}
                        >
                          {niceLabel(r.ml_label)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.confidence}</td>
                      <td className="px-3 py-2 text-gray-600">{r.unemployment_score}</td>
                      <td className="px-3 py-2 text-gray-600">{r.income_score}</td>
                      <td className="px-3 py-2 text-gray-600">{r.vitality_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapsPage;