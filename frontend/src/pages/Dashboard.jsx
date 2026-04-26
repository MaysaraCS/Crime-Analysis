import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import NeighbourhoodChecklist from "../components/NeighbourhoodChecklist";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend
);

const API = import.meta.env.VITE_API_BASE_URL;

const LABEL_COLORS = {
  safe: "#22c55e",
  moderate: "#eab308",
  dangerous: "#f97316",
  very_dangerous: "#ef4444",
  unknown: "#94a3b8",
};

// Helper: filter riskRows by a checklist selection ([] = all)
const applyFilter = (rows, selected) =>
  selected.length === 0 ? rows : rows.filter((r) => selected.includes(r.name));

const Dashboard = () => {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [riskRows, setRiskRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per-section checklist filters — [] means "all selected"
  const [filterKpi, setFilterKpi] = useState([]);
  const [filterPie1, setFilterPie1] = useState([]);
  const [filterPie2, setFilterPie2] = useState([]);
  const [filterBar, setFilterBar] = useState([]);
  const [filterLine, setFilterLine] = useState([]);

  // All neighbourhood names for the checklists
  const allNames = useMemo(() => neighborhoods.map((n) => n.name), [neighborhoods]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [nRes, rRes] = await Promise.all([
          fetch(`${API}/api/neighborhoods`),
          fetch(`${API}/api/risk?year=2025`),
        ]);
        if (!nRes.ok) throw new Error(`Failed /api/neighborhoods (${nRes.status})`);
        if (!rRes.ok) throw new Error(`Failed /api/risk (${rRes.status})`);
        setNeighborhoods(await nRes.json());
        setRiskRows(await rRes.json());
      } catch (err) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ─── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const rows = applyFilter(riskRows, filterKpi);
    const total = rows.length;
    const avgR = total > 0 ? rows.reduce((s, x) => s + (Number(x.r) || 0), 0) / total : 0;
    const confRows = rows.filter((x) => x.confidence != null);
    const avgConf =
      confRows.length > 0
        ? confRows.reduce((s, x) => s + (Number(x.confidence) || 0), 0) / confRows.length
        : 0;
    return { total, avgR, avgConf };
  }, [riskRows, filterKpi]);

  // ─── ML Pie ────────────────────────────────────────────────────────────────
  const mlLabelPie = useMemo(() => {
    const rows = applyFilter(riskRows, filterPie1);
    const counts = rows.reduce((acc, r) => {
      const k = r.predicted_label || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const labels = Object.keys(counts);
    return {
      labels,
      datasets: [
        {
          data: labels.map((l) => counts[l]),
          backgroundColor: labels.map((l) => LABEL_COLORS[l] || "#94a3b8"),
        },
      ],
    };
  }, [riskRows, filterPie1]);

  // ─── Formula Pie ───────────────────────────────────────────────────────────
  const formulaLabelPie = useMemo(() => {
    const rows = applyFilter(riskRows, filterPie2);
    const counts = rows.reduce((acc, r) => {
      const k = r.formula_label || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const labels = Object.keys(counts);
    return {
      labels,
      datasets: [
        {
          data: labels.map((l) => counts[l]),
          backgroundColor: labels.map((l) => LABEL_COLORS[l] || "#94a3b8"),
        },
      ],
    };
  }, [riskRows, filterPie2]);

  // ─── Top Risk Bar ──────────────────────────────────────────────────────────
  const topRiskBar = useMemo(() => {
    const rows = applyFilter(riskRows, filterBar)
      .sort((a, b) => (Number(b.r) || 0) - (Number(a.r) || 0))
      .slice(0, 10);
    return {
      labels: rows.map((x) => x.name),
      datasets: [
        {
          label: "Risk Score (R)",
          data: rows.map((x) => Number(x.r) || 0),
          backgroundColor: rows.map(
            (x) => LABEL_COLORS[x.predicted_label] || "#3c81f6"
          ),
          borderRadius: 6,
        },
      ],
    };
  }, [riskRows, filterBar]);

  // ─── Demographics Line ─────────────────────────────────────────────────────
  const demoLine = useMemo(() => {
    const rows = applyFilter(riskRows, filterLine);
    if (!rows.length) return { labels: [], datasets: [] };

    const keys = [
      { key: "population_density", label: "Pop Density",    color: "#3c81f6" },
      { key: "divorce_ratio",       label: "Divorce Ratio",  color: "#ef4444" },
      { key: "unmarried_over_30",   label: "Unmarried >30",  color: "#f97316" },
      { key: "university_education",label: "Univ Education", color: "#22c55e" },
      { key: "unemployment",        label: "Unemployment",   color: "#eab308" },
      { key: "income",              label: "Income",         color: "#a855f7" },
      { key: "vitality",            label: "Vitality",       color: "#06b6d4" },
    ];

    const nMap = Object.fromEntries(neighborhoods.map((n) => [n.name, n]));
    const displayRows = rows.map((r) => nMap[r.name] || r);

    return {
      labels: displayRows.map((n) => n.name),
      datasets: keys.map((k) => ({
        label: k.label,
        data: displayRows.map((n) => Number(n?.scores?.[k.key]) || 0),
        borderColor: k.color,
        backgroundColor: k.color + "22",
        tension: 0.25,
        pointRadius: 3,
      })),
    };
  }, [riskRows, neighborhoods, filterLine]);

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading dashboard data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Crime Risk Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">
          Dammam · 2025 · Comparing ML predictions vs formula-based risk scores
        </p>
      </div>

      {/* KPI Cards */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-0">
          {[
            { label: "Neighbourhoods",  value: kpis.total,                          color: "text-primary"      },
            { label: "Average Risk (R)", value: kpis.avgR.toFixed(2),               color: "text-orange-500"   },
            { label: "Avg ML Confidence",value: (kpis.avgConf * 100).toFixed(1) + "%", color: "text-emerald-600" },
          ].map((kpi) => (
            <div key={kpi.label}>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {kpi.label}
              </div>
              <div className={`text-3xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>
        <NeighbourhoodChecklist
          allNames={allNames}
          selected={filterKpi}
          onChange={setFilterKpi}
          label="Filter KPIs:"
        />
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ML Labels */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-700 mb-1">ML Predicted Labels</h3>
          <p className="text-xs text-gray-400 mb-3">
            Random Forest classifier output distribution
          </p>
          <div className="w-full h-64">
            <Pie
              data={mlLabelPie}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "right" } },
              }}
            />
          </div>
          <NeighbourhoodChecklist
            allNames={allNames}
            selected={filterPie1}
            onChange={setFilterPie1}
          />
        </div>

        {/* Formula Labels */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-700 mb-1">Formula Labels (Quantile)</h3>
          <p className="text-xs text-gray-400 mb-3">
            R1/R2 formula-based classification (for comparison)
          </p>
          <div className="w-full h-64">
            <Pie
              data={formulaLabelPie}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "right" } },
              }}
            />
          </div>
          <NeighbourhoodChecklist
            allNames={allNames}
            selected={filterPie2}
            onChange={setFilterPie2}
          />
        </div>
      </div>

      {/* Top Risk Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-1">
          Top 10 Neighbourhoods by Risk (R)
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          Bars coloured by ML predicted label. R = average of crime-weighted score (R1)
          and demographic score (R2).
        </p>
        <div className="w-full h-72">
          <Bar
            data={topRiskBar}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { maxRotation: 55, minRotation: 30, font: { size: 11 } } },
                y: { beginAtZero: true },
              },
            }}
          />
        </div>
        <NeighbourhoodChecklist
          allNames={allNames}
          selected={filterBar}
          onChange={setFilterBar}
        />
      </div>

      {/* Demographics Line */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-700 mb-1">Demographic Score Profiles</h3>
        <p className="text-xs text-gray-400 mb-3">
          Each line represents a demographic factor scored 1 / 3 / 5 (Low / Medium / High).
        </p>
        <div className="w-full h-80">
          <Line
            data={demoLine}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "bottom",
                  labels: { boxWidth: 12, font: { size: 11 } },
                },
              },
              scales: {
                y: { beginAtZero: true, max: 6, ticks: { stepSize: 1 } },
                x: { ticks: { maxRotation: 50, font: { size: 11 } } },
              },
            }}
          />
        </div>
        <NeighbourhoodChecklist
          allNames={allNames}
          selected={filterLine}
          onChange={setFilterLine}
        />
      </div>
    </div>
  );
};

export default Dashboard;