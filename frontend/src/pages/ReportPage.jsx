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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  ArcElement,
  PointElement,
  Tooltip,
  Legend
);

const API = import.meta.env.VITE_API_BASE_URL;

const SEASONS = [
  { key: "ramadan", label: "Ramadan", windows: [{ start: "02-01", end: "03-31" }] },
  { key: "hajj", label: "Hajj", windows: [{ start: "05-15", end: "06-15" }] },
  { key: "summer", label: "Summer", windows: [{ start: "06-15", end: "08-31" }] },
  {
    key: "school",
    label: "School Season",
    windows: [
      { start: "09-01", end: "01-31" },
      { start: "04-01", end: "04-30" },
    ],
  },
];

function downloadCSV(filename, rows) {
  if (!rows?.length) return;

  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

async function downloadFileFromEndpoint(url, filename, mimeHint) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const mime = mimeHint || blob.type || "application/octet-stream";
  const finalBlob = blob.type ? blob : new Blob([blob], { type: mime });

  const fileUrl = URL.createObjectURL(finalBlob);
  const a = document.createElement("a");
  a.href = fileUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(fileUrl);
}

const ReportPage = () => {
  const [year, setYear] = useState(2025);
  const [seasonKey, setSeasonKey] = useState("ramadan");
  const [mode, setMode] = useState("ml");
  const [seasonPayload, setSeasonPayload] = useState(null);
  const [loading, setLoading] = useState(false);

  const season = useMemo(
    () => SEASONS.find((s) => s.key === seasonKey) || SEASONS[0],
    [seasonKey]
  );

  const generateReport = async () => {
    setLoading(true);
    try {
      const url = `${API}/api/reports/season?year=${year}&season=${seasonKey}&mode=${mode}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed /api/reports/season (${res.status})`);
      const data = await res.json();
      setSeasonPayload(data);
      toast.success("Season report generated");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return Array.isArray(seasonPayload?.rows) ? seasonPayload.rows : [];
  }, [seasonPayload]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const avgR =
      seasonPayload?.avg_r != null
        ? Number(seasonPayload.avg_r || 0)
        : total > 0
        ? rows.reduce((s, x) => s + (Number(x.r) || 0), 0) / total
        : 0;

    const labelCounts = seasonPayload?.label_counts || {};

    const top =
      (Array.isArray(seasonPayload?.top_risk) && seasonPayload.top_risk[0])
        ? seasonPayload.top_risk[0]
        : [...rows].sort((a, b) => (Number(b.r) || 0) - (Number(a.r) || 0))[0];

    return {
      total,
      avgR,
      labelCounts,
      topName: top?.name || "-",
      topR: top?.r != null ? Number(top.r).toFixed(2) : "-",
    };
  }, [rows, seasonPayload]);

  const mlLabelPie = useMemo(() => {
    const counts = kpis.labelCounts || {};
    const labels = Object.keys(counts);
    const values = labels.map((l) => counts[l]);

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ["#22c55e", "#eab308", "#f97316", "#ef4444", "#94a3b8"],
        },
      ],
    };
  }, [kpis]);

  const topRiskBar = useMemo(() => {
    const top = [...rows]
      .sort((a, b) => (Number(b.r) || 0) - (Number(a.r) || 0))
      .slice(0, 12);

    return {
      labels: top.map((x) => x.name),
      datasets: [
        {
          label: "Risk Score (R)",
          data: top.map((x) => Number(x.r) || 0),
          backgroundColor: "#3c81f6",
        },
      ],
    };
  }, [rows]);

  const riskVsDemoLine = useMemo(() => {
    const sorted = [...rows].sort((a, b) => (Number(a.r) || 0) - (Number(b.r) || 0));
    return {
      labels: sorted.map((x) => x.name),
      datasets: [
        {
          label: "Risk (R)",
          data: sorted.map((x) => Number(x.r) || 0),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.15)",
          tension: 0.25,
        },
        {
          label: "Unemployment Score",
          data: sorted.map((x) => Number(x?.unemployment_score) || 0),
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.10)",
          tension: 0.25,
        },
        {
          label: "Income Score",
          data: sorted.map((x) => Number(x?.income_score) || 0),
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245,158,11,0.10)",
          tension: 0.25,
        },
      ],
    };
  }, [rows]);

  const tableRows = useMemo(() => {
    return rows.map((r) => ({
      neighborhood: r.name,
      r1: Number(r.r1 || 0).toFixed(2),
      r2: Number(r.r2 || 0).toFixed(2),
      R: Number(r.r || 0).toFixed(2),
      formula_label: r.formula_label || "-",
      ml_label: r.predicted_label || "-",
      confidence: r.confidence != null ? (Number(r.confidence) * 100).toFixed(1) + "%" : "-",
      unemployment_score: r?.unemployment_score ?? "-",
      income_score: r?.income_score ?? "-",
      vitality_score: r?.vitality_score ?? "-",
    }));
  }, [rows]);

  const downloadPDF = async () => {
    try {
      const url = `${API}/api/reports/export?year=${year}&season=${seasonKey}&mode=${mode}`;
      const filename = `seasonal_report_${year}_${seasonKey}_${mode}.pdf`;
      await downloadFileFromEndpoint(url, filename, "application/pdf");
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error(e.message || "PDF download failed");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Seasonal Risk Report</h2>
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:w-56">
          <label className="block text-sm font-medium mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>

        <div className="flex-1 w-full">
          <label className="block text-sm font-medium mb-1">Season</label>
          <select
            value={seasonKey}
            onChange={(e) => setSeasonKey(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            {SEASONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>

          <p className="text-xs text-gray-500 mt-1">
            Windows: {season.windows.map((w) => `${w.start} → ${w.end}`).join("  |  ")}
          </p>
        </div>

        <div className="w-full md:w-56">
          <label className="block text-sm font-medium mb-1">Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="ml">ML</option>
            <option value="formula">Formula</option>
          </select>
        </div>

        <div className="flex gap-2 items-end">
          <button
            type="button"
            onClick={generateReport}
            className="px-4 py-2 rounded-full bg-primary text-white hover:opacity-90"
          >
            {loading ? "Generating..." : "Generate"}
          </button>

          <button
            type="button"
            onClick={() => downloadCSV(`seasonal_report_${year}_${seasonKey}_${mode}.csv`, tableRows)}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Download CSV
          </button>

          <button
            type="button"
            onClick={downloadPDF}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Neighborhoods</div>
          <div className="text-3xl font-semibold">{kpis.total}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Average Risk (R)</div>
          <div className="text-3xl font-semibold">{Number(kpis.avgR || 0).toFixed(2)}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Highest Risk</div>
          <div className="text-lg font-semibold">{kpis.topName}</div>
          <div className="text-sm text-gray-600">R: {kpis.topR}</div>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
              <h3 className="font-medium mb-2">Label Distribution</h3>
              <div className="w-full h-80">
                <Pie
                  data={mlLabelPie}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "left" } },
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-medium mb-2">Top Risk Neighborhoods</h3>
              <div className="w-full h-80">
                <Bar data={topRiskBar} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-2">Risk vs Demographics (sorted by Risk)</h3>
            <div className="w-full h-96">
              <Line
                data={riskVsDemoLine}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "bottom" } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
            <h3 className="font-medium mb-2">Season Report Table</h3>
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">Neighborhood</th>
                  <th className="border px-2 py-1">R1</th>
                  <th className="border px-2 py-1">R2</th>
                  <th className="border px-2 py-1">R</th>
                  <th className="border px-2 py-1">Formula Label</th>
                  <th className="border px-2 py-1">ML Label</th>
                  <th className="border px-2 py-1">Confidence</th>
                  <th className="border px-2 py-1">Unemp Score</th>
                  <th className="border px-2 py-1">Income Score</th>
                  <th className="border px-2 py-1">Vitality Score</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={r.neighborhood} className="border-b">
                    <td className="border px-2 py-1">{r.neighborhood}</td>
                    <td className="border px-2 py-1">{r.r1}</td>
                    <td className="border px-2 py-1">{r.r2}</td>
                    <td className="border px-2 py-1 font-semibold">{r.R}</td>
                    <td className="border px-2 py-1">{r.formula_label}</td>
                    <td className="border px-2 py-1">{r.ml_label}</td>
                    <td className="border px-2 py-1">{r.confidence}</td>
                    <td className="border px-2 py-1">{r.unemployment_score}</td>
                    <td className="border px-2 py-1">{r.income_score}</td>
                    <td className="border px-2 py-1">{r.vitality_score}</td>
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