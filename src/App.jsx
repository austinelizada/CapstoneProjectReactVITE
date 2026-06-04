import { BrowserRouter, Routes, Route } from "react-router-dom";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import LandingPage from "./pages/LandingPage/LandingPage";
import Login from "./pages/Login/Login";
import Signup from "./pages/Signup/Signup";
import Dashboard from "./pages/Dashboard/Dashboard";
import TrackOrder from "./pages/TrackOrder/TrackOrder";
import SiteInspection from "./pages/SiteInspection/SiteInspection";
import Transactions from "./pages/Transactions/Transactions";
import ProgressMonitor from "./pages/ProgressMonitor/ProgressMonitor";
import Product from "./pages/Product/Product";
import AdminProfile from "./pages/AdminProfile/AdminProfile";
import Settings from "./pages/Settings/Settings";
import CustomerDashboard from "./pages/CustomerDashboard/CustomerDashboard";
import AdminCreationModal from "./components/AdminCreationModal";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AdminCreationModal />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
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
              <ProtectedRoute>
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;