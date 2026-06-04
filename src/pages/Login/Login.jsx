import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye,
  EyeOff,
  ChevronLeft,
} from "lucide-react";

import logo from "../../assets/images/ACGCLOGO1.png";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authError, setAuthError } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
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

      const destination =
        location.state?.from?.pathname ||
        (response.user?.role === "customer" ? "/customer-dashboard" : "/dashboard");
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.data?.message || err.message || "Login failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a0000] to-[#0f0f0f] flex items-center justify-center px-4 py-8">

      <div className="w-full max-w-6xl bg-white rounded-[35px] overflow-hidden shadow-[0_20px_80px_rgba(255,0,0,.25)]">

        <div className="grid lg:grid-cols-2">

          {/* LEFT SIDE */}

          <div className="relative bg-gradient-to-br from-red-600 via-red-700 to-[#1a0000] flex flex-col justify-center items-center p-12 text-white">

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,.15),transparent_60%)]" />

            <div className="relative z-10 text-center">

              <p className="uppercase tracking-widest text-sm mb-10">
                Welcome To
              </p>

              <img
                src={logo}
                alt="ACGC Logo"
                className="w-72 mx-auto drop-shadow-2xl"
              />

              <p className="mt-10 text-xl font-medium leading-9 max-w-md mx-auto">
                Securely manage products, site inspections,
                and operations from one powerful dashboard.
              </p>

            </div>

          </div>

          {/* RIGHT SIDE */}

          <div className="bg-white p-10 lg:p-16 flex items-center">

            <div className="w-full">

              <h1 className="text-5xl font-black text-slate-900">
                Sign in to ACGC
              </h1>

              <p className="mt-4 text-slate-500 text-lg">
                Enter your credentials to continue.
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-10 space-y-6"
              >

                {/* USERNAME */}

                <div>

                  <label className="block mb-3 font-semibold text-slate-700">
                    Email or Username
                  </label>

                  <input
                    type="text"
                    name="identifier"
                    value={formData.identifier}
                    onChange={handleChange}
                    placeholder="Email or username"
                    className="w-full border border-slate-200 bg-slate-50 rounded-2xl px-5 py-4 outline-none focus:border-red-500"
                  />

                </div>

                {/* PASSWORD */}

                <div>

                  <label className="block mb-3 font-semibold text-slate-700">
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
                      className="w-full border border-slate-200 bg-slate-50 rounded-2xl px-5 py-4 pr-14 outline-none focus:border-red-500"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(!showPassword)
                      }
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500"
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
                    className="w-5 h-5"
                  />

                  <span className="text-slate-700">
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
                  className="w-full py-4 rounded-2xl text-white font-bold text-xl bg-gradient-to-r from-red-600 via-red-700 to-slate-800 hover:scale-[1.02] transition shadow-xl shadow-red-500/20"
                >
                  Login
                </button>

                {/* BACK BUTTON */}

                <Link
                  to="/"
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border border-slate-300 bg-slate-100 text-slate-700 font-bold text-xl hover:bg-slate-200 transition"
                >
                  <ChevronLeft size={22} />
                  Back to Browse
                </Link>

                {/* LINKS */}

                <div className="flex justify-center gap-4 pt-3">

                <Link
                  to="/forgot-password"
                  className="text-red-700 font-semibold hover:underline"
                >
                  Forgot Password?
                </Link>

                  <span className="text-slate-300">|</span>

                  <Link
                    to="/signup"
                    className="text-red-700 font-bold hover:text-red-500"
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