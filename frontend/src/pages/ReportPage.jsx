import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  ArcElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import NeighbourhoodChecklist from "../components/NeighbourhoodChecklist";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  ArcElement, PointElement, Tooltip, Legend
);

const API = import.meta.env.VITE_API_BASE_URL;

const SEASONS = [
  { key: "ramadan", label: "Ramadan",       months: "Feb – Mar"       },
  { key: "hajj",    label: "Hajj",          months: "May – Jun"       },
  { key: "summer",  label: "Summer",        months: "Jun – Aug"       },
  { key: "school",  label: "School Season", months: "Sep – Jan + Apr" },
];

const LABEL_COLORS = {
  safe:           "#22c55e",
  moderate:       "#eab308",
  dangerous:      "#f97316",
  very_dangerous: "#ef4444",
  unknown:        "#94a3b8",
};

// ─── helpers ──────────────────────────────────────────────────────────────────
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

async function downloadPDFFile(url, filename) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
  const blob    = await res.blob();
  const fileUrl = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href = fileUrl; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(fileUrl);
}

// Apply checklist filter: [] = all
const applyFilter = (rows, selected) =>
  selected.length === 0 ? rows : rows.filter((r) => selected.includes(r.name));

// ─── Main component ────────────────────────────────────────────────────────────
const ReportPage = () => {
  const [year,          setYear]          = useState(2025);
  const [seasonKey,     setSeasonKey]     = useState("ramadan");
  const [mode,          setMode]          = useState("ml");
  const [seasonPayload, setSeasonPayload] = useState(null);
  const [loading,       setLoading]       = useState(false);

  // Global neighbourhood checklist (applied to all charts + table + PDF + CSV)
  const [selectedGlobal, setSelectedGlobal] = useState([]);

  // Per-chart checklists
  const [filterPie,  setFilterPie]  = useState([]);
  const [filterBar,  setFilterBar]  = useState([]);
  const [filterLine, setFilterLine] = useState([]);

  const season = useMemo(
    () => SEASONS.find((s) => s.key === seasonKey) || SEASONS[0],
    [seasonKey]
  );

  const generateReport = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/reports/season?year=${year}&season=${seasonKey}&mode=${mode}`);
      if (!res.ok) throw new Error(`Report API failed (${res.status})`);
      const data = await res.json();
      setSeasonPayload(data);
      setSelectedGlobal([]);
      setFilterPie([]); setFilterBar([]); setFilterLine([]);
      toast.success("Report generated");
    } catch (err) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { generateReport(); }, []); // eslint-disable-line

  const allRows  = useMemo(() => (Array.isArray(seasonPayload?.rows) ? seasonPayload.rows : []), [seasonPayload]);
  const allNames = useMemo(() => allRows.map((r) => r.name), [allRows]);

  // Global filter applied first
  const globalRows = useMemo(() => applyFilter(allRows, selectedGlobal), [allRows, selectedGlobal]);

  // ─── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const rows  = globalRows;
    const total = rows.length;
    const avgR  = total > 0 ? rows.reduce((s, x) => s + (Number(x.r) || 0), 0) / total : 0;
    const top   = [...rows].sort((a, b) => (Number(b.r) || 0) - (Number(a.r) || 0))[0];
    return {
      total,
      avgR,
      topName: top?.name || "—",
      topR:    top ? Number(top.r).toFixed(2) : "—",
    };
  }, [globalRows]);

  // ─── Pie ─────────────────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const rows   = applyFilter(globalRows, filterPie);
    const counts = {};
    rows.forEach((r) => {
      const k = (mode === "ml" ? r.predicted_label : r.formula_label) || "unknown";
      counts[k] = (counts[k] || 0) + 1;
    });
    const labels = Object.keys(counts);
    return {
      labels,
      datasets: [{ data: labels.map((l) => counts[l]), backgroundColor: labels.map((l) => LABEL_COLORS[l] || "#94a3b8") }],
    };
  }, [globalRows, filterPie, mode]);

  // ─── Bar ─────────────────────────────────────────────────────────────────
  const barData = useMemo(() => {
    const rows = applyFilter(globalRows, filterBar)
      .sort((a, b) => (Number(b.r) || 0) - (Number(a.r) || 0))
      .slice(0, 12);
    return {
      labels: rows.map((x) => x.name),
      datasets: [{
        label: "Risk Score (R)",
        data:  rows.map((x) => Number(x.r) || 0),
        backgroundColor: rows.map((x) => LABEL_COLORS[(mode === "ml" ? x.predicted_label : x.formula_label)] || "#3c81f6"),
        borderRadius: 6,
      }],
    };
  }, [globalRows, filterBar, mode]);

  // ─── Line ────────────────────────────────────────────────────────────────
  const lineData = useMemo(() => {
    const rows = applyFilter(globalRows, filterLine)
      .sort((a, b) => (Number(a.r) || 0) - (Number(b.r) || 0));
    return {
      labels: rows.map((x) => x.name),
      datasets: [
        {
          label: "Risk (R)", data: rows.map((x) => Number(x.r) || 0),
          borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)", tension: 0.25, pointRadius: 3,
        },
        {
          label: "Unemployment Score", data: rows.map((x) => Number(x?.unemployment_score) || 0),
          borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.1)", tension: 0.25, pointRadius: 3,
        },
        {
          label: "Income Score", data: rows.map((x) => Number(x?.income_score) || 0),
          borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", tension: 0.25, pointRadius: 3,
        },
      ],
    };
  }, [globalRows, filterLine]);

  // ─── Table rows (matches exactly what PDF will show) ─────────────────────
  const tableRows = useMemo(() =>
    globalRows
      .sort((a, b) => (Number(b.r) || 0) - (Number(a.r) || 0))
      .map((r) => ({
        neighborhood:       r.name,
        r1:                 Number(r.r1 || 0).toFixed(2),
        r2:                 Number(r.r2 || 0).toFixed(2),
        R:                  Number(r.r  || 0).toFixed(2),
        formula_label:      r.formula_label   || "—",
        ml_label:           r.predicted_label || "—",
        confidence:         r.confidence != null ? (Number(r.confidence) * 100).toFixed(1) + "%" : "—",
        unemployment_score: r?.unemployment_score ?? "—",
        income_score:       r?.income_score        ?? "—",
        vitality_score:     r?.vitality_score      ?? "—",
      })),
  [globalRows]);

  const downloadPDF = async () => {
    try {
      // Pass the globally-selected neighbourhoods to the backend so the PDF matches
      const neighbourhoodParam =
        selectedGlobal.length > 0
          ? `&neighbourhoods=${encodeURIComponent(selectedGlobal.join(","))}`
          : "";
      await downloadPDFFile(
        `${API}/api/reports/export?year=${year}&season=${seasonKey}&mode=${mode}${neighbourhoodParam}`,
        `seasonal_report_${year}_${seasonKey}_${mode}.pdf`
      );
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e.message || "PDF download failed");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Seasonal Risk Report</h2>
        <p className="text-sm text-gray-500 mt-1">
          Compare ML vs formula risk classifications per season
        </p>
      </div>

      {/* Controls card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Year */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Season */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Season
            </label>
            <select
              value={seasonKey}
              onChange={(e) => setSeasonKey(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {SEASONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label} ({s.months})
                </option>
              ))}
            </select>
          </div>

          {/* Mode */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="ml">ML (Random Forest)</option>
              <option value="formula">Formula (Quantile)</option>
            </select>
          </div>

          {/* Global neighbourhood checklist */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Neighbourhoods
            </label>
            <NeighbourhoodChecklist
              allNames={allNames}
              selected={selectedGlobal}
              onChange={setSelectedGlobal}
              label=""
              className="border-none mt-0 pt-0"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={generateReport}
            disabled={loading}
            className="px-5 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "Generating…" : "Generate Report"}
          </button>
          <button
            type="button"
            onClick={() => downloadCSV(`seasonal_${year}_${seasonKey}_${mode}.csv`, tableRows)}
            className="px-5 py-2 rounded-full border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={downloadPDF}
            className="px-5 py-2 rounded-full border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Neighbourhoods",  value: kpis.total,                    color: "text-primary"    },
          { label: "Average Risk (R)",value: Number(kpis.avgR).toFixed(2),  color: "text-orange-500" },
          { label: "Highest Risk",    value: kpis.topName, sub: `R: ${kpis.topR}`, color: "text-red-500" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">{k.label}</div>
            <div className={`text-2xl font-bold mt-1 truncate ${k.color}`}>{k.value}</div>
            {k.sub && <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>

      {allRows.length > 0 && (
        <>
          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-700 mb-1">Label Distribution</h3>
              <p className="text-xs text-gray-400 mb-3">
                {mode === "ml" ? "ML predicted" : "Formula quantile"} labels for selected data
              </p>
              <div className="w-full h-64">
                <Pie
                  data={pieData}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } } }}
                />
              </div>
              <NeighbourhoodChecklist
                allNames={allNames}
                selected={filterPie}
                onChange={setFilterPie}
              />
            </div>

            {/* Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-700 mb-1">Top Risk Neighbourhoods</h3>
              <p className="text-xs text-gray-400 mb-3">
                Sorted by R score (combined crime + demographic)
              </p>
              <div className="w-full h-64">
                <Bar
                  data={barData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: { maxRotation: 55, font: { size: 10 } } },
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
          </div>

          {/* Line */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-1">
              Risk vs Demographics (sorted by R)
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Compares R against key demographic scores to identify correlation patterns
            </p>
            <div className="w-full h-80">
              <Line
                data={lineData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
            <NeighbourhoodChecklist
              allNames={allNames}
              selected={filterLine}
              onChange={setFilterLine}
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 overflow-x-auto">
            <div className="mb-3">
              <h3 className="font-semibold text-gray-700">Detailed Report Table</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {tableRows.length} neighbourhood(s) shown · sorted by R descending
              </p>
            </div>
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    "Neighbourhood","R1","R2","R",
                    "Formula Label","ML Label","Confidence",
                    "Unemp Score","Income Score","Vitality Score",
                  ].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => (
                  <tr
                    key={r.neighborhood}
                    className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className="px-3 py-2 font-medium text-gray-800">{r.neighborhood}</td>
                    <td className="px-3 py-2 text-gray-600">{r.r1}</td>
                    <td className="px-3 py-2 text-gray-600">{r.r2}</td>
                    <td className="px-3 py-2 font-bold text-orange-600">{r.R}</td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                        style={{ backgroundColor: LABEL_COLORS[r.formula_label] || "#94a3b8" }}
                      >
                        {r.formula_label}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                        style={{ backgroundColor: LABEL_COLORS[r.ml_label] || "#94a3b8" }}
                      >
                        {r.ml_label}
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
        </>
      )}
    </div>
  );
};

export default ReportPage;