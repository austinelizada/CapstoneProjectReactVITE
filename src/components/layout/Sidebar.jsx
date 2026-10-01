import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import logo from "../../assets/images/ACGCLOGO1.png";
import { useAuth } from "../../contexts/AuthContext";

import {
  Gauge,
  ClipboardCheck,
  ReceiptText,
  ChartNoAxesCombined,
  Package,
  UserCog,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useAdminTheme } from "@/contexts/AdminThemeContext";

function Sidebar({ isOpen, onToggle }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const location = useLocation();
  const { logout } = useAuth();
  const { darkMode } = useAdminTheme();

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
  };

  const handleLogoClick = () => {
    if (window.location.pathname === "/dashboard") {
      window.location.reload();
      return;
    }

    window.location.assign("/dashboard");
  };

  return (
    <>
      <div className={`relative shrink-0 transition-[width] duration-300 ease-in-out motion-reduce:transition-none ${isOpen ? "w-52" : "w-20"}`}>
        <aside
          className={`admin-sidebar relative h-full min-h-screen w-full border-r shadow-sm overflow-hidden ${darkMode ? "border-red-950/70 bg-gradient-to-b from-[#050817] via-[#10162d] to-[#3b0b1b] text-slate-100" : "border-slate-300 bg-gradient-to-b from-slate-100 via-white to-slate-200 text-slate-900"}`}
        >
        <div className={`pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full border ${darkMode ? "border-red-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -right-16 -top-12 h-48 w-48 rounded-full border ${darkMode ? "border-red-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -left-24 top-1/3 h-44 w-44 rounded-full border ${darkMode ? "border-blue-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -left-14 top-[38%] h-24 w-24 rounded-full border ${darkMode ? "border-blue-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -bottom-28 right-6 h-56 w-56 rounded-full border ${darkMode ? "border-red-200/10" : "border-slate-900/10"}`} />
        <div className={`pointer-events-none absolute -bottom-12 right-24 h-28 w-28 rounded-full border ${darkMode ? "border-red-200/10" : "border-slate-900/10"}`} />

        <div className={`relative z-10 flex border-b ${isOpen ? "items-center gap-0 p-1.5" : "flex-col items-center gap-2 p-2"}`}>
          <button
            type="button"
            onClick={handleLogoClick}
            className={`grid min-w-0 cursor-pointer items-center text-left transition-[grid-template-columns,gap] duration-300 ease-in-out motion-reduce:transition-none ${isOpen ? "flex-1 grid-cols-[36px_minmax(0,1fr)] gap-1" : "w-full grid-cols-[1fr_0fr] gap-0"}`}
            aria-label="Go to dashboard"
          >
            <img
              src={logo}
              alt="ACGC Aluminum Services"
              className="h-8 w-9 shrink-0 justify-self-center object-contain"
            />

            <div className={`min-w-0 overflow-hidden transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${isOpen ? "max-w-full opacity-100" : "max-w-0 opacity-0"}`}>
              <h1 className="truncate text-base font-bold leading-tight text-red-500">
                ACGC Services
              </h1>

              <p className={`whitespace-nowrap text-[10px] leading-tight font-bold ${darkMode ? "text-slate-300" : "text-gray-700"}`}>
                Aluminum & Glass Services
              </p>
            </div>
          </button>
        </div>

        {/* MENU */}
        <nav className="mt-3 flex flex-col gap-1.5 px-2 py-1">

          <MenuItem
            to="/dashboard"
            icon={<Gauge size={20} />}
            label="Dashboard"
            isOpen={isOpen}
            active={location.pathname === "/dashboard"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/site-inspection"
            icon={<ClipboardCheck size={20} />}
            label="Site Inspection"
            isOpen={isOpen}
            active={location.pathname === "/site-inspection"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/transactions"
            icon={<ReceiptText size={20} />}
            label="Transactions"
            isOpen={isOpen}
            active={location.pathname === "/transactions"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/progress-monitor"
            icon={<ChartNoAxesCombined size={20} />}
            label="Progress Monitor"
            isOpen={isOpen}
            active={location.pathname === "/progress-monitor"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/product"
            icon={<Package size={20} />}
            label="Products"
            isOpen={isOpen}
            active={location.pathname === "/product"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/profile"
            icon={<UserCog size={20} />}
            label="Admin Profile"
            isOpen={isOpen}
            active={location.pathname === "/profile"}
            darkMode={darkMode}
          />

          <MenuItem
            to="/settings"
            icon={<Settings size={20} />}
            label="Settings"
            isOpen={isOpen}
            active={location.pathname === "/settings"}
            darkMode={darkMode}
          />

          {/* LOGOUT */}
          <button
            onClick={() => setShowLogoutModal(true)}
            title="Logout"
            className={`relative z-10 flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-sm text-red-500 transition-[gap,background-color,color] duration-300 ease-in-out motion-reduce:transition-none ${darkMode ? "hover:bg-red-950/70 hover:text-red-300" : "hover:bg-red-50"} ${isOpen ? "justify-start gap-2.5" : "justify-center gap-0"}`}
          >
            <LogOut size={20} className="shrink-0" />
            <span className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${isOpen ? "max-w-full opacity-100" : "invisible max-w-0 opacity-0"}`}>
              Logout
            </span>
          </button>

        </nav>
        </aside>
        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-pressed={!isOpen}
          title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          className={`absolute right-0 top-7 z-20 inline-flex h-8 w-8 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border shadow-[0_2px_8px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition-[transform,background-color,border-color,box-shadow,color] duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 motion-reduce:transition-none ${darkMode ? "border-slate-600 bg-slate-800 text-slate-200 ring-white/10 hover:border-red-800 hover:bg-slate-700 hover:text-red-300" : "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"}`}
        >
          {isOpen ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
        </button>
      </div>

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
      className={`group relative grid min-h-10 w-full items-center rounded-lg px-3 py-2 text-sm transition-[grid-template-columns,gap,background-color,color,transform] duration-200 ease-out hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 motion-reduce:transition-none motion-reduce:hover:translate-x-0 ${
        active
          ? darkMode
            ? "bg-amber-500/15 text-amber-200 shadow-sm shadow-amber-950/30 ring-1 ring-inset ring-amber-400/40"
            : "bg-white text-amber-800 shadow-[0_2px_10px_rgba(245,158,11,0.12)] ring-1 ring-inset ring-amber-500/40"
          : darkMode
            ? "text-slate-300 hover:bg-red-950/70 hover:text-red-200"
            : "text-gray-700 hover:bg-red-50 hover:text-red-700"
      } ${isOpen ? "grid-cols-[20px_minmax(0,1fr)] gap-2.5" : "grid-cols-[1fr_0fr] gap-0"} ${nested ? "rounded-l-none rounded-r-xl" : ""}`}
    >
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.75)]" />}
      <span className={`relative shrink-0 justify-self-center transition-transform duration-200 ease-out motion-reduce:transition-none ${
        isOpen ? "" : "group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100"
      }`}>{icon}</span>
      <span className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
        isOpen ? "max-w-full opacity-100" : "max-w-0 opacity-0"
      }`}>
        {label}
      </span>
    </Link>
  );
}

export default Sidebar;