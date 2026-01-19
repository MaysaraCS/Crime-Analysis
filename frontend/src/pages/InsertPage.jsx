import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
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

const InsertPage = () => {
  const { user, token } = useAuth();
  const role = user?.role;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState([]); // [{ main_category, weight, subcategories: [] }]
  const [neighbourhoods, setNeighbourhoods] = useState([]);

  const [form, setForm] = useState({
    main_category: '',
    crime_weight: '',
    subcategories: [],
    neighbourhood_name: '',
    date: '',
    offender_income_level: 'middle',
    climate: 'moderate',
    time_of_year: 'summer',
  });

  useEffect(() => {
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

        // Initialize defaults if possible
        if (metaData.length > 0) {
          const first = metaData[0];
          setForm((prev) => ({
            ...prev,
            main_category: first.main_category,
            crime_weight: first.weight,
            subcategories: [],
          }));
        }
        if (neighData.length > 0) {
          setForm((prev) => ({ ...prev, neighbourhood_name: neighData[0].name }));
        }
      } catch (err) {
        console.error('Failed to load crime meta/neighbourhoods', err);
        toast.error('Failed to load reference data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (role !== 'general_statistic') {
    return <Navigate to="/crime" replace />;
  }

  const handleMainCategoryChange = (e) => {
    const main_category = e.target.value;
    const selected = meta.find((m) => m.main_category === main_category);
    setForm((prev) => ({
      ...prev,
      main_category,
      crime_weight: selected ? selected.weight : '',
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
    if (!form.main_category || !form.crime_weight || !form.neighbourhood_name || !form.date) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!token) {
      toast.error('Missing authentication token');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/crime-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          main_category: form.main_category,
          subcategories: form.subcategories,
          neighbourhood_name: form.neighbourhood_name,
          date: form.date,
          offender_income_level: form.offender_income_level,
          climate: form.climate,
          time_of_year: form.time_of_year,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save data');
      }

      toast.success(data.message || 'Data saved successfully');
      // Optionally reset subcategories and date only
      setForm((prev) => ({
        ...prev,
        subcategories: [],
        date: '',
      }));
    } catch (err) {
      console.error('Error saving crime form data', err);
      toast.error(err.message || 'Failed to save data');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading form data...</div>;
  }

  const selectedCategory = meta.find((m) => m.main_category === form.main_category);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">Crime Information Form</h2>
      <p className="text-sm text-gray-600 mb-6">
        Fill in the details below to insert a new crime record. Main category and selected subcategories
        will determine the crime weight automatically.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
         {/* Main Category & Weight */}
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
            <label className="block text-sm font-medium mb-1">Crime Weight</label>
            <input
              type="text"
              value={form.crime_weight}
              readOnly
              className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100"
            />
          </div>
        </div>

        {/* Subcategories */}
        <div>
          <label className="block text-sm font-medium mb-4">Subcategories</label>
          {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 ? (
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

        {/* Neighbourhood & Date */}
        <div className="grid grid-cols-1 md-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Neighbourhood<span className="text-red-500">*</span></label>
            <select
              name="neighbourhood_name"
              value={form.neighbourhood_name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              {neighbourhoods.map((n) => (
                <option key={n.id} value={n.name}>{n.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date of Crime<span className="text-red-500">*</span></label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
        </div>

        {/* Additional attributes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Offender Income Level</label>
            <select
              name="offender_income_level"
              value={form.offender_income_level}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              {incomeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Time of Year</label>
            <select
              name="time_of_year"
              value={form.time_of_year}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              {timeOfYearOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-4 px-6 py-2 rounded-full bg-primary text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
}

export default InsertPage;
