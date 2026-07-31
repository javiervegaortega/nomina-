import React, { useState, useContext, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { Box, Flex, Heading, Text, Button, VStack, Icon, useColorModeValue } from '@chakra-ui/react';
import { RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function ReactivatePayroll() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { showToast } = useContext(AppContext);
  
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const handleReactivate = async () => {
    if (!token) return;
    setStatus('loading');
    
    try {
      // Optional: We can send the user's auth token as well if we want to enforce login,
      // but since they might just click the link, the JWT token itself carries the authorization for this action.
      // If the backend requires authentication, we would add the auth header here.
      // In payroll.routes.js, we put `authenticateToken` on `/reactivate`, so the user MUST be logged in.
      const authToken = localStorage.getItem('nomina-token');
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const response = await apiFetch('/api/payrolls/reactivate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al reactivar nómina');
      }

      setStatus('success');
      showToast('Nómina reactivada exitosamente', 'success');
    } catch (err) {
      setErrorMessage(err.message);
      setStatus('error');
      showToast(err.message, 'error');
    }
  };

  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  if (!token) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg={useColorModeValue('gray.50', 'gray.900')}>
        <VStack spacing={4} p={8} bg={bg} borderRadius="xl" border="1px solid" borderColor={borderColor} shadow="lg">
          <Icon as={AlertTriangle} boxSize={12} color="red.500" />
          <Heading size="md">Enlace Inválido</Heading>
          <Text color="gray.500">No se proporcionó un token de seguridad válido.</Text>
          <Button mt={4} onClick={() => navigate('/dashboard')}>Volver al inicio</Button>
        </VStack>
      </Flex>
    );
  }

  return (
    <Flex minH="100vh" align="center" justify="center" bg={useColorModeValue('gray.50', 'gray.900')} p={4}>
      <VStack spacing={6} p={8} bg={bg} borderRadius="xl" border="1px solid" borderColor={borderColor} shadow="xl" maxW="400px" w="100%" textAlign="center">
        
        {status === 'idle' && (
          <>
            <Icon as={RotateCcw} boxSize={16} color="blue.500" />
            <Heading size="md">Aprobar Reactivación</Heading>
            <Text color="gray.500">
              Estás a punto de reactivar una nómina cerrada. Esto la regresará al Dashboard como un borrador activo.
            </Text>
            <Button colorScheme="blue" w="full" size="lg" onClick={handleReactivate}>
              Aprobar y Reactivar
            </Button>
          </>
        )}

        {status === 'loading' && (
          <>
            <Button isLoading loadingText="Reactivando..." colorScheme="blue" variant="ghost" size="lg" w="full" />
            <Text color="gray.500">Procesando solicitud...</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Icon as={CheckCircle} boxSize={16} color="green.500" />
            <Heading size="md">¡Reactivada!</Heading>
            <Text color="gray.500">La nómina ha sido restaurada con éxito.</Text>
            <Button colorScheme="green" w="full" mt={4} onClick={() => navigate('/dashboard')}>
              Ir al Dashboard
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <Icon as={AlertTriangle} boxSize={16} color="red.500" />
            <Heading size="md">Error</Heading>
            <Text color="red.500">{errorMessage}</Text>
            <Button w="full" mt={4} onClick={() => navigate('/dashboard')}>
              Volver al inicio
            </Button>
          </>
        )}

      </VStack>
    </Flex>
  );
}
