import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

// When app loads, check if user was previously logged in
// Restores authentication state across page refreshes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem("auth_token");
  });
// Saves user info and token to both state and localStorage
// Called after successful login API response
  const login = (data) => {
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    localStorage.setItem("auth_token", data.token);
  };
// Clears user data from state and localStorage
// Effectively logs user out of the application
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
  };

  return (
    // Wraps entire app to provide authentication state globally
    // Any component can access user, token, login, logout via useAuth hook
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
