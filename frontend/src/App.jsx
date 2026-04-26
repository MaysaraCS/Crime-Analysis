import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import ReportPage from "./pages/ReportPage";
import MapsPage from "./pages/MapsPage";
import InsertNeighbourhoodPage from "./pages/InsertNeighbourhoodPage";

function App() {
  return (
    <div>
      <Toaster position="top-right" />
      <Routes>
        {/* Home page is the default landing */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Insert neighbourhood - standalone page */}
        <Route path="/insert-neighbourhood" element={<InsertNeighbourhoodPage />} />

        {/* Main app layout */}
        <Route path="/crime" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="maps" element={<MapsPage />} />
          <Route path="report-page" element={<ReportPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;