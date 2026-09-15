import { useState, useEffect } from "react";
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
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${darkMode ? "bg-slate-800 text-amber-300 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={darkMode}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
        </button>
        <NotificationMenu />
      </div>

    </header>
  );
}

export default Navbar;

function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Mock notifications; replace with real API call when available
    setNotifications([
      { id: 1, title: "New Order", message: "Order #1023 submitted", time: "2h", read: false },
      { id: 2, title: "Contract Response", message: "Customer accepted the contract", time: "1d", read: false },
      { id: 3, title: "Inspection Scheduled", message: "Site inspection set for 06/08", time: "3d", read: true },
    ]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className={`px-4 py-2 rounded-xl flex items-center gap-2 ${open ? "bg-gray-100 text-red" : "hover:bg-gray-100"}`}
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
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-20 max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-600">
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setOpen(false)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition"
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <Bell size={16} className={n.read ? "text-slate-400" : "text-amber-600"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950 truncate">{n.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
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