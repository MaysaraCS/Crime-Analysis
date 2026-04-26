import React, { createContext, useContext, useMemo } from "react";

const AuthContext = createContext({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }) {
  const value = useMemo(
    () => ({ user: null, token: null, login: () => {}, logout: () => {} }),
    []
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}