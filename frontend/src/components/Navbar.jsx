import React from "react";
import { assets } from "../assets/assets";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, MapPin } from "lucide-react";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isDashboard = location.pathname.startsWith("/crime");
  const isInsert = location.pathname === "/insert-neighbourhood";

  return (
    <div className="fixed z-50 w-full backdrop-blur-2xl bg-white/80 border-b border-gray-100 flex justify-between items-center py-1.5 px-4 sm:px-16 xl:px-28 shadow-sm">
      <img
        src={assets.logo}
        alt="Logo"
        className="w-20 sm:w-24 cursor-pointer"
        onClick={() => navigate("/")}
      />

      <div className="flex items-center gap-2">
        {/* Dashboard button */}
        <button
          onClick={() => navigate("/crime")}
          className={`flex items-center gap-1.5 rounded-full text-xs px-4 py-1.5 font-medium transition-all duration-200 cursor-pointer border ${
            isDashboard
              ? "bg-primary text-white border-primary shadow-sm"
              : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        {/* Insert Neighbourhood button */}
        <button
          onClick={() => navigate("/insert-neighbourhood")}
          className={`flex items-center gap-1.5 rounded-full text-xs px-4 py-1.5 font-medium transition-all duration-200 cursor-pointer border ${
            isInsert
              ? "bg-primary text-white border-primary shadow-sm"
              : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Insert Neighbourhood</span>
        </button>
      </div>
    </div>
  );
};

export default Navbar;