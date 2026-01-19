//import React, { useState } from "react";

import { Routes, Route } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import InsertPage from "./pages/InsertPage";
import Layout from "./pages/Layout";
import ReportPage from "./pages/ReportPage";
import UpdatePage from "./pages/UpdatePage";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <div>
      <Toaster />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/crime" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="admin-page" element={<AdminPage />} />
          <Route path="insert-info" element={<InsertPage />} />
          <Route path="update-info" element={<UpdatePage />} />
          <Route path="report-page" element={<ReportPage />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
