import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import logo from "../../assets/images/ACGCLOGO1.png";
import { LoaderCircle, Truck } from "lucide-react";
import { trackOrder } from "../../api/orders";

function TrackOrder() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingError, setTrackingError] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);

  const handleTrackOrder = async (event) => {
    event.preventDefault();
    const tracking = trackingNumber.trim();
    if (!tracking) {
      setTrackingError("Please enter your tracking number.");
      setTrackingResult(null);
      return;
    }

    setTrackingLoading(true);
    setTrackingError("");
    setTrackingResult(null);
    try {
      const response = await trackOrder(tracking);
      setTrackingResult(response.order || response);
    } catch (error) {
      setTrackingError(error.data?.message || error.message || "No order found with that tracking number.");
    } finally {
      setTrackingLoading(false);
    }
  };

  const statusLabel = (status) => String(status || "Unknown").replace(/_/g, " ");

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-r from-white via-gray-100 to-white text-gray-900 flex flex-col">

      {/* NAVBAR */}

      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1 }}
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-white/95 backdrop-blur-2xl shadow-sm"
      >

        <div className="w-full px-6 py-5 flex justify-between items-center">

          <Link to="/" className="flex items-center gap-4 text-left" aria-label="Go to ACGC Services home">

            <motion.img
              animate={{ rotate: [0, 3, -3, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              src={logo}
              alt="logo"
              className="w-16 h-16 object-contain sm:w-20 sm:h-20"
            />

            <div>

              <h1 className="font-black text-2xl text-red-600 tracking-tight">
                ACGC Services
              </h1>

              <p className="text-2xl text-gray-700 font-bold tracking-tight sm:text-2xl">
                Aluminum & Glass Services
              </p>

            </div>

          </Link>

          <nav className="hidden lg:flex items-center gap-10">

            <Link
              to="/"
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

      {/* TRACK FORM */}

      <main className="flex-grow px-6 pb-16 pt-36">

        <div className="mx-auto max-w-7xl">

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">

            <div className="mb-6 flex items-center gap-3">
              <Truck size={30} className="text-red-600" />
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Track an Order</h2>
                <p className="text-slate-500">Enter your tracking number to see current order status.</p>
              </div>
            </div>

            <form className="grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={handleTrackOrder}>

              <input
                type="text"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Enter tracking ID"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              />

              <button
                type="submit"
                disabled={trackingLoading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {trackingLoading && <LoaderCircle size={20} className="animate-spin" />}
                {trackingLoading ? "Searching..." : "Track"}
              </button>

            </form>

            {trackingError && (
              <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                {trackingError}
              </div>
            )}

            {trackingResult && (
            <div className="mt-10 border-t border-slate-100 pt-8">

              <h3 className="font-black text-xl text-slate-950 mb-5">

                Order Status

              </h3>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">

                <div className="flex justify-between mb-4">

                  <span className="font-medium">
                    Order ID:
                  </span>

                  <span>
                    {trackingResult.tracking || trackingResult._id || "—"}
                  </span>

                </div>

                <div className="flex justify-between mb-4">

                  <span className="font-medium">
                    Customer:
                  </span>

                  <span>
                    {trackingResult.customer_name || `${trackingResult.customer?.first_name || ""} ${trackingResult.customer?.last_name || ""}`.trim() || "—"}
                  </span>

                </div>

                <div className="flex justify-between mb-4">

                  <span className="font-medium">
                    Product:
                  </span>

                  <span>
                    {trackingResult.items?.[0]?.name || trackingResult.items?.[0]?.product_name || "—"}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span className="font-medium">
                    Status:
                  </span>

                    <span className="rounded-full bg-red-100 px-4 py-1 font-semibold capitalize text-red-700">
                    {statusLabel(trackingResult.status)}

                  </span>

                </div>

              </div>

            </div>
            )}

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
