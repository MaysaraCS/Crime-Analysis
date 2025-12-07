import React, { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Navigate, useNavigate } from "react-router-dom";

const roles = [
  { value: "administrator", label: "Administrator" },
  { value: "general_statistic", label: "General Statistic" },
  { value: "hr", label: "Human Resources" },
  { value: "civil_status", label: "Civil Status" },
  { value: "ministry_of_justice", label: "Ministry of Justice" },
  { value: "ministry_of_interior", label: "Ministry of Interior" },
];

const SelectRolePage = () => {
  const { user, isLoaded } = useUser();
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  if (!isLoaded) return null;

  // If user already has a role (e.g. they refreshed or visited manually), go back to dashboard
  if (user && user.unsafeMetadata?.role) {
    return <Navigate to="/crime" replace />;
  }

  const handleSave = async () => {
    if (!role || !user) return;
    setSaving(true);
    try {
      await user.update({
        unsafeMetadata: {
          ...(user.unsafeMetadata || {}),
          role,
        },
      });
    } catch (e) {
      console.error("Failed to update user role", e);
    } finally {
      setSaving(false);
      // Use a full reload so Clerk state is fresh before Layout checks the role
      window.location.href = "/crime";
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f4f7fb]">
      <div className="bg-white rounded-lg shadow p-8 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Choose your user type
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Please select your role so we can show you the correct pages and
          permissions.
        </p>

        <select
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">Select user type...</option>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <button
          disabled={!role || saving}
          onClick={handleSave}
          className="w-full bg-primary text-white rounded py-2 disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
};

export default SelectRolePage;
