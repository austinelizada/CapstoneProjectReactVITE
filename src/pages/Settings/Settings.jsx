import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, Check, Loader2, Search, Settings2, ShieldCheck, Users } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import AdminPageHeader from "../../components/layout/AdminPageHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminTheme } from "../../contexts/AdminThemeContext";
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

const normalizePermissions = (permissions) => {
  const normalized = { ...defaultPermissions(), ...(permissions || {}) };
  if (normalized.view_only_access) {
    PERMISSIONS.forEach(({ key }) => {
      normalized[key] = key === "view_only_access";
    });
  }
  return normalized;
};

function Settings() {
  const { user } = useAuth();
  const { darkMode } = useAdminTheme();
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
          setGlobalPermissions(normalizePermissions(response.global_permissions));
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

  const getPermissions = (account) => normalizePermissions(account.access_permissions);

  const updateGlobalPermission = (key, checked) => {
    setGlobalPermissions((current) => normalizePermissions({
      ...current,
      ...(key === "view_only_access" && checked
        ? Object.fromEntries(PERMISSIONS.map(({ key: permissionKey }) => [permissionKey, permissionKey === "view_only_access"]))
        : { [key]: checked }),
    }));
  };

  const updateUser = async (account, patch) => {
    const accountId = account._id || account.id;
    const previous = account;
    const nextPermissions = normalizePermissions({ ...getPermissions(account), ...patch });
    const next = { ...account, access_permissions: nextPermissions };
    const normalizedPatch = nextPermissions;
    setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? next : item));
    setSavingId(accountId);
    try {
      const response = await updateAdminUserAccess(accountId, normalizedPatch);
      setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? response.user : item));
      recordActivity(user, `Updated access permissions for ${account.first_name} ${account.last_name}.`, "Settings");
    } catch (error) {
      setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? previous : item));
      toast.error(error?.data?.message || error?.message || "Unable to update permissions.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleAccountStatus = async (account) => {
    const accountId = account._id || account.id;
    if (!accountId || accountId === user?._id || accountId === user?.id) return;

    const previous = account;
    const next = { ...account, is_active: account.is_active === false };
    setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? next : item));
    setSavingId(accountId);
    try {
      const response = await updateAdminUserAccess(accountId, { is_active: next.is_active });
      setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? response.user : item));
      recordActivity(user, `${next.is_active ? "Enabled" : "Disabled"} account for ${account.first_name} ${account.last_name}.`, "Settings");
      toast.success(next.is_active ? "Account enabled." : "Account disabled.");
    } catch (error) {
      setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? previous : item));
      toast.error(error?.data?.message || error?.message || "Unable to update account status.");
    } finally {
      setSavingId(null);
    }
  };

  const applyGlobalTemplate = async () => {
    if (!users.length) return;
    setApplyingGlobal(true);
    try {
      const normalizedPermissions = normalizePermissions(globalPermissions);
      const results = await Promise.all(users.map((account) => updateAdminUserAccess(account._id || account.id, normalizedPermissions)));
      await updateSystemSettings({ global_permissions: normalizedPermissions });
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
    <div className={`admin-settings settings-premium flex h-screen overflow-hidden ${darkMode ? "bg-slate-950 text-slate-100" : "bg-[#eef1f3] text-slate-900"}`}>
      <Toaster position="bottom-right" />
      <Sidebar isOpen={isSidebarOpen} />
      <div className="flex min-h-0 flex-1 flex-col">
        <Navbar toggleSidebar={() => setIsSidebarOpen((open) => !open)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AdminPageHeader
            title="System Settings"
            description="Manage customer access, permissions, and account availability."
            stats={[
              { label: "Users", value: counts.all },
              { label: "Active", value: counts.active, color: "text-emerald-300" },
              { label: "Staff", value: counts.skilled_worker, color: "text-red-300" },
            ]}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Platform status", value: maintenanceMode ? "Maintenance mode" : "Operating normally", icon: Activity, tone: maintenanceMode ? "amber" : "emerald" },
              { label: "Managed accounts", value: `${counts.all} accounts in view`, icon: Users, tone: "red" },
              { label: "Access template", value: `${Object.values(globalPermissions).filter(Boolean).length} of ${PERMISSIONS.length} enabled`, icon: Check, tone: "slate" },
            ].map(({ label, value, icon: Icon, tone }) => {
              const tones = {
                amber: darkMode ? "border-amber-800/70 bg-amber-950/30 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-700",
                emerald: darkMode ? "border-emerald-800/70 bg-emerald-950/30 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-700",
                red: darkMode ? "border-red-900/70 bg-red-950/30 text-red-300" : "border-red-200 bg-red-50 text-red-700",
                slate: darkMode ? "border-slate-700 bg-slate-900 text-slate-300" : "border-slate-200 bg-white text-slate-700",
              };
              return <div key={label} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${tones[tone]}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70"><Icon size={16} /></span><div className="min-w-0"><p className={`text-[10px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p><p className="mt-0.5 truncate text-sm font-bold">{value}</p></div></div>;
            })}
          </div>

          <section className={`mt-7 overflow-hidden rounded-[22px] border shadow-[0_18px_45px_-28px_rgba(15,23,42,0.65)] ${darkMode ? "border-slate-700 bg-slate-900" : "border-red-100 bg-white"}`}>
            <div className={`relative flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${darkMode ? "border-slate-700 bg-gradient-to-r from-slate-900 via-slate-900 to-red-950/40" : "border-red-100 bg-gradient-to-r from-red-50 via-white to-orange-50"}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-red-900 text-white shadow-lg shadow-red-950/20"><Settings2 size={17} /></div>
                <div><p className={`text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? "text-red-300" : "text-red-700"}`}>Access control</p><h2 className={`mt-1 text-base font-black ${darkMode ? "text-white" : "text-red-950"}`}>Global Customer Permissions</h2><p className={`mt-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Changes apply to the users currently shown below.</p></div>
              </div>
              <button type="button" onClick={() => setGlobalOpen((open) => !open)} className={`inline-flex items-center gap-2 self-end rounded-full border px-4 py-2 text-xs font-bold transition sm:self-auto ${darkMode ? "border-red-900/70 bg-red-950/50 text-red-200 hover:bg-red-900/60" : "border-red-200 bg-red-100 text-red-900 hover:bg-red-200"}`}>{globalOpen ? "Collapse" : "Manage All"}<ChevronDown size={14} className={`transition-transform ${globalOpen ? "rotate-180" : ""}`} /></button>
            </div>
            {globalOpen && <>
              <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-slate-800" : "border-slate-100"}`}><div><p className={`text-[10px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Default customer access profile</p><p className={`mt-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Choose which capabilities are available by default.</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{Object.values(globalPermissions).filter(Boolean).length} enabled</span></div>
              <div className="grid gap-3 p-4 md:grid-cols-2">{PERMISSIONS.map((permission, index) => <PermissionSwitch key={permission.key} permission={permission} index={index} checked={globalPermissions[permission.key]} disabled={globalPermissions.view_only_access && permission.key !== "view_only_access"} onChange={(checked) => updateGlobalPermission(permission.key, checked)} darkMode={darkMode} />)}</div>
              <div className={`mx-4 mb-4 flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 ${maintenanceMode ? (darkMode ? "border-amber-700/70 bg-amber-950/40" : "border-amber-300 bg-amber-50") : (darkMode ? "border-slate-700 bg-slate-800/70" : "border-slate-200 bg-slate-50")}`}>
                <div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${maintenanceMode ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]" : "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"}`} /><div><p className={`text-xs font-black ${maintenanceMode ? (darkMode ? "text-amber-200" : "text-amber-900") : (darkMode ? "text-slate-200" : "text-slate-700")}`}>System Maintenance Mode</p><p className={`text-[10px] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{maintenanceMode ? "Customer activity is temporarily restricted." : "Platform is operating normally."}</p></div></div>
                <button type="button" role="switch" aria-checked={maintenanceMode} disabled={savingMaintenance} onClick={toggleMaintenanceMode} className={`relative h-6 w-11 shrink-0 rounded-full transition ${maintenanceMode ? "bg-amber-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${maintenanceMode ? "left-[22px]" : "left-1"}`} /></button>
              </div>
              <div className={`flex flex-col gap-3 border-t border-dashed px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-slate-700" : "border-slate-200"}`}><p className={`text-xs ${darkMode ? "text-amber-300" : "text-amber-600"}`}>Changes update the selected users immediately.</p><button type="button" onClick={applyGlobalTemplate} disabled={applyingGlobal || !users.length} title={users.length ? `Apply these permission settings to ${users.length} users in the system` : "No users are available to update"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-950 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60">{applyingGlobal && <Loader2 size={14} className="animate-spin" />}{applyingGlobal ? "Saving system permissions..." : users.length ? `Apply & Save to ${users.length} Users` : "No Users to Update"}</button></div>
            </>}
          </section>

          <section className={`mt-4 rounded-2xl border p-2 shadow-sm ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap gap-1">{[{ key: "all", label: "All Users", count: counts.all }, { key: "customer", label: "Customers", count: counts.customer }, { key: "skilled_worker", label: "Skilled Workers", count: counts.skilled_worker }].map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${activeTab === tab.key ? (darkMode ? "border border-red-700 bg-red-950/60 text-red-200" : "border border-red-900 bg-red-50 text-red-950") : (darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-50")}`}>{tab.label} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.key ? (darkMode ? "bg-red-900 text-red-100" : "bg-red-200 text-red-900") : (darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200")}`}>{tab.count}</span></button>)}</div></section>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email..." className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 ${darkMode ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500" : "border-slate-200 bg-white"}`} /></div><span className={`text-xs font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{loading ? "Loading users..." : `${users.length} users found`}</span></div>

          <section className={`mt-4 overflow-hidden rounded-[22px] border shadow-[0_18px_45px_-28px_rgba(15,23,42,0.55)] ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
            {loading ? <div className={`flex items-center justify-center gap-2 p-16 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}><Loader2 size={18} className="animate-spin" /> Loading user access...</div> : users.length === 0 ? <div className="p-16 text-center"><ShieldCheck size={30} className="mx-auto text-slate-300" /><p className={`mt-3 text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-600"}`}>No users found</p><p className="mt-1 text-xs text-slate-400">Try another search or permission group.</p></div> : <div className="overflow-x-auto"><table className="min-w-[1180px] w-full border-collapse text-left"><thead className={darkMode ? "bg-slate-800/80" : "bg-slate-50"}><tr className={`border-b ${darkMode ? "border-slate-700" : "border-slate-200"}`}><th className={`sticky left-0 z-10 w-[280px] px-5 py-4 text-[10px] font-black uppercase tracking-[0.16em] ${darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-50 text-slate-500"}`}>Account</th>{PERMISSIONS.map((permission) => <th key={permission.key} className={`w-[150px] px-3 py-4 text-center text-[10px] font-black uppercase tracking-[0.12em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{permission.label.replace("Can ", "").replace("Show ", "")}</th>)}</tr></thead><tbody className={`divide-y ${darkMode ? "divide-slate-800" : "divide-slate-100"}`}>{users.map((account) => { const accountId = account._id || account.id; const permissions = getPermissions(account); const isCurrentAccount = accountId === user?._id || accountId === user?.id; const accountActive = account.is_active !== false; return <tr key={accountId} className={`transition ${darkMode ? "hover:bg-slate-800/50" : "hover:bg-slate-50"}`}><td className={`sticky left-0 z-10 px-5 py-4 ${darkMode ? "bg-slate-900" : "bg-white"}`}><div className="flex min-w-[245px] items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${darkMode ? "bg-red-950 text-red-300" : "bg-[#f5ebe4] text-[#17324d]"}`}>{(account.first_name || account.email || "U").charAt(0).toUpperCase()}</div><div className="min-w-0"><p className={`truncate text-sm font-black ${darkMode ? "text-white" : "text-slate-900"}`}>{account.first_name} {account.last_name}</p><p className={`truncate text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{account.email}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${accountActive ? (darkMode ? "bg-emerald-950/70 text-emerald-300" : "bg-emerald-50 text-emerald-700") : (darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")}`}>{accountActive ? roleLabel(account.role) : "Disabled"}</span></div><button type="button" role="switch" aria-checked={accountActive} onClick={() => toggleAccountStatus(account)} disabled={isCurrentAccount || savingId === accountId} title={isCurrentAccount ? "You cannot deactivate your own account" : accountActive ? "Deactivate account" : "Activate account"} aria-label={isCurrentAccount ? "Your account cannot be deactivated" : accountActive ? "Deactivate account" : "Activate account"} className={`relative ml-auto inline-flex h-7 w-[104px] shrink-0 items-center rounded-full border p-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${accountActive ? (darkMode ? "border-sky-700 bg-sky-900/80" : "border-sky-700 bg-sky-700") : (darkMode ? "border-slate-600 bg-slate-700" : "border-slate-300 bg-slate-200")}`}><span className={`absolute top-1 flex h-5 w-[46px] items-center justify-center rounded-full bg-white text-[8px] font-black uppercase tracking-[0.08em] shadow-[0_1px_4px_rgba(15,23,42,0.28)] transition-all duration-200 ${accountActive ? "left-[52px] text-sky-700" : "left-1 text-slate-500"}`}>{accountActive ? "Active" : "Disabled"}</span><span className={`pointer-events-none absolute top-1 h-5 w-5 rounded-full bg-white/95 shadow-sm transition-all duration-200 ${accountActive ? "left-[76px]" : "left-1"}`} /></button></div></td>{PERMISSIONS.map((permission, index) => <td key={permission.key} className="px-3 py-4 text-center"><PermissionSwitch permission={permission} index={index} checked={permissions[permission.key]} disabled={savingId === accountId || (permissions.view_only_access && permission.key !== "view_only_access")} onChange={(checked) => updateUser(account, { [permission.key]: checked })} compact tableMode darkMode={darkMode} /></td>)}</tr>; })}</tbody></table></div>}
          </section>
        </main>
      </div>
    </div>
  );
}

function PermissionSwitch({ permission, index = 0, checked, onChange, disabled = false, compact = false, tableMode = false, darkMode = false }) {
  if (tableMode) {
    return <button type="button" role="switch" aria-label={permission.label} aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative inline-flex h-7 w-12 rounded-full border-0 p-0 shadow-inner transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${checked ? "bg-sky-700" : (darkMode ? "bg-slate-600" : "bg-slate-300")}`}><span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(15,23,42,0.28)] transition-transform duration-200 ease-out ${checked ? "translate-x-5" : "translate-x-0"}`} /></button>;
  }

  return <label className={`group flex min-h-[74px] cursor-pointer items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition-all ${checked ? (darkMode ? "border-sky-700/70 bg-sky-950/25 shadow-[inset_3px_0_0_#67a7c7]" : "border-sky-200 bg-sky-50/80 shadow-[inset_3px_0_0_#2f6f91]") : (darkMode ? "border-slate-700 bg-slate-800/60 hover:border-slate-600" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm")} ${disabled ? "cursor-wait opacity-60" : ""}`}><span className="flex min-w-0 items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${checked ? (darkMode ? "bg-sky-900/70 text-sky-200" : "bg-sky-100 text-sky-800") : (darkMode ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500")}`}>{String(index + 1).padStart(2, "0")}</span><span className="min-w-0"><span className={`block text-xs font-bold ${checked ? (darkMode ? "text-sky-100" : "text-slate-900") : (darkMode ? "text-slate-300" : "text-slate-700")}`}>{permission.label}</span>{!compact && <span className={`mt-1 block truncate text-[10px] ${darkMode ? "text-slate-500" : "text-slate-500"}`}>{permission.description}</span>}{!compact && <span className={`mt-1 block text-[9px] font-bold uppercase tracking-wider ${checked ? (darkMode ? "text-sky-300" : "text-sky-700") : (darkMode ? "text-slate-600" : "text-slate-400")}`}>{checked ? "Available" : "Restricted"}</span>}</span></span><button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full border-0 p-0 shadow-inner transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${checked ? "bg-sky-700" : (darkMode ? "bg-slate-600" : "bg-slate-300")}`}><span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-[0_1px_4px_rgba(15,23,42,0.28)] transition-transform duration-200 ease-out ${checked ? "translate-x-5" : "translate-x-0"}`} /></button></label>;
}

export default Settings;
