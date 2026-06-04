import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import logo from "../../assets/images/ACGCLOGO1.png";

function TrackOrder() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* NAVBAR */}

      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1 }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-white/95 backdrop-blur-2xl shadow-sm"
      >

        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">

          <div className="flex items-center gap-4">

            <motion.img
              animate={{ rotate: [0, 3, -3, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              src={logo}
              alt="logo"
              className="w-14 h-14 object-contain"
            />

            <div>

              <h1 className="font-bold text-xl text-red-600">
                ACGC Aluminum Services
              </h1>

              <p className="text-xs text-gray-600 font-medium">
                Aluminum & Glass Management System
              </p>

            </div>

          </div>

          <nav className="hidden lg:flex items-center gap-10">

            <Link
              to="/"
              className="relative transition duration-300 font-medium text-gray-800 hover:text-red-600"
            >
              Home
            </Link>

            <Link
              to="/products"
              className="relative transition duration-300 font-medium text-gray-800 hover:text-red-600"
            >
              Browse Products
            </Link>

            <Link
              to="/"
              className="relative transition duration-300 font-medium text-gray-800 hover:text-red-600"
            >
              About Us
            </Link>
            
            <Link
              to="/track-order"
              className="relative transition duration-300 font-medium text-red-600"
            >
              Track Order
            </Link>

          </nav>

          <div className="hidden lg:flex items-center gap-4">

            <Link
              to="/login"
              className="border border-white/20 hover:border-gray-500 px-5 py-2 rounded-xl bg-white/5 backdrop-blur-xl transition"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="bg-red-600 px-6 py-2 rounded-xl font-semibold text-white shadow-lg shadow-red-900/20 hover:scale-105 transition"
            >
              Sign Up
            </Link>

          </div>

        </div>

      </motion.header>

      {/* HERO */}

      <section className="bg-white-700 text-black py-8 mt-32">

        <div className="max-w-5xl mx-auto text-center px-6">

          <h1 className="text-5xl font-bold">
            Track Your Order
          </h1>

          <p className="mt-5 text-lg text-red-500 font-bold">
            Check your aluminum & glass order status anytime.
          </p>

        </div>

      </section>

      {/* TRACK FORM */}

      <main className="flex-grow py-4 px-6">

        <div className="max-w-3xl mx-auto">

          <div className="bg-white rounded-3xl shadow-xl p-10">

            <h2 className="text-3xl font-bold text-center text-red-700">

              Order Tracking

            </h2>

            <p className="text-center text-gray-500 mt-3 mb-10">

              Enter your Order ID below.

            </p>

            <form className="space-y-6">

              <input
                type="text"
                placeholder="Enter Order ID"
                className="w-full border border-gray-300 rounded-xl p-5 focus:outline-none focus:ring-2 focus:ring-red-500"
              />

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl text-lg font-semibold transition"
              >
                Track Order
              </button>

            </form>

            {/* SAMPLE RESULT */}

            <div className="mt-10 border-t pt-8">

              <h3 className="font-bold text-xl text-gray-800 mb-5">

                Order Status

              </h3>

              <div className="bg-gray-100 rounded-xl p-6">

                <div className="flex justify-between mb-4">

                  <span className="font-medium">
                    Order ID:
                  </span>

                  <span>
                    ORD-2026-001
                  </span>

                </div>

                <div className="flex justify-between mb-4">

                  <span className="font-medium">
                    Customer:
                  </span>

                  <span>
                    Juan Dela Cruz
                  </span>

                </div>

                <div className="flex justify-between mb-4">

                  <span className="font-medium">
                    Product:
                  </span>

                  <span>
                    Sliding Window System
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="font-medium">
                    Status:
                  </span>

                  <span className="bg-green-100 text-green-700 px-4 py-1 rounded-full font-semibold">

                    In Progress

                  </span>

                </div>

              </div>

            </div>

          </div>

        </div>

      </main>

      {/* FOOTER */}

<footer className="border-t border-white/10 bg-black/70 py-8 mt-10">

  <div className="max-w-7xl mx-auto px-6 py-14">

    <div className="grid lg:grid-cols-3 gap-14">

      <div>

        <div className="flex items-center gap-4">

          <img
            src={logo}
            alt="logo"
            className="w-20 h-14 object-contain"
          />

          <div>

            <h3 className="font-bold text-xl text-white">

              ACGC Aluminum Services

            </h3>

            <p className="text-gray-300 text-sm">

              Premium Glass & Aluminum Solutions

            </p>

          </div>

        </div>

      </div>

      <div>

        <h4 className="font-bold text-white 500 mb-6">

          Quick Links

        </h4>

        <div className="space-y-4 text-gray-300">

          <p>Home</p>
          <p>Browse Products</p>
          <p>Track Order</p>
          <p>About Us</p>

        </div>

      </div>

      <div>

        <h4 className="font-bold text-white 500 mb-6">

          Contact

        </h4>

        <div className="space-y-4 text-gray-300">

          <p>Email: acgc.services00@email.com</p>

          <p>Phone: +63 900 000 0000</p>

          <p>Philippines</p>

        </div>

      </div>

    </div>

    <div className="border-t border-white/40 mt-12 pt-8 text-center text-white 500 text-sm">

      © 2026 ACGC Aluminum Services — All Rights Reserved.

    </div>

  </div>

</footer>

</div>
  );
}
export default TrackOrder;
