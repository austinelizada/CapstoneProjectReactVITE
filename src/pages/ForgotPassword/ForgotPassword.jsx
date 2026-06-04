import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import logo from "../../assets/images/ACGCLOGO1.png";

function ForgotPassword() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-red-900 to-black flex items-center justify-center px-6 py-10 overflow-hidden">

      {/* Background Effects */}

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-20 w-72 h-72 bg-red-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-20 w-96 h-96 bg-red-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 w-full max-w-md bg-white rounded-[35px] shadow-2xl p-8"
      >
        {/* Logo */}

        <div className="text-center">
          <img
            src={logo}
            alt="ACGC Logo"
            className="w-32 mx-auto"
          />

          <p className="mt-4 text-xs tracking-[4px] font-bold text-red-700 uppercase">
            ACGC Password Reset
          </p>

          <h1 className="mt-4 text-5xl font-extrabold text-slate-900">
            Forgot Password
          </h1>

          <p className="mt-4 text-gray-500 leading-7">
            Follow the secure verification flow to reset your
            password and keep your account protected.
          </p>
        </div>

        {/* Steps */}

        <div className="mt-8 border border-gray-200 rounded-3xl p-5">
          <div className="flex items-center justify-center">

            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-600 to-red-900 text-white flex items-center justify-center font-bold">
                1
              </div>
              <span className="text-[10px] mt-2 tracking-[3px] uppercase text-gray-500">
                Email
              </span>
            </div>

            <div className="w-16 h-[2px] bg-red-300 mx-2" />

            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full border border-red-300 text-red-700 flex items-center justify-center font-bold">
                2
              </div>
              <span className="text-[10px] mt-2 tracking-[3px] uppercase text-gray-500">
                Verify
              </span>
            </div>

            <div className="w-16 h-[2px] bg-red-300 mx-2" />

            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full border border-red-300 text-red-700 flex items-center justify-center font-bold">
                3
              </div>
              <span className="text-[10px] mt-2 tracking-[3px] uppercase text-gray-500">
                Reset
              </span>
            </div>

          </div>
        </div>

        <p className="text-center text-xs tracking-[5px] text-gray-500 mt-4">
          STEP 1 OF 3
        </p>

        {/* Form */}

        <div className="mt-6 bg-gray-50 rounded-3xl p-6">

          <h2 className="text-3xl font-bold text-center text-slate-900">
            Forgot Password
          </h2>

          <p className="text-center text-gray-500 mt-3 leading-7">
            Enter your email address and we'll send you a
            verification code.
          </p>

          <div className="mt-6">
            <label className="block mb-2 font-semibold text-slate-700">
              Email Address
            </label>

            <input
              type="email"
              placeholder="Enter your registered email"
              className="w-full px-5 py-4 rounded-2xl border border-gray-300 outline-none focus:border-red-500"
            />
          </div>

          <button
            className="w-full mt-6 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-red-600 to-red-950 hover:scale-[1.02] transition"
          >
            Send Code
          </button>

          <div className="text-center mt-5 text-gray-500">
            Remember your password?

            <Link
              to="/login"
              className="ml-2 font-bold text-red-700 hover:text-red-900"
            >
              Back to Login
            </Link>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

export default ForgotPassword;