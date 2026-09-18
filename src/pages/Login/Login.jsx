import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye,
  EyeOff,
  ChevronLeft,
  LoaderCircle,
} from "lucide-react";

import logo from "../../assets/images/ACGCLOGO1.png";

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loginLoading) {
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
      const isCustomer = response.user?.role === "customer";
      const destination = isCustomer
        ? requestedPath?.startsWith("/customer-dashboard")
          ? requestedPath
          : "/customer-dashboard"
        : requestedPath && !requestedPath.startsWith("/customer-dashboard")
          ? requestedPath
          : "/dashboard";
      setRedirecting(true);
      window.setTimeout(() => {
        navigate(destination, { replace: true });
      }, 3000);
    } catch (err) {
      setError(err.data?.message || err.message || "Login failed.");
    }
  };

  if (loginLoading || redirecting) {
    return (
      <div className="login-loading-page min-h-screen bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] flex items-center justify-center px-4">
        <div className="text-center text-white">
          <img
            src={logo}
            alt="ACGC Logo"
            className="login-loading-logo w-56 mx-auto drop-shadow-2xl"
          />
          <div className="login-loading-spinner-wrap mx-auto mt-10">
            <LoaderCircle
              size={52}
              strokeWidth={2.5}
              className="login-loading-spinner text-red-400"
              aria-hidden="true"
            />
          </div>
          <h1 className="login-loading-heading mt-6 text-3xl font-black">Signing you in...</h1>
          <p className="login-loading-text mt-3 text-slate-300">Preparing your dashboard</p>
          <div className="login-loading-dots mt-6" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] flex items-center justify-center px-4 py-8 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(135deg,#020617,#111827_54%,#450a0a)] [background-size:42px_42px,42px_42px,100%_100%]">

      <div className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/90 shadow-[0_28px_90px_rgba(2,6,23,0.65)] backdrop-blur-xl">

        <div className="grid lg:grid-cols-2">

          {/* LEFT SIDE */}

          <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] p-12 text-white lg:min-h-[680px]">

            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(148,163,184,.08),transparent_42%,rgba(127,29,29,.28))]" />
            <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-16 -top-8 h-56 w-56 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />

            <div className="relative z-10 text-center">

              <p className="mb-10 text-sm font-black uppercase tracking-[0.3em] text-red-100">
                Welcome To
              </p>

              <img
                src={logo}
                alt="ACGC Logo"
                className="w-72 mx-auto drop-shadow-2xl"
              />

              <p className="mx-auto mt-10 max-w-md text-lg font-medium leading-8 text-red-50">
                Securely manage products, site inspections,
                and operations from one powerful dashboard.
              </p>

            </div>

          </div>

          {/* RIGHT SIDE */}

          <div className="flex items-center bg-white p-7 text-slate-900 lg:p-12">

            <div className="w-full">

              <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                Sign in to ACGC
              </h1>

              <p className="mt-2 text-sm leading-5 text-slate-500">
                Enter your credentials to continue.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-7 space-y-5"
              >

                {/* USERNAME */}

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email or Username
                  </label>

                  <input
                    type="text"
                    name="identifier"
                    value={formData.identifier}
                    onChange={handleChange}
                    placeholder="Email or username"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-5 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
                  />

                </div>

                {/* PASSWORD */}

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </label>

                  <div className="relative">

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Password"
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-5 py-3 pr-14 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(!showPassword)
                      }
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-red-600"
                    >
                      {showPassword ? (
                        <EyeOff size={22} />
                      ) : (
                        <Eye size={22} />
                      )}
                    </button>

                  </div>

                </div>

                {/* REMEMBER */}

                <div className="flex items-center gap-3">

                  <input
                    type="checkbox"
                    name="remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    className="h-5 w-5 accent-red-600"
                  />

                  <span className="text-sm text-slate-700">
                    Remember me
                  </span>

                </div>

                {/* LOGIN BUTTON */}

                {error || authError ? (
                  <p className="text-sm text-red-600 font-medium">
                    {error || authError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className={`w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 py-3 text-base font-bold text-white shadow-lg shadow-red-900/20 transition ${loginLoading ? "cursor-not-allowed opacity-60 hover:scale-100" : "hover:scale-[1.01] hover:shadow-red-900/30"}`}
                >
                  {loginLoading ? "Logging in..." : "Login"}
                </button>

                {/* BACK BUTTON */}

                <Link
                  to="/"
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-slate-100 py-3 text-base font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-200"
                >
                  <ChevronLeft size={22} />
                  Back to Browse
                </Link>

                {/* LINKS */}

                <div className="flex justify-center gap-4 pt-1 text-sm">

                <Link
                  to="/forgot-password"
                  className="font-semibold text-red-500 hover:text-red-600"
                >
                  Forgot Password?
                </Link>

                  <span className="text-slate-300">|</span>

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