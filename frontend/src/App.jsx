import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import ReportPage from "./pages/ReportPage";
import MapsPage from "./pages/MapsPage";

// Old pages (not needed now)
// import AdminPage from "./pages/AdminPage";
// import InsertPage from "./pages/InsertPage";
// import UpdatePage from "./pages/UpdatePage";
// import Home from "./pages/Home";
// import Login from "./pages/Login";

function App() {
  return (
    <div>
      <Toaster />

      <Routes>
        {/* ✅ Default route: go straight to the map (NO LOGIN) */}
        <Route path="/" element={<Navigate to="/crime/maps" replace />} />

        {/* ✅ Keep your existing layout routes, but remove auth-only pages */}
        <Route path="/crime" element={<Layout />}>
          <Route index element={<Dashboard />} />

          {/* ✅ Updated map page (ML + Formula risk) */}
          <Route path="maps" element={<MapsPage />} />

          {/* Keep reports only if you refactor them to new DB later */}
          <Route path="report-page" element={<ReportPage />} />

          {/* ❌ Remove CRUD/admin routes (not part of new ML scope) */}
          {/* <Route path="admin-page" element={<AdminPage />} /> */}
          {/* <Route path="insert-info" element={<InsertPage />} /> */}
          {/* <Route path="update-info" element={<UpdatePage />} /> */}
        </Route>

        {/* ✅ catch-all */}
        <Route path="*" element={<Navigate to="/crime/maps" replace />} />
      </Routes>
    </div>
  );
}

export default App;