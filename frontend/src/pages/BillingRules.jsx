import React, { useState, useEffect, useContext } from 'react';
import {
  Box, Flex, Text, Button, Table, Thead, Tbody, Tr, Th, Td, IconButton,
  useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  FormControl, FormLabel, Input, Select, Switch, HStack, VStack, Badge, useColorModeValue
} from '@chakra-ui/react';
import { Edit2, Trash2, Plus, ArrowRight } from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import { DataContext } from '../context/DataContext';

export default function BillingRules() {
  const { showToast, confirmAction } = useContext(AppContext);
  const { token } = useContext(AuthContext);
  const { companies } = useContext(DataContext);
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const bgCard = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const bgHeader = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    id: null,
    fromCompany: '',
    toCompany: '',
    concept: 'Servicios de RRHH',
    marginPercentage: 4,
    applyIva: true,
    isActive: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const rulesRes = await fetch('http://localhost:3000/api/billing/rules', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!rulesRes.ok) throw new Error('Error al cargar reglas');
      const data = await rulesRes.json();
      setRules(data);
    } catch (error) {
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (rule = null) => {
    if (rule) {
      setFormData({
        id: rule.id,
        fromCompany: rule.fromCompany,
        toCompany: rule.toCompany,
        concept: rule.concept,
        marginPercentage: rule.marginPercentage,
        applyIva: rule.applyIva,
        isActive: rule.isActive
      });
    } else {
      setFormData({
        id: null,
        fromCompany: '',
        toCompany: '',
        concept: 'Servicios de RRHH',
        marginPercentage: 4,
        applyIva: true,
        isActive: true
      });
    }
    onOpen();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        const res = await fetch(`http://localhost:3000/api/billing/rules/${formData.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Error');
        showToast('Regla actualizada exitosamente');
      } else {
        const res = await fetch('http://localhost:3000/api/billing/rules', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error('Error');
        showToast('Regla creada exitosamente');
      }
      onClose();
      fetchData();
    } catch (error) {
      showToast('Error al guardar regla', 'error');
    }
  };

  const handleDelete = (id) => {
    confirmAction('¿Estás seguro de que deseas eliminar esta regla?', async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/billing/rules/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        showToast('Regla eliminada exitosamente');
        fetchData();
      } catch (error) {
        showToast('Error al eliminar regla', 'error');
      }
    });
  };

  return (
    <Box p={6}>
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold">Reglas de Facturación</Text>
          <Text color="gray.500">Configura quién factura a quién y con qué márgenes.</Text>
        </Box>
        <Button leftIcon={<Plus size={18} />} colorScheme="brand" onClick={() => handleOpenModal()}>
          Nueva Regla
        </Button>
      </Flex>

      <Box bg={bgCard} borderRadius="xl" shadow="sm" overflowX="auto" borderWidth="1px" borderColor={borderColor}>
        <Table variant="simple">
          <Thead bg={bgHeader}>
            <Tr>
              <Th>Empresa Emisora (De)</Th>
              <Th w="50px"></Th>
              <Th>Empresa Receptora (A)</Th>
              <Th>Concepto</Th>
              <Th isNumeric>Margen %</Th>
              <Th>IVA</Th>
              <Th>Estado</Th>
              <Th textAlign="right">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rules.map(rule => (
              <Tr key={rule.id}>
                <Td fontWeight="bold">{rule.fromCompany}</Td>
                <Td><ArrowRight size={16} color="gray" /></Td>
                <Td fontWeight="bold">{rule.toCompany}</Td>
                <Td>{rule.concept}</Td>
                <Td isNumeric>{Number(rule.marginPercentage).toFixed(2)}%</Td>
                <Td>
                  {rule.applyIva ? <Badge colorScheme="green">Sí (12%)</Badge> : <Badge colorScheme="gray">No</Badge>}
                </Td>
                <Td>
                  {rule.isActive ? <Badge colorScheme="blue">Activa</Badge> : <Badge colorScheme="red">Inactiva</Badge>}
                </Td>
                <Td textAlign="right">
                  <HStack justify="flex-end" spacing={2}>
                    <IconButton
                      icon={<Edit2 size={16} />}
                      size="sm"
                      variant="ghost"
                      colorScheme="blue"
                      onClick={() => handleOpenModal(rule)}
                    />
                    <IconButton
                      icon={<Trash2 size={16} />}
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => handleDelete(rule.id)}
                    />
                  </HStack>
                </Td>
              </Tr>
            ))}
            {rules.length === 0 && !loading && (
              <Tr>
                <Td colSpan={8} textAlign="center" py={6} color="gray.500">
                  No hay reglas configuradas
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit}>
          <ModalHeader>{formData.id ? 'Editar Regla' : 'Nueva Regla'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Empresa Emisora (De)</FormLabel>
                <Select
                  placeholder="Seleccionar empresa"
                  value={formData.fromCompany}
                  onChange={(e) => setFormData({ ...formData, fromCompany: e.target.value })}
                >
                  {companies.map(c => <option key={c.id} value={c.nombre_comercial}>{c.nombre_comercial}</option>)}
                </Select>
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Empresa Receptora (A)</FormLabel>
                <Select
                  placeholder="Seleccionar empresa"
                  value={formData.toCompany}
                  onChange={(e) => setFormData({ ...formData, toCompany: e.target.value })}
                >
                  {companies.map(c => <option key={c.id} value={c.nombre_comercial}>{c.nombre_comercial}</option>)}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Concepto de Facturación</FormLabel>
                <Input
                  value={formData.concept}
                  onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                />
              </FormControl>

              <HStack w="100%" spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Margen (%)</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.marginPercentage}
                    onChange={(e) => setFormData({ ...formData, marginPercentage: e.target.value })}
                  />
                </FormControl>
                
                <FormControl display="flex" alignItems="center" mt={6}>
                  <FormLabel mb="0" flex="1">Aplicar IVA</FormLabel>
                  <Switch
                    colorScheme="brand"
                    isChecked={formData.applyIva}
                    onChange={(e) => setFormData({ ...formData, applyIva: e.target.checked })}
                  />
                </FormControl>
              </HStack>

              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0" flex="1">Regla Activa</FormLabel>
                <Switch
                  colorScheme="brand"
                  isChecked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
            <Button colorScheme="brand" type="submit">Guardar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
