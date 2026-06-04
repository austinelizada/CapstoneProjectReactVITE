import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function AdminCreationModal() {
  const navigate = useNavigate();
  const { adminExists, adminLoading, adminError, refreshAdminStatus, createAdmin, authError, setAuthError } = useAuth();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setAuthError("");

    if (
      !formData.first_name ||
      !formData.last_name ||
      !formData.email ||
      !formData.username ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      await createAdmin({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        username: formData.username,
        password: formData.password,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.data?.message || err.message || "Failed to create admin account.");
    } finally {
      setSaving(false);
    }
  };

  if (adminLoading || adminExists === true) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <div className="w-full max-w-xl rounded-[32px] bg-white p-8 shadow-2xl border border-gray-200">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Create Admin Account</h2>
          <p className="mt-3 text-gray-600">
            No admin account exists yet. Create the first administrator for this system before customer sign-up is available.
          </p>
        </div>

        {(error || authError || adminError) && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error || authError || adminError}
            {adminError && (
              <button
                type="button"
                onClick={refreshAdminStatus}
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-red-700 underline"
              >
                Retry admin status
              </button>
            )}
            {adminError && (
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 text-sm font-medium text-red-700 underline"
                >
                  I already have an admin account / Go to login
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="font-semibold text-sm text-gray-700">First Name *</span>
              <input
                name="first_name"
                type="text"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </label>
            <label className="space-y-2">
              <span className="font-semibold text-sm text-gray-700">Last Name *</span>
              <input
                name="last_name"
                type="text"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="font-semibold text-sm text-gray-700">Email *</span>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </label>
            <label className="space-y-2">
              <span className="font-semibold text-sm text-gray-700">Username *</span>
              <input
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="font-semibold text-sm text-gray-700">Password *</span>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </label>
            <label className="space-y-2">
              <span className="font-semibold text-sm text-gray-700">Confirm Password *</span>
              <input
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-red-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-4 rounded-2xl bg-red-600 px-6 py-4 text-white font-semibold shadow-lg shadow-red-500/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating admin..." : "Create Admin Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminCreationModal;
