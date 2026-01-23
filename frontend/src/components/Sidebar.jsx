import React, { useState } from "react";
import {
    House,
    User,
    UserStar,
    BookText,
    PenLine,
    FileChartColumnIncreasing,
    Map,
    LogOut,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import LogoutModal from "./LogoutModal";
import { useAuth } from "../auth/AuthContext.jsx";

// Defines all navigation menu items
// roles: "any" means all users can see it
// roles: ["administrator"] means only admin sees it
// roles: array means any of those roles can see it

const navItems = [
    { to: "/crime", label: "Dashboard", Icon: House, roles: "any" },
    { to: "/crime/admin-page", label: "Admin Page", Icon: UserStar, roles: ["administrator"] },
    { to: "/crime/insert-info", label: "Insert Information", Icon: BookText, roles: ["general_statistic"] },
    {
        to: "/crime/update-info",
        label: "Update Information",
        Icon: PenLine,
        roles: ["general_statistic", "hr", "civil_status", "ministry_of_justice"],
    },
    {
        to: "/crime/report-page",
        label: "Report Page",
        Icon: FileChartColumnIncreasing,
        roles: ["administrator", "ministry_of_interior"],
    },
    {
        to: "/crime/maps",
        label: "Crime Maps",
        Icon: Map,
        roles: "any",
    },
];

const Sidebar = ({ sidebar, setSidebar }) => {
    const { user, logout } = useAuth();
    const role = user?.role;
// Filters navigation items based on current user's role
// Only shows menu items the user has permission to access
    const visibleNavItems = navItems.filter((item) => {
        if (item.roles === "any") return true;
        if (!role) return false;
        return item.roles.includes(role);
    });

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogoutClick = () => {
        setShowLogoutModal(true);
    };

    const handleConfirmLogout = () => {
        setShowLogoutModal(false);
        logout();
    };

    const handleCancelLogout = () => {
        setShowLogoutModal(false);
    };

    return (
        <>
            <div
    className={`w-90 bg-white border-r border-gray-200 
      flex flex-col justify-between items-center
      max-sm:absolute top-14 bottom-0
      ${sidebar ? "translate-x-0" : "max-sm:-translate-x-full"}
      transition-all duration-300 ease-in-out z-50`}
>
                <div className="my-7 w-full ">
                    <div className="px-6 mt-5 text-sm text-gray-600 font-medium ">
                        {visibleNavItems.map(({ to, label, Icon }) => (
                            // NavLink automatically adds 'isActive' when route matches
                            // Active route gets gradient background, others get hover effect
                            // onClick closes sidebar on mobile after navigation
                            <NavLink
                                key={to}
                                to={to}
                                end={to === "/crime"}
                                onClick={() => setSidebar(false)}
                                className={({ isActive }) =>
                                    `px-3.5 py-2.5 flex items-center gap-3 rounded 
        ${isActive
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

                <div className="w-full border-t border-gray-200 p-4 px-7 flex items-center justify-between gap-3">
                    <div className="flex gap-2 items-center">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700">
                            {user?.email ? user.email.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div>
                            <h1 className="text-sm font-medium">{user?.email || "Unknown"}</h1>
                            <p className="text-xs text-gray-500 capitalize">{user?.role || "no role"}</p>
                        </div>
                    </div>
                    <LogOut onClick={handleLogoutClick} className="w-5 h-5 text-gray-400 hover:text-gray-700 transition cursor-pointer flex-shrink-0" />
                </div>
            </div>

            <LogoutModal
                isOpen={showLogoutModal}
                onClose={handleCancelLogout}
                onConfirm={handleConfirmLogout}
            />
        </>
    );
};

export default Sidebar;