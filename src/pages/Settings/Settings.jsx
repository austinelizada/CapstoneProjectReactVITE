import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CircleCheck,
  Database,
  Download,
  History,
  Loader2,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { RadioGroup } from "radix-ui";
import toast, { Toaster } from "react-hot-toast";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";
import AdminPageHeader from "../../components/layout/AdminPageHeader";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminTheme } from "../../contexts/AdminThemeContext";
import { recordActivity } from "@/lib/activityLog";
import {
  createSystemBackup,
  deleteSystemBackup,
  downloadSystemBackup,
  getAdminUsers,
  getSystemSettings,
  restoreSystemBackup,
  updateAdminUserAccess,
  updateSystemSettings,
} from "@/api/users";

const PERMISSIONS = [
  { key: "can_request_orders", label: "Can Request Orders", description: "Submit new glass/aluminum orders" },
  { key: "can_estimate_pricing", label: "Can Estimate Pricing", description: "Access the pricing estimator tool" },
  { key: "view_only_access", label: "View Only Access", description: "Read-only access to the account" },
  { key: "can_track_products", label: "Can Track Products", description: "Look up order status using a tracking code" },
  { key: "can_upload_feedback", label: "Can Upload/View Feedback", description: "Allow customers to view product feedback" },
  { key: "show_ratings_homepage", label: "Show Ratings on Homepage", description: "Display customer ratings on the homepage" },
];

const STAFF_MODULES = [
  { key: "dashboard", label: "Dashboard", actions: [{ key: "view", label: "View", enabled: true }] },
  { key: "product_management", label: "Product Management", actions: [{ key: "view", label: "View", enabled: true }, { key: "add", label: "Add" }, { key: "edit", label: "Edit" }, { key: "delete", label: "Delete" }] },
  { key: "site_inspection", label: "Site Inspection", enabled: false, actions: [{ key: "view", label: "View" }, { key: "view_details", label: "View Details" }, { key: "edit", label: "Edit" }, { key: "cancel", label: "Cancel" }, { key: "generate_contract", label: "Generate Contract" }, { key: "send_email", label: "Send Email" }, { key: "download_contract", label: "Download Contract" }, { key: "manual_approve", label: "Manual Approve" }] },
  { key: "progress_monitoring", label: "Progress Monitoring", actions: [{ key: "view", label: "View", enabled: true }, { key: "view_details", label: "View Details", enabled: true }, { key: "edit", label: "Edit" }, { key: "delete_proof", label: "Delete Proof" }] },
  { key: "transactions", label: "Transactions", actions: [{ key: "view", label: "View", enabled: true }, { key: "view_details", label: "View Details", enabled: true }, { key: "edit", label: "Edit" }, { key: "view_contract", label: "View Contract" }, { key: "download_contract", label: "Download Contract" }, { key: "send_email", label: "Send Email" }] },
  { key: "settings", label: "Settings", actions: [{ key: "view", label: "View", enabled: true }, { key: "manage_access", label: "Manage Access", enabled: true }, { key: "back_up", label: "Back Up", enabled: true }] },
  { key: "profile", label: "Profile", actions: [{ key: "view", label: "View", enabled: true }, { key: "edit", label: "Edit" }] },
];
const STAFF_SUBROLES = ["Helper", "Installer", "Fabricator", "Site Inspector", "Supervisor"];

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

const defaultStaffAccess = () => ({
  profile_version: 2,
  subrole: "Helper",
  custom_subroles: [],
  modules: Object.fromEntries(STAFF_MODULES.map(({ key, enabled = true, actions }) => [key, {
    enabled,
    actions: Object.fromEntries(actions.map(({ key: actionKey, enabled: actionEnabled = false }) => [actionKey, actionEnabled])),
  }])),
});

const normalizeStaffAccess = (staffAccess = {}) => {
  const defaults = defaultStaffAccess();
  const needsSettingsAccessMigration = Number(staffAccess.profile_version || 0) < 2;
  return {
    profile_version: 2,
    subrole: staffAccess.subrole || defaults.subrole,
    custom_subroles: Array.isArray(staffAccess.custom_subroles) ? staffAccess.custom_subroles : [],
    modules: Object.fromEntries(STAFF_MODULES.map(({ key, actions }) => {
      const moduleAccess = staffAccess.modules?.[key] || defaults.modules[key];
      return [key, {
        enabled: key === "settings" && needsSettingsAccessMigration ? true : moduleAccess.enabled === true,
        actions: Object.fromEntries(actions.map(({ key: actionKey }) => [
          actionKey,
          key === "settings" && needsSettingsAccessMigration
            ? true
            : typeof moduleAccess.actions?.[actionKey] === "boolean"
              ? moduleAccess.actions[actionKey]
              : defaults.modules[key].actions[actionKey],
        ])),
      }];
    })),
  };
};

