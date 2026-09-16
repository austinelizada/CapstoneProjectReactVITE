import { useState } from "react";
import { Menu, Bell, Moon, Sun } from "lucide-react";
import { useAdminTheme } from "@/contexts/AdminThemeContext";

function Navbar({ toggleSidebar }) {
  const { darkMode, toggleDarkMode } = useAdminTheme();

  return (
    <header className={`admin-navbar px-6 py-4 flex items-center justify-between shadow ${darkMode ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}>

      <div className="flex items-center gap-4">

        <button
          onClick={toggleSidebar}
          className={`p-2 rounded-lg ${darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100"}`}
          aria-label="Toggle sidebar"
        >
          <Menu size={24} />
        </button>

        <div>
          <h1 className="text-xl font-bold">
            Welcome Administrator
          </h1>
        </div>

      </div>

      <div className="flex items-center gap-4 relative">
        <button
          type="button"
          onClick={toggleDarkMode}
          className={`relative inline-flex h-10 w-[128px] shrink-0 items-center rounded-full border p-1 transition-all duration-500 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500/40 ${
            darkMode
              ? "border-black bg-black text-white hover:bg-slate-950"
              : "border-slate-300 bg-slate-200 text-slate-950 hover:bg-slate-300"
          }`}
          aria-label={darkMode ? "Switch to day mode" : "Switch to night mode"}
          aria-pressed={darkMode}
        >
          <span className={`absolute inset-y-1 flex w-[84px] items-center justify-center gap-1 text-[8px] font-black uppercase tracking-[0.06em] transition-all duration-500 ease-in-out ${
            darkMode ? "left-[40px] text-white" : "left-1 text-slate-950"
          }`}>
            {darkMode ? "Night Mode" : "Day Mode"}
          </span>
          <span className={`relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white text-black shadow-sm transition-all duration-500 ease-in-out ${
            darkMode ? "translate-x-0 border-slate-300" : "translate-x-[86px] border-slate-200"
          }`}>
            {darkMode ? <Moon size={18} strokeWidth={1.8} /> : <Sun size={18} strokeWidth={1.8} />}
          </span>
        </button>
        <NotificationMenu />
      </div>

    </header>
  );
}

export default Navbar;

function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [notifications] = useState([
    { id: 1, title: "New Order", message: "Order #1023 submitted", time: "2h", read: false },
    { id: 2, title: "Contract Response", message: "Customer accepted the contract", time: "1d", read: false },
    { id: 3, title: "Inspection Scheduled", message: "Site inspection set for 06/08", time: "3d", read: true },
  ]);
  const { darkMode } = useAdminTheme();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className={`px-4 py-2 rounded-xl flex items-center gap-2 ${open ? (darkMode ? "bg-slate-800 text-red-300" : "bg-gray-100 text-red-600") : (darkMode ? "hover:bg-slate-800" : "hover:bg-gray-100")}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell size={18} />
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-600 text-white text-xs font-semibold">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 w-80 border rounded shadow-lg z-20 max-h-96 overflow-y-auto ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white"}`}>
          {notifications.length === 0 ? (
            <div className={`px-4 py-6 text-center ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setOpen(false)}
                  className={`w-full text-left px-4 py-3 transition ${darkMode ? "hover:bg-slate-700" : "hover:bg-gray-50"}`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <Bell size={16} className={n.read ? "text-slate-400" : "text-amber-600"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${darkMode ? "text-white" : "text-slate-950"}`}>{n.title}</p>
                      <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                    </div>
                  </div>
                </button>
              ))}

            </div>
          )}
        </div>
      )}
    </div>
  );
}