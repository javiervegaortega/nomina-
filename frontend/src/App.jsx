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
    <Flex h="100vh" overflow="hidden">
      <Sidebar />
      <Box
        as="main"
        flex="1"
        overflow="auto"
        bg="chakra-body-bg"
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

// Layout without Sidebar for auth pages
function AuthLayout() {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
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