function Settings() {
  const { user } = useAuth();
  const { darkMode } = useAdminTheme();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const canManageAccess = isAdmin || (user?.role === "skilled_worker" && user.staff_access?.modules?.settings?.enabled === true && user.staff_access.modules.settings.actions?.manage_access === true);
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
  const [permissionAccount, setPermissionAccount] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState(null);
  const [staffAccount, setStaffAccount] = useState(null);
  const [staffDraft, setStaffDraft] = useState(null);
  const [expandedStaffModule, setExpandedStaffModule] = useState(null);
  const [customSubroleInput, setCustomSubroleInput] = useState("");
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [globalPermissions, setGlobalPermissions] = useState(defaultPermissions);
  const [globalOpen, setGlobalOpen] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [loadingBackupSettings, setLoadingBackupSettings] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("user-management");
  const backupOptions = [
    { id: "weekly", label: "Weekly", description: "Every Sunday at midnight" },
    { id: "monthly", label: "Monthly", description: "1st of every month" },
    { id: "yearly", label: "Yearly", description: "December 31st at midnight" },
  ];

  const getDefaultBackupState = () => {
    return {
      selectedSchedule: "weekly",
      lastBackupAt: null,
      status: null,
      backups: [],
    };
  };

  const [backupState, setBackupState] = useState(getDefaultBackupState);
  const settingsTabs = [
    { key: "user-management", label: "User Management" },
    { key: "backup-recovery", label: "Backup & Recovery" },
  ];
  const isOwnStaffAccount = Boolean(
    staffAccount &&
    String(staffAccount._id || staffAccount.id || "") === String(user?._id || user?.id || "")
  );

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
        setBackupState({
          selectedSchedule: ["weekly", "monthly", "yearly"].includes(response.backup_schedule) ? response.backup_schedule : "weekly",
          status: response.backup_status || null,
          lastBackupAt: response.last_backup_at || null,
          backups: Array.isArray(response.backup_history) ? response.backup_history : [],
        });
      })
      .catch((error) => toast.error(error?.data?.message || error?.message || "Unable to load system settings."))
      .finally(() => setLoadingBackupSettings(false));
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await getAdminUsers({ role: activeTab, search });
      setUsers((response.users || []).map((account) => ({ ...account, is_active: true })));
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
    staff: users.filter((account) => account.role === "skilled_worker").length,
    helper: users.filter((account) => account.role === "helper").length,
    skilled_worker: users.filter((account) => account.role === "skilled_worker").length,
    active: users.length,
  }), [users]);

  const displayUsers = useMemo(() => {
    const authAdmin = user && (user.role === "admin" || user.role === "super_admin")
      ? {
          ...user,
          _id: user._id || user.id,
          id: user.id || user._id,
          first_name: user.first_name || "Admin",
          last_name: user.last_name || "",
          email: user.email || "",
          role: user.role || "admin",
          is_active: true,
          access_permissions: normalizePermissions(user.access_permissions || defaultPermissions()),
        }
      : null;
    if (!authAdmin) return users;
    const seenIds = new Set([authAdmin._id, authAdmin.id].filter(Boolean));
    const realUsers = users.filter((account) => {
      const accountId = account._id || account.id;
      return accountId && !seenIds.has(accountId);
    });
    return [authAdmin, ...realUsers];
  }, [users, user]);

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
    setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? next : item));
    setSavingId(accountId);
    try {
      const response = await updateAdminUserAccess(accountId, nextPermissions);
      setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? response.user : item));
      recordActivity(user, `Updated access permissions for ${account.first_name} ${account.last_name}.`, "Settings");
      return true;
    } catch (error) {
      setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? previous : item));
      toast.error(error?.data?.message || error?.message || "Unable to update permissions.");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const renderBackupRecovery = (metrics) => (
    <>
          {activeSettingsTab === "backup-recovery" && (
            <div className="mt-7 min-w-0 space-y-6">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/[0.08] text-brand dark:bg-brand-dark-fill/20 dark:text-brand-dark-text">
                    <Calendar aria-hidden="true" className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Last backup</div>
                    <div className="mt-1 text-base font-medium text-foreground">{metrics.lastBackupAt ? formatBackupDateShort(metrics.lastBackupAt) : "No backup"}</div>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${metrics.status === "Success" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    <History aria-hidden="true" className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Backup status</div>
                    <div className={`mt-1 inline-flex items-center gap-2 text-base font-medium ${metrics.status === "Success" ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                      <span className={`size-2 rounded-full ${metrics.status === "Success" ? "bg-green-600" : "bg-muted-foreground"}`} />
                      {metrics.status}
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    <Database aria-hidden="true" className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Backup snapshots</div>
                    <div className="mt-1 text-base font-medium text-foreground">{metrics.totalBackups} backups</div>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-700 dark:text-green-400">
                    <CircleCheck aria-hidden="true" className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Success rate</div>
                    <div className="mt-1 text-base font-medium text-foreground">{metrics.successRate}%</div>
                  </div>
                </div>
              </div>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 id="backup-schedule-heading" className="text-[17px] font-medium text-foreground">Backup Schedule</h3>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                  <RadioGroup.Root
                    value={backupState.selectedSchedule}
                    onValueChange={handleScheduleChange}
                    disabled={loadingBackupSettings}
                    aria-labelledby="backup-schedule-heading"
                    className="contents"
                  >
                    {backupOptions.map((option) => {
                      const isSelected = backupState.selectedSchedule === option.id;
                      const ScheduleIcon = {
                        weekly: CalendarDays,
                        monthly: CalendarRange,
                        yearly: CalendarClock,
                      }[option.id];

                      return (
                        <label
                          key={option.id}
                          htmlFor={`backup-schedule-${option.id}`}
                          className="has-[[data-state=checked]]:border-[1.5px] has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand/[0.08] flex min-h-[84px] cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background p-4 transition-colors motion-reduce:transition-none dark:has-[[data-state=checked]]:border-brand-dark-text dark:has-[[data-state=checked]]:bg-brand-dark-fill/15"
                        >
                          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${isSelected ? "bg-brand text-white dark:bg-brand-dark-fill" : "bg-muted text-muted-foreground"}`}>
                            <ScheduleIcon aria-hidden="true" className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-medium text-foreground">{option.label}</span>
                            <span className="mt-1 block text-[13px] text-muted-foreground">{option.description}</span>
                          </span>
                          <RadioGroup.Item
                            id={`backup-schedule-${option.id}`}
                            value={option.id}
                            aria-label={option.label}
                            className="flex size-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/50 text-brand outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-brand motion-reduce:transition-none dark:text-brand-dark-text dark:data-[state=checked]:border-brand-dark-text"
                          >
                            <RadioGroup.Indicator className="flex items-center justify-center">
                              <span className="size-2.5 rounded-full bg-current" />
                            </RadioGroup.Indicator>
                          </RadioGroup.Item>
                        </label>
                      );
                    })}
                  </RadioGroup.Root>
                  <button
                    type="button"
                    onClick={handleCreateBackup}
                    disabled={loadingBackupSettings || creatingBackup}
                    className="flex min-h-[84px] items-center gap-3 rounded-2xl border border-brand/50 bg-brand/[0.08] p-4 text-left transition-colors hover:border-brand hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none dark:border-brand-dark-text/50 dark:bg-brand-dark-fill/15 dark:hover:bg-brand-dark-fill/25"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white dark:bg-brand-dark-fill">
                      {creatingBackup ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Database aria-hidden="true" className="size-5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium text-foreground">Full System</span>
                      <span className="mt-1 block text-[13px] text-muted-foreground">Complete system snapshot</span>
                    </span>
                    <span className="text-xs font-semibold text-brand dark:text-brand-dark-text">{creatingBackup ? "Creating..." : "Create"}</span>
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[17px] font-medium text-foreground">Backup History</h3>
                <div className="overflow-hidden rounded-2xl border border-border bg-background">
                  <div className="overflow-x-auto">
                    <table className="min-w-[680px] w-full border-collapse text-left">
                      <thead className="bg-muted/50">
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Backup Name</th>
                          <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Date</th>
                          <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Type</th>
                          <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Size</th>
                          <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(backupState.backups || []).map((backup) => (
                          <tr key={backup.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/50 motion-reduce:transition-none">
                            <td className="px-4 py-3 font-mono text-[13px] text-foreground">{backup.name}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{formatBackupDateShort(backup.date)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${backup.type === "Full System" ? "border-brand/50 bg-brand/[0.08] text-brand dark:border-brand-dark-text/50 dark:bg-brand-dark-fill/15 dark:text-brand-dark-text" : "border-border bg-muted text-muted-foreground"}`}>{backup.type}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">{formatBackupSize(backup.size)}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                                <span className="size-1.5 rounded-full bg-green-500" />
                                {backup.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => handleDownloadBackup(backup)} className="inline-flex size-9 items-center justify-center rounded-[10px] bg-blue-500/10 text-blue-700 transition-colors hover:bg-blue-600 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none dark:text-blue-400 dark:hover:text-white" aria-label="Download backup">
                                  <Download aria-hidden="true" className="size-5" />
                                </button>
                                <button type="button" onClick={() => handleRestoreBackup(backup.id)} className="inline-flex size-9 items-center justify-center rounded-[10px] bg-brand/[0.08] text-brand transition-colors hover:bg-brand hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none dark:bg-brand-dark-fill/15 dark:text-brand-dark-text dark:hover:bg-brand-dark-fill dark:hover:text-white" aria-label="Restore backup">
                                  <RotateCcw aria-hidden="true" className="size-5" />
                                </button>
                                <button type="button" onClick={() => handleDeleteBackup(backup.id)} className="inline-flex size-9 items-center justify-center rounded-[10px] bg-red-500/10 text-red-700 transition-colors hover:bg-red-600 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none dark:text-red-400 dark:hover:text-white" aria-label="Delete backup">
                                  <Trash2 aria-hidden="true" className="size-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {(backupState.backups || []).length === 0 && (
                          <tr>
                            <td colSpan="6" className="px-4 py-6 text-center text-sm text-muted-foreground">
                              {loadingBackupSettings ? "Loading backup history..." : "No backup snapshots yet. Create your first backup to get started."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          )}
    </>
  );

  const togglePermissionDraft = (key, checked) => {
    setPermissionDraft((current) => {
      const nextPermissions = key === "view_only_access" && checked
        ? Object.fromEntries(PERMISSIONS.map(({ key: permissionKey }) => [permissionKey, permissionKey === "view_only_access"]))
        : {
            ...current,
            ...(key !== "view_only_access" && checked ? { view_only_access: false } : {}),
            [key]: checked,
          };
      return normalizePermissions(nextPermissions);
    });
  };

  const savePermissionMatrix = async () => {
    if (!permissionAccount || !permissionDraft) return;
    const saved = await updateUser(permissionAccount, permissionDraft);
    if (saved) {
      toast.success("Customer permissions saved.");
      setPermissionAccount(null);
      setPermissionDraft(null);
    }
  };

  const upgradeCustomerToStaff = async () => {
    if (!permissionAccount) return;
    const accountId = permissionAccount._id || permissionAccount.id;
    setSavingId(accountId);
    try {
      const response = await updateAdminUserAccess(accountId, { role: "skilled_worker" });
      setUsers((current) => current.map((item) => (item._id || item.id) === accountId ? response.user : item));
      recordActivity(user, `Upgraded ${permissionAccount.first_name} ${permissionAccount.last_name} to staff.`, "Settings");
      toast.success("Customer upgraded to staff.");
      setPermissionAccount(null);
      setPermissionDraft(null);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to upgrade customer to staff.");
    } finally {
      setSavingId(null);
    }
  };

  const openPermissionMatrix = (account) => {
    setPermissionAccount(account);
    setPermissionDraft(getPermissions(account));
  };

  const openStaffAccess = (account) => {
    setStaffAccount(account);
    setStaffDraft(normalizeStaffAccess(account.staff_access));
    setExpandedStaffModule(null);
    setCustomSubroleInput("");
  };

  const updateStaffModule = (moduleKey, update) => {
    setStaffDraft((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [moduleKey]: { ...current.modules[moduleKey], ...update },
      },
    }));
  };

  const toggleStaffAction = (moduleKey, actionKey) => {
    setStaffDraft((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [moduleKey]: {
          ...current.modules[moduleKey],
          actions: {
            ...current.modules[moduleKey].actions,
            [actionKey]: !current.modules[moduleKey].actions[actionKey],
          },
        },
      },
    }));
  };

  const saveStaffAccess = async () => {
    if (!isAdmin || !staffAccount || !staffDraft) return;
    const accountId = staffAccount._id || staffAccount.id;
    setSavingId(accountId);
    try {
      const response = await updateAdminUserAccess(accountId, { staff_access: staffDraft });
      setUsers((current) => current.map((account) => (account._id || account.id) === accountId ? { ...response.user, is_active: true } : account));
      recordActivity(user, `Updated staff access for ${staffAccount.first_name} ${staffAccount.last_name}.`, "Settings");
      toast.success("Staff access settings saved.");
      setStaffAccount(null);
      setStaffDraft(null);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to save staff access settings.");
    } finally {
      setSavingId(null);
    }
  };

  const addCustomSubrole = () => {
    const subrole = customSubroleInput.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!subrole || !staffDraft) return;
    const existingSubrole = [...STAFF_SUBROLES, ...staffDraft.custom_subroles]
      .find((item) => item.toLowerCase() === subrole.toLowerCase());
    if (existingSubrole) {
      setStaffDraft((current) => ({ ...current, subrole: existingSubrole }));
      setCustomSubroleInput("");
      toast.success(`Subrole selected: ${existingSubrole}. Save Settings to apply it.`);
      return;
    }

    setStaffDraft((current) => ({
      ...current,
      subrole,
      custom_subroles: [...new Set([...current.custom_subroles, subrole])],
    }));
    setCustomSubroleInput("");
    toast.success(`Subrole added: ${subrole}. Save Settings to apply it.`);
  };

  const convertStaffToCustomer = async () => {
    if ((!isAdmin && !canManageAccess) || !staffAccount || isOwnStaffAccount) return;
    const accountId = staffAccount._id || staffAccount.id;
    setSavingId(accountId);
    try {
      const response = await updateAdminUserAccess(accountId, { role: "customer" });
      setUsers((current) => current.map((account) => (account._id || account.id) === accountId ? { ...response.user, is_active: true } : account));
      recordActivity(user, `Converted ${staffAccount.first_name} ${staffAccount.last_name} to customer.`, "Settings");
      toast.success("Staff account converted to customer.");
      setStaffAccount(null);
      setStaffDraft(null);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to convert staff account.");
    } finally {
      setSavingId(null);
    }
  };

  const saveGlobalPermissions = async () => {
    setSavingGlobal(true);
    try {
      const normalizedPermissions = normalizePermissions(globalPermissions);
      await updateSystemSettings({ global_permissions: normalizedPermissions });
      recordActivity(user, "Saved the global customer permissions profile.", "Settings");
      toast.success("Global profile saved. Individual account permissions were not changed.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to save the global permissions profile.");
    } finally {
      setSavingGlobal(false);
    }
  };

  const roleLabel = (role) => {
    if (role === "customer") return "Client";
    if (role === "helper") return "Helper";
    if (role === "staff" || role === "skilled_worker") return "Staff";
    if (role === "admin") return "Super Admin";
    return "Client";
  };

  const getRoleBadgeClasses = (role) => {
    if (role === "customer") return darkMode ? "bg-sky-950/70 text-sky-200" : "bg-sky-100 text-sky-700";
    if (role === "helper") return darkMode ? "bg-violet-950/70 text-violet-200" : "bg-violet-100 text-violet-700";
    if (role === "admin") return darkMode ? "bg-emerald-950/70 text-emerald-200" : "bg-emerald-100 text-emerald-700";
    return darkMode ? "bg-violet-950/70 text-violet-200" : "bg-violet-100 text-violet-700";
  };

  const getModuleAccessLabel = (permissions, isAdmin = false) => {
    if (isAdmin) return "Full Module Access";
    if (permissions.view_only_access) return "View only";
    if (permissions.can_request_orders || permissions.can_estimate_pricing || permissions.can_track_products) return "Customer Portal Matrix";
    return "No access";
  };

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

  const formatBackupDateShort = (value) => new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formatBackupSize = (sizeInMB) => `${Number(sizeInMB || 0).toFixed(1)} MB`;

  const backupMetrics = useMemo(() => {
    const backups = backupState.backups || [];
    const successfulBackups = backups.filter((backup) => backup.status?.toLowerCase() === "success").length;
    return {
      status: loadingBackupSettings ? "Loading..." : backups.length ? backupState.status || "Success" : "No backups yet",
      lastBackupAt: backupState.lastBackupAt || backups[0]?.date,
      totalBackups: backups.length,
      successRate: backups.length ? Math.round((successfulBackups / backups.length) * 100) : 0,
    };
  }, [backupState, loadingBackupSettings]);

  const persistBackupState = async (nextState) => {
    const payload = {
      backup_schedule: nextState.selectedSchedule || "weekly",
      backup_status: nextState.status || "Success",
      last_backup_at: nextState.lastBackupAt || null,
      backup_history: Array.isArray(nextState.backups) ? nextState.backups : [],
    };

    const response = await updateSystemSettings(payload);
    if (response?.backup_history) {
      setBackupState({
        selectedSchedule: response.backup_schedule || nextState.selectedSchedule || "weekly",
        status: response.backup_status || nextState.status || "Success",
        lastBackupAt: response.last_backup_at || nextState.lastBackupAt || null,
        backups: Array.isArray(response.backup_history) ? response.backup_history : nextState.backups || [],
      });
    }
    return response;
  };

  const handleScheduleChange = async (scheduleId) => {
    const nextState = { ...backupState, selectedSchedule: scheduleId };
    setBackupState(nextState);
    try {
      await persistBackupState(nextState);
      toast.success(`Backup schedule set to ${backupOptions.find((option) => option.id === scheduleId)?.label || "custom"}.`);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to update backup schedule.");
      setBackupState(backupState);
    }
  };

  const handleCreateBackup = async () => {
    const backupType = "Full System";
    setCreatingBackup(true);
    try {
      const response = await createSystemBackup(backupType);
      setBackupState({
        selectedSchedule: response.backup_schedule || backupState.selectedSchedule,
        status: response.backup_status || "Success",
        lastBackupAt: response.last_backup_at || response.backup?.date || null,
        backups: Array.isArray(response.backup_history) ? response.backup_history : [response.backup, ...(backupState.backups || [])],
      });
      recordActivity(user, "Created a full system backup.", "Settings");
      toast.success("Backup created successfully.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to create backup.");
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (backup) => {
    try {
      const { blob, filename } = await downloadSystemBackup(backup.id);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to download backup.");
    }
  };

  const handleRestoreBackup = async (backupId) => {
    const backup = (backupState.backups || []).find((item) => item.id === backupId);
    if (!backup) return;
    if (!window.confirm(`Restore ${backup.name}? Current database records and uploaded files will be replaced.`)) return;

    try {
      const response = await restoreSystemBackup(backupId);
      setBackupState({
        selectedSchedule: response.backup_schedule || backupState.selectedSchedule,
        status: response.backup_status || "Restored",
        lastBackupAt: response.last_backup_at || backup.date,
        backups: Array.isArray(response.backup_history) ? response.backup_history : backupState.backups,
      });
      recordActivity(user, `Restored backup ${backup.name}.`, "Settings");
      toast.success(`${backup.name} restored successfully.`);
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to restore backup.");
    }
  };

  const handleDeleteBackup = async (backupId) => {
    const backup = (backupState.backups || []).find((item) => item.id === backupId);
    if (!backup || !window.confirm(`Delete ${backup.name}? This backup file will be permanently removed.`)) return;

    try {
      const response = await deleteSystemBackup(backupId);
      setBackupState({
        selectedSchedule: response.backup_schedule || backupState.selectedSchedule,
        status: response.backup_status || "Success",
        lastBackupAt: response.last_backup_at || null,
        backups: Array.isArray(response.backup_history) ? response.backup_history : [],
      });
      toast.success("Backup deleted.");
    } catch (error) {
      toast.error(error?.data?.message || error?.message || "Unable to delete backup.");
    }
  };

  return (
    <div className={`admin-settings settings-premium flex h-screen overflow-hidden ${darkMode ? "bg-slate-950 text-slate-100" : "bg-[#eef1f3] text-slate-900"}`}>
      <Toaster position="bottom-right" />
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen((open) => !open)} />
      <div className="flex min-h-0 flex-1 flex-col">
        <Navbar />
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

          <section className={`mt-6 rounded-2xl border p-2 shadow-sm ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
            <div className="flex flex-wrap gap-2">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveSettingsTab(tab.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeSettingsTab === tab.key ? (darkMode ? "border border-red-700 bg-red-950/60 text-red-200" : "border border-red-900 bg-red-50 text-red-950") : (darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-50")}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {activeSettingsTab === "user-management" && (
            <>
              {isAdmin && <section className={`mt-7 overflow-hidden rounded-[22px] border shadow-[0_18px_45px_-28px_rgba(15,23,42,0.65)] ${darkMode ? "border-slate-700 bg-slate-900" : "border-red-100 bg-white"}`}>
            <div className={`relative flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${darkMode ? "border-slate-700 bg-gradient-to-r from-slate-900 via-slate-900 to-red-950/40" : "border-red-100 bg-gradient-to-r from-red-50 via-white to-orange-50"}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-red-900 text-white shadow-lg shadow-red-950/20"><Settings2 size={17} /></div>
                <div><p className={`text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? "text-red-300" : "text-red-700"}`}>Access control</p><h2 className={`mt-1 text-base font-black ${darkMode ? "text-white" : "text-red-950"}`}>Global Customer Permissions</h2><p className={`mt-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Saved globally without changing individual account matrices.</p></div>
              </div>
              <button type="button" onClick={() => setGlobalOpen((open) => !open)} className={`inline-flex items-center gap-2 self-end rounded-full border px-4 py-2 text-xs font-bold transition sm:self-auto ${darkMode ? "border-red-900/70 bg-red-950/50 text-red-200 hover:bg-red-900/60" : "border-red-200 bg-red-100 text-red-900 hover:bg-red-200"}`}>{globalOpen ? "Collapse" : "Manage All"}<ChevronDown size={14} className={`transition-transform ${globalOpen ? "rotate-180" : ""}`} /></button>
            </div>
            {globalOpen && <>
              <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-slate-800" : "border-slate-100"}`}><div><p className={`text-[10px] font-black uppercase tracking-[0.18em] ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Global customer access profile</p><p className={`mt-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Choose the global profile; each account's matrix remains independent.</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{Object.values(globalPermissions).filter(Boolean).length} enabled</span></div>
              <div className="grid gap-3 p-4 md:grid-cols-2">{PERMISSIONS.map((permission, index) => <PermissionSwitch key={permission.key} permission={permission} index={index} checked={globalPermissions[permission.key]} disabled={globalPermissions.view_only_access && permission.key !== "view_only_access"} onChange={(checked) => updateGlobalPermission(permission.key, checked)} darkMode={darkMode} />)}</div>
              <div className={`mx-4 mb-4 flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 ${maintenanceMode ? (darkMode ? "border-amber-700/70 bg-amber-950/40" : "border-amber-300 bg-amber-50") : (darkMode ? "border-slate-700 bg-slate-800/70" : "border-slate-200 bg-slate-50")}`}>
                <div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${maintenanceMode ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]" : "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"}`} /><div><p className={`text-xs font-black ${maintenanceMode ? (darkMode ? "text-amber-200" : "text-amber-900") : (darkMode ? "text-slate-200" : "text-slate-700")}`}>System Maintenance Mode</p><p className={`text-[10px] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{maintenanceMode ? "Customer activity is temporarily restricted." : "Platform is operating normally."}</p></div></div>
                <button type="button" role="switch" aria-checked={maintenanceMode} disabled={savingMaintenance} onClick={toggleMaintenanceMode} className={`relative h-6 w-11 shrink-0 rounded-full transition ${maintenanceMode ? "bg-amber-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${maintenanceMode ? "left-[22px]" : "left-1"}`} /></button>
              </div>
              <div className={`flex flex-col gap-3 border-t border-dashed px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-slate-700" : "border-slate-200"}`}><p className={`text-xs ${darkMode ? "text-amber-300" : "text-amber-600"}`}>Account-level Customer Matrix Permissions remain unchanged.</p><button type="button" onClick={saveGlobalPermissions} disabled={savingGlobal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-950 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60">{savingGlobal && <Loader2 size={14} className="animate-spin" />}{savingGlobal ? "Saving global profile..." : "Save Global Profile"}</button></div>
            </>}
          </section>}

          <section className={`mt-4 rounded-2xl border p-2 shadow-sm ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
            <div className="flex flex-wrap gap-1">
              {[
                { key: "all", label: "All Users", count: counts.all },
                { key: "customer", label: "Customers", count: counts.customer },
                { key: "staff", label: "Staff", count: counts.staff },
                { key: "helper", label: "Helpers", count: counts.helper },
                { key: "skilled_worker", label: "Skilled Workers", count: counts.skilled_worker },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${activeTab === tab.key ? (darkMode ? "border border-red-700 bg-red-950/60 text-red-200" : "border border-red-900 bg-red-50 text-red-950") : (darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-50")}`}
                >
                  {tab.label}
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === tab.key ? (darkMode ? "bg-red-900 text-red-100" : "bg-red-200 text-red-900") : (darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200")}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or email..." className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 ${darkMode ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500" : "border-slate-200 bg-white"}`} />
            </div>
            <span className={`text-xs font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{loading ? "Loading users..." : `${displayUsers.length} users found`}</span>
          </div>

          <section className={`mt-4 overflow-hidden rounded-[22px] border shadow-[0_18px_45px_-28px_rgba(15,23,42,0.55)] ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
            {loading ? <div className={`flex items-center justify-center gap-2 p-16 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}><Loader2 size={18} className="animate-spin" /> Loading user access...</div> : displayUsers.length === 0 ? <div className="p-16 text-center"><ShieldCheck size={30} className="mx-auto text-slate-300" /><p className={`mt-3 text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-600"}`}>No users found</p><p className="mt-1 text-xs text-slate-400">Try another search or permission group.</p></div> : <div className="overflow-x-auto"><table className="min-w-[1180px] w-full border-collapse text-left"><thead className={darkMode ? "bg-slate-800/80" : "bg-slate-50"}><tr className={`border-b ${darkMode ? "border-slate-700" : "border-slate-200"}`}><th className={`sticky left-0 z-10 w-[280px] px-5 py-4 text-[10px] font-black uppercase tracking-[0.16em] ${darkMode ? "bg-slate-800 text-slate-400" : "bg-slate-50 text-slate-500"}`}>User</th><th className={`w-[200px] px-3 py-4 text-[10px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Role</th><th className={`w-[240px] px-3 py-4 text-[10px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Module Access</th><th className={`w-[190px] px-3 py-4 text-[10px] font-black uppercase tracking-[0.16em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Actions</th></tr></thead><tbody className={`divide-y ${darkMode ? "divide-slate-800" : "divide-slate-100"}`}>{displayUsers.map((account) => { const accountId = account._id || account.id; const permissions = getPermissions(account); const accountActive = account.is_active !== false; const accountIsAdmin = account.role === "admin" || account.role === "super_admin"; const isStaff = account.role === "skilled_worker"; const staffAccess = isStaff ? normalizeStaffAccess(account.staff_access) : null; const effectivePermissions = accountIsAdmin ? Object.fromEntries(PERMISSIONS.map(({ key }) => [key, true])) : permissions; const enabledStaffModules = isStaff ? STAFF_MODULES.filter(({ key }) => staffAccess.modules[key].enabled).length : 0; const moduleCount = isStaff || accountIsAdmin ? STAFF_MODULES.length : 6; const enabledModuleCount = accountIsAdmin ? moduleCount : isStaff ? enabledStaffModules : Math.min(5, Object.values(effectivePermissions).filter(Boolean).length); const moduleAccessLabel = accountIsAdmin ? "Full Module Access" : isStaff ? `${enabledStaffModules} of ${STAFF_MODULES.length} staff modules` : getModuleAccessLabel(effectivePermissions); const actionClasses = accountIsAdmin ? (darkMode ? "border-emerald-800 bg-emerald-950/70 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700") : (darkMode ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"); const avatarLetters = `${(account.first_name || account.email || "U").charAt(0)}${(account.last_name || account.email || "U").charAt(0)}`.toUpperCase(); const name = `${account.first_name || ""} ${account.last_name || ""}`.trim() || "User"; return <tr key={accountId} className={`transition ${darkMode ? "hover:bg-slate-800/50" : "hover:bg-slate-50"}`}><td className={`sticky left-0 z-10 px-5 py-4 ${darkMode ? "bg-slate-900" : "bg-white"}`}><div className="flex min-w-[245px] items-center gap-3"><span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-amber-600 text-[10px] font-black text-white shadow-sm ${darkMode ? "ring-1 ring-white/10" : ""}`}>{avatarLetters}</span><div className="min-w-0"><div className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-200">{name}</div><div className="truncate text-xs text-slate-500">{account.email}</div></div></div></td><td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getRoleBadgeClasses(account.role)}`}>{accountActive ? roleLabel(account.role) : "Disabled"}</span></td><td className="px-3 py-4"><div className="flex items-center gap-2"><span className="inline-flex items-center gap-1">{Array.from({ length: moduleCount }).map((_, dotIndex) => (<span key={dotIndex} className={`h-2.5 w-2.5 rounded-full ${dotIndex < enabledModuleCount ? "bg-red-700" : darkMode ? "bg-slate-600" : "bg-slate-300"}`} />))}</span><span className={`text-xs ${darkMode ? "text-slate-300" : "text-slate-600"}`}>{moduleAccessLabel}</span></div></td><td className="px-3 py-4"><div className="flex items-center justify-end">{accountIsAdmin ? <span className={`inline-flex min-w-[120px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold ${actionClasses}`}>✓ Full Access</span> : isStaff ? <button type="button" onClick={() => openStaffAccess(account)} className={`inline-flex min-w-[120px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition ${actionClasses}`} aria-label={`Manage access for ${name}`}>Manage Access</button> : canManageAccess ? <button type="button" onClick={() => openPermissionMatrix(account)} className={`inline-flex min-w-[120px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition ${actionClasses}`} aria-label={`View permissions for ${name}`}>View Permissions</button> : <span className="px-3 py-2 text-xs text-slate-400">Read Only</span>}</div></td></tr>; })}</tbody></table></div>}
          </section>
            </>
          )}

          {renderBackupRecovery(backupMetrics)}

          {permissionAccount && permissionDraft && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) { setPermissionAccount(null); setPermissionDraft(null); } }}>
            <section role="dialog" aria-modal="true" aria-labelledby="customer-matrix-title" className={`w-full max-w-[620px] overflow-hidden rounded-xl border shadow-2xl ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
              <header className={`flex items-center justify-between border-b px-6 py-5 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-700">{`${(permissionAccount.first_name || "C").charAt(0)}${(permissionAccount.last_name || "T").charAt(0)}`.toUpperCase()}</span>
                  <div className="min-w-0"><h2 id="customer-matrix-title" className={`truncate text-base font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>Customer Matrix Permissions</h2><p className={`mt-1 truncate font-mono text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{`${permissionAccount.first_name || "Customer"} ${permissionAccount.last_name || ""}`.trim()} · Client Profile</p></div>
                </div>
                <button type="button" onClick={() => { setPermissionAccount(null); setPermissionDraft(null); }} aria-label="Close permissions" className={`rounded-full p-2 transition ${darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}><X size={16} /></button>
              </header>
              <div className="px-6 py-4">
                <p className={`mb-4 text-sm ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Toggle specific baseline visibility rules for this customer portal view layout configuration.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERMISSIONS.map((permission) => {
                    const checked = permissionDraft[permission.key] === true;
                    return <div key={permission.key} className={`flex min-h-[88px] items-center justify-between gap-3 rounded-md border px-3.5 py-3 ${checked ? (darkMode ? "border-red-900/70 bg-red-950/30" : "border-red-200 bg-red-50") : (darkMode ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50")}`}>
                      <div className="min-w-0"><p className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-800"}`}>{permission.label}</p><p className={`mt-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{permission.description}</p></div>
                      <button type="button" role="switch" aria-label={permission.label} aria-checked={checked} disabled={savingId === (permissionAccount._id || permissionAccount.id)} onClick={() => togglePermissionDraft(permission.key, !checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed ${checked ? "bg-red-900" : darkMode ? "bg-slate-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-1"}`} /></button>
                    </div>;
                  })}
                </div>
              </div>
              <footer className={`flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-slate-800 bg-slate-800/50" : "border-slate-100 bg-slate-50"}`}>
                {(isAdmin || canManageAccess) && permissionAccount.role === "customer" && <button type="button" onClick={() => setShowUpgradeConfirm(true)} disabled={savingId === (permissionAccount._id || permissionAccount.id)} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">↑ Upgrade to Staff</button>}
                <div className="flex justify-end gap-2"><button type="button" onClick={() => { setPermissionAccount(null); setPermissionDraft(null); }} disabled={savingId === (permissionAccount._id || permissionAccount.id)} className={`rounded-md border px-4 py-2.5 text-sm font-medium ${darkMode ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-white"}`}>Cancel</button><button type="button" onClick={savePermissionMatrix} disabled={savingId === (permissionAccount._id || permissionAccount.id)} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-md bg-red-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-900 disabled:opacity-60">{savingId === (permissionAccount._id || permissionAccount.id) ? <Loader2 size={15} className="animate-spin" /> : null}Save Matrix</button></div>
              </footer>
            </section>
          </div>}
          {staffAccount && staffDraft && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) { setStaffAccount(null); setStaffDraft(null); } }}>
            <section role="dialog" aria-modal="true" aria-labelledby="staff-access-title" className={`flex max-h-[92vh] w-full max-w-[620px] flex-col overflow-hidden rounded-xl border shadow-2xl ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
              <header className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                <div><h2 id="staff-access-title" className={`text-base font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>Staff Access Control</h2><p className={`mt-1 text-xs font-mono ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{`${staffAccount.first_name || "Staff"} ${staffAccount.last_name || ""}`.trim()} · Permission Matrix</p></div>
                <button type="button" onClick={() => { setStaffAccount(null); setStaffDraft(null); }} aria-label="Close staff access settings" className={`rounded-full p-2 ${darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}><X size={16} /></button>
              </header>
              <div className="overflow-y-auto">
                {(isOwnStaffAccount || !isAdmin) && <p role="status" className={`mx-5 mt-4 rounded-md border px-3 py-2 text-xs ${darkMode ? "border-amber-800 bg-amber-950/30 text-amber-200" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{isOwnStaffAccount ? "You are currently viewing your own profile. Modifying your own permissions is disabled to prevent accidental lockout." : "Staff access is read-only here. Only a Super Admin can change staff permissions."}</p>}
                <section className={`border-b px-5 py-4 ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                  <p className={`mb-2 text-[10px] font-black uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Staff Subrole Designation</p>
                  <div className="flex flex-wrap gap-2">
                    <select value={staffDraft.subrole} disabled={!isAdmin || isOwnStaffAccount} onChange={(event) => setStaffDraft((current) => ({ ...current, subrole: event.target.value }))} className={`h-9 rounded-md border px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-200 bg-white text-slate-800"}`}>
                      {[...new Set([...STAFF_SUBROLES, ...staffDraft.custom_subroles])].map((subrole) => <option key={subrole} value={subrole}>{subrole}</option>)}
                    </select>
                    <input value={customSubroleInput} maxLength={40} disabled={!isAdmin || isOwnStaffAccount} onChange={(event) => setCustomSubroleInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomSubrole(); } }} placeholder="Add custom subrole..." className={`h-9 min-w-[150px] flex-1 rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${darkMode ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500" : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400"}`} />
                    {isAdmin && !isOwnStaffAccount && <button type="button" onClick={addCustomSubrole} disabled={!customSubroleInput.trim()} className={`h-9 rounded-md border px-3 text-sm font-medium disabled:opacity-50 ${darkMode ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Add</button>}
                  </div>
                </section>
                <section className="px-5 py-4">
                  <h3 className={`text-[10px] font-black uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Module System Permissions</h3>
                  <p className={`mb-3 mt-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Enable modules and configure their individual actions.</p>
                  <div className="space-y-2">
                    {STAFF_MODULES.map((module) => {
                      const moduleAccess = staffDraft.modules[module.key];
                      const isExpanded = expandedStaffModule === module.key;
                      return <div key={module.key} className={`rounded-md border ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                        <div className="flex min-h-11 items-center gap-3 px-3">
                          <span className={`min-w-0 flex-1 text-xs font-semibold ${darkMode ? "text-slate-200" : "text-slate-800"}`}>{module.label}</span>
                          <button type="button" onClick={() => setExpandedStaffModule(isExpanded ? null : module.key)} className={`whitespace-nowrap text-[10px] font-medium ${darkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"}`} aria-expanded={isExpanded}>{isExpanded ? "▲ Hide Sub-actions" : "▼ Manage Sub-actions"}</button>
                          <button type="button" role="switch" aria-label={`${module.label} module`} aria-checked={moduleAccess.enabled} disabled={!isAdmin || isOwnStaffAccount} onClick={() => updateStaffModule(module.key, { enabled: !moduleAccess.enabled })} className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${moduleAccess.enabled ? "bg-red-900" : darkMode ? "bg-slate-600" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${moduleAccess.enabled ? "left-[18px]" : "left-0.5"}`} /></button>
                        </div>
                        {isExpanded && <div className={`grid grid-cols-1 gap-2 border-t p-3 sm:grid-cols-2 ${darkMode ? "border-slate-700 bg-slate-800/40" : "border-slate-100 bg-slate-50"}`}>
                          {module.actions.map((action) => <div key={action.key} className={`flex min-h-8 items-center justify-between gap-3 rounded-sm px-2.5 ${darkMode ? "bg-slate-900/70" : "bg-white"} ${moduleAccess.enabled ? (darkMode ? "text-slate-300" : "text-slate-700") : "opacity-50"}`}><span className="text-xs">{action.label}</span><button type="button" role="switch" aria-label={`${module.label}: ${action.label}`} aria-checked={moduleAccess.actions[action.key]} disabled={!isAdmin || isOwnStaffAccount || !moduleAccess.enabled} onClick={() => toggleStaffAction(module.key, action.key)} className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${moduleAccess.actions[action.key] ? "bg-red-900" : darkMode ? "bg-slate-600" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${moduleAccess.actions[action.key] ? "left-[18px]" : "left-0.5"}`} /></button></div>)}
                        </div>}
                      </div>;
                    })}
                  </div>
                </section>
              </div>
              <footer className={`flex flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between ${darkMode ? "border-slate-800 bg-slate-800/40" : "border-slate-100 bg-slate-50"}`}>
                {(isAdmin || canManageAccess) && !isOwnStaffAccount && <button type="button" onClick={convertStaffToCustomer} disabled={savingId === (staffAccount._id || staffAccount.id)} className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">↓ Convert to Customer</button>}
                <div className="flex justify-end gap-2"><button type="button" onClick={() => { setStaffAccount(null); setStaffDraft(null); }} className={`rounded-md border px-4 py-2 text-sm ${darkMode ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-white"}`}>Close</button>{isAdmin && !isOwnStaffAccount && <button type="button" onClick={saveStaffAccess} disabled={savingId === (staffAccount._id || staffAccount.id)} className="inline-flex min-w-28 items-center justify-center gap-2 rounded-md bg-red-950 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 disabled:opacity-60">{savingId === (staffAccount._id || staffAccount.id) ? <Loader2 size={14} className="animate-spin" /> : null}Save Settings</button>}</div>
              </footer>
            </section>
          </div>}
          {showUpgradeConfirm && permissionAccount && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <section role="alertdialog" aria-modal="true" aria-labelledby="upgrade-confirm-title" aria-describedby="upgrade-confirm-description" className={`w-full max-w-md rounded-xl border p-6 shadow-2xl ${darkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
              <h2 id="upgrade-confirm-title" className={`text-lg font-bold leading-tight ${darkMode ? "text-slate-100" : "text-slate-900"}`}>Upgrade Customer to Operational Staff?</h2>
              <p id="upgrade-confirm-description" className={`mt-3 text-sm leading-6 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>This will change {`${permissionAccount.first_name || "this customer"} ${permissionAccount.last_name || ""}`.trim()}'s role to Staff. You can still customize their customer portal permissions separately.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowUpgradeConfirm(false)} disabled={savingId === (permissionAccount._id || permissionAccount.id)} className={`rounded-md border px-4 py-2.5 text-sm font-medium ${darkMode ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Cancel</button>
                <button type="button" onClick={() => { setShowUpgradeConfirm(false); upgradeCustomerToStaff(); }} disabled={savingId === (permissionAccount._id || permissionAccount.id)} className="rounded-md bg-red-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60">{savingId === (permissionAccount._id || permissionAccount.id) ? "Upgrading..." : "Confirm Upgrade"}</button>
              </div>
            </section>
          </div>}
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
