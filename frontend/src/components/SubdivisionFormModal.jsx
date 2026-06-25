import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Box,
  Flex,
  Text,
  Input,
  Select,
  Button,
  useColorModeValue,
} from '@chakra-ui/react';

const INITIAL_FORM = {
  nombre: '',
  id_estado: 1
};

export default function SubdivisionFormModal({ isOpen, onClose, onSave, initialData }) {
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'AUDITOR';
  const [formData, setFormData] = useState(INITIAL_FORM);

  // Exact matching colors from screenshot
  const modalBg = useColorModeValue('white', '#0f111a'); 
  const textColor = useColorModeValue('gray.800', '#e2e8f0');
  const subtextColor = useColorModeValue('gray.500', '#94a3b8');
  const inputBg = useColorModeValue('gray.50', '#2d3348'); 
  const inputBorder = useColorModeValue('gray.200', 'transparent');
  const tableHeaderColor = useColorModeValue('gray.600', '#cbd5e1');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          nombre: initialData.nombre || '',
          id_estado: initialData.id_estado || 1
        });
      } else {
        setFormData(INITIAL_FORM);
      }
    }
  }, [isOpen, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'id_estado' ? Number(value) : value 
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent 
        bg={modalBg} 
        color={textColor} 
        borderRadius="xl" 
        overflow="hidden"
        boxShadow="0 20px 40px rgba(0,0,0,0.5)"
      >
        <form onSubmit={handleSubmit}>
          <ModalBody p={0}>
            {/* Custom Header from Screenshot style */}
            <Box textAlign="center" pt={10} pb={6}>
              <Text fontSize="3xl" fontWeight="600" mb={2} color={useColorModeValue('gray.800', 'white')}>
                Detalle Subdivisión
              </Text>
              <Text fontSize="sm" color={subtextColor}>
                Información de la subdivisión.
              </Text>
            </Box>

            {/* Form Fields Section */}
            <Box px={10} pb={8}>
              {/* Box container like the screenshot for inputs */}
              <Box bg={useColorModeValue('white', '#141a28')} p={6} borderRadius="lg" border="1px solid" borderColor={useColorModeValue('gray.200', '#1f2937')}>
                
                <Box mb={6}>
                  <Text fontSize="xs" fontWeight="700" color={tableHeaderColor} mb={2}>
                    Nombre De La Subdivisión
                  </Text>
                  <Input
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="E.g. R01 - RUTA ADMINISTRATIVA"
                    bg={inputBg}
                    border="1px solid"
                    borderColor={inputBorder}
                    _focus={{ borderColor: '#60a5fa', boxShadow: 'none' }}
                    _hover={{ borderColor: useColorModeValue('gray.300', '#4b5563') }}
                    color={useColorModeValue('gray.800', '#d1d5db')}
                    size="lg"
                    fontSize="sm"
                    borderRadius="md"
                    isRequired
                  />
                </Box>

                <Box mb={4}>
                  <Text fontSize="xs" fontWeight="700" color={tableHeaderColor} mb={2}>
                    Estado
                  </Text>
                  <Select
                    name="id_estado"
                    value={formData.id_estado}
                    onChange={handleChange}
                    bg={inputBg}
                    border="1px solid"
                    borderColor={inputBorder}
                    _focus={{ borderColor: '#60a5fa', boxShadow: 'none' }}
                    _hover={{ borderColor: useColorModeValue('gray.300', '#4b5563') }}
                    color={useColorModeValue('gray.800', '#d1d5db')}
                    size="lg"
                    fontSize="sm"
                    borderRadius="md"
                  >
                    <option value={1} style={{ background: '#2d3348' }}>1 - Activo</option>
                    <option value={2} style={{ background: '#2d3348' }}>2 - Inactivo</option>
                  </Select>
                </Box>

              </Box>

              {/* Action Buttons */}
              <Flex justify="flex-end" gap={3} mt={6}>
                <Button variant="ghost" onClick={onClose} color={subtextColor} _hover={{ bg: useColorModeValue('gray.100', 'whiteAlpha.100') }}>
                  Cancelar
                </Button>
                {!isReadOnly && (
                  <Button colorScheme="blue" type="submit" px={8}>
                    Guardar
                  </Button>
                )}
              </Flex>
            </Box>
          </ModalBody>
        </form>
      </ModalContent>
    </Modal>
  );
}
