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

const Dashboard = () => {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [riskRows, setRiskRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load neighborhoods + risk in parallel
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

        const nData = await nRes.json();
        const rData = await rRes.json();

        setNeighborhoods(Array.isArray(nData) ? nData : []);
        setRiskRows(Array.isArray(rData) ? rData : []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const total = riskRows.length || neighborhoods.length || 0;

    const avgR =
      riskRows.length > 0
        ? riskRows.reduce((s, x) => s + (Number(x.r) || 0), 0) / riskRows.length
        : 0;

    const avgConfidence =
      riskRows.length > 0
        ? riskRows
            .filter((x) => x.confidence != null)
            .reduce((s, x) => s + (Number(x.confidence) || 0), 0) /
          Math.max(1, riskRows.filter((x) => x.confidence != null).length)
        : 0;

    return {
      totalNeighborhoods: total,
      avgR: avgR,
      avgConfidence: avgConfidence,
    };
  }, [riskRows, neighborhoods]);

  // ---------- Label distributions ----------
  const mlLabelPie = useMemo(() => {
    const counts = riskRows.reduce((acc, r) => {
      const k = r.predicted_label || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

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
  }, [riskRows]);

  const formulaLabelPie = useMemo(() => {
    const counts = riskRows.reduce((acc, r) => {
      const k = r.formula_label || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

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
  }, [riskRows]);

  // ---------- Top risk bar chart ----------
  const topRiskBar = useMemo(() => {
    const sorted = [...riskRows].sort((a, b) => (Number(b.r) || 0) - (Number(a.r) || 0)).slice(0, 10);
    const labels = sorted.map((x) => x.name);
    const values = sorted.map((x) => Number(x.r) || 0);

    return {
      labels,
      datasets: [
        {
          label: "Risk Score (R)",
          data: values,
          backgroundColor: "#3c81f6",
          borderColor: "#3c81f6",
          borderWidth: 1,
        },
      ],
    };
  }, [riskRows]);

  // ---------- Average demographic scores ----------
  const demoAvgLine = useMemo(() => {
    if (!neighborhoods.length) {
      return { labels: [], datasets: [] };
    }

    const keys = [
      { key: "population_density", label: "Pop Density" },
      { key: "divorce_ratio", label: "Divorce" },
      { key: "unmarried_over_30", label: "Unmarried >30" },
      { key: "university_education", label: "University Edu" },
      { key: "unemployment", label: "Unemployment" },
      { key: "income", label: "Income" },
      { key: "vitality", label: "Vitality" },
    ];

    const labels = neighborhoods.map((n) => n.name);

    const datasets = keys.map((k) => ({
      label: k.label,
      data: neighborhoods.map((n) => Number(n?.scores?.[k.key]) || 0),
      tension: 0.25,
    }));

    return { labels, datasets };
  }, [neighborhoods]);

  if (loading) {
    return <div className="p-6 text-gray-600">Loading dashboard data...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Failed to load dashboard data: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-2xl font-semibold mb-2">Crime Risk Dashboard (Dammam — 2025)</h2>
      <p className="text-sm text-gray-600">
        Dashboard summarizes risk computed from R1/R2 and the ML classifier prediction.
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Neighborhoods</div>
          <div className="text-3xl font-semibold">{kpis.totalNeighborhoods}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Average Risk (R)</div>
          <div className="text-3xl font-semibold">{kpis.avgR.toFixed(2)}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Avg ML Confidence</div>
          <div className="text-3xl font-semibold">
            {(kpis.avgConfidence * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Label distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">ML Predicted Labels</h3>
          <div className="w-full h-80">
            <Pie data={mlLabelPie} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-2">Formula Labels (Quantiles)</h3>
          <div className="w-full h-80">
            <Pie data={formulaLabelPie} />
          </div>
        </div>
      </div>

      {/* Top 10 risk */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-medium mb-2">Top 10 Neighborhoods by Risk (R)</h3>
        <div className="w-full h-80">
          <Bar
            data={topRiskBar}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: true } },
              scales: {
                x: { ticks: { maxRotation: 60, minRotation: 45 } },
                y: { beginAtZero: true },
              },
            }}
          />
        </div>
      </div>

      {/* Demographic scores */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-medium mb-2">Demographic Score Profiles (1/3/5)</h3>
        <p className="text-xs text-gray-500 mb-3">
          Each line shows the 1/3/5 demographic scoring for neighborhoods.
        </p>
        <div className="w-full h-96">
          <Line
            data={demoAvgLine}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "bottom" } },
              scales: {
                y: { beginAtZero: true, suggestedMax: 5 },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;