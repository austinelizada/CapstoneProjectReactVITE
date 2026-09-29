import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "../../assets/images/ACGCLOGO1.png";
import {
  AtSign,
  Building2,
  Eye,
  EyeOff,
  Hash,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Map,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";

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

  return { score, ...levels[score - 1] };
};

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
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const passwordStrength = getPasswordStrength(formData.password);

  useEffect(() => {
    if (!adminLoading && adminExists === false) navigate("/", { replace: true });
  }, [adminExists, adminLoading, navigate]);

  const sanitizeFieldValue = (name, value) => {
    if (["first_name", "last_name", "city", "province"].includes(name)) {
      return value.replace(/[^\p{L}\s'-]/gu, "");
    }

    if (["zip_code", "phone"].includes(name)) {
      return value.replace(/\D/g, "");
    }

    return value;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: sanitizeFieldValue(name, value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setAuthError("");

    if (submitting) return;

    if (Object.values(formData).some((value) => !value)) {
      setError("Please complete all required fields.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await register({
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
      navigate("/login", {
        replace: true,
        state: { message: response.message || `Verification email sent to ${formData.email}.` },
      });
    } catch (err) {
      setError(err.data?.message || err.message || "Sign up failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-gray-300 py-2.5 pr-4 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] p-4 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(135deg,#020617,#111827_54%,#450a0a)] [background-size:42px_42px,42px_42px,100%_100%] sm:p-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[20px] border border-gray-800 bg-white shadow-[0_24px_70px_rgba(2,6,23,0.6)] lg:max-h-[calc(100vh-2rem)] lg:grid-cols-5">
        <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-[#111827] to-[#450a0a] px-5 py-6 text-white sm:px-7 lg:col-span-2 lg:min-h-[560px]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(148,163,184,.08),transparent_42%,rgba(127,29,29,.28))]" />
          <div className="pointer-events-none absolute -right-28 -top-20 h-80 w-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-16 -top-8 h-56 w-56 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative z-10 text-center">
            <p className="mb-5 text-xs font-black uppercase tracking-[0.3em] text-red-100">Welcome To</p>
            <img src={logo} alt="ACGC" className="mx-auto mb-4 w-44 drop-shadow-2xl" />
            <p className="mx-auto max-w-sm text-xs font-medium leading-5 text-red-50">Securely manage products, site inspections, and operations from one powerful dashboard.</p>
          </div>
        </div>

        <div className="overflow-y-auto bg-white p-4 lg:col-span-3 lg:p-6">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-red-700">Customer registration</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Create your ACGC account</h1>
            <p className="mt-1 text-xs leading-5 text-gray-500">Verify your email to activate your profile.</p>

            <form className="mt-4" onSubmit={handleSubmit}>
              {error || authError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error || authError}</div> : null}
              {success ? <div className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div> : null}

              <div className="grid gap-2 md:grid-cols-2">
                <Field icon={UserRound} label="First Name *" name="first_name" value={formData.first_name} onChange={handleChange} placeholder="Enter your first name" inputClass={inputClass} />
                <Field icon={UserRound} label="Last Name *" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Enter your last name" inputClass={inputClass} />
                <Field icon={Mail} label="Email *" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" inputClass={inputClass} />
                <Field icon={AtSign} label="Username *" name="username" value={formData.username} onChange={handleChange} placeholder="Choose a username" inputClass={inputClass} />
              </div>

              <div className="mt-2"><Field icon={MapPin} label="Address *" name="street_address" value={formData.street_address} onChange={handleChange} placeholder="Enter your street address" inputClass={inputClass} /></div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <Field icon={Building2} label="City *" name="city" value={formData.city} onChange={handleChange} placeholder="Enter your city" inputClass={inputClass} />
                <Field icon={Map} label="Province *" name="province" value={formData.province} onChange={handleChange} placeholder="Enter your province" inputClass={inputClass} />
                <Field icon={Hash} label="Zip Code *" name="zip_code" inputMode="numeric" value={formData.zip_code} onChange={handleChange} placeholder="4000" inputClass={inputClass} />
                <Field icon={Phone} label="Phone Number *" name="phone" inputMode="numeric" value={formData.phone} onChange={handleChange} placeholder="639123456789" inputClass={inputClass} />
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <Field
                    icon={LockKeyhole}
                    label="Password *"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    inputClass={inputClass}
                    showPasswordToggle
                    passwordVisible={showPassword}
                    onToggleVisibility={() => setShowPassword((visible) => !visible)}
                  />
                  {formData.password ? (
                    <div className="mt-2" aria-live="polite">
                      <div
                        className="h-1.5 w-3/4 overflow-hidden rounded-full bg-slate-200"
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
                      <p className="mt-1 text-xs font-semibold" style={{ color: passwordStrength.color }}>
                        {passwordStrength.label} password
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs leading-4 text-slate-500">
                    Use 12+ characters with uppercase, lowercase, a number, and a symbol for a stronger password.
                  </p>
                </div>
                <div>
                  <Field
                    icon={LockKeyhole}
                    label="Confirm Password *"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    inputClass={inputClass}
                    showPasswordToggle
                    passwordVisible={showConfirmPassword}
                    onToggleVisibility={() => setShowConfirmPassword((visible) => !visible)}
                    isValid={formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword}
                  />
                  {formData.confirmPassword ? (
                    <p className={`mt-2 text-xs font-semibold ${formData.password === formData.confirmPassword ? "text-green-600" : "text-red-600"}`} role="status">
                      {formData.password === formData.confirmPassword ? "Passwords match" : "Passwords do not match"}
                    </p>
                  ) : null}
                </div>
              </div>

              <button type="submit" disabled={submitting} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:scale-[1.01] hover:shadow-red-900/30 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? <><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Sending...</> : "Verify Email"}
              </button>
              <p className="mt-3 text-center text-xs text-gray-500">Already have an account? <Link to="/login" className="ml-2 font-bold text-red-700">Login</Link></p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, inputClass, icon: Icon, showPasswordToggle = false, passwordVisible = false, onToggleVisibility, isValid = false, ...props }) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <span className="mb-1 block">{label}</span>
      <span className="relative block">
        <Icon
          size={18}
          strokeWidth={1.8}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input {...props} className={`${inputClass} ${isValid ? "border-green-500 focus:border-green-500 focus:ring-green-500/10" : ""} ${showPasswordToggle ? "pr-11" : ""} pl-11`} />
        {showPasswordToggle ? (
          <button
            type="button"
            onClick={onToggleVisibility}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-red-700"
            aria-label={passwordVisible ? "Hide password" : "Show password"}
          >
            {passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        ) : null}
      </span>
    </label>
  );
}

export default Signup;
