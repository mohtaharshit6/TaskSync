import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/UI/ErrorBoundary';
import OfflineBanner from './components/UI/OfflineBanner';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ForgotPassword from './pages/ForgotPassword';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './components/Dashboard/Dashboard';
import ProjectBoard from './components/Project/ProjectBoard';
import JoinProject from './pages/JoinProject';
import MyTasks from './pages/MyTasks';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading…</div>;
  return user ? children : <Navigate to="/login" state={{ from: location }} replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading…</div>;
  return !user ? children : <Navigate to="/" replace />;
};

const AppRoutes = () => (
  <>
    <OfflineBanner />
    <Routes>
      <Route path="/login"          element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register"       element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/verify-email"    element={<PublicRoute><VerifyEmail /></PublicRoute>} />
      <Route path="/"               element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/projects/:id"   element={<PrivateRoute><ProjectBoard /></PrivateRoute>} />
      <Route path="/join"           element={<PrivateRoute><JoinProject /></PrivateRoute>} />
      <Route path="/my-tasks"       element={<PrivateRoute><MyTasks /></PrivateRoute>} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  </>
);

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <SocketProvider>
            <AppRoutes />
          </SocketProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
