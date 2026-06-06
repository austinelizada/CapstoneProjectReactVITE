import { useEffect, useState } from "react";
import { getAdminOrders } from "@/api/orders";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [acceptedResp, declinedResp] = await Promise.all([
          getAdminOrders({ contract_status: "accepted" }),
          getAdminOrders({ contract_status: "declined" }),
        ]);
        const items = [
          ...(acceptedResp.orders || []).map((o) => ({ ...o, notificationType: "accepted", read: false })),
          ...(declinedResp.orders || []).map((o) => ({ ...o, notificationType: "declined", read: false })),
        ].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        setNotifications(items);
      } catch (err) {
        console.error(err);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <div className="p-6">
      <div className="bg-white rounded-3xl p-6 shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Notifications</h2>
        </div>

        <div>
          {loading ? (
            <div className="text-sm text-slate-500">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="text-sm text-slate-500">No notifications</div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <button
                  key={n._id || n.tracking}
                  onClick={() => navigate(`/site-inspection?view=${n._id || n.id || n.tracking}`)}
                  className={`w-full text-left p-3 rounded-xl border hover:bg-gray-50 flex gap-3 ${n.read ? "bg-white" : "bg-slate-50"}`}
                >
                  <div className="flex-shrink-0">
                    <Bell size={18} className={n.notificationType === "accepted" ? "text-emerald-600" : "text-red-600"} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-slate-900">{n.tracking}</div>
                      <div className="text-xs text-slate-400">{new Date(n.updatedAt || n.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">{n.notificationType === "accepted" ? `Customer accepted the contract for ₱${Number(n.contract_amount || n.total_amount || 0).toLocaleString()}` : "Customer declined the contract"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
