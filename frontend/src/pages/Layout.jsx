import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LayoutDashboard, MapPin } from "lucide-react";
import { assets } from "../assets/assets";
import Sidebar from "../components/Sidebar";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebar, setSidebar] = useState(false);

  const isDashboard = location.pathname.startsWith("/crime");
  const isInsert    = location.pathname === "/insert-neighbourhood";

  return (
    <div className="flex flex-col h-screen">
      {/* ── Top nav — identical styling to Navbar.jsx ── */}
      <nav className="w-full backdrop-blur-2xl bg-white/80 border-b border-gray-100 flex items-center justify-between py-1.5 px-4 sm:px-16 xl:px-28 shadow-sm z-40 flex-shrink-0">
        <img
          src={assets.logo}
          alt="Logo"
          className="w-20 sm:w-24 cursor-pointer"
          onClick={() => navigate("/")}
        />

        {/* Desktop buttons */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => navigate("/crime")}
            className={`flex items-center gap-1.5 rounded-full text-xs px-4 py-1.5 font-medium transition-all duration-200 cursor-pointer border ${
              isDashboard
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>

          <button
            onClick={() => navigate("/insert-neighbourhood")}
            className={`flex items-center gap-1.5 rounded-full text-xs px-4 py-1.5 font-medium transition-all duration-200 cursor-pointer border ${
              isInsert
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Insert Neighbourhood
          </button>
        </div>

        {/* Mobile hamburger */}
        {sidebar ? (
          <X
            onClick={() => setSidebar(false)}
            className="w-5 h-5 text-gray-600 sm:hidden cursor-pointer"
          />
        ) : (
          <Menu
            onClick={() => setSidebar(true)}
            className="w-5 h-5 text-gray-600 sm:hidden cursor-pointer"
          />
        )}
      </nav>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar sidebar={sidebar} setSidebar={setSidebar} />
        <main className="flex-1 bg-[#f4f7fb] overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;