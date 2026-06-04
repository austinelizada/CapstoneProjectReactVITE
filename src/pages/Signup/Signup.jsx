import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "../../assets/images/ACGCLOGO1.png";

function Signup() {
  const navigate = useNavigate();
  const { register, authError, setAuthError, adminExists, adminLoading } = useAuth();

  useEffect(() => {
    if (!adminLoading && adminExists === false) {
      navigate("/", { replace: true });
    }
  }, [adminExists, adminLoading, navigate]);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    street_address: "",
    city: "",
    province: "",
    zip_code: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setAuthError("");

    if (
      !formData.first_name ||
      !formData.last_name ||
      !formData.email ||
      !formData.username ||
      !formData.street_address ||
      !formData.city ||
      !formData.province ||
      !formData.zip_code ||
      !formData.phone ||
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

    try {
      await register({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        username: formData.username,
        street_address: formData.street_address,
        city: formData.city,
        province: formData.province,
        zip_code: formData.zip_code,
        phone: formData.phone,
        password: formData.password,
      });
      navigate("/customer-dashboard", { replace: true });
    } catch (err) {
      setError(err.data?.message || err.message || "Sign up failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-red-900 to-black flex items-center justify-center p-6">

      <div className="w-full max-w-6xl bg-white rounded-[35px] overflow-hidden shadow-2xl grid lg:grid-cols-5">

        {/* LEFT PANEL */}

        <div className="lg:col-span-2 bg-gradient-to-b from-red-600 via-red-700 to-red-950 text-white flex flex-col justify-center items-center px-10 py-12">

          <p className="uppercase text-lg tracking-wide mb-8">
            Welcome To
          </p>

          <img
            src={logo}
            alt="ACGC"
            className="w-72 mb-10"
          />

          <p className="text-center text-xl leading-10 max-w-sm">
            Securely manage products, site inspections,
            and operations from one powerful dashboard.
          </p>

          <p className="text-center text-lg mt-8 leading-9 max-w-sm text-white/90">
            Instant account verification
            Trusted workflow visibility
            Easy access to inspections,
            orders, and transactions
          </p>

        </div>

        {/* RIGHT PANEL */}

        <div className="lg:col-span-3 p-10">

          <h1 className="text-5xl font-bold text-slate-900">
            Create your ACGC account
          </h1>

          <p className="mt-3 text-gray-500">
            Verify your email to activate your profile.
          </p>

          <form className="mt-10" onSubmit={handleSubmit}>

            {error || authError ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                {error || authError}
              </div>
            ) : null}

            <div className="grid md:grid-cols-2 gap-5">

              <div>
                <label className="block mb-2 font-semibold">
                  First Name *
                </label>

                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="Enter your first name"
                  className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">
                  Last Name *
                </label>

                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Enter your last name"
                  className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">
                  Email *
                </label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">
                  Username *
                </label>

                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                  className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
                />
              </div>

            </div>

            <div className="mt-5">
              <label className="block mb-2 font-semibold">
                Address *
              </label>

              <input
                type="text"
                name="street_address"
                value={formData.street_address}
                onChange={handleChange}
                placeholder="Enter your street address"
                className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-5 mt-5">

              <div>
                <label className="block mb-2 font-semibold">
                  City *
                </label>

                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Enter your city"
                  className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">
                  Province *
                </label>

                <input
                  type="text"
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  placeholder="Enter your province"
                  className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
                />
              </div>

            </div>

            <div className="grid md:grid-cols-2 gap-5 mt-5">

              <div>
                <label className="block mb-2 font-semibold">
                  Zip Code *
                </label>

                <input
                  type="text"
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleChange}
                  placeholder="4000"
                  className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">
                  Phone Number *
                </label>

                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+63"
                  className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
                />
              </div>

            </div>

            <div className="mt-5">
              <label className="block mb-2 font-semibold">
                Password *
              </label>

              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
              />
            </div>

            <div className="mt-5">
              <label className="block mb-2 font-semibold">
                Confirm Password *
              </label>

              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-6 py-4 rounded-2xl font-bold text-white bg-red-600 via-red-800 to-black hover:scale-[1.01] transition"
            >
              Verify Email
            </button>

            <p className="text-center mt-8 text-gray-500">
              Already have an account?

              <Link
                to="/login"
                className="ml-2 text-red-700 font-bold"
              >
                Login
              </Link>
            </p>

          </form>

        </div>

      </div>

    </div>
  );
}

export default Signup;