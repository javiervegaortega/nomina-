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
const BILLING_WRITE_ROLES = new Set(['ADMIN', 'NOMINA', 'GERENTE GENERAL']);
const BILLING_PAYER_IDS = new Set([1, 2, 3]);
const BILLING_DESTINATION_IDS = new Set([1, 2, 3, 4]);
const ROUTE_DEFAULTS = {
  '1->2': { marginPercentage: 0, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '1->3': { marginPercentage: 0, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '2->1': { marginPercentage: 0, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '2->3': { marginPercentage: 0, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '3->1': { marginPercentage: 4, applyIva: true, ivaRate: 0.12, baseAdjustment: 0 },
  '3->2': { marginPercentage: 4, applyIva: true, ivaRate: 0.12, baseAdjustment: 1296.13 },
  '3->4': { marginPercentage: 4, applyIva: false, ivaRate: 0, baseAdjustment: 0 }
};
const routeKey = (fromId, toId) => `${Number(fromId)}->${Number(toId)}`;
const isAllowedRoute = (fromId, toId) => !!ROUTE_DEFAULTS[routeKey(fromId, toId)];

export function BillingRulesPanel() {
  const { showToast, confirmAction } = useContext(AppContext);
  const { token, user } = useContext(AuthContext);
  const { companies } = useContext(DataContext);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const canWriteBilling = BILLING_WRITE_ROLES.has(
    String(user?.role || '').trim().toUpperCase()
  );

  const bgCard = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const bgHeader = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    id: null,
    fromCompanyId: 1,
    toCompanyId: 2,
    concept: 'Servicios de RRHH',
    marginPercentage: 0,
    applyIva: true,
    ivaRate: 0.12,
    baseAdjustment: 0,
    isActive: true
  });
  const payerCompanies = companies.filter((c) => BILLING_PAYER_IDS.has(Number(c.id)));
  const destinationCompanies = companies.filter((c) =>
    BILLING_DESTINATION_IDS.has(Number(c.id))
    && isAllowedRoute(formData.fromCompanyId, c.id)
  );

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
      const data = await res.json();
      setRules(data.filter((rule) =>
        isAllowedRoute(rule.fromCompanyId, rule.toCompanyId)
      ));
    } catch {
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenModal = (rule = null) => {
    if (!canWriteBilling) {
      showToast('Tu perfil tiene acceso de solo lectura a facturación', 'warning');
      return;
    }
    if (rule) {
      setFormData({
        id: rule.id,
        fromCompanyId: rule.fromCompanyId || '',
        toCompanyId: rule.toCompanyId || '',
        concept: rule.concept || 'Servicios de RRHH',
        marginPercentage: rule.marginPercentage,
        applyIva: rule.applyIva,
        ivaRate: rule.ivaRate ?? 0.12,
        baseAdjustment: rule.baseAdjustment ?? 0,
        isActive: rule.isActive
      });
    } else {
      setFormData({
        id: null,
        fromCompanyId: 1,
        toCompanyId: 2,
        concept: 'Servicios de RRHH',
        marginPercentage: 0,
        applyIva: true,
        ivaRate: 0.12,
        baseAdjustment: 0,
        isActive: true
      });
    }
    onOpen();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canWriteBilling) {
      showToast('No tienes permiso para modificar reglas de facturación', 'error');
      return;
    }
    if (Number(formData.fromCompanyId) === Number(formData.toCompanyId)) {
      showToast('La empresa emisora y receptora deben ser distintas', 'error');
      return;
    }
    if (!isAllowedRoute(formData.fromCompanyId, formData.toCompanyId)) {
      showToast('La relación seleccionada no corresponde a una ruta de los Excel', 'error');
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
        baseAdjustment: Number(formData.baseAdjustment) || 0,
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
    if (!canWriteBilling) {
      showToast('No tienes permiso para desactivar reglas de facturación', 'error');
      return;
    }
    confirmAction('¿Estás seguro de que deseas desactivar esta regla?', async () => {
      try {
        const res = await fetch(`${API}/rules/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        showToast('Regla desactivada exitosamente');
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
    <Box>
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={3}>
        <Text fontSize="sm" color="gray.500">
          Configura quién factura a quién, márgenes e IVA.
        </Text>
        {canWriteBilling ? (
          <Button leftIcon={<Plus size={18} />} colorScheme="brand" size="sm" onClick={() => handleOpenModal()}>
            Nueva regla
          </Button>
        ) : (
          <Badge colorScheme="gray" px={3} py={1} borderRadius="md">
            Solo lectura
          </Badge>
        )}
      </Flex>

      <Box bg={bgCard} borderRadius="xl" shadow="sm" overflowX="auto" borderWidth="1px" borderColor={borderColor}>
        <Table variant="simple">
          <Thead bg={bgHeader}>
            <Tr>
              <Th>Empresa emisora</Th>
              <Th w="50px" />
              <Th>Empresa receptora</Th>
              <Th>Concepto</Th>
              <Th isNumeric>Margen %</Th>
              <Th isNumeric>Ajuste base</Th>
              <Th>IVA</Th>
              <Th>Estado</Th>
              {canWriteBilling && <Th textAlign="right">Acciones</Th>}
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
                <Td isNumeric>
                  {Number(rule.baseAdjustment || 0) !== 0
                    ? `Q${Number(rule.baseAdjustment).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
                    : '—'}
                </Td>
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
                {canWriteBilling && (
                  <Td textAlign="right">
                    <HStack justify="flex-end" spacing={2}>
                      <IconButton icon={<Edit2 size={16} />} size="sm" variant="ghost" colorScheme="blue" aria-label="Editar" onClick={() => handleOpenModal(rule)} />
                      <IconButton icon={<Trash2 size={16} />} size="sm" variant="ghost" colorScheme="red" aria-label="Eliminar" onClick={() => handleDelete(rule.id)} />
                    </HStack>
                  </Td>
                )}
              </Tr>
            ))}
            {rules.length === 0 && !loading && (
              <Tr>
                <Td colSpan={canWriteBilling ? 9 : 8} textAlign="center" py={6} color="gray.500">No hay reglas configuradas</Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit}>
          <ModalHeader>{formData.id ? 'Editar regla' : 'Nueva regla'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Empresa emisora</FormLabel>
                <Select
                  placeholder="Seleccionar empresa"
                  value={formData.fromCompanyId}
                  onChange={(e) => {
                    const fromCompanyId = Number(e.target.value);
                    const nextTo = companies.find((c) => isAllowedRoute(fromCompanyId, c.id))?.id || '';
                    const defaults = ROUTE_DEFAULTS[routeKey(fromCompanyId, nextTo)] || {};
                    setFormData({
                      ...formData,
                      fromCompanyId,
                      toCompanyId: nextTo,
                      ...defaults
                    });
                  }}
                >
                  {payerCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre_comercial || c.razon_social}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Empresa receptora</FormLabel>
                <Select
                  placeholder="Seleccionar empresa"
                  value={formData.toCompanyId}
                  onChange={(e) => {
                    const toCompanyId = Number(e.target.value);
                    const defaults = ROUTE_DEFAULTS[routeKey(formData.fromCompanyId, toCompanyId)] || {};
                    setFormData({ ...formData, toCompanyId, ...defaults });
                  }}
                >
                  {destinationCompanies.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre_comercial || c.razon_social}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Concepto de facturación</FormLabel>
                <Input value={formData.concept} onChange={(e) => setFormData({ ...formData, concept: e.target.value })} />
              </FormControl>

              <HStack w="100%" spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Margen (%)</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.marginPercentage}
                    isReadOnly
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Tasa IVA</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.ivaRate}
                    isReadOnly
                    isDisabled={!formData.applyIva}
                  />
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel>Ajuste a la base (Q)</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.baseAdjustment}
                  onChange={(e) => setFormData({ ...formData, baseAdjustment: e.target.value })}
                />
              </FormControl>

              <HStack w="100%" spacing={4}>
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">Aplicar IVA</FormLabel>
                  <Switch colorScheme="brand" isChecked={formData.applyIva} isReadOnly />
                </FormControl>
                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0" flex="1">Regla activa</FormLabel>
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

export default BillingRulesPanel;
