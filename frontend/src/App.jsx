import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider, CssBaseline, Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Snackbar, Alert } from '@mui/material';
import { getTheme } from './theme';
import Sidebar, { DRAWER_WIDTH } from './components/Sidebar';
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

// Layout with Sidebar for main app pages
function MainLayout() {
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: 'background.default',
        }}
      >
        <Outlet />
      </Box>
    </Box>
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
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('nomina-theme') || 'dark');
  const [toast, setToast] = useState({ message: '', visible: false, type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  const muiTheme = useMemo(() => getTheme(themeMode), [themeMode]);

  const showToast = (message, type = 'success') => {
    setToast({ message, visible: true, type });
    setTimeout(() => setToast({ message: '', visible: false, type: 'success' }), 3000);
  };

  const confirmAction = (message, onConfirm) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  };

  const toggleTheme = () => {
    setThemeMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('nomina-theme', next);
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AppContext.Provider value={{ theme: themeMode, toggleTheme, showToast, confirmAction }}>
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
            <Snackbar
              open={toast.visible}
              autoHideDuration={3000}
              onClose={() => setToast(prev => ({ ...prev, visible: false }))}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Alert
                severity={toast.type === 'danger' ? 'error' : toast.type === 'success' ? 'success' : 'info'}
                variant="filled"
                sx={{ fontWeight: 600, borderRadius: 2 }}
              >
                {toast.message}
              </Alert>
            </Snackbar>

            {/* Global Confirm Modal */}
            <Dialog
              open={confirmDialog.isOpen}
              onClose={() => setConfirmDialog({ isOpen: false })}
              maxWidth="xs"
              fullWidth
              PaperProps={{ sx: { borderRadius: 3, textAlign: 'center', p: 1 } }}
            >
              <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                Confirmación Requerida
              </DialogTitle>
              <DialogContent>
                <Typography variant="body2" color="text.secondary">
                  {confirmDialog.message}
                </Typography>
              </DialogContent>
              <DialogActions sx={{ justifyContent: 'center', pb: 2.5, gap: 1 }}>
                <Button variant="outlined" color="inherit" onClick={() => setConfirmDialog({ isOpen: false })} sx={{ borderRadius: 2 }}>
                  Cancelar
                </Button>
                <Button variant="contained" color="error" onClick={() => {
                  if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                  setConfirmDialog({ isOpen: false });
                }} sx={{ borderRadius: 2 }}>
                  Confirmar Acción
                </Button>
              </DialogActions>
            </Dialog>
          </DataProvider>
        </AuthProvider>
      </AppContext.Provider>
    </ThemeProvider>
  );
}

export default App;
