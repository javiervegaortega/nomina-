import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider, AuthContext } from './context/AuthContext';
import TopNavbar from './components/TopNavbar';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import PayrollProcessing from './pages/PayrollProcessing';
import Companies from './pages/Companies';
import Bonuses from './pages/Bonuses';
import PayrollHistory from './pages/PayrollHistory';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import './index.css';

export const AppContext = createContext();

// Layout with TopNavbar for main app pages
function MainLayout() {
  return (
    <div className="app-layout">
      <TopNavbar />
      <main className="main-content">
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Protected Route Wrapper
function ProtectedRoute() {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Layout without TopNavbar for auth pages
function AuthLayout() {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="app-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Outlet />
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('nomina-theme') || 'dark');
  const [toast, setToast] = useState({ message: '', visible: false, type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  const showToast = (message, type = 'success') => {
    setToast({ message, visible: true, type });
    setTimeout(() => setToast({ message: '', visible: false, type: 'success' }), 3000);
  };

  const confirmAction = (message, onConfirm) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  };

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('nomina-theme', next);
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <AppContext.Provider value={{ theme, toggleTheme, showToast, confirmAction }}>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              {/* Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>

              {/* Main App Routes (Protected) */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/employees" element={<Employees />} />
                  <Route path="/payroll" element={<PayrollProcessing />} />
                  <Route path="/companies" element={<Companies />} />
                  <Route path="/bonuses" element={<Bonuses />} />
                  <Route path="/history" element={<PayrollHistory />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
      {/* Global Toast */}
        <div className={`toast-container ${toast.visible ? 'visible' : ''} ${toast.type}`}>
          {toast.message}
        </div>

        {/* Global Confirm Modal */}
        {confirmDialog.isOpen && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-panel" style={{ maxWidth: '400px', padding: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Confirmación Requerida</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                {confirmDialog.message}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setConfirmDialog({ isOpen: false })}>Cancelar</button>
                <button className="btn btn-primary" style={{ background: 'var(--danger)', color: 'white' }} onClick={() => {
                  if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                  setConfirmDialog({ isOpen: false });
                }}>
                  Confirmar Acción
                </button>
              </div>
            </div>
          </div>
        )}
        </DataProvider>
      </AuthProvider>
    </AppContext.Provider>
  );
}

export default App;
