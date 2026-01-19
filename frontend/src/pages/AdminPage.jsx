import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import toast from 'react-hot-toast';
import UpdateFormPage from '../components/UpdateFormPage.jsx';
import AdminInsertPage from '../components/AdminInsertPage.jsx';

const AdminPage = () => {
  const { user, token } = useAuth();
  const role = user?.role;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showInsertModal, setShowInsertModal] = useState(false);

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

  if (role !== 'administrator') {
    return <Navigate to="/crime" replace />;
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/crime-form/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to delete');
      }
      toast.success('Record deleted successfully');
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleUpdated = () => {
    setLoading(true);
    loadRows();
  };

  const handleInserted = () => {
    setLoading(true);
    loadRows();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Admin - Crime Records</h2>
        <button
          type="button"
          onClick={() => setShowInsertModal(true)}
          className="px-4 py-2 rounded-full bg-primary text-white hover:opacity-90"
        >
          Insert Data
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="w-full text-sm border-collapse">
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
                <td className="border px-2 py-1 space-x-2">
                  <button
                    type="button"
                    className="text-blue-600 underline"
                    onClick={() => setEditingRecord(r)}
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    className="text-red-600 underline"
                    onClick={() => handleDelete(r.id)}
                  >
                    Delete
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

      <AdminInsertPage
        isOpen={showInsertModal}
        onClose={() => setShowInsertModal(false)}
        onInserted={handleInserted}
      />
    </div>
  );
};

export default AdminPage;