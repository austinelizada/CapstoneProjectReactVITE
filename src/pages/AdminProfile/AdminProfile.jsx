import { useEffect, useState } from "react";
import {
  User,
  Mail,
  Phone,
  Camera,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import Sidebar from "../../components/layout/Sidebar";
import Navbar from "../../components/layout/Navbar";

function AdminProfile() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebarOpen");
    return stored !== null ? JSON.parse(stored) : true;
  });
  const { user, loading, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState("");

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!loading && user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        username: user.username || "",
        role: user.role || "admin",
        phone: user.phone || "",
        street_address: user.street_address || "",
        city: user.city || "",
        province: user.province || "",
        zip_code: user.zip_code || "",
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    }
  }, [loading, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const profileHasChanges = () => {
    if (!user) return false;
    return (
      profile.first_name !== (user.first_name || "") ||
      profile.last_name !== (user.last_name || "") ||
      profile.phone !== (user.phone || "") ||
      profile.street_address !== (user.street_address || "") ||
      profile.city !== (user.city || "") ||
      profile.province !== (user.province || "") ||
      profile.zip_code !== (user.zip_code || "") ||
      Boolean(profile.new_password) ||
      Boolean(profile.confirm_password)
    );
  };

  const performSave = async () => {
    if (!profile.current_password) {
      setError("Please enter your current password to save profile changes.");
      return false;
    }

    if (!profile.first_name || !profile.last_name) {
      setError("Please enter both first name and last name.");
      return false;
    }

    if (profile.new_password || profile.confirm_password) {
      if (!profile.new_password) {
        setError("Please enter a new password.");
        return false;
      }

      if (profile.new_password.length < 8) {
        setError("New password must be at least 8 characters long.");
        return false;
      }

      if (profile.new_password !== profile.confirm_password) {
        setError("New password and confirmation do not match.");
        return false;
      }
    }

    setSaving(true);
    try {
      const payload = {
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        street_address: profile.street_address,
        city: profile.city,
        province: profile.province,
        zip_code: profile.zip_code,
        current_password: profile.current_password,
      };

      if (profile.new_password) {
        payload.new_password = profile.new_password;
      }

      const response = await updateProfile(payload);

      setProfile((prev) => ({
        ...prev,
        ...response.user,
        current_password: "",
        new_password: "",
        confirm_password: "",
      }));
      setSuccess("Profile updated successfully.");
      return true;
    } catch (err) {
      setError(err.data?.message || err.message || "Failed to update profile.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setPasswordModalError("");

    if (!profileHasChanges()) {
      setSuccess("No changes to save.");
      return;
    }

    if (!profile.current_password) {
      setShowPasswordModal(true);
      return;
    }

    await performSave();
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading admin profile...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />

      <div className="flex-1 min-h-0 flex flex-col">
        <Navbar
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 text-white rounded-3xl p-8 shadow-lg">
            <h1 className="text-3xl font-bold">Admin Profile</h1>
            <p className="text-red-100 mt-2">
              Manage your administrator account settings and security.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
            <div className="bg-white rounded-3xl shadow p-8">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <img
                    src="https://i.pravatar.cc/300"
                    alt="Admin"
                    className="w-36 h-36 rounded-full object-cover border-4 border-red-100"
                  />
                  <button className="absolute bottom-2 right-2 bg-red-600 text-white p-3 rounded-full shadow-lg hover:bg-red-700">
                    <Camera size={18} />
                  </button>
                </div>

                <h2 className="text-2xl font-bold mt-5">
                  {profile.first_name} {profile.last_name}
                </h2>
                <p className="text-gray-500 capitalize">{profile.role}</p>

                <div className="mt-6 w-full space-y-4">
                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                    <Mail className="text-red-600" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                    <Phone className="text-red-600" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">{profile.phone || "Not set"}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                    <ShieldCheck className="text-red-600" />
                    <div>
                      <p className="text-sm text-gray-500">Role</p>
                      <p className="font-medium capitalize">{profile.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-2 bg-white rounded-3xl shadow p-8">
              <h2 className="text-2xl font-bold mb-6">Profile Settings</h2>

              {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="rounded-3xl bg-gray-100 border border-gray-200 p-2 flex overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setActiveTab("profile")}
                      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                        activeTab === "profile"
                          ? "bg-white text-red-600 shadow-sm"
                          : "text-gray-600 hover:text-red-600"
                      }`}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("security")}
                      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                        activeTab === "security"
                          ? "bg-white text-red-600 shadow-sm"
                          : "text-gray-600 hover:text-red-600"
                      }`}
                    >
                      Security
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  {activeTab === "profile" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm font-medium text-gray-600">First Name</label>
                        <div className="relative mt-2">
                          <User size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="first_name"
                            value={profile.first_name}
                            onChange={handleChange}
                            className="w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Last Name</label>
                        <div className="relative mt-2">
                          <User size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="last_name"
                            value={profile.last_name}
                            onChange={handleChange}
                            className="w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Email Address</label>
                        <div className="relative mt-2">
                          <Mail size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="email"
                            name="email"
                            value={profile.email}
                            disabled
                            className="w-full pl-12 pr-4 py-3 border rounded-2xl bg-gray-100 text-gray-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Username</label>
                        <div className="relative mt-2">
                          <User size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="username"
                            value={profile.username}
                            disabled
                            className="w-full pl-12 pr-4 py-3 border rounded-2xl bg-gray-100 text-gray-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Phone Number</label>
                        <div className="relative mt-2">
                          <Phone size={18} className="absolute left-4 top-4 text-gray-400" />
                          <input
                            type="text"
                            name="phone"
                            value={profile.phone}
                            onChange={handleChange}
                            className="w-full pl-12 pr-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Street Address</label>
                        <input
                          type="text"
                          name="street_address"
                          value={profile.street_address}
                          onChange={handleChange}
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">City</label>
                        <input
                          type="text"
                          name="city"
                          value={profile.city}
                          onChange={handleChange}
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Province</label>
                        <input
                          type="text"
                          name="province"
                          value={profile.province}
                          onChange={handleChange}
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Zip Code</label>
                        <input
                          type="text"
                          name="zip_code"
                          value={profile.zip_code}
                          onChange={handleChange}
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-3">
                        <label className="text-sm font-medium text-gray-600">Current Password</label>
                        <input
                          type="password"
                          name="current_password"
                          value={profile.current_password}
                          onChange={handleChange}
                          placeholder="Enter current password"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">New Password</label>
                        <input
                          type="password"
                          name="new_password"
                          value={profile.new_password}
                          onChange={handleChange}
                          placeholder="Enter new password"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-600">Confirm Password</label>
                        <input
                          type="password"
                          name="confirm_password"
                          value={profile.confirm_password}
                          onChange={handleChange}
                          placeholder="Confirm new password"
                          className="w-full mt-2 px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-red-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-red-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>

              {showPasswordModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6">
                  <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                    <h3 className="text-xl font-semibold mb-3">Confirm Profile Changes</h3>
                    <p className="text-gray-600 mb-4">
                      Enter your current password to confirm saving profile changes.
                    </p>
                    {passwordModalError && (
                      <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                        {passwordModalError}
                      </div>
                    )}
                    <input
                      type="password"
                      name="current_password"
                      value={profile.current_password}
                      onChange={handleChange}
                      placeholder="Current password"
                      className="w-full border rounded-2xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordModal(false);
                          setPasswordModalError("");
                        }}
                        className="px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setPasswordModalError("");
                          if (!profile.current_password) {
                            setPasswordModalError("Please enter your current password.");
                            return;
                          }
                          const success = await performSave();
                          if (success) {
                            setShowPasswordModal(false);
                          }
                        }}
                        className="px-4 py-3 rounded-2xl bg-red-600 text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminProfile;
