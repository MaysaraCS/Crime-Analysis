import React from "react";
import { useAuth } from "../auth/AuthContext.jsx";

const Profile = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">Profile</h2>
        <p className="text-sm text-gray-500">You are not logged in.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Profile</h2>
      <ul className="text-sm text-gray-700">
        <li>
          <strong>Email:</strong> {user.email}
        </li>
        <li>
          <strong>Role:</strong> {user.role}
        </li>
      </ul>
    </div>
  );
};

export default Profile;