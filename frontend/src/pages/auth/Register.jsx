import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Building, ArrowRight } from 'lucide-react';
import AuthSidePanel from './AuthSidePanel';
import { AuthContext } from '../../context/AuthContext';
import { AppContext } from '../../App';import {
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
  HStack
} from '@chakra-ui/react';

export default function Register() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register } = useContext(AuthContext);
  const { showToast } = useContext(AppContext);
  const navigate = useNavigate();

  const bgPanel = useColorModeValue('white', 'gray.900');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedColor = useColorModeValue('gray.500', 'gray.400');
  const inputBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleRegister = async (e) => {
    e.preventDefault();
    const result = await register(name, username, email, password);
    if (result.success) {
      showToast('Cuenta creada exitosamente. Por favor, inicia sesión.', 'success');
      navigate('/login');
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

      {/* Right Side - Register Form */}
      <Flex w={{ base: '100%', lg: '50%' }} align="center" justify="center" p={8}>
        <Box w="100%" maxW="md">
          <VStack spacing={8} align="stretch">
            <Box textAlign="center">
              <Heading as="h1" size="xl" fontWeight={800} color={textColor} mb={2} letterSpacing="-0.02em">
                Crea tu cuenta
              </Heading>
              <Text color={mutedColor} fontSize="md">
                Comienza a gestionar tu nómina de manera inteligente
              </Text>
            </Box>

            <form onSubmit={handleRegister}>
              <VStack spacing={5}>
                <HStack spacing={4} w="100%">
                  <FormControl isRequired>
                    <FormLabel fontSize="sm" fontWeight={600} color={textColor}>
                      Nombre Completo
                    </FormLabel>
                    <InputGroup size="lg">
                      <InputLeftElement pointerEvents="none" color={mutedColor}>
                        <User size={20} />
                      </InputLeftElement>
                      <Input
                        type="text"
                        placeholder="Juan Pérez"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        bg={inputBg}
                        borderColor={borderColor}
                        _hover={{ borderColor: 'brand.400' }}
                        _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                        borderRadius="xl"
                      />
                    </InputGroup>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontSize="sm" fontWeight={600} color={textColor}>
                      Usuario
                    </FormLabel>
                    <InputGroup size="lg">
                      <InputLeftElement pointerEvents="none" color={mutedColor}>
                        <User size={20} />
                      </InputLeftElement>
                      <Input
                        type="text"
                        placeholder="jperez"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        bg={inputBg}
                        borderColor={borderColor}
                        _hover={{ borderColor: 'brand.400' }}
                        _focus={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                        borderRadius="xl"
                      />
                    </InputGroup>
                  </FormControl>
                </HStack>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" fontWeight={600} color={textColor}>
                    Correo Electrónico
                  </FormLabel>
                  <InputGroup size="lg">
                    <InputLeftElement pointerEvents="none" color={mutedColor}>
                      <Mail size={20} />
                    </InputLeftElement>
                    <Input
                      type="email"
                      placeholder="jperez@grupoeconsa.com"
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
                  <FormLabel fontSize="sm" fontWeight={600} color={textColor} m={0}>
                    Contraseña
                  </FormLabel>
                  <InputGroup size="lg" mt={2}>
                    <InputLeftElement pointerEvents="none" color={mutedColor}>
                      <Lock size={20} />
                    </InputLeftElement>
                    <Input
                      type="password"
                      placeholder="Crea una contraseña segura"
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
                  Crear Cuenta
                </Button>
              </VStack>
            </form>

            <Box textAlign="center" mt={6}>
              <Text fontSize="sm" color={mutedColor}>
                ¿Ya tienes una cuenta?{' '}
                <ChakraLink as={Link} to="/login" color="brand.500" fontWeight={600}>
                  Inicia sesión
                </ChakraLink>
              </Text>
            </Box>
          </VStack>
        </Box>
      </Flex>
    </Flex>
  );
}
