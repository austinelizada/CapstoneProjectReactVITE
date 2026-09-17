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
        className={`admin-sidebar relative shrink-0 border-r shadow-sm min-h-screen overflow-hidden transition-all duration-300 ease-in-out ${darkMode ? "border-red-950/70 bg-gradient-to-b from-[#050817] via-[#10162d] to-[#3b0b1b] text-slate-100" : "border-slate-300 bg-gradient-to-b from-slate-100 via-white to-slate-200 text-slate-900"} ${
          isOpen ? "w-72" : "w-20"
        }`}
      >
        <div className={`pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full border ${darkMode ? "border-red-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -right-16 -top-12 h-48 w-48 rounded-full border ${darkMode ? "border-red-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -left-24 top-1/3 h-44 w-44 rounded-full border ${darkMode ? "border-blue-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -left-14 top-[38%] h-24 w-24 rounded-full border ${darkMode ? "border-blue-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -bottom-28 right-6 h-56 w-56 rounded-full border ${darkMode ? "border-red-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -bottom-12 right-24 h-28 w-28 rounded-full border ${darkMode ? "border-red-200/10" : "border-slate-900/10"}`} />

        {/* LOGO */}
        <div className={`relative z-10 flex items-center gap-1 border-b p-5 ${darkMode ? "border-red-200/10" : "border-slate-300/80"}`}>
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
            darkMode={darkMode}
          />

          <MenuItem
            to="/site-inspection"
            icon={<MapPinned size={23} />}
            label="Site Inspection"
            isOpen={isOpen}
            active={location.pathname === "/site-inspection"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/transactions"
            icon={<ReceiptText size={23} />}
            label="Transactions"
            isOpen={isOpen}
            active={location.pathname === "/transactions"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/progress-monitor"
            icon={<BarChart3 size={23} />}
            label="Progress Monitor"
            isOpen={isOpen}
            active={location.pathname === "/progress-monitor"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/product"
            icon={<Package size={23} />}
            label="Products"
            isOpen={isOpen}
            active={location.pathname === "/product"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/profile"
            icon={<UserCog size={23} />}
            label="Admin Profile"
            isOpen={isOpen}
            active={location.pathname === "/profile"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/settings"
            icon={<Settings size={23} />}
            label="Settings"
            isOpen={isOpen}
            active={location.pathname === "/settings"}
            darkMode={darkMode}
          />

          {/* LOGOUT */}
          <button
            onClick={() => setShowLogoutModal(true)}
            title="Logout"
            className={`relative z-10 flex w-full items-center gap-3 rounded-xl p-3 text-red-500 transition-all duration-300 ease-in-out ${darkMode ? "hover:bg-red-950/70 hover:text-red-300" : "hover:bg-red-50"} ${isOpen ? "justify-start" : "justify-center"}`}
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
  darkMode = false,
}) {
  return (
    <Link
      to={to}
      title={label}
      className={`flex w-full items-center gap-1 p-3 rounded-xl transition-all duration-300 ease-in-out ${
        active
          ? darkMode
            ? "bg-gradient-to-r from-red-700 to-red-950 text-white shadow-lg shadow-red-950/30"
            : "bg-red-600 text-white"
          : darkMode
            ? "text-slate-300 hover:bg-red-950/70 hover:text-red-200"
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