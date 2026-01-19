import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import toast from 'react-hot-toast';
import UpdateFormPage from '../components/UpdateFormPage.jsx';

const UpdatePage = () => {
  const { user, token } = useAuth();
  const role = user?.role;

  const allowedRoles = ['general_statistic', 'hr', 'civil_status', 'ministry_of_justice'];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState(null);

  const loadRows = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/crime-forms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRows(data);
    } catch (err) {
      console.error('Failed to load crime forms', err);
      toast.error('Failed to load crime data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadRows();
  }, [token]);

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/crime" replace />;
  }

  const handleUpdated = () => {
    // re-fetch after an update
    setLoading(true);
    loadRows();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Update Crime Records</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">ID</th>
              <th className="border px-2 py-1">Neighbourhood</th>
              <th className="border px-2 py-1">Main Category</th>
              <th className="border px-2 py-1">Weight</th>
              <th className="border px-2 py-1">Date</th>
              <th className="border px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="border px-2 py-1">{r.id}</td>
                <td className="border px-2 py-1">{r.neighbourhood_name}</td>
                <td className="border px-2 py-1">{r.main_category}</td>
                <td className="border px-2 py-1">{r.crime_weight}</td>
                <td className="border px-2 py-1">{r.date}</td>
                <td className="border px-2 py-1">
                  <button
                    className="text-blue-600 underline"
                    type="button"
                    onClick={() => setEditingRecord(r)}
                  >
                    Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <UpdateFormPage
        isOpen={!!editingRecord}
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
        onUpdated={handleUpdated}
      />
    </div>
  );
};

export default UpdatePage;