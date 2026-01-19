import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import toast from 'react-hot-toast';

const UpdatePage = () => {
  const { user, token } = useAuth();
  const role = user?.role;

  const allowedRoles = ['general_statistic', 'hr', 'civil_status', 'ministry_of_justice'];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // record being edited
  const [form, setForm] = useState({
    main_category: '',
    subcategories: [],
    neighbourhood_name: '',
    date: '',
    offender_income_level: '',
    climate: '',
    time_of_year: '',
  });

  useEffect(() => {
    const load = async () => {
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
    if (token) load();
  }, [token]);

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/crime" replace />;
  }

  const startEdit = (record) => {
    setEditing(record);
    setForm({
      main_category: record.main_category,
      subcategories: record.subcategories ? record.subcategories.split(', ').filter(Boolean) : [],
      neighbourhood_name: record.neighbourhood_name,
      date: record.date,
      offender_income_level: record.offender_income_level,
      climate: record.climate,
      time_of_year: record.time_of_year,
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editing) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/crime-form/${editing.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update');
      }
      toast.success(data.message || 'Data updated successfully');
      // refresh list
      setRows((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...form } : r)));
      setEditing(null);
    } catch (err) {
      console.error('Update failed', err);
      toast.error(err.message || 'Failed to update');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Update Crime Records</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
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
                      onClick={() => startEdit(r)}
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {editing && (
            <div className="mt-6 border border-gray-200 rounded p-4">
              <h3 className="font-semibold mb-2">Editing record #{editing.id}</h3>
              <form onSubmit={handleUpdate} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Main Category</label>
                    <input
                      name="main_category"
                      value={form.main_category}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Neighbourhood</label>
                    <input
                      name="neighbourhood_name"
                      value={form.neighbourhood_name}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input
                      type="date"
                      name="date"
                      value={form.date}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Income Level</label>
                    <input
                      name="offender_income_level"
                      value={form.offender_income_level}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Climate</label>
                    <input
                      name="climate"
                      value={form.climate}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Time of Year</label>
                    <input
                      name="time_of_year"
                      value={form.time_of_year}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded px-2 py-1"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="mt-2 px-4 py-2 rounded bg-primary text-white hover:opacity-90"
                >
                  Update
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UpdatePage;
