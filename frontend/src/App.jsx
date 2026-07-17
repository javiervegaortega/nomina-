import React, { useState, useEffect, createContext, useContext, useMemo, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ChakraProvider, Box, Flex, useColorMode, Spinner, Center } from '@chakra-ui/react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Button, Text
} from '@chakra-ui/react';
import theme from './theme';
import { Toaster, toast } from 'sonner';
import Sidebar from './components/Sidebar';
import './index.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Employees = lazy(() => import('./pages/Employees'));
const PayrollProcessing = lazy(() => import('./pages/PayrollProcessing'));
const PayrollHistory = lazy(() => import('./pages/PayrollHistory'));
const ReactivatePayroll = lazy(() => import('./pages/ReactivatePayroll'));
const Departments = lazy(() => import('./pages/Departments'));
const Areas = lazy(() => import('./pages/Areas'));
const Divisions = lazy(() => import('./pages/Divisions'));
const Subdivisions = lazy(() => import('./pages/Subdivisions'));
const Dimension5 = lazy(() => import('./pages/Dimension5'));
const Companies = lazy(() => import('./pages/Companies'));
const Settings = lazy(() => import('./pages/Settings'));
const OperationBatches = lazy(() => import('./pages/OperationBatches'));
const OperationLogs = lazy(() => import('./pages/OperationLogs'));
const Commissions = lazy(() => import('./pages/Commissions'));
const Bonuses = lazy(() => import('./pages/Bonuses'));
const Login = lazy(() => import('./pages/auth/Login'));
const Users = lazy(() => import('./pages/Users'));
const BillingDistribution = lazy(() => import('./pages/BillingDistribution'));
const BillingRules = lazy(() => import('./pages/BillingRules'));
const BillingHistory = lazy(() => import('./pages/BillingHistory'));
const Suspensions = lazy(() => import('./pages/Suspensions'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));

export const AppContext = createContext();

function PageLoader() {
  return (
    <Center h="60vh">
      <Spinner size="lg" color="brand.500" thickness="3px" />
    </Center>
  );
}

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
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
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
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Flex>
  );
}

function AppContent() {
  const { colorMode, toggleColorMode } = useColorMode();
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, message: '', onConfirm: null });

  const showToast = useCallback((message, type = 'success') => {
    if (type === 'danger' || type === 'error') {
      toast.error(message);
    } else if (type === 'success') {
      toast.success(message);
    } else {
      toast(message);
    }
  }, []);

  const confirmAction = useCallback((message, onConfirm) => {
    setConfirmDialog({ isOpen: true, message, onConfirm });
  }, []);

  const appValue = useMemo(
    () => ({ theme: colorMode, toggleTheme: toggleColorMode, showToast, confirmAction }),
    [colorMode, toggleColorMode, showToast, confirmAction]
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorMode);
  }, [colorMode]);

  return (
    <AppContext.Provider value={appValue}>
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
                    <Route path="/billing/history" element={<BillingHistory />} />
                  </Route>

                  {/* ADMIN, GERENTE GENERAL, NOMINA, AUDITOR, DIGITADOR */}
                  <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'GERENTE GENERAL', 'NOMINA', 'AUDITOR', 'DIGITADOR']} />}>
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/suspensions" element={<Suspensions />} />
                  </Route>

                  {/* ADMIN, GERENTE GENERAL, NOMINA, GERENTE */}
                  <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'GERENTE GENERAL', 'NOMINA', 'GERENTE']} />}>
                    <Route path="/commissions" element={<Commissions />} />
                    <Route path="/bonuses" element={<Bonuses />} />
                  </Route>

                  {/* ADMIN, GERENTE GENERAL, GERENTE, SOLICITANTE, NOMINA */}
                  <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'GERENTE GENERAL', 'GERENTE', 'SOLICITANTE', 'NOMINA']} />}>
                    <Route path="/operations" element={<OperationBatches />} />
                    <Route path="/operations/:id" element={<OperationLogs />} />
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
