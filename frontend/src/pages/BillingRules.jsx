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

const API = 'http://localhost:3000/api/billing';

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
    fromCompanyId: '',
    toCompanyId: '',
    concept: 'Servicios de RRHH',
    marginPercentage: 4,
    applyIva: true,
    ivaRate: 0.12,
    isActive: true
  });

  const companyName = (id) => {
    const c = companies.find((x) => x.id === Number(id));
    return c ? (c.nombre_comercial || c.razon_social) : id;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/rules`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar reglas');
      setRules(await res.json());
    } catch {
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenModal = (rule = null) => {
    if (rule) {
      setFormData({
        id: rule.id,
        fromCompanyId: rule.fromCompanyId || '',
        toCompanyId: rule.toCompanyId || '',
        concept: rule.concept || 'Servicios de RRHH',
        marginPercentage: rule.marginPercentage,
        applyIva: rule.applyIva,
        ivaRate: rule.ivaRate ?? 0.12,
        isActive: rule.isActive
      });
    } else {
      setFormData({
        id: null,
        fromCompanyId: '',
        toCompanyId: '',
        concept: 'Servicios de RRHH',
        marginPercentage: 4,
        applyIva: true,
        ivaRate: 0.12,
        isActive: true
      });
    }
    onOpen();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(formData.fromCompanyId) === Number(formData.toCompanyId)) {
      showToast('La empresa emisora y receptora deben ser distintas', 'error');
      return;
    }
    try {
      const payload = {
        fromCompanyId: Number(formData.fromCompanyId),
        toCompanyId: Number(formData.toCompanyId),
        concept: formData.concept,
        marginPercentage: Number(formData.marginPercentage),
        applyIva: formData.applyIva,
        ivaRate: Number(formData.ivaRate),
        isActive: formData.isActive
      };
      const url = formData.id ? `${API}/rules/${formData.id}` : `${API}/rules`;
      const res = await fetch(url, {
        method: formData.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      showToast(formData.id ? 'Regla actualizada exitosamente' : 'Regla creada exitosamente');
      onClose();
      fetchData();
    } catch (err) {
      showToast(err.message || 'Error al guardar regla', 'error');
    }
  };

  const handleDelete = (id) => {
    confirmAction('¿Estás seguro de que deseas eliminar esta regla?', async () => {
      try {
        const res = await fetch(`${API}/rules/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        showToast('Regla eliminada exitosamente');
        fetchData();
      } catch {
        showToast('Error al eliminar regla', 'error');
      }
    });
  };

  const resolveName = (rule, field) => {
    if (field === 'from') {
      return rule.fromCompanyData?.nombre_comercial || rule.fromCompany || companyName(rule.fromCompanyId);
    }
    return rule.toCompanyData?.nombre_comercial || rule.toCompany || companyName(rule.toCompanyId);
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
              <Th w="50px" />
              <Th>Empresa Receptora (A)</Th>
              <Th>Concepto</Th>
              <Th isNumeric>Margen %</Th>
              <Th>IVA</Th>
              <Th>Estado</Th>
              <Th textAlign="right">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rules.map((rule) => (
              <Tr key={rule.id}>
                <Td fontWeight="bold">{resolveName(rule, 'from')}</Td>
                <Td><ArrowRight size={16} color="gray" /></Td>
                <Td fontWeight="bold">{resolveName(rule, 'to')}</Td>
                <Td>{rule.concept}</Td>
                <Td isNumeric>{Number(rule.marginPercentage).toFixed(2)}%</Td>
                <Td>
                  {rule.applyIva
                    ? <Badge colorScheme="green">Sí ({(Number(rule.ivaRate || 0.12) * 100).toFixed(0)}%)</Badge>
                    : <Badge colorScheme="gray">No</Badge>}
                </Td>
                <Td>
                  {rule.isActive
                    ? <Badge colorScheme="blue">Activa</Badge>
                    : <Badge colorScheme="red">Inactiva</Badge>}
                </Td>
                <Td textAlign="right">
                  <HStack justify="flex-end" spacing={2}>
                    <IconButton icon={<Edit2 size={16} />} size="sm" variant="ghost" colorScheme="blue" onClick={() => handleOpenModal(rule)} />
                    <IconButton icon={<Trash2 size={16} />} size="sm" variant="ghost" colorScheme="red" onClick={() => handleDelete(rule.id)} />
                  </HStack>
                </Td>
              </Tr>
            ))}
            {rules.length === 0 && !loading && (
              <Tr>
                <Td colSpan={8} textAlign="center" py={6} color="gray.500">No hay reglas configuradas</Td>
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
                  value={formData.fromCompanyId}
                  onChange={(e) => setFormData({ ...formData, fromCompanyId: e.target.value })}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre_comercial || c.razon_social}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Empresa Receptora (A)</FormLabel>
                <Select
                  placeholder="Seleccionar empresa"
                  value={formData.toCompanyId}
                  onChange={(e) => setFormData({ ...formData, toCompanyId: e.target.value })}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre_comercial || c.razon_social}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Concepto de Facturación</FormLabel>
                <Input value={formData.concept} onChange={(e) => setFormData({ ...formData, concept: e.target.value })} />
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
                <FormControl>
                  <FormLabel>Tasa IVA</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.ivaRate}
                    onChange={(e) => setFormData({ ...formData, ivaRate: e.target.value })}
                    isDisabled={!formData.applyIva}
                  />
                </FormControl>
              </HStack>

              <HStack w="100%" spacing={4}>
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">Aplicar IVA</FormLabel>
                  <Switch colorScheme="brand" isChecked={formData.applyIva} onChange={(e) => setFormData({ ...formData, applyIva: e.target.checked })} />
                </FormControl>
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">Regla Activa</FormLabel>
                  <Switch colorScheme="brand" isChecked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
                </FormControl>
              </HStack>
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
