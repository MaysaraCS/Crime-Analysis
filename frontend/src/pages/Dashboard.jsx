import React, { useEffect, useMemo, useState } from 'react';
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
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

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
const Dashboard = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/neighbourhoods`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Failed to load data (${res.status})`);
        }
        const data = await res.json();
        setRows(data);
      } catch (err) {
        console.error('Failed to load neighbourhoods', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const incomePieData = useMemo(() => {
    const totals = rows.reduce((acc, n) => {
      if (!n.income_level) return acc;
      const key = n.income_level;
      acc[key] = (acc[key] || 0) + (n.population || 0);
      return acc;
    }, {});

    const labels = Object.keys(totals);
    const values = labels.map((l) => totals[l]);

    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#1d4ed8', '#f97316', '#22c55e'],
        },
      ],
    };
  }, [rows]);

    const populationBarData = useMemo(() => {
    const labels = rows.map((r) => r.name);
    const values = rows.map((r) => r.population || 0);

    // Basic color palette for bar segments
    const barColors = [
      '#4f46e5', // blue / purple
      '#f59e0b', // yellow / amber
      '#f97373', // light red
      '#22c55e', // green
      '#0ea5e9', // light blue
      '#a855f7', // purple
    ];

    return {
      labels,
      datasets: [
        {
          label: 'Population (thousands)',
          data: values,
          backgroundColor: labels.map((_, idx) => barColors[idx % barColors.length]),
          borderColor: labels.map((_, idx) => barColors[idx % barColors.length]),
          borderWidth: 1,
        },
      ],
    };
  }, [rows]);

  const unemploymentLineData = useMemo(() => {
    const labels = rows.map((r) => r.name);
    const values = rows.map((r) => r.unemployment_percent || 0);

    return {
      labels,
      datasets: [
        {
          label: 'Unemployment %',
          data: values,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.2)',
          tension: 0.3,
        },
      ],
    };
  }, [rows]);

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
      <h2 className="text-2xl font-semibold mb-4">Neighbourhood Overview</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <h3 className="font-medium mb-2">Population by Income Level</h3>
          <div className="w-full h-80">
            <Pie data={incomePieData} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 col-span-2">
          <h3 className="font-medium mb-2">Population per Neighbourhood</h3>
          <div className="w-full h-72">
            <Bar
              data={populationBarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                },
                scales: {
                  x: {
                    ticks: { maxRotation: 60, minRotation: 45 },
                  },
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-medium mb-2">Unemployment Rate by Neighbourhood</h3>
        <div className="w-full h-80">
          <Line
            data={unemploymentLineData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (v) => `${v}%`,
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard
