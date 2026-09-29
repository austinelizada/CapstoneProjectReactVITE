import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye,
  EyeOff,
  ChevronLeft,
  Mail,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";

import logo from "../../assets/images/ACGCLOGO1.png";

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "#cbd5e1" };

  const hasMinimumLength = password.length >= 8;
  const hasLongLength = password.length >= 12;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  let score = 1;

  if (!hasMinimumLength) score = 1;
  else if (hasLongLength && hasMixedCase && hasNumber && hasSymbol) score = 4;
  else if (hasMixedCase && hasNumber && (hasLongLength || hasSymbol)) score = 3;
  else if (hasLongLength || hasMixedCase || hasNumber || hasSymbol) score = 2;

  const levels = [
    { label: "Weak", color: "#ef4444" },
    { label: "Fair", color: "#f59e0b" },
    { label: "Good", color: "#eab308" },
    { label: "Strong", color: "#16a34a" },
  ];

  return { score, ...levels[Math.max(score - 1, 0)] };
};

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authError, setAuthError, loginLoading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
    remember: false,
  });
  const [error, setError] = useState("");
  const [passwordInteracted, setPasswordInteracted] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordStrength = getPasswordStrength(formData.password);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loginLoading || redirecting) {
      return;
    }

    if (!formData.identifier || !formData.password) {
      setError("Please enter your email/username and password.");
      return;
    }

    try {
      setError("");
      setAuthError("");
      const response = await login({
        identifier: formData.identifier,
        password: formData.password,
      });

      const requestedPath = location.state?.from?.pathname;
      const requestedSearch = location.state?.from?.search || "";
      const isCustomer = response.user?.role === "customer";
      const destination = isCustomer
        ? requestedPath?.startsWith("/customer-dashboard")
          ? `${requestedPath}${requestedSearch}`
          : "/customer-dashboard"
        : requestedPath && !requestedPath.startsWith("/customer-dashboard")
          ? requestedPath
          : "/dashboard";
      setRedirecting(true);
      window.setTimeout(() => {
        navigate(destination, { replace: true });
      }, 2500);
    } catch (err) {
      setError(err.data?.message || err.message || "Login failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] flex items-center justify-center px-4 py-5 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(135deg,#020617,#111827_54%,#450a0a)] [background-size:42px_42px,42px_42px,100%_100%]">

      <div className="w-full max-w-5xl overflow-hidden rounded-[22px] border border-white/10 bg-slate-900/90 shadow-[0_28px_90px_rgba(2,6,23,0.65)] backdrop-blur-xl">

        <div className="grid lg:grid-cols-2">

          {/* LEFT SIDE */}

          <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] p-8 text-white lg:min-h-[560px]">

            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(148,163,184,.08),transparent_42%,rgba(127,29,29,.28))]" />
            <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-16 -top-8 h-56 w-56 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />

            <div className="relative z-10 text-center">

              <p className="mb-6 text-xs font-black uppercase tracking-[0.3em] text-red-100">
                Welcome To
              </p>

              <img
                src={logo}
                alt="ACGC Logo"
                className="w-56 mx-auto drop-shadow-2xl"
              />

              <p className="mx-auto mt-6 max-w-md text-sm font-medium leading-6 text-red-50">
                Securely manage products, site inspections,
                and operations from one powerful dashboard.
              </p>

            </div>

          </div>

          {/* RIGHT SIDE */}

          <div className="flex items-center bg-white p-5 text-slate-900 lg:p-8">

            <div className="w-full">
              
              <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Sign in to ACGC
              </h1>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Enter your credentials to continue.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-5 space-y-4"
              >

                {/* USERNAME */}

                <div>

                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Email or Username
                  </label>

                  <div className="relative">
                    <Mail
                      size={20}
                      strokeWidth={1.8}
                      className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      name="identifier"
                      value={formData.identifier}
                      onChange={handleChange}
                      placeholder="Email or username"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-12 pr-5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
                    />
                  </div>

                </div>

                {/* PASSWORD */}

                <div>

                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Password
                  </label>

                  <div className="relative">

                    <LockKeyhole
                      size={20}
                      strokeWidth={1.8}
                      className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      onKeyDown={() => setPasswordInteracted(true)}
                      onPaste={() => setPasswordInteracted(true)}
                      placeholder="Password"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-12 pr-14 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(!showPassword)
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-red-600"
                    >
                      {showPassword ? (
                        <EyeOff size={22} />
                      ) : (
                        <Eye size={22} />
                      )}
                    </button>

                  </div>

                  {passwordFocused && passwordInteracted && formData.password ? (
                    <div className="mt-2" aria-live="polite">
                      <div
                        className="h-1.5 w-4/4 overflow-hidden rounded-full bg-slate-200"
                        role="progressbar"
                        aria-label="Password strength"
                        aria-valuemin="0"
                        aria-valuemax="4"
                        aria-valuenow={passwordStrength.score}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${passwordStrength.score * 25}%`,
                            backgroundColor: passwordStrength.color,
                          }}
                        />
                      </div>
                      <p
                        className="mt-1 text-xs font-semibold transition-colors duration-300"
                        style={{ color: passwordStrength.color }}
                      >
                        {passwordStrength.label} password
                      </p>
                    </div>
                  ) : null}

                </div>

                <div className="-mt-2 flex items-center justify-between gap-4">
                  <label className="flex items-center gap-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="remember"
                      checked={formData.remember}
                      onChange={handleChange}
                      className="h-4 w-4 accent-red-600"
                    />
                    Remember me
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-semibold text-red-500 hover:text-red-600"
                  >
                    Forgot Password?
                  </Link>
                </div>

                {/* LOGIN BUTTON */}

                {error || authError ? (
                  <p className="text-sm text-red-600 font-medium">
                    {error || authError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loginLoading || redirecting}
                  className={`w-full rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition ${loginLoading || redirecting ? "cursor-not-allowed opacity-60 hover:scale-100" : "hover:scale-[1.01] hover:shadow-red-900/30"}`}
                >
                  {loginLoading || redirecting ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                      Logging in...
                    </span>
                  ) : (
                    "Login"
                  )}
                </button>

                {/* BACK BUTTON */}

                <Link
                  to="/"
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-slate-100 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200"
                >
                  <ChevronLeft size={22} />
                  Back to Browse
                </Link>

                {/* LINKS */}

                <div className="flex justify-center gap-4 pt-1 text-sm">
                  <span className="text-slate-500">Don't have an account?</span>
                  <Link
                    to="/signup"
                    className="font-bold text-red-500 hover:text-red-600"
                  >
                    Sign Up
                  </Link>

                </div>

              </form>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Login;