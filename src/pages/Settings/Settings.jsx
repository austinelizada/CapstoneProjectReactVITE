import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Database,
  ShieldCheck,
  Users,
  ToggleLeft,
  ToggleRight,
  Download,
  Upload,
  RefreshCcw,
  Lock,
  KeyRound,
} from "lucide-react";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";

function Settings() {
  const [isSidebarOpen, setIsSidebarOpen] =
    useState(() => {
      if (typeof window === "undefined") return true;
      const stored = localStorage.getItem("sidebarOpen");
      return stored !== null ? JSON.parse(stored) : true;
    });

  const [backupEnabled, setBackupEnabled] =
    useState(true);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const [maintenanceMode, setMaintenanceMode] =
    useState(false);

  const [users, setUsers] = useState([
    {
      name: "Admin User",
      role: "Super Admin",
      active: true,
    },
    {
      name: "Project Manager",
      role: "Manager",
      active: true,
    },
    {
      name: "Inspection Staff",
      role: "Inspector",
      active: false,
    },
    {
      name: "Warehouse Staff",
      role: "Inventory",
      active: true,
    },
  ]);

  const toggleUserStatus = (index) => {
    const updatedUsers = [...users];

    updatedUsers[index].active =
      !updatedUsers[index].active;

    setUsers(updatedUsers);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />

      <div className="flex-1 min-h-0 flex flex-col">
        <Navbar
          toggleSidebar={() =>
            setIsSidebarOpen(!isSidebarOpen)
          }
        />

        <main className="flex-1 min-h-0 overflow-y-auto p-6">

          {/* HEADER */}

          <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white rounded-3xl p-8 shadow-lg">

            <div className="flex items-center gap-4">

              <SettingsIcon size={40} />

              <div>

                <h1 className="text-3xl font-bold">
                  System Settings
                </h1>

                <p className="text-red-100 mt-1">
                  Manage RBAC, backups,
                  security and user access.
                </p>

              </div>

            </div>

          </div>

          {/* SETTINGS GRID */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">

            {/* DATABASE BACKUP */}

            <div className="bg-white rounded-3xl shadow p-6">

              <div className="flex items-center gap-3 mb-6">

                <Database
                  className="text-blue-600"
                  size={28}
                />

                <div>

                  <h2 className="text-xl font-bold">
                    Database Backup
                  </h2>

                  <p className="text-gray-500 text-sm">
                    Backup and restore data
                  </p>

                </div>

              </div>

              <div className="space-y-4">

                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">

                  <div>

                    <h3 className="font-semibold">
                      Automatic Backup
                    </h3>

                    <p className="text-sm text-gray-500">
                      Daily database backup
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setBackupEnabled(
                        !backupEnabled
                      )
                    }
                  >
                    {backupEnabled ? (
                      <ToggleRight
                        size={40}
                        className="text-green-600"
                      />
                    ) : (
                      <ToggleLeft
                        size={40}
                        className="text-gray-400"
                      />
                    )}
                  </button>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <button className="flex items-center justify-center gap-2 bg-blue-100 text-blue-700 py-3 rounded-2xl hover:bg-blue-200">

                    <Download size={18} />

                    Backup

                  </button>

                  <button className="flex items-center justify-center gap-2 bg-green-100 text-green-700 py-3 rounded-2xl hover:bg-green-200">

                    <Upload size={18} />

                    Restore

                  </button>

                  <button className="flex items-center justify-center gap-2 bg-orange-100 text-orange-700 py-3 rounded-2xl hover:bg-orange-200">

                    <RefreshCcw size={18} />

                    Sync

                  </button>

                </div>

              </div>

            </div>

            {/* SECURITY */}

            <div className="bg-white rounded-3xl shadow p-6">

              <div className="flex items-center gap-3 mb-6">

                <ShieldCheck
                  className="text-green-600"
                  size={28}
                />

                <div>

                  <h2 className="text-xl font-bold">
                    Security & RBAC
                  </h2>

                  <p className="text-gray-500 text-sm">
                    Access and security controls
                  </p>

                </div>

              </div>

              <div className="space-y-4">

                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">

                  <div className="flex items-center gap-3">

                    <Lock className="text-red-600" />

                    <div>

                      <h3 className="font-semibold">
                        Maintenance Mode
                      </h3>

                      <p className="text-sm text-gray-500">
                        Restrict platform access
                      </p>

                    </div>

                  </div>

                  <button
                    onClick={() =>
                      setMaintenanceMode(
                        !maintenanceMode
                      )
                    }
                  >
                    {maintenanceMode ? (
                      <ToggleRight
                        size={40}
                        className="text-red-600"
                      />
                    ) : (
                      <ToggleLeft
                        size={40}
                        className="text-gray-400"
                      />
                    )}
                  </button>

                </div>

                <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">

                  <KeyRound className="text-blue-600" />

                  <div>

                    <h3 className="font-semibold">
                      Role-Based Access
                    </h3>

                    <p className="text-sm text-gray-500">
                      Admins control permissions
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>

          {/* USERS MANAGEMENT */}

          <div className="bg-white rounded-3xl shadow mt-6 overflow-hidden">

            <div className="p-6 border-b flex items-center justify-between">

              <div className="flex items-center gap-3">

                <Users
                  className="text-purple-600"
                  size={24}
                />

                <div>

                  <h2 className="text-xl font-bold">
                    User Access Management
                  </h2>

                  <p className="text-gray-500 text-sm">
                    Manage users and permissions
                  </p>

                </div>

              </div>

              <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm">
                Add User
              </button>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-50">

                  <tr>

                    <th className="p-4 text-left text-sm font-semibold">
                      User
                    </th>

                    <th className="p-4 text-left text-sm font-semibold">
                      Role
                    </th>

                    <th className="p-4 text-left text-sm font-semibold">
                      Status
                    </th>

                    <th className="p-4 text-center text-sm font-semibold">
                      Access
                    </th>

                    <th className="p-4 text-center text-sm font-semibold">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {users.map((user, index) => (

                    <tr
                      key={index}
                      className="border-t hover:bg-gray-50 transition"
                    >

                      {/* USER */}

                      <td className="p-4">

                        <div className="flex items-center gap-3">

                          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">
                            {user.name.charAt(0)}
                          </div>

                          <div>

                            <p className="font-medium">
                              {user.name}
                            </p>

                            <p className="text-xs text-gray-500">
                              admin@acgc.com
                            </p>

                          </div>

                        </div>

                      </td>

                      {/* ROLE */}

                      <td className="p-4">

                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs">
                          {user.role}
                        </span>

                      </td>

                      {/* STATUS */}

                      <td className="p-4">

                        <span
                          className={`px-3 py-1 rounded-full text-xs ${
                            user.active
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {user.active
                            ? "Active"
                            : "Disabled"}
                        </span>

                      </td>

                      {/* ACCESS */}

                      <td className="p-4 text-center">

                        <button
                          onClick={() =>
                            toggleUserStatus(index)
                          }
                        >

                          {user.active ? (
                            <ToggleRight
                              size={32}
                              className="text-green-600"
                            />
                          ) : (
                            <ToggleLeft
                              size={32}
                              className="text-gray-400"
                            />
                          )}

                        </button>

                      </td>

                      {/* ACTIONS */}

                      <td className="p-4">

                        <div className="flex justify-center gap-2">

                          <button className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-sm hover:bg-blue-200">
                            Edit
                          </button>

                          <button className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200">
                            Remove
                          </button>

                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        </main>
      </div>
    </div>
  );
}

export default Settings;