import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ChakraProvider, Box, Flex, useColorMode } from '@chakra-ui/react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Button, Text, useDisclosure
} from '@chakra-ui/react';
import theme from './theme';
import { Toaster, toast } from 'sonner';
import Sidebar, { DRAWER_WIDTH } from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import PayrollProcessing from './pages/PayrollProcessing';
import PayrollHistory from './pages/PayrollHistory';
import ReactivatePayroll from './pages/ReactivatePayroll';
import Departments from './pages/Departments';
import Areas from './pages/Areas';
import Divisions from './pages/Divisions';
import Subdivisions from './pages/Subdivisions';
import Dimension5 from './pages/Dimension5';
import Companies from './pages/Companies';
import Settings from './pages/Settings';
import OperationLogs from './pages/OperationLogs';
import Login from './pages/auth/Login';
import Users from './pages/Users';
import BillingDistribution from './pages/BillingDistribution';
import BillingRules from './pages/BillingRules';

import ForgotPassword from './pages/auth/ForgotPassword';
import './index.css';

export const AppContext = createContext();

// Layout with Sidebar for main app pages
function MainLayout() {
  return (
    <Flex h="100vh" overflow="hidden" sx={{ '@media print': { h: 'auto', overflow: 'visible' } }}>
      <Sidebar />
      <Box
        as="main"
        flex="1"
        overflow="auto"
        bg="chakra-body-bg"
        pt={{ base: '60px', md: 0 }}
        sx={{ '@media print': { overflow: 'visible', h: 'auto' } }}
      >
        <Outlet />
      </Box>
    </Flex>
  );
}

// Protected Route Wrapper
function ProtectedRoute() {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <Flex h="100vh" align="center" justify="center">Cargando...</Flex>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Role Protected Route Wrapper
function RoleProtectedRoute({ allowedRoles }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <Flex h="100vh" align="center" justify="center">Cargando...</Flex>;
  if (!user) return <Navigate to="/login" replace />;
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Outlet />;
}

// Layout without Sidebar for auth pages
function AuthLayout() {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <Flex className="app-layout" justify="center" align="center">
      <Outlet />
    </Flex>
  );
}

function AppContent() {
  const { colorMode, toggleColorMode } = useColorMode();
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  const showToast = (message, type = 'success') => {
    if (type === 'danger' || type === 'error') {
      toast.error(message);
    } else if (type === 'success') {
      toast.success(message);
    } else {
      toast(message);
    }
  };

  const confirmAction = (message, onConfirm) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorMode);
  }, [colorMode]);

  return (
    <AppContext.Provider value={{ theme: colorMode, toggleTheme: toggleColorMode, showToast, confirmAction }}>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              {/* Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>

              {/* Main App Routes (Protected) */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  
                  {/* ALL ROLES */}
                  <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'GERENTE GENERAL', 'NOMINA', 'AUDITOR', 'GERENTE', 'SOLICITANTE', 'DIGITADOR']} />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                  </Route>

                  {/* ADMIN, GERENTE GENERAL */}
                  <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'GERENTE GENERAL']} />}>
                    <Route path="/reactivate" element={<ReactivatePayroll />} />
                  </Route>

                  {/* ADMIN, GERENTE GENERAL, NOMINA, AUDITOR */}
                  <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'GERENTE GENERAL', 'NOMINA', 'AUDITOR']} />}>
                    <Route path="/payroll" element={<PayrollProcessing />} />
                    <Route path="/history" element={<PayrollHistory />} />
                    <Route path="/departments" element={<Departments />} />
                    <Route path="/areas" element={<Areas />} />
                    <Route path="/divisions" element={<Divisions />} />
                    <Route path="/subdivisions" element={<Subdivisions />} />
                    <Route path="/dimension5" element={<Dimension5 />} />
                    <Route path="/companies" element={<Companies />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/billing" element={<BillingDistribution />} />
                    <Route path="/billing/rules" element={<BillingRules />} />
                  </Route>

                  {/* ADMIN, GERENTE GENERAL, NOMINA, AUDITOR, DIGITADOR */}
                  <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'GERENTE GENERAL', 'NOMINA', 'AUDITOR', 'DIGITADOR']} />}>
                    <Route path="/employees" element={<Employees />} />
                  </Route>

                  {/* ADMIN, GERENTE GENERAL, GERENTE, SOLICITANTE, NOMINA */}
                  <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'GERENTE GENERAL', 'GERENTE', 'SOLICITANTE', 'NOMINA']} />}>
                    <Route path="/operations" element={<OperationLogs />} />
                  </Route>

                  {/* ADMIN, GERENTE GENERAL, NOMINA, DIGITADOR */}
                  <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'GERENTE GENERAL', 'NOMINA', 'DIGITADOR']} />}>
                    <Route path="/users" element={<Users />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>

          {/* Global Toast */}
          <Toaster position="bottom-center" richColors expand={true} />

          {/* Global Confirm Modal */}
          <Modal isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog({ isOpen: false })} isCentered size="sm">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader fontWeight={700} fontSize="lg" textAlign="center">
                Confirmación Requerida
              </ModalHeader>
              <ModalCloseButton />
              <ModalBody textAlign="center" pb={2}>
                <Text color="gray.500" fontSize="sm">
                  {confirmDialog.message}
                </Text>
              </ModalBody>
              <ModalFooter justifyContent="center" gap={3} pb={6}>
                <Button 
                  variant="ghost" 
                  onClick={() => setConfirmDialog({ isOpen: false })}
                  borderRadius="lg"
                >
                  Cancelar
                </Button>
                <Button 
                  colorScheme="red" 
                  onClick={() => {
                    if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                    setConfirmDialog({ isOpen: false });
                  }}
                  borderRadius="lg"
                >
                  Confirmar Acción
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </DataProvider>
      </AuthProvider>
    </AppContext.Provider>
  );
}

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AppContent />
    </ChakraProvider>
  );
}

export default App;
