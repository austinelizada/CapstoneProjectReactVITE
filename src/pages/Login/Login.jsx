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
    <div className="flex h-[100dvh] min-h-[100dvh] items-stretch justify-center bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] lg:items-center lg:px-4 lg:py-5 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(135deg,#020617,#111827_54%,#450a0a)] [background-size:42px_42px,42px_42px,100%_100%]">

      <div className="h-[100dvh] w-full max-w-none overflow-hidden bg-slate-900/90 lg:h-auto lg:max-w-5xl lg:rounded-[22px] lg:border lg:border-white/10 lg:shadow-[0_28px_90px_rgba(2,6,23,0.65)] lg:backdrop-blur-xl">

        <div className="grid h-full grid-rows-[minmax(13rem,40dvh)_minmax(0,1fr)] lg:h-auto lg:grid-cols-2 lg:grid-rows-1">

          {/* LEFT SIDE */}

          <div className="relative flex min-h-0 flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] p-4 text-white sm:gap-3 lg:min-h-[560px] lg:p-8">

            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(148,163,184,.08),transparent_42%,rgba(127,29,29,.28))]" />
            <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-16 -top-8 h-56 w-56 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />

            <div className="relative z-10 flex min-w-0 flex-col items-center text-center">

              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-red-100 sm:text-xs lg:mb-6 lg:tracking-[0.3em]">
                Welcome To
              </p>

              <img
                src={logo}
                alt="ACGC Logo"
                className="w-28 drop-shadow-2xl sm:w-36 lg:mx-auto lg:w-56"
              />

              <p className="mt-2 max-w-md text-center text-[11px] font-medium leading-4 text-red-50 sm:text-xs lg:mx-auto lg:mt-6 lg:text-sm lg:leading-6">
                Securely manage products, site inspections,
                and operations from one powerful dashboard.
              </p>

            </div>

          </div>

          {/* RIGHT SIDE */}

          <div className="min-h-0 overflow-y-auto bg-white px-4 py-3 text-slate-900 sm:px-6 sm:py-4 lg:flex lg:items-center lg:p-8">

            <div className="mx-auto flex min-h-full w-full max-w-md flex-col lg:min-h-0">
              
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl lg:text-4xl">
                Sign in to ACGC
              </h1>

              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                Enter your credentials to continue.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-4 flex flex-1 flex-col gap-3 sm:mt-5 lg:mt-6 lg:gap-4"
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
                      className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 sm:pl-12 sm:pr-5"
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
                      className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 sm:pl-12 sm:pr-14"
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

                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1">
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
                  className={`min-h-12 w-full rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 text-base font-bold text-white shadow-lg shadow-red-900/20 transition ${loginLoading || redirecting ? "cursor-not-allowed opacity-60 hover:scale-100" : "hover:scale-[1.01] hover:shadow-red-900/30"}`}
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
                  className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-slate-100 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200"
                >
                  <ChevronLeft size={22} />
                  Back to Browse
                </Link>

                {/* LINKS */}

                <div className="mt-auto flex flex-wrap justify-center gap-x-2 gap-y-1 rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-xs sm:gap-4 sm:py-4 sm:text-sm">
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