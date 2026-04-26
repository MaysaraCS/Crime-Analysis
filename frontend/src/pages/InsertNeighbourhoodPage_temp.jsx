import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { MapPin, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import Navbar from "../components/Navbar";

const API = import.meta.env.VITE_API_BASE_URL;

const SCORE_OPTIONS = [
  { value: 1, label: "1 — Low" },
  { value: 3, label: "3 — Medium" },
  { value: 5, label: "5 — High" },
];

const SCORE_FIELDS = [
  { key: "population_density_score", label: "Population Density Score", hint: "How densely populated is this area?" },
  { key: "divorce_ratio_score", label: "Divorce Ratio Score", hint: "Relative divorce rate in the area" },
  { key: "unmarried_over_30_score", label: "Unmarried Over 30 Score", hint: "Proportion of unmarried residents over 30" },
  { key: "university_education_score", label: "University Education Score", hint: "Level of higher education in the area" },
  { key: "unemployment_score", label: "Unemployment Score", hint: "Relative unemployment rate" },
  { key: "income_score", label: "Income Score", hint: "Average income level of residents" },
  { key: "vitality_score", label: "Vitality Score", hint: "General social and economic vitality" },
];

const defaultForm = {
  name: "",
  latitude: "",
  longitude: "",
  population_density_score: "",
  divorce_ratio_score: "",
  unmarried_over_30_score: "",
  university_education_score: "",
  unemployment_score: "",
  income_score: "",
  vitality_score: "",
};

const InsertNeighbourhoodPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [insertedName, setInsertedName] = useState("");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = "Name is required.";

    const lat = parseFloat(form.latitude);
    if (form.latitude === "" || isNaN(lat) || lat < -90 || lat > 90)
      newErrors.latitude = "Enter a valid latitude (-90 to 90).";

    const lng = parseFloat(form.longitude);
    if (form.longitude === "" || isNaN(lng) || lng < -180 || lng > 180)
      newErrors.longitude = "Enter a valid longitude (-180 to 180).";

    SCORE_FIELDS.forEach(({ key }) => {
      if (!form[key]) newErrors[key] = "Please select a value.";
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        population_density_score: parseInt(form.population_density_score),
        divorce_ratio_score: parseInt(form.divorce_ratio_score),
        unmarried_over_30_score: parseInt(form.unmarried_over_30_score),
        university_education_score: parseInt(form.university_education_score),
        unemployment_score: parseInt(form.unemployment_score),
        income_score: parseInt(form.income_score),
        vitality_score: parseInt(form.vitality_score),
      };

      const res = await fetch(`${API}/api/neighborhoods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to insert neighbourhood.");
      }

      setInsertedName(data.name);
      setSuccess(true);
      toast.success(`"${data.name}" inserted! Model retraining in background.`);

      // Navigate to dashboard after 2.5 seconds
      setTimeout(() => navigate("/crime"), 2500);
    } catch (err) {
      toast.error(err.message || "Failed to insert neighbourhood.");
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center pt-20">
          <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full mx-4 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Neighbourhood Added!</h2>
            <p className="text-gray-500 mb-2">
              <span className="font-semibold text-primary">"{insertedName}"</span> has been
              inserted into the database.
            </p>
            <p className="text-sm text-gray-400 mb-6">
              ML model retraining has started in the background. Redirecting to dashboard…
            </p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-[progress_2.5s_linear_forwards]" />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-20 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition mb-4 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                Insert New Neighbourhood
              </h1>
            </div>
            <p className="text-gray-500 text-sm ml-13">
              Add a new neighbourhood to the database. The ML model will retrain automatically
              after insertion using city-average crime counts as a baseline.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-[#9234ea] px-6 py-4">
              <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
                Neighbourhood Details
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic info */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Neighbourhood Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Dammam Area 41"
                    className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${
                      errors.name ? "border-red-400 bg-red-50" : "border-gray-200"
                    }`}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Latitude <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="latitude"
                      value={form.latitude}
                      onChange={handleChange}
                      placeholder="e.g. 26.4207"
                      step="any"
                      className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${
                        errors.latitude ? "border-red-400 bg-red-50" : "border-gray-200"
                      }`}
                    />
                    {errors.latitude && (
                      <p className="text-red-500 text-xs mt-1">{errors.latitude}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Longitude <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="longitude"
                      value={form.longitude}
                      onChange={handleChange}
                      placeholder="e.g. 50.0888"
                      step="any"
                      className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition ${
                        errors.longitude ? "border-red-400 bg-red-50" : "border-gray-200"
                      }`}
                    />
                    {errors.longitude && (
                      <p className="text-red-500 text-xs mt-1">{errors.longitude}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Score fields */}
              <div>
                <div className="bg-gradient-to-r from-primary to-[#9234ea] px-4 py-2 rounded-lg mb-4">
                  <h3 className="text-white font-semibold text-sm uppercase tracking-wider">
                    Demographic Scores (1 = Low · 3 = Medium · 5 = High)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SCORE_FIELDS.map(({ key, label, hint }) => (
                    <div key={key}>
                      <label className="block text-sm font-semibold text-gray-700 mb-0.5">
                        {label} <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-gray-400 mb-1">{hint}</p>
                      <select
                        name={key}
                        value={form[key]}
                        onChange={handleChange}
                        className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition bg-white ${
                          errors[key] ? "border-red-400 bg-red-50" : "border-gray-200"
                        }`}
                      >
                        <option value="">— Select —</option>
                        {SCORE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {errors[key] && (
                        <p className="text-red-500 text-xs mt-1">{errors[key]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
                <strong>Note:</strong> After submission, monthly crime counts will be seeded
                using city-wide averages. The ML model will retrain automatically in the
                background — this may take up to 60 seconds.
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      Insert Neighbourhood
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Inline keyframe for progress bar */}
      <style>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-\\[progress_2\\.5s_linear_forwards\\] {
          animation: progress 2.5s linear forwards;
        }
      `}</style>
    </>
  );
};

export default InsertNeighbourhoodPage;