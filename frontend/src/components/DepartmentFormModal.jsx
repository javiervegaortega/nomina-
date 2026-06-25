import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../context/DataContext';
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
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useColorModeValue,
  Divider
} from '@chakra-ui/react';

const INITIAL_FORM = {
  nombre_dimension: '',
  gerente: '',
  areaId: null
};

export default function DepartmentFormModal({ isOpen, onClose, onSave, initialData }) {
  const { areas } = useContext(DataContext);
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'AUDITOR';
  const [formData, setFormData] = useState(INITIAL_FORM);

  // Exact matching colors from screenshot
  const isDark = useColorModeValue(false, true);
  
  // Custom theme variables reflecting the provided image
  const modalBg = useColorModeValue('white', '#0f111a'); // Dark, almost navy background
  const textColor = useColorModeValue('gray.800', '#e2e8f0');
  const subtextColor = useColorModeValue('gray.500', '#94a3b8');
  const inputBg = useColorModeValue('gray.50', '#2d3348'); // Purplish dark grey
  const inputBorder = useColorModeValue('gray.200', 'transparent');
  const tableHeaderBg = useColorModeValue('gray.50', '#0a0d14'); // Very dark for table header
  const tableHeaderColor = useColorModeValue('gray.600', '#cbd5e1');
  const tableHoverBg = useColorModeValue('gray.50', '#1e2436');
  const selectedRowBg = useColorModeValue('brand.50', '#1a2235'); // Distinct when selected

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          nombre_dimension: initialData.nombre_dimension || '',
          gerente: initialData.gerente || '',
          areaId: initialData.areaId || null
        });
      } else {
        setFormData(INITIAL_FORM);
      }
    }
  }, [isOpen, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectArea = (id) => {
    setFormData(prev => ({ ...prev, areaId: id }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered>
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
            {/* Custom Header from Screenshot */}
            <Box textAlign="center" pt={10} pb={6}>
              <Text fontSize="3xl" fontWeight="600" mb={2} color={useColorModeValue('gray.800', 'white')}>
                Nueva Departamento
              </Text>
              <Text fontSize="sm" color={subtextColor}>
                Cree una nueva dimension 1, llenando los campos que se solicitan
              </Text>
            </Box>

            {/* Form Fields Section */}
            <Box px={10} pb={8}>
              {/* Box container like the screenshot for inputs */}
              <Box bg={useColorModeValue('white', '#141a28')} p={6} borderRadius="lg" border="1px solid" borderColor={useColorModeValue('gray.200', '#1f2937')}>
                
                <Box mb={5}>
                  <Text fontSize="xs" fontWeight="700" color={tableHeaderColor} mb={2}>
                    Nombre De La Dimensión
                  </Text>
                  <Input
                    name="nombre_dimension"
                    value={formData.nombre_dimension}
                    onChange={handleChange}
                    placeholder="E.g. 300000 - OPERACIONES"
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

                <Box mb={8}>
                  <Text fontSize="xs" fontWeight="700" color={tableHeaderColor} mb={2}>
                    Gerente
                  </Text>
                  <Input
                    name="gerente"
                    value={formData.gerente}
                    onChange={handleChange}
                    placeholder="E.g. GERENTE"
                    bg={inputBg}
                    border="1px solid"
                    borderColor={inputBorder}
                    _focus={{ borderColor: '#60a5fa', boxShadow: 'none' }}
                    _hover={{ borderColor: useColorModeValue('gray.300', '#4b5563') }}
                    color={useColorModeValue('gray.800', '#d1d5db')}
                    size="lg"
                    fontSize="sm"
                    borderRadius="md"
                  />
                </Box>

                <Divider borderColor={useColorModeValue('gray.200', '#1f2937')} mb={6} />

                {/* Área Table Section */}
                <Box textAlign="center" mb={4}>
                  <Text fontSize="lg" fontWeight="500" color={useColorModeValue('gray.800', 'white')}>
                    Área
                  </Text>
                </Box>

                <Box borderRadius="md" overflow="hidden" border="1px solid" borderColor={useColorModeValue('gray.200', '#0a0d14')}>
                  <Table variant="unstyled" size="sm">
                    <Thead bg={tableHeaderBg}>
                      <Tr>
                        <Th color={tableHeaderColor} textTransform="none" fontSize="xs" py={3} w="30%">ID</Th>
                        <Th color={tableHeaderColor} textTransform="none" fontSize="xs" py={3}>Nombre</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {areas.map((area) => (
                        <Tr 
                          key={area.id} 
                          cursor="pointer"
                          bg={formData.areaId === area.id ? selectedRowBg : 'transparent'}
                          _hover={{ bg: formData.areaId === area.id ? selectedRowBg : tableHoverBg }}
                          onClick={() => handleSelectArea(area.id)}
                          transition="all 0.2s"
                        >
                          <Td color={subtextColor} fontSize="sm" py={3}>{area.id}</Td>
                          <Td color={subtextColor} fontSize="sm" py={3}>{area.nombre}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
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
