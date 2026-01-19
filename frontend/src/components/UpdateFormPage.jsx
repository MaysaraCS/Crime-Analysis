import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import toast from 'react-hot-toast';

const incomeOptions = [
  { value: 'low', label: 'Low' },
  { value: 'middle', label: 'Middle' },
  { value: 'high', label: 'High' },
];

const climateOptions = [
  { value: 'hot', label: 'Hot' },
  { value: 'cold', label: 'Cold' },
  { value: 'moderate', label: 'Moderate' },
];

const timeOfYearOptions = [
  { value: 'summer', label: 'Summer' },
  { value: 'winter', label: 'Winter' },
  { value: 'spring', label: 'Spring' },
  { value: 'autumn', label: 'Autumn' },
];

const UpdateFormPage = ({ isOpen, record, onClose, onUpdated }) => {
  const { token } = useAuth();

  const [meta, setMeta] = useState([]);
  const [neighbourhoods, setNeighbourhoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    main_category: '',
    subcategories: [],
    neighbourhood_name: '',
    date: '',
    offender_income_level: 'middle',
    climate: 'moderate',
    time_of_year: 'summer',
  });

  // Load meta + neighbourhoods once
  useEffect(() => {
    if (!isOpen || !record) return;

    const load = async () => {
      try {
        const [metaRes, neighRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/crime/meta`),
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/neighbourhoods`),
        ]);

        const metaData = await metaRes.json();
        const neighData = await neighRes.json();

        setMeta(metaData);
        setNeighbourhoods(neighData);

        const selectedMain = record.main_category || (metaData[0]?.main_category ?? '');
        const selectedMeta = metaData.find((m) => m.main_category === selectedMain);

        setForm({
          main_category: selectedMain,
          subcategories: record.subcategories
            ? record.subcategories.split(', ').filter(Boolean)
            : [],
          neighbourhood_name: record.neighbourhood_name || (neighData[0]?.name ?? ''),
          date: record.date,
          offender_income_level: record.offender_income_level || 'middle',
          climate: record.climate || 'moderate',
          time_of_year: record.time_of_year || 'summer',
        });
      } catch (err) {
        console.error('Failed to load meta/neighbourhoods', err);
        toast.error('Failed to load reference data');
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    load();
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const selectedCategory = meta.find((m) => m.main_category === form.main_category);

  const handleMainCategoryChange = (e) => {
    const main_category = e.target.value;
    setForm((prev) => ({
      ...prev,
      main_category,
      subcategories: [],
    }));
  };

  const handleCheckboxChange = (subcategory) => {
    setForm((prev) => {
      const exists = prev.subcategories.includes(subcategory);
      if (exists) {
        return {
          ...prev,
          subcategories: prev.subcategories.filter((s) => s !== subcategory),
        };
      }
      return {
        ...prev,
        subcategories: [...prev.subcategories, subcategory],
      };
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.main_category || !form.neighbourhood_name || !form.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!token) {
      toast.error('Missing authentication token');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/crime-form/${record.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to update');
      }

      toast.success(data.message || 'Data updated successfully');
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      console.error('Update failed', err);
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/30">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-xl font-semibold mb-4">Update Crime Record #{record.id}</h3>
        {loading ? (
          <p>Loading form data...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Main Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Main Category<span className="text-red-500">*</span>
                </label>
                <select
                  name="main_category"
                  value={form.main_category}
                  onChange={handleMainCategoryChange}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {meta.map((m) => (
                    <option key={m.main_category} value={m.main_category}>
                      {m.main_category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Neighbourhood<span className="text-red-500">*</span>
                </label>
                <select
                  name="neighbourhood_name"
                  value={form.neighbourhood_name}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {neighbourhoods.map((n) => (
                    <option key={n.id} value={n.name}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subcategories */}
            <div>
              <label className="block text-sm font-medium mb-1">Subcategories</label>
              {selectedCategory && selectedCategory.subcategories?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                  {selectedCategory.subcategories.map((sub) => (
                    <label key={sub} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.subcategories.includes(sub)}
                        onChange={() => handleCheckboxChange(sub)}
                      />
                      <span>{sub}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No subcategories for this category.</p>
              )}
            </div>

            {/* Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Date of Crime<span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Offender Income Level</label>
                <select
                  name="offender_income_level"
                  value={form.offender_income_level}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {incomeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Climate</label>
                <select
                  name="climate"
                  value={form.climate}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {climateOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time of year */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Time of Year</label>
                <select
                  name="time_of_year"
                  value={form.time_of_year}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {timeOfYearOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-full bg-primary text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Update'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default UpdateFormPage;