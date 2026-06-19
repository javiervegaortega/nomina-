import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import AuthSidePanel from './AuthSidePanel';
import { AuthContext } from '../../context/AuthContext';
import { AppContext } from '../../App';
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftElement,
  useColorModeValue,
  Link as ChakraLink,
  VStack,
} from '@chakra-ui/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);
  const { showToast } = useContext(AppContext);
  const navigate = useNavigate();

  const bgPanel = useColorModeValue('white', 'gray.900');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedColor = useColorModeValue('gray.500', 'gray.400');
  const inputBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleLogin = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      showToast('Sesión iniciada correctamente', 'success');
      navigate('/dashboard');
    } else {
      showToast(result.error, 'error');
    }
  };

  return (
    <Flex h="100vh" w="100vw" overflow="hidden" bg={bgPanel}>
      {/* Left Side Panel (hidden on small screens) */}
      <Box display={{ base: 'none', lg: 'block' }} w="50%">
        <AuthSidePanel />
      </Box>

      {/* Right Side - Login Form */}
      <Flex w={{ base: '100%', lg: '50%' }} align="center" justify="center" p={8}>
        <Box w="100%" maxW="md">
          <VStack spacing={8} align="stretch">
            <Box textAlign="center">
              <Heading as="h1" size="xl" fontWeight={800} color={textColor} mb={2} letterSpacing="-0.02em">
                Iniciar Sesión
              </Heading>
              <Text color={mutedColor} fontSize="md">
                Bienvenido de nuevo, por favor ingresa tus credenciales.
              </Text>
            </Box>

            <form onSubmit={handleLogin}>
              <VStack spacing={5}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight={600} color={textColor}>
                    Usuario
                  </FormLabel>
                  <InputGroup size="lg">
                    <InputLeftElement pointerEvents="none" color={mutedColor}>
                      <Mail size={20} />
                    </InputLeftElement>
                    <Input
                      type="text"
                      placeholder="usuario"
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      bg={inputBg}
                      borderColor={borderColor}
                      _hover={{ borderColor: 'brand.400' }}
                      _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                      borderRadius="xl"
                    />
                  </InputGroup>
                </FormControl>

                <FormControl isRequired>
                  <Flex justify="space-between" align="center" mb={2}>
                    <FormLabel fontSize="sm" fontWeight={600} color={textColor} m={0}>
                      Contraseña
                    </FormLabel>
                    {/* El usuario solicitó quitar "Olvidaste tu contraseña" */}
                  </Flex>
                  <InputGroup size="lg">
                    <InputLeftElement pointerEvents="none" color={mutedColor}>
                      <Lock size={20} />
                    </InputLeftElement>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      bg={inputBg}
                      borderColor={borderColor}
                      _hover={{ borderColor: 'brand.400' }}
                      _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                      borderRadius="xl"
                    />
                  </InputGroup>
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="brand"
                  size="lg"
                  w="100%"
                  mt={4}
                  borderRadius="xl"
                  fontWeight={600}
                  rightIcon={<ArrowRight size={20} />}
                  _hover={{ boxShadow: 'lg' }}
                  transition="all 0.3s"
                >
                  Iniciar Sesión
                </Button>
              </VStack>
            </form>

          </VStack>
        </Box>
      </Flex>
    </Flex>
  );
}
