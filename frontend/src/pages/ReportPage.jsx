import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import toast from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, ArcElement, Tooltip, Legend);

const ReportPage = () => {
  const { user, token } = useAuth();
  const role = user?.role;
  const allowedRoles = ['administrator', 'ministry_of_interior'];

  const [reportType, setReportType] = useState('crime');
  const [dataRows, setDataRows] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/crime" replace />;
  }

  const loadReport = async () => {
    setLoading(true);
    try {
      const endpoint = reportType === 'crime' ? '/api/reports/crime' : '/api/reports/general';
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to load report');
      }
      setDataRows(data);
    } catch (err) {
      console.error('Failed to load report', err);
      toast.error(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (mode) => {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/api/reports/export?type=${reportType}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Failed to export report');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    if (mode === 'view') {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('Export failed', err);
    toast.error(err.message || 'Failed to export report');
  }
};

  const labels = useMemo(() => dataRows.map((r) => r.neighbourhood_name), [dataRows]);

  const barData = useMemo(() => {
    if (reportType === 'crime') {
      return {
        labels,
        datasets: [
          {
            label: 'Population (thousands)',
            data: dataRows.map((r) => Number(r.population) || 0),
            backgroundColor: '#4f46e5',
          },
        ],
      };
    }
    return {
      labels,
      datasets: [
        {
          label: 'Avg Crime Weight',
          data: dataRows.map((r) => Number(r.avg_crime_weight) || 0),
          backgroundColor: '#f97316',
        },
      ],
    };
  }, [dataRows, labels, reportType]);

  const pieData = useMemo(() => {
    const counts = dataRows.reduce((acc, r) => {
      const key = r.main_crime_category || 'None';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const pLabels = Object.keys(counts);
    const values = pLabels.map((k) => counts[k]);
    return {
      labels: pLabels,
      datasets: [
        {
          data: values,
          backgroundColor: ['#1d4ed8', '#f97316', '#22c55e', '#ef4444', '#0ea5e9', '#a855f7'],
        },
      ],
    };
  }, [dataRows]);

  const lineData = useMemo(() => {
    if (reportType === 'crime') {
      return {
        labels,
        datasets: [
          {
            label: 'Unemployment %',
            data: dataRows.map((r) => Number(r.unemployment_percent) || 0),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.2)',
            tension: 0.3,
          },
        ],
      };
    }
    return {
      labels,
      datasets: [
        {
          label: 'Avg Crime Weight',
          data: dataRows.map((r) => Number(r.avg_crime_weight) || 0),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.2)',
          tension: 0.3,
        },
      ],
    };
  }, [dataRows, labels, reportType]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Generate Report</h2>
      </div>

      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="crime">Crime Report</option>
            <option value="general">General Analysis Report</option>
          </select>
        </div>
        <div className="flex gap-2 items-end">
          <button
            type="button"
            onClick={loadReport}
            className="px-4 py-2 rounded-full bg-primary text-white hover:opacity-90"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button
            type="button"
            onClick={() => handleExport('download')}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Download Report
          </button>
          <button
            type="button"
            onClick={() => handleExport('view')}
            className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            View Report
          </button>
        </div>
      </div>

      {dataRows.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
              <h3 className="font-medium mb-2">Crime Categories Distribution</h3>
              <div className="w-full h-64">
                <Pie data={pieData} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 col-span-2">
              <h3 className="font-medium mb-2">
                {reportType === 'crime' ? 'Population per Neighbourhood' : 'Avg Crime Weight per Neighbourhood'}
              </h3>
              <div className="w-full h-72">
                <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium mb-2">
              {reportType === 'crime' ? 'Unemployment vs Neighbourhood' : 'Avg Crime Weight Trend'}
            </h3>
            <div className="w-full h-80">
              <Line data={lineData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
            <h3 className="font-medium mb-2">Report Table</h3>
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">Neighbourhood</th>
                  <th className="border px-2 py-1">Population</th>
                  <th className="border px-2 py-1">Income Level</th>
                  <th className="border px-2 py-1">Unemployment %</th>
                  <th className="border px-2 py-1">Main Crime Category</th>
                  {reportType === 'crime' && (
                    <>
                      <th className="border px-2 py-1">Univ. Edu %</th>
                      <th className="border px-2 py-1">Unmarried 30+ %</th>
                    </>
                  )}
                  {reportType === 'general' && (
                    <th className="border px-2 py-1">Avg Crime Weight</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((r) => (
                  <tr key={r.neighbourhood_name} className="border-b">
                    <td className="border px-2 py-1">{r.neighbourhood_name}</td>
                    <td className="border px-2 py-1">{Number(r.population).toFixed(3)}</td>
                    <td className="border px-2 py-1">{r.income_level}</td>
                    <td className="border px-2 py-1">{Number(r.unemployment_percent || 0).toFixed(1)}</td>
                    <td className="border px-2 py-1">{r.main_crime_category || 'N/A'}</td>
                    {reportType === 'crime' && (
                      <>
                        <td className="border px-2 py-1">{Number(r.university_education_percent || 0).toFixed(1)}</td>
                        <td className="border px-2 py-1">{Number(r.unmarried_over_30_percent || 0).toFixed(1)}</td>
                      </>
                    )}
                    {reportType === 'general' && (
                      <td className="border px-2 py-1">{Number(r.avg_crime_weight || 0).toFixed(2)}</td>
                    )}
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
