import React from "react";
import { NavLink } from "react-router-dom";
import { House, FileChartColumnIncreasing, Map } from "lucide-react";

/**
 * New scope:
 * - No login
 * - No users/roles
 * - No admin/insert/update pages
 *
 * Keep navigation minimal: Maps (+ optional Dashboard/Reports later).
 */

const navItems = [
  // Optional: keep dashboard only if it no longer calls old endpoints
  { to: "/crime", label: "Dashboard", Icon: House },

  // ✅ Main page
  { to: "/crime/maps", label: "Crime Maps", Icon: Map },


  { to: "/crime/report-page", label: "Season Report", Icon: FileChartColumnIncreasing },

  // Optional: show only after you refactor reports to new DB
  // { to: "/crime/report-page", label: "Reports", Icon: FileChartColumnIncreasing },
];

const Sidebar = ({ sidebar, setSidebar }) => {
  return (
    <div
      className={`w-90 bg-white border-r border-gray-200 
      flex flex-col justify-between items-center
      max-sm:absolute top-14 bottom-0
      ${sidebar ? "translate-x-0" : "max-sm:-translate-x-full"}
      transition-all duration-300 ease-in-out z-50`}
    >
      <div className="my-7 w-full">
        <div className="px-6 mt-5 text-sm text-gray-600 font-medium">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/crime"}
              onClick={() => setSidebar(false)}
              className={({ isActive }) =>
                `px-3.5 py-2.5 flex items-center gap-3 rounded 
                ${
                  isActive
                    ? "bg-gradient-to-r from-[#3c81f6] to-[#9234ea] text-white"
                    : "hover:bg-gray-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : ""}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Simple footer (optional) */}
      <div className="w-full border-t border-gray-200 p-4 px-7">
        <div className="text-xs text-gray-500">
          ML Crime Risk Classification • Dammam • 2025
        </div>
      </div>
    </div>
  );
};

export default Sidebar;