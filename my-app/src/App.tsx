// @ts-ignore
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
// @ts-ignore
import { isAdmin, isAuthenticated } from './lib/jwtUtils'

// --- Public Pages ---
// @ts-ignore
import Landing from './pages/Landing'
// @ts-ignore
import Booking from './pages/Bookings' // This is the User-side booking page
// @ts-ignore
import UserProfile from './pages/Profile' 

// --- Auth Pages ---
// @ts-ignore
import Login from './pages/auth/Login'
// @ts-ignore
import Register from './pages/auth/Register'
// @ts-ignore
import AccountCreated from './pages/auth/Account-created'
// @ts-ignore
import ForgotPassword from './pages/auth/Forgot-password'
// @ts-ignore
import VerifyOTP from './pages/auth/Verify-OTP'
// @ts-ignore
import VerifyResetOTP from './pages/auth/Verify-reset-otp'
// @ts-ignore
import ResetPassword from './pages/auth/Reset-password'

// --- Admin Pages ---
// @ts-ignore
import AdminDashboard from './pages/admin/AdminDashboard'
// @ts-ignore
import AdminBookings from './pages/admin/AdminBookings'
// @ts-ignore
import AdminProfile from './pages/admin/AdminProfile'
// @ts-ignore
import AdminReports from './pages/admin/AdminReports'
// @ts-ignore
import UsersManagement from './pages/admin/UsersManagement'
// @ts-ignore
import AdminModules from './pages/admin/AdminModules'
// @ts-ignore
import AdminInstructors from './pages/admin/AdminInstructors'
// @ts-ignore
import AdminPayments from './pages/admin/AdminPayments'
// @ts-ignore
import AdminNotifications from './pages/admin/AdminNotifications'
// @ts-ignore
import AdminActivityLogs from './pages/admin/AdminActivityLogs'

// --- Reusable Admin Protected Route ---
// This allows any child component to be protected by the token check
// @ts-ignore
const ProtectedAdminRoute = ({ children }) => {
  const authenticated = isAuthenticated();
  const admin = isAdmin();
  
  if (!authenticated) {
    return <Navigate to="/auth/login" replace />; 
  }

  if (!admin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing */}
        <Route path="/" element={<Landing />} />

        {/* Auth Routes */}
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/Account-created" element={<AccountCreated />} />
        <Route path="/auth/Forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/Verify-otp" element={<VerifyOTP />} />
        <Route path="/auth/verify-reset-otp" element={<VerifyResetOTP />} />
        <Route path="/auth/Reset-password" element={<ResetPassword />} />
        
        {/* User Routes */}
        <Route path="/Bookings" element={<Booking />} />
        <Route path="/Profile" element={<UserProfile />} /> 

        {/* --- ADMIN ROUTES --- */}
        
        {/* Admin Dashboard */}
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedAdminRoute>
              <AdminDashboard />
            </ProtectedAdminRoute>
          } 
        />

        {/* Admin Users */}
        <Route 
          path="/admin/users" 
          element={
            <ProtectedAdminRoute>
              <UsersManagement />
            </ProtectedAdminRoute>
          } 
        />

        {/* Admin Bookings */}
        <Route 
          path="/admin/bookings" 
          element={
            <ProtectedAdminRoute>
              <AdminBookings />
            </ProtectedAdminRoute>
          } 
        />

        {/* Admin Modules & Lessons */}
        <Route 
          path="/admin/modules" 
          element={
            <ProtectedAdminRoute>
              <AdminModules />
            </ProtectedAdminRoute>
          } 
        />

        {/* Admin Instructors */}
        <Route 
          path="/admin/instructors" 
          element={
            <ProtectedAdminRoute>
              <AdminInstructors />
            </ProtectedAdminRoute>
          } 
        />

        {/* Admin Payments */}
        <Route 
          path="/admin/payments" 
          element={
            <ProtectedAdminRoute>
              <AdminPayments />
            </ProtectedAdminRoute>
          } 
        />

        {/* Admin Notifications */}
        <Route 
          path="/admin/notifications" 
          element={
            <ProtectedAdminRoute>
              <AdminNotifications />
            </ProtectedAdminRoute>
          } 
        />

        {/* Admin Activity Logs */}
        <Route 
          path="/admin/activity" 
          element={
            <ProtectedAdminRoute>
              <AdminActivityLogs />
            </ProtectedAdminRoute>
          } 
        />

        {/* Admin Reports */}
        <Route 
          path="/admin/reports" 
          element={
            <ProtectedAdminRoute>
              <AdminReports />
            </ProtectedAdminRoute>
          } 
        />

        {/* Admin Profile */}
        <Route 
          path="/admin/profile" 
          element={
            <ProtectedAdminRoute>
              <AdminProfile />
            </ProtectedAdminRoute>
          } 
        />

        {/* Fallback/404 Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App