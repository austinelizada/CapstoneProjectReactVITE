import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Search, Settings2, ShieldCheck } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import AdminPageHeader from "../../components/layout/AdminPageHeader";
import { useAuth } from "../../contexts/AuthContext";
import { recordActivity } from "@/lib/activityLog";
import { getAdminUsers, getSystemSettings, updateAdminUserAccess, updateSystemSettings } from "@/api/users";

const PERMISSIONS = [
  { key: "can_request_orders", label: "Can Request Orders", description: "Submit new glass/aluminum orders" },
  { key: "can_estimate_pricing", label: "Can Estimate Pricing", description: "Access the pricing estimator tool" },
  { key: "view_only_access", label: "View Only Access", description: "Read-only access to the account" },
  { key: "can_track_products", label: "Can Track Products", description: "Look up order status using a tracking code" },
  { key: "can_upload_feedback", label: "Can Upload/View Feedback", description: "Allow customers to view product feedback" },
  { key: "show_ratings_homepage", label: "Show Ratings on Homepage", description: "Display customer ratings on the homepage" },
];

const defaultPermissions = () => Object.fromEntries(PERMISSIONS.map(({ key }) => [key, key !== "view_only_access"]));

function Settings() {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebarOpen");
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [globalPermissions, setGlobalPermissions] = useState(defaultPermissions);
  const [globalOpen, setGlobalOpen] = useState(true);
  const [applyingGlobal, setApplyingGlobal] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    getSystemSettings()
      .then((response) => {
        setMaintenanceMode(response.maintenance_mode === true);
        if (response.global_permissions) {
          setGlobalPermissions((current) => ({ ...current, ...response.global_permissions }));
        }
      })
      .catch((error) => toast.error(error?.data?.message || error?.message || "Unable to load system maintenance mode."));
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await getAdminUsers({ role: activeTab, search });
      setUsers(response.users || []);
    } catch (error) {
      setUsers([]);
      toast.error(error?.data?.message || error?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadUsers, 250);
    return () => clearTimeout(timer);
  }, [activeTab, search]);

  const counts = useMemo(() => ({
    all: users.length,
    customer: users.filter((account) => account.role === "customer").length,
    skilled_worker: users.filter((account) => account.role === "skilled_worker").length,
    active: users.filter((account) => account.is_active !== false).length,
  }), [users]);

  const getPermissions = (account) => ({ ...defaultPermissions(), ...(account.access_permissions || {}) });

  const updateUser = async (account, patch) => {
    const accountId = account._id || account.id;
    const previous = account;
    const next = { ...account, access_permissions: { ...getPermissions(account), ...patch } };
    setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? next : item));
    setSavingId(accountId);
    try {
      const response = await updateAdminUserAccess(accountId, patch);
      setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? response.user : item));
      recordActivity(user, `Updated access permissions for ${account.first_name} ${account.last_name}.`, "Settings");
    } catch (error) {
      setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? previous : item));
      toast.error(error?.data?.message || error?.message || "Unable to update permissions.");
    } finally {
      setSavingId(null);
    }
  };

  const applyGlobalTemplate = async () => {
    if (!users.length) return;
    setApplyingGlobal(true);
    try {
      const results = await Promise.all(users.map((account) => updateAdminUserAccess(account._id || account.id, globalPermissions)));
      await updateSystemSettings({ global_permissions: globalPermissions });
      const updatedById = new Map(results.map((result) => [result.user._id, result.user]));
      setUsers((current) => current.map((account) => updatedById.get(account._id) || account));
      recordActivity(user, `Applied the global customer permissions template to ${users.length} users.`, "Settings");
      toast.success("Permissions applied to the current users.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to apply the permissions template.");
    } finally {
      setApplyingGlobal(false);
    }
  };

  const roleLabel = (role) => role === "skilled_worker" ? "Skilled Worker" : role === "customer" ? "Customer" : "Admin";

  const toggleMaintenanceMode = async () => {
    const nextMode = !maintenanceMode;
    setMaintenanceMode(nextMode);
    setSavingMaintenance(true);
    try {
      const response = await updateSystemSettings({ maintenance_mode: nextMode });
      setMaintenanceMode(response.maintenance_mode === true);
      recordActivity(user, `${nextMode ? "Enabled" : "Disabled"} system maintenance mode.`, "Settings");
      toast.success(nextMode ? "System maintenance mode enabled." : "System maintenance mode disabled.");
    } catch (error) {
      setMaintenanceMode(!nextMode);
      toast.error(error?.data?.message || error?.message || "Unable to update maintenance mode.");
    } finally {
      setSavingMaintenance(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Toaster position="bottom-right" />
      <Sidebar isOpen={isSidebarOpen} />
      <div className="flex min-h-0 flex-1 flex-col">
        <Navbar toggleSidebar={() => setIsSidebarOpen((open) => !open)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-6">
          <AdminPageHeader
            title="System Settings"
            description="Manage customer access, permissions, and account availability."
            stats={[
              { label: "Users", value: counts.all },
              { label: "Active", value: counts.active, color: "text-emerald-300" },
              { label: "Staff", value: counts.skilled_worker, color: "text-red-300" },
            ]}
          />

          <section className="mt-6 overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-red-100 bg-red-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-red-900 text-white"><Settings2 size={15} /></div>
                <div><h2 className="text-sm font-bold text-red-950">Global Customer Permissions</h2><p className="text-xs text-slate-500">Changes apply to the users currently shown below.</p></div>
              </div>
              <button type="button" onClick={() => setGlobalOpen((open) => !open)} className="inline-flex items-center gap-2 self-end rounded-full bg-red-100 px-3 py-2 text-xs font-bold text-red-900 hover:bg-red-200 sm:self-auto">{globalOpen ? "Collapse" : "Manage All"}<ChevronDown size={14} className={globalOpen ? "rotate-180" : ""} /></button>
            </div>
            {globalOpen && <>
              <div className="grid gap-2 p-4 md:grid-cols-2">{PERMISSIONS.map((permission) => <PermissionSwitch key={permission.key} permission={permission} checked={globalPermissions[permission.key]} onChange={(checked) => setGlobalPermissions((current) => ({ ...current, [permission.key]: checked }))} />)}</div>
              <div className={`mx-4 mb-4 flex items-center justify-between gap-4 rounded-lg border px-3 py-3 ${maintenanceMode ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                <div><p className={`text-xs font-bold ${maintenanceMode ? "text-amber-900" : "text-slate-700"}`}>System Maintenance Mode</p><p className="text-[10px] text-slate-500">Temporarily restrict customer activity across the platform.</p></div>
                <button type="button" role="switch" aria-checked={maintenanceMode} disabled={savingMaintenance} onClick={toggleMaintenanceMode} className={`relative h-5 w-9 shrink-0 rounded-full transition ${maintenanceMode ? "bg-amber-600" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${maintenanceMode ? "left-[18px]" : "left-0.5"}`} /></button>
              </div>
              <div className="flex flex-col gap-3 border-t border-dashed border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-amber-600">Changes update the selected users immediately.</p><button type="button" onClick={applyGlobalTemplate} disabled={applyingGlobal || !users.length} title={users.length ? `Apply these permission settings to ${users.length} users in the system` : "No users are available to update"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60">{applyingGlobal && <Loader2 size={14} className="animate-spin" />}{applyingGlobal ? "Saving system permissions..." : users.length ? `Apply & Save to ${users.length} Users` : "No Users to Update"}</button></div>
            </>}
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><div className="flex flex-wrap gap-1">{[{ key: "all", label: "All Users", count: counts.all }, { key: "customer", label: "Customers", count: counts.customer }, { key: "skilled_worker", label: "Skilled Workers", count: counts.skilled_worker }].map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeTab === tab.key ? "border border-red-900 bg-red-50 text-red-950" : "text-slate-600 hover:bg-slate-50"}`}>{tab.label} <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px]">{tab.count}</span></button>)}</div></section>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email..." className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" /></div><span className="text-xs text-slate-500">{loading ? "Loading users..." : `${users.length} users found`}</span></div>

          <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" /> Loading user access...</div> : users.length === 0 ? <div className="p-16 text-center"><ShieldCheck size={30} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-600">No users found</p><p className="mt-1 text-xs text-slate-400">Try another search or permission group.</p></div> : <div className="divide-y divide-slate-100">{users.map((account) => { const accountId = account._id || account.id; const permissions = getPermissions(account); return <article key={accountId} className="p-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-900">{(account.first_name || account.email || "U").charAt(0).toUpperCase()}</div><div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-900">{account.first_name} {account.last_name}</h3><p className="truncate text-xs text-slate-500">{account.email} · {roleLabel(account.role)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${account.is_active === false ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-800"}`}>{account.is_active === false ? "Inactive" : "Active"}</span></div><div className="grid gap-2 md:grid-cols-2 xl:w-[68%]">{PERMISSIONS.map((permission) => <PermissionSwitch key={permission.key} permission={permission} checked={permissions[permission.key]} disabled={savingId === accountId} onChange={(checked) => updateUser(account, { [permission.key]: checked })} compact />)}</div></div></article>; })}</div>}
          </section>
        </main>
      </div>
    </div>
  );
}

function PermissionSwitch({ permission, checked, onChange, disabled = false, compact = false }) {
  return <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${checked ? "border-red-200 bg-red-50/70" : "border-slate-200 bg-slate-50"} ${disabled ? "cursor-wait opacity-60" : "hover:border-red-300"}`}><span className="min-w-0"><span className={`block text-xs font-semibold ${checked ? "text-red-950" : "text-slate-600"}`}>{permission.label}</span>{!compact && <span className="block truncate text-[10px] text-slate-500">{permission.description}</span>}</span><button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-red-950" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} /></button></label>;
}

export default Settings;
