import React, { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { assets } from "../assets/assets";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../auth/AuthContext.jsx";

const Layout = () => {
    const navigate = useNavigate();
    const [sidebar, setSidebar] = useState(false);
    const { user } = useAuth();

    // If no logged-in user, redirect to login page
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex flex-col item-start justify-start h-screen">
            <nav className="w-full px-8 min-h-14 flex items-center justify-between border-b border-gray-200">
                <img className="w-32 sm:w-15 mt-3 mb-3 cursor-pointer" src={assets.logo} alt="" onClick={() => navigate("/")} />
                {sidebar ? (
                    <X
                        onClick={() => setSidebar(false)}
                        className="w-6 h-6 text-gray-600 sm:hidden"
                    />
                ) : (
                    <Menu
                        onClick={() => setSidebar(true)}
                        className="w-6 h-6 text-gray-600 sm:hidden"
                    />
                )}
            </nav>

            <div className=" flex flex-1  h-[calc(100vh-64px)] ">
                <Sidebar sidebar={sidebar} setSidebar={setSidebar} />

                <div className="flex-1 bg-[#f4f7fb] ">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default Layout;