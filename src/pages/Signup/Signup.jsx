import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "../../assets/images/ACGCLOGO1.png";

function Signup() {
  const navigate = useNavigate();
  const { register, authError, setAuthError, adminExists, adminLoading } = useAuth();
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

  useEffect(() => {
    if (!adminLoading && adminExists === false) navigate("/", { replace: true });
  }, [adminExists, adminLoading, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setAuthError("");

    if (Object.values(formData).some((value) => !value)) {
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

  const inputClass = "w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] p-4 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(135deg,#020617,#111827_54%,#450a0a)] [background-size:42px_42px,42px_42px,100%_100%] sm:p-6">
      <div className="grid w-full max-w-7xl overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_28px_90px_rgba(2,6,23,0.65)] lg:max-h-[calc(100vh-2rem)] lg:grid-cols-5">
        <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] px-6 py-8 text-white sm:px-8 lg:col-span-2 lg:min-h-[620px]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(148,163,184,.08),transparent_42%,rgba(127,29,29,.28))]" />
          <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-16 -top-8 h-56 w-56 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative z-10 text-center">
            <p className="mb-5 text-xs font-black uppercase tracking-[0.3em] text-red-100">Welcome To</p>
            <img src={logo} alt="ACGC" className="mx-auto mb-6 w-52 drop-shadow-2xl" />
            <p className="mx-auto max-w-sm text-sm font-medium leading-6 text-red-50">Securely manage products, site inspections, and operations from one powerful dashboard.</p>
          </div>
        </div>

        <div className="overflow-y-auto bg-white p-5 lg:col-span-3 lg:p-7">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-red-700">Customer registration</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Create your ACGC account</h1>
            <p className="mt-2 text-sm leading-5 text-gray-500">Verify your email to activate your profile.</p>

            <form className="mt-5" onSubmit={handleSubmit}>
              {error || authError ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error || authError}</div> : null}

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="First Name *" name="first_name" value={formData.first_name} onChange={handleChange} placeholder="Enter your first name" inputClass={inputClass} />
                <Field label="Last Name *" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Enter your last name" inputClass={inputClass} />
                <Field label="Email *" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" inputClass={inputClass} />
                <Field label="Username *" name="username" value={formData.username} onChange={handleChange} placeholder="Choose a username" inputClass={inputClass} />
              </div>

              <div className="mt-3"><Field label="Address *" name="street_address" value={formData.street_address} onChange={handleChange} placeholder="Enter your street address" inputClass={inputClass} /></div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="City *" name="city" value={formData.city} onChange={handleChange} placeholder="Enter your city" inputClass={inputClass} />
                <Field label="Province *" name="province" value={formData.province} onChange={handleChange} placeholder="Enter your province" inputClass={inputClass} />
                <Field label="Zip Code *" name="zip_code" value={formData.zip_code} onChange={handleChange} placeholder="4000" inputClass={inputClass} />
                <Field label="Phone Number *" name="phone" value={formData.phone} onChange={handleChange} placeholder="+63" inputClass={inputClass} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Password *" type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Enter your password" inputClass={inputClass} />
                <Field label="Confirm Password *" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Confirm your password" inputClass={inputClass} />
              </div>

              <button type="submit" className="mt-4 w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:scale-[1.01] hover:shadow-red-900/30">Verify Email</button>
              <p className="mt-5 text-center text-xs text-gray-500">Already have an account? <Link to="/login" className="ml-2 font-bold text-red-700">Login</Link></p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, inputClass, ...props }) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <span className="mb-2 block">{label}</span>
      <input {...props} className={inputClass} />
    </label>
  );
}

export default Signup;
