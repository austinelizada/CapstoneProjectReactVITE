import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import logo from "../../assets/images/ACGCLOGO1.png";
import { useAuth } from "../../contexts/AuthContext";

import {
  LayoutDashboard,
  MapPinned,
  ReceiptText,
  BarChart3,
  Package,
  UserCog,
  Settings,
  LogOut,
} from "lucide-react";

import { useAdminTheme } from "@/contexts/AdminThemeContext";

function Sidebar({ isOpen }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const location = useLocation();
  const { logout } = useAuth();
  const { darkMode } = useAdminTheme();

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
  };

  return (
    <>
      <aside
        className={`admin-sidebar ${darkMode ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-gray-300"} border-r shadow-sm min-h-screen overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "w-72" : "w-20"
        }`}
      >
        {/* LOGO */}
        <div className={`flex items-center gap-1 p-5 border-b ${darkMode ? "border-slate-700" : ""}`}>
          <img
            src={logo}
            alt="ACGC Logo"
            className="w-20 h-12 object-contain"
          />

          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-w-full opacity-100" : "max-w-0 opacity-0"}`}>
            <h1 className="text-lg font-bold text-red-500">
              ACGC ADMIN
            </h1>

            <p className={`text-xs font-bold ${darkMode ? "text-slate-300" : "text-gray-700"}`}>
              Aluminum & Glass Services
            </p>
          </div>
        </div>

        {/* MENU */}
        <nav className="p-1 space-y-4 gap-1 mt-4 px-2 flex flex-col">

          <MenuItem
            to="/dashboard"
            icon={<LayoutDashboard size={23} />}
            label="Dashboard"
            isOpen={isOpen}
            active={location.pathname === "/dashboard"}
          />

          <MenuItem
            to="/site-inspection"
            icon={<MapPinned size={23} />}
            label="Site Inspection"
            isOpen={isOpen}
            active={location.pathname === "/site-inspection"}
          />

          <MenuItem
            to="/transactions"
            icon={<ReceiptText size={23} />}
            label="Transactions"
            isOpen={isOpen}
            active={location.pathname === "/transactions"}
          />

          <MenuItem
            to="/progress-monitor"
            icon={<BarChart3 size={23} />}
            label="Progress Monitor"
            isOpen={isOpen}
            active={location.pathname === "/progress-monitor"}
          />

          <MenuItem
            to="/product"
            icon={<Package size={23} />}
            label="Products"
            isOpen={isOpen}
            active={location.pathname === "/product"}
          />

          <MenuItem
            to="/profile"
            icon={<UserCog size={23} />}
            label="Admin Profile"
            isOpen={isOpen}
            active={location.pathname === "/profile"}
          />

          <MenuItem
            to="/settings"
            icon={<Settings size={23} />}
            label="Settings"
            isOpen={isOpen}
            active={location.pathname === "/settings"}
          />

          {/* LOGOUT */}
          <button
            onClick={() => setShowLogoutModal(true)}
            title="Logout"
            className={`flex w-full items-center gap-3 p-3 rounded-xl text-red-500 transition-all duration-300 ease-in-out ${darkMode ? "hover:bg-slate-800" : "hover:bg-red-50"} ${isOpen ? "justify-start" : "justify-center"}`}
          >
            <LogOut size={23} />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${isOpen ? "max-w-full opacity-100" : "max-w-0 opacity-0"}`}>
              Logout
            </span>
          </button>

        </nav>
      </aside>

      {/* LOGOUT MODAL */}
      {showLogoutModal && createPortal(
        <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center p-4">
          <div
            className="logout-modal-backdrop-in absolute inset-0 bg-black/45 backdrop-blur-md"
            onClick={() => setShowLogoutModal(false)}
          />
          <div className={`logout-modal-in relative z-40 w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl ${darkMode ? "bg-slate-800 text-white" : "bg-white text-slate-900"}`}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <LogOut size={22} />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Confirm Logout</h3>
            <p className={`mt-2 text-sm ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
              Are you sure you want to log out?
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className={`rounded-lg px-3 py-1 ${darkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-gray-100 hover:bg-gray-200"}`}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-red-600 px-3 py-1 text-white hover:bg-red-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function MenuItem({
  to,
  icon,
  label,
  isOpen,
  active,
  nested = false,
}) {
  return (
    <Link
      to={to}
      title={label}
      className={`flex w-full items-center gap-1 p-3 rounded-xl transition-all duration-300 ease-in-out ${
        active
          ? "bg-red-600 text-white"
          : "text-gray-700 hover:bg-red-50 hover:text-red-700"
      } ${isOpen ? "justify-start" : "justify-center"} ${nested ? "rounded-l-none rounded-r-xl" : ""}`}
    >
      {icon}
      <span className={`overflow-hidden whitespace-nowrap transition-all duration-1000 ease-in-out ${
        isOpen ? "max-w-full opacity-100" : "max-w-0 opacity-0"
      }`}>
        {label}
      </span>
    </Link>
  );
}

export default Sidebar;