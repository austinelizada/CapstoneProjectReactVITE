import { BrowserRouter, Routes, Route } from "react-router-dom";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import LandingPage from "./pages/LandingPage/LandingPage";
import Login from "./pages/Login/Login";
import Signup from "./pages/Signup/Signup";
import Dashboard from "./pages/Dashboard/Dashboard";
import TrackOrder from "./pages/TrackOrder/TrackOrder";
import SiteInspection from "./pages/SiteInspection/SiteInspection";
import Notifications from "./pages/Notifications/Notifications";
import Transactions from "./pages/Transactions/Transactions";
import ProgressMonitor from "./pages/ProgressMonitor/ProgressMonitor";
import Product from "./pages/Product/Product";
import AdminProfile from "./pages/AdminProfile/AdminProfile";
import Settings from "./pages/Settings/Settings";
import CustomerDashboard from "./pages/CustomerDashboard/CustomerDashboard";
import AdminCreationModal from "./components/AdminCreationModal";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { AdminThemeProvider, useAdminTheme } from "@/contexts/AdminThemeContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { LoaderCircle } from "lucide-react";
import logo from "./assets/images/ACGCLOGO1.png";


function LogoutLoadingScreen() {
  return (
    <div className="login-loading-page min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a0000] to-[#0f0f0f] flex items-center justify-center px-4">
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
            className="login-loading-spinner text-red-500"
            aria-hidden="true"
          />
        </div>
        <h1 className="login-loading-heading mt-6 text-3xl font-black">
          Signing you out...
        </h1>
        <p className="login-loading-text mt-3 text-slate-300">
          Securing your session
        </p>
        <div className="login-loading-dots mt-6" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { logoutLoading, user } = useAuth();
  const { darkMode } = useAdminTheme();

  if (logoutLoading) {
    return <LogoutLoadingScreen />;
  }

  return (
    <div className={user?.role === "admin" && darkMode ? "admin-theme-shell admin-theme-dark" : "admin-theme-shell"}>
      <AdminCreationModal />
      <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={["admin"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/track-order"
            element={
              <ProtectedRoute>
                <TrackOrder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/site-inspection"
            element={
              <ProtectedRoute>
                <SiteInspection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress-monitor"
            element={
              <ProtectedRoute>
                <ProgressMonitor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/product"
            element={
              <ProtectedRoute roles={["admin"]}>
                <Product />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AdminProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer-dashboard/*"
            element={
              <ProtectedRoute roles={["customer"]}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AdminThemeProvider>
          <AppRoutes />
        </AdminThemeProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;