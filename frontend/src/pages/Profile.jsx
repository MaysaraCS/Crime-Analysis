import React, { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";

const Profile = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [backendUser, setBackendUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken({ template: "backend" });
        if (!token) {
          setError("No Clerk session token available");
          return;
        }

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Request failed with ${res.status}`);
        }

        const data = await res.json();
        setBackendUser(data);
      } catch (err) {
        console.error("Failed to load /api/me", err);
        setError(err.message);
      }
    };

    load();
  }, [getToken]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Profile</h2>

      <div className="mb-6">
        <h3 className="font-medium mb-1">Clerk user</h3>
        {user ? (
          <ul className="text-sm text-gray-700">
            <li>
              <strong>Name:</strong> {user.fullName}
            </li>
            <li>
              <strong>Email:</strong> {user.primaryEmailAddress?.emailAddress}
            </li>
            <li>
              <strong>Role (frontend):</strong> {user.unsafeMetadata?.role || "not set"}
            </li>
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Not loaded.</p>
        )}
      </div>

      <div>
        <h3 className="font-medium mb-1">Backend user (/api/me)</h3>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {backendUser ? (
          <ul className="text-sm text-gray-700">
            <li>
              <strong>ID:</strong> {backendUser.id}
            </li>
            <li>
              <strong>Clerk ID:</strong> {backendUser.clerk_id}
            </li>
            <li>
              <strong>Email:</strong> {backendUser.email}
            </li>
            <li>
              <strong>Role (DB):</strong> {backendUser.role}
            </li>
          </ul>
        ) : !error ? (
          <p className="text-sm text-gray-500">Loading user info...</p>
        ) : null}
      </div>
    </div>
  );
};

export default Profile;
