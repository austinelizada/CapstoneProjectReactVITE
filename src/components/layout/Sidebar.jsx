import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
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

function Sidebar({ isOpen }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      <aside
        className={`bg-white border-gray-300 border-r shadow-sm min-h-screen overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "w-72" : "w-20"
        }`}
      >
        {/* LOGO */}
        <div className="flex items-center gap-1 p-5 border-b">
          <img
            src={logo}
            alt="ACGC Logo"
            className="w-20 h-12 object-contain"
          />

          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-w-full opacity-100" : "max-w-0 opacity-0"}`}>
            <h1 className="text-lg font-bold text-red-700">
              ACGC ADMIN
            </h1>

            <p className="text-xs font-bold text-gray-700">
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
            className={`flex w-full items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-300 ease-in-out ${isOpen ? "justify-start" : "justify-center"}`}
          >
            <LogOut size={23} />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${isOpen ? "max-w-full opacity-100" : "max-w-0 opacity-0"}`}>
              Logout
            </span>
          </button>

        </nav>
      </aside>

      {/* LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

          <div className="bg-white w-[350px] rounded-xl p-6 shadow-lg">

            <h2 className="text-xl font-bold text-gray-800">
              Confirm Logout
            </h2>

            <p className="text-gray-500 mt-2">
              Are you sure you want to logout?
            </p>

            <div className="flex justify-end gap-3 mt-6">

              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>

              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Logout
              </button>

            </div>

          </div>

        </div>
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