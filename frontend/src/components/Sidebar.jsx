import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { House, FileChartColumnIncreasing, Map, MapPin, LayoutDashboard } from "lucide-react";

const navItems = [
  { to: "/crime", label: "Dashboard", Icon: House },
  { to: "/crime/maps", label: "Crime Maps", Icon: Map },
  { to: "/crime/report-page", label: "Season Report", Icon: FileChartColumnIncreasing },
];

const Sidebar = ({ sidebar, setSidebar }) => {
  const navigate = useNavigate();

  return (
    <div
      className={`w-72 bg-white border-r border-gray-200 
      flex flex-col justify-between items-center
      max-sm:absolute top-14 bottom-0
      ${sidebar ? "translate-x-0" : "max-sm:-translate-x-full"}
      transition-all duration-300 ease-in-out z-50`}
    >
      <div className="my-6 w-full">
        {/* Top action buttons */}
        <div className="px-4 mb-4 flex flex-col gap-2">
          
          <button
            onClick={() => { navigate("/insert-neighbourhood"); setSidebar(false); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition border border-emerald-200"
          >
            <MapPin className="w-4 h-4" />
            Insert Neighbourhood
          </button>
        </div>

        <div className="mx-4 border-t border-gray-100 mb-4" />

        {/* Nav links */}
        <div className="px-4 text-sm text-gray-600 font-medium space-y-1">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/crime"}
              onClick={() => setSidebar(false)}
              className={({ isActive }) =>
                `px-3.5 py-2.5 flex items-center gap-3 rounded-lg transition ${
                  isActive
                    ? "bg-gradient-to-r from-[#3c81f6] to-[#9234ea] text-white shadow-md"
                    : "hover:bg-gray-100 text-gray-600"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : ""}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full border-t border-gray-100 p-4">
        <div className="text-xs text-gray-400 text-center">
          ML Crime Risk Classification · Dammam · 2025
        </div>
      </div>
    </div>
  );
};

export default Sidebar;