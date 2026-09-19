import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Bell, Moon, Sun, ClipboardCheck, CheckCircle2, XCircle, ShoppingCart, CheckCheck } from "lucide-react";
import { getAdminOrders } from "@/api/orders";
import { formatDateTimeToMMDDYYYY } from "@/lib/dateUtils";
import { useAdminTheme } from "@/contexts/AdminThemeContext";

const ADMIN_READ_NOTIFICATIONS_KEY = "acgc-admin-read-notifications";

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
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const { darkMode } = useAdminTheme();
  const navigate = useNavigate();

  const getReadNotificationIds = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(ADMIN_READ_NOTIFICATIONS_KEY) || "[]"));
    } catch {
      return new Set();
    }
  };

  useEffect(() => {
    let active = true;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const [newOrders, inspections, accepted, declined] = await Promise.all([
          getAdminOrders({ status: "order_submitted" }),
          getAdminOrders({ status: "site_inspection" }),
          getAdminOrders({ contract_status: "accepted" }),
          getAdminOrders({ contract_status: "declined" }),
        ]);

        const readNotificationIds = getReadNotificationIds();
        const items = [
          ...(newOrders.orders || []).map((order) => ({
            id: `${order._id}-new-order`,
            title: "New order request",
            message: `${order.tracking || "An order"} is waiting for approval.`,
            icon: ShoppingCart,
            color: "text-blue-600",
            category: "orders",
            path: "/dashboard",
            date: order.createdAt,
          })),
          ...(inspections.orders || []).map((order) => ({
            id: `${order._id}-inspection`,
            title: "Inspection needs attention",
            message: `${order.tracking || "A project"} is ready for site inspection.`,
            icon: ClipboardCheck,
            color: "text-amber-600",
            category: "inspections",
            path: "/site-inspection",
            date: order.updatedAt || order.createdAt,
          })),
          ...(accepted.orders || []).map((order) => ({
            id: `${order._id}-accepted`,
            title: "Contract accepted",
            message: `Customer accepted ${order.tracking || "a contract"}.`,
            icon: CheckCircle2,
            color: "text-emerald-600",
            category: "accepted",
            path: `/site-inspection?view=${order._id || order.id || order.tracking}`,
            date: order.updatedAt || order.createdAt,
          })),
          ...(declined.orders || []).map((order) => ({
            id: `${order._id}-declined`,
            title: "Contract declined",
            message: `Customer declined ${order.tracking || "a contract"}.`,
            icon: XCircle,
            color: "text-red-600",
            category: "declined",
            path: `/site-inspection?view=${order._id || order.id || order.tracking}`,
            date: order.updatedAt || order.createdAt,
          })),
        ]
          .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
          .slice(0, 8)
          .map((item) => ({ ...item, read: readNotificationIds.has(item.id) }));

        if (active) setNotifications(items);
      } catch (error) {
        console.error("Failed to load admin notifications:", error);
        if (active) setNotifications([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchNotifications();
    return () => {
      active = false;
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = notifications.filter((notification) => (
    notificationFilter === "all" || notification.category === notificationFilter
  ));
  const adminFilterOptions = [
    ["all", "All"],
    ["orders", "Orders"],
    ["inspections", "Inspections"],
    ["accepted", "Accepted"],
    ["declined", "Declined"],
  ];

  const openNotification = (notification) => {
    setNotifications((current) => current.map((item) => (
      item.id === notification.id ? { ...item, read: true } : item
    )));
    const readNotificationIds = getReadNotificationIds();
    readNotificationIds.add(notification.id);
    localStorage.setItem(ADMIN_READ_NOTIFICATIONS_KEY, JSON.stringify([...readNotificationIds]));
    window.dispatchEvent(new Event("admin-notifications-updated"));
    setOpen(false);
    navigate(notification.path);
  };

  const markAllNotificationsRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    const readNotificationIds = getReadNotificationIds();
    notifications.forEach((notification) => readNotificationIds.add(notification.id));
    localStorage.setItem(ADMIN_READ_NOTIFICATIONS_KEY, JSON.stringify([...readNotificationIds]));
    window.dispatchEvent(new Event("admin-notifications-updated"));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className={`relative rounded-xl p-2.5 transition ${open || unreadCount > 0 ? (darkMode ? "bg-red-950/60 text-red-300 ring-1 ring-red-400/60" : "bg-red-50 text-red-600 ring-1 ring-red-200") : (darkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-gray-100")}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={23} strokeWidth={2.2} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white shadow-md shadow-red-500/40">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 w-96 overflow-hidden rounded-2xl border shadow-xl z-20 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
          <div className={`flex items-center justify-between border-b px-4 py-3 ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
            <div>
              <p className={`text-sm font-bold ${darkMode ? "text-white" : "text-slate-950"}`}>Admin activity</p>
              <p className="mt-0.5 text-xs text-slate-400">Actions that need your attention</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600">{unreadCount} new</span>}
              <button
                type="button"
                onClick={markAllNotificationsRead}
                disabled={unreadCount === 0}
                className={`inline-flex items-center gap-1 text-xs font-semibold transition ${unreadCount === 0 ? "cursor-not-allowed text-slate-400" : darkMode ? "text-red-300 hover:text-white" : "text-red-600 hover:text-red-700"}`}
              >
                <CheckCheck size={14} />
                Mark all as read
              </button>
            </div>
          </div>

          <div className={`flex flex-wrap gap-1 border-b px-3 py-2 ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
            {adminFilterOptions.map(([filter, label]) => {
              const count = filter === "all"
                ? notifications.length
                : notifications.filter((notification) => notification.category === filter).length;

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setNotificationFilter(filter)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    notificationFilter === filter
                      ? darkMode
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-950"
                      : darkMode
                        ? "text-slate-300 hover:bg-slate-700"
                        : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className={`px-4 py-8 text-center text-sm ${darkMode ? "text-slate-300" : "text-slate-500"}`}>Loading admin activity...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className={`px-4 py-6 text-center ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
              <Bell size={22} className="mx-auto mb-2 text-slate-400" />
              <p>{notificationFilter === "all" ? "No action items right now" : `No ${notificationFilter} notifications`}</p>
            </div>
          ) : (
            <div className="max-h-96 divide-y overflow-y-auto">
              {filteredNotifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`w-full px-4 py-3 text-left transition ${darkMode ? "hover:bg-slate-700" : "hover:bg-slate-50"} ${n.read ? "opacity-65" : ""}`}
                >
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <n.icon size={17} className={n.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${darkMode ? "text-white" : "text-slate-950"}`}>{n.title}</p>
                      <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>{n.message}</p>
                      <p className="mt-1 text-xs text-slate-400">{n.date ? formatDateTimeToMMDDYYYY(n.date) : "Recently"}</p>
                    </div>
                  </div>
                </button>
              ))}

            </div>
          )}
          <button
            type="button"
            onClick={() => { setOpen(false); navigate("/notifications"); }}
            className={`w-full border-t px-4 py-3 text-center text-sm font-semibold transition ${darkMode ? "border-slate-700 text-red-300 hover:bg-slate-700" : "border-slate-100 text-red-600 hover:bg-red-50"}`}
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}