import React, { useState, useContext, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Heading, Table, Thead, Tbody, Tr, Th, Td, IconButton, Button,
  HStack, Select, Input, Badge, useDisclosure, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel,
  VStack, Text, Checkbox, CheckboxGroup, Radio, RadioGroup, useColorModeValue, Tooltip, Divider, Grid, GridItem,
  AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay,
  Tabs, TabList, Tab, TabPanels, TabPanel, Skeleton, Flex,
  Menu, MenuButton, MenuList, MenuOptionGroup, MenuItemOption
} from '@chakra-ui/react';
import { Plus, Check, X, Trash2, Eye, Edit2, ChevronDown, ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';

export default function OperationLogs() {
  const { id: batchId } = useParams();
  const navigate = useNavigate();
  const { employees, departments, areas, divisions, subdivisions, dimension5s, companies, addOperationLog, updateOperationLogStatus, deleteOperationLog, updateOperationLog, isLoading } = useContext(DataContext);
  const { user } = useContext(AuthContext);

  const [batch, setBatch] = useState(null);
  const [operationLogs, setOperationLogs] = useState([]);
  
  const fetchBatch = async () => {
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await fetch(`http://localhost:3000/api/operation-batches/${batchId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBatch(data);
        setOperationLogs(data.logs || []);
      }
    } catch(e) {}
  };

  useEffect(() => {
    fetchBatch();
  }, [batchId]);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [tabIndex, setTabIndex] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDetailsOpen, onOpen: onDetailsOpen, onClose: onDetailsClose } = useDisclosure();
  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [editFormData, setEditFormData] = useState(null);
  const [editModalAreaFilter, setEditModalAreaFilter] = useState([]);
  const [editModalFilterArea, setEditModalFilterArea] = useState([]);
  const [editModalFilterDiv, setEditModalFilterDiv] = useState([]);
  const [editModalFilterSubdiv, setEditModalFilterSubdiv] = useState([]);
  const [editModalFilterDim5, setEditModalFilterDim5] = useState([]);
  const [editModalSearchQuery, setEditModalSearchQuery] = useState('');

  const openEdit = (log) => {
    setEditModalAreaFilter([]);
    setEditModalFilterArea([]);
    setEditModalFilterDiv([]);
    setEditModalFilterSubdiv([]);
    setEditModalFilterDim5([]);
    setEditModalSearchQuery('');
    setEditFormData({
      id: log.id,
      employeeId: log.employeeId || log.Employee?.id || '',
      type: log.type,
      hoursQty: log.hoursQty,
      hourType: log.hourType || 'SIMPLE',
      bonusAmount: log.bonusAmount,
      taskDescription: log.taskDescription
    });
    onEditOpen();
  };

  const handleEditSave = async () => {
    if (!editFormData.taskDescription || !editFormData.employeeId) {
      toast.warning('Completa la descripción y el empleado');
      return;
    }
    try {
      await updateOperationLog(editFormData.id, {
        employeeId: Number(editFormData.employeeId),
        hoursQty: editFormData.type === 'HORA_EXTRA' ? Number(editFormData.hoursQty) : 0,
        hourType: editFormData.hourType,
        bonusAmount: editFormData.type === 'BONO' ? Number(editFormData.bonusAmount) : 0,
        taskDescription: editFormData.taskDescription
      });
      await fetchBatch();
      toast.success('Registro corregido exitosamente');
      onEditClose();
    } catch(e) {
      toast.error('Error al guardar');
    }
  };

  const [confirmState, setConfirmState] = useState({ isOpen: false, action: null, data: null, justification: '' });
  const cancelRef = React.useRef();

  const isManagerOrAdmin = ['gerente', 'nomina', 'admin'].includes(user?.role?.toLowerCase());
  const isGlobalRole = ['admin', 'nomina', 'gerente general'].includes(user?.role?.toLowerCase());
  const isReadOnly = user?.role === 'AUDITOR';

  const bg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedTextColor = useColorModeValue('gray.600', 'gray.400');
  const theadBg = useColorModeValue('gray.50', 'gray.900');
  const theadTextColor = useColorModeValue('gray.600', 'gray.400');
  const detailBg = useColorModeValue('gray.50', 'whiteAlpha.100');
  const bulkBg = useColorModeValue('blue.50', 'rgba(14, 165, 233, 0.15)');
  const bulkTextColor = useColorModeValue('blue.700', 'blue.200');

  const availableEmployees = useMemo(() => {
    let filtered = employees;
    
    // Bypass department filter for ADMIN and NOMINA so they can create bonuses for anyone

    if (user && user.idDepartamento && !isGlobalRole) {
      const normalize = (str) => (str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "");
      const userDept = normalize(user.idDepartamento);
      
      filtered = employees.filter(emp => {
        const dept = departments?.find(d => String(d.id) === String(emp.departmentId));
        const groupName = dept?.nombre_dimension || emp.departmentData?.nombre_dimension || '';
        return normalize(groupName).includes(userDept);
      });
    }

    return filtered
      .filter(emp => emp.estado && emp.estado.toUpperCase() === 'ACTIVO')
      .sort((a, b) => {
        const nameA = [a.primer_nombre, a.segundo_nombre, a.otro_nombre, a.primer_apellido, a.segundo_apellido].filter(Boolean).join(' ').trim();
        const nameB = [b.primer_nombre, b.segundo_nombre, b.otro_nombre, b.primer_apellido, b.segundo_apellido].filter(Boolean).join(' ').trim();
        return nameA.localeCompare(nameB);
      });
  }, [employees, user, isManagerOrAdmin]);

  const [modalAreaFilter, setModalAreaFilter] = useState([]);
  const [modalFilterArea, setModalFilterArea] = useState([]);
  const [modalFilterDiv, setModalFilterDiv] = useState([]);
  const [modalFilterSubdiv, setModalFilterSubdiv] = useState([]);
  const [modalFilterDim5, setModalFilterDim5] = useState([]);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    employeeIds: [],
    companyId: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'HORA_EXTRA',
    hoursQty: 0,
    hourType: 'SIMPLE',
    bonusQty: 1,
    bonusAmount: 0,
    taskDescription: ''
  });

  const filteredModalEmployees = useMemo(() => {
    const normalize = (str) => {
      if (!str) return '';
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    let result = availableEmployees;



    if (modalAreaFilter.length > 0) {
      result = result.filter(emp => modalAreaFilter.some(id => String(emp.departmentId) === id));
    }
    if (modalFilterArea.length > 0) {
      result = result.filter(emp => modalFilterArea.some(id => String(emp.areaId) === id));
    }
    if (modalFilterDiv.length > 0) {
      result = result.filter(emp => modalFilterDiv.some(id => String(emp.divisionId) === id));
    }
    if (modalFilterSubdiv.length > 0) {
      result = result.filter(emp => modalFilterSubdiv.some(id => String(emp.subdivisionId) === id));
    }
    if (modalFilterDim5.length > 0) {
      result = result.filter(emp => modalFilterDim5.some(id => String(emp.dimension5Id) === id));
    }

    if (modalSearchQuery.trim()) {
      const query = normalize(modalSearchQuery);
      result = result.filter(emp => {
        const fullName = [emp.primer_nombre, emp.segundo_nombre, emp.otro_nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ');
        return normalize(fullName).includes(query);
      });
    }

    return result;
  }, [availableEmployees, modalAreaFilter, modalFilterArea, modalFilterDiv, modalFilterSubdiv, modalFilterDim5, areas, modalSearchQuery]);

  const filteredEditModalEmployees = useMemo(() => {
    const normalize = (str) => {
      if (!str) return '';
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    let result = availableEmployees;



    if (editModalAreaFilter.length > 0) {
      result = result.filter(emp => editModalAreaFilter.some(id => String(emp.departmentId) === id));
    }
    if (editModalFilterArea.length > 0) {
      result = result.filter(emp => editModalFilterArea.some(id => String(emp.areaId) === id));
    }
    if (editModalFilterDiv.length > 0) {
      result = result.filter(emp => editModalFilterDiv.some(id => String(emp.divisionId) === id));
    }
    if (editModalFilterSubdiv.length > 0) {
      result = result.filter(emp => editModalFilterSubdiv.some(id => String(emp.subdivisionId) === id));
    }
    if (editModalFilterDim5.length > 0) {
      result = result.filter(emp => editModalFilterDim5.some(id => String(emp.dimension5Id) === id));
    }

    if (editModalSearchQuery.trim()) {
      const query = normalize(editModalSearchQuery);
      result = result.filter(emp => {
        const fullName = [emp.primer_nombre, emp.segundo_nombre, emp.otro_nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ');
        return normalize(fullName).includes(query);
      });
    }

    return result;
  }, [availableEmployees, editModalAreaFilter, editModalFilterArea, editModalFilterDiv, editModalFilterSubdiv, editModalFilterDim5, areas, editModalSearchQuery]);

  const handleSelectAllEmployees = () => {
    if (formData.employeeIds.length === filteredModalEmployees.length) {
      setFormData({ ...formData, employeeIds: [] });
    } else {
      setFormData({ ...formData, employeeIds: filteredModalEmployees.map(e => e.id.toString()) });
    }
  };

  const filteredLogs = useMemo(() => {
    return operationLogs.filter(log => {
      if (filterMonth && !log.date.startsWith(filterMonth)) return false;
      if (filterType !== 'ALL' && log.type !== filterType) return false;
      if (filterStatus !== 'ALL' && log.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [operationLogs, filterMonth, filterType, filterStatus]);

  const handleSave = () => {
    if (formData.employeeIds.length === 0 || !formData.date || !formData.taskDescription || !formData.companyId) {
      toast.warning('Selecciona al menos un empleado, la empresa y completa los campos requeridos');
      return;
    }
    setConfirmState({ isOpen: true, action: 'SAVE', data: null });
  };

  const handleApprove = (id) => setConfirmState({ isOpen: true, action: 'APPROVE', data: id });
  const handleReject = (id) => setConfirmState({ isOpen: true, action: 'REJECT', data: id });
  const handleDelete = (id) => setConfirmState({ isOpen: true, action: 'DELETE', data: id });

  const handleBulkApprove = () => setConfirmState({ isOpen: true, action: 'BULK_APPROVE', data: null });
  const handleBulkReject = () => setConfirmState({ isOpen: true, action: 'BULK_REJECT', data: null });

  const executeConfirm = async () => {
    const { action, data, justification } = confirmState;
    setConfirmState({ isOpen: false, action: null, data: null, justification: '' });

    try {
      if (action === 'SAVE') {
        const promises = formData.employeeIds.map(empId => {
          const payload = {
            ...formData,
            employeeId: Number(empId),
            companyId: Number(formData.companyId),
            hoursQty: formData.type === 'HORA_EXTRA' ? Number(formData.hoursQty) : 0,
            bonusQty: formData.type === 'BONO' ? Number(formData.bonusQty) : 0,
            bonusAmount: formData.type === 'BONO' ? Number(formData.bonusAmount) : 0,
            batchId: Number(batchId)
          };
          delete payload.employeeIds;
          return addOperationLog(payload);
        });
        await Promise.all(promises);
        
        await fetchBatch();
        
        onClose();
        setFormData(prev => ({ ...prev, employeeIds: [] }));
        setModalAreaFilter([]);
        toast.success(`Se agregaron ${formData.employeeIds.length} registros al lote`);
      } else if (action === 'APPROVE') {
        await updateOperationLogStatus(data, 'APPROVED_MANAGER');
        toast.success('Solicitud aprobada');
      } else if (action === 'REJECT') {
        await updateOperationLogStatus(data, 'RETURNED', null, justification);
        toast.success('Solicitud devuelta al solicitante');
      } else if (action === 'BULK_APPROVE') {
        const promises = selectedRowIds.map(id => updateOperationLogStatus(id, 'APPROVED_MANAGER'));
        await Promise.all(promises);
        setSelectedRowIds([]);
        toast.success(`${selectedRowIds.length} solicitudes aprobadas`);
      } else if (action === 'BULK_REJECT') {
        const promises = selectedRowIds.map(id => updateOperationLogStatus(id, 'RETURNED', null, justification));
        await Promise.all(promises);
        setSelectedRowIds([]);
        toast.success(`${selectedRowIds.length} solicitudes devueltas`);
      } else if (action === 'DELETE') {
        await deleteOperationLog(data);
        await fetchBatch();
        toast.success('Registro eliminado');
      }
    } catch (e) {
      toast.error('Hubo un error al procesar la acción');
    }
  };

  const getStatusBadge = (status) => {
    const badgeProps = { variant: "subtle", borderRadius: "full", px: 2.5, py: 0.5, textTransform: "capitalize", fontWeight: "medium", fontSize: "xs" };
    switch(status) {
      case 'PENDING_MANAGER': return <Badge colorScheme="yellow" {...badgeProps}>Pdte. Gerente</Badge>;
      case 'APPROVED_MANAGER': return <Badge colorScheme="blue" {...badgeProps}>Aprobado</Badge>;
      case 'RETURNED': return <Badge colorScheme="orange" {...badgeProps}>Devuelto</Badge>;
      case 'PROCESSED_PAYROLL': return <Badge colorScheme="green" {...badgeProps}>En Nómina</Badge>;
      default: return <Badge {...badgeProps}>{status}</Badge>;
    }
  };

  const pendingVisibleLogs = filteredLogs.filter(l => l.status === 'PENDING_MANAGER');
  
  const handleSelectAllRows = () => {
    if (selectedRowIds.length === pendingVisibleLogs.length && pendingVisibleLogs.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(pendingVisibleLogs.map(l => l.id));
    }
  };

  const toggleRowSelection = (id) => {
    if (selectedRowIds.includes(id)) {
      setSelectedRowIds(prev => prev.filter(rowId => rowId !== id));
    } else {
      setSelectedRowIds(prev => [...prev, id]);
    }
  };

  if (isLoading) {
    return (
      <Box p={{ base: 3, md: 6, lg: 8 }}>
        <Flex justify="space-between" align="center" mb={6}>
          <Skeleton h="28px" w="250px" borderRadius="md" />
          <Skeleton h="40px" w="140px" borderRadius="lg" />
        </Flex>
        <Skeleton h="32px" w="300px" mb={4} borderRadius="md" />
        <Skeleton h="64px" w="100%" mb={4} borderRadius="xl" />
        <Box border="1px solid" borderColor={detailBg} borderRadius="xl" overflow="hidden">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th><Skeleton h="14px" w="60px" /></Th>
                <Th><Skeleton h="14px" w="150px" /></Th>
                <Th><Skeleton h="14px" w="100px" /></Th>
                <Th><Skeleton h="14px" w="80px" /></Th>
                <Th><Skeleton h="14px" w="100px" /></Th>
              </Tr>
            </Thead>
            <Tbody>
              {[1,2,3,4,5].map(i => (
                <Tr key={i}>
                  <Td><Skeleton h="14px" w="60px" /></Td>
                  <Td>
                    <Skeleton h="16px" w="180px" mb={2} />
                    <Skeleton h="12px" w="120px" />
                  </Td>
                  <Td><Skeleton h="24px" w="80px" borderRadius="full" /></Td>
                  <Td><Skeleton h="14px" w="80px" /></Td>
                  <Td><Skeleton h="32px" w="80px" borderRadius="md" /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>
    );
  }

  const handleSendToManager = async () => {
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await fetch(`http://localhost:3000/api/operation-batches/${batchId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'PENDING_MANAGER' })
      });
      if (res.ok) {
        toast.success('Lote enviado a gerencia exitosamente');
        navigate('/operations');
      }
    } catch (e) {
      toast.error('Error al enviar');
    }
  };

  const handleApproveBatch = async () => {
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await fetch(`http://localhost:3000/api/operation-batches/${batchId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'APPROVED_MANAGER' })
      });
      if (res.ok) {
        toast.success('Lote aprobado');
        navigate('/operations');
      }
    } catch (e) {
      toast.error('Error al aprobar');
    }
  };

  const handleRejectBatch = async () => {
    const note = prompt('Razón del rechazo:');
    if (!note) return;
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await fetch(`http://localhost:3000/api/operation-batches/${batchId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'RETURNED', justification: note })
      });
      if (res.ok) {
        toast.success('Lote rechazado');
        navigate('/operations');
      }
    } catch (e) {
      toast.error('Error al rechazar');
    }
  };

  if (!batch) return null;

  const canCreateBatch = ['ADMIN', 'GERENTE GENERAL', 'SOLICITANTE', 'NOMINA', 'GERENTE'].includes(user?.role);
  const canEdit = canCreateBatch && (batch.status === 'DRAFT' || batch.status === 'RETURNED');


  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        mb={6}
        flexWrap="wrap"
        gap={4}
      >
        <Flex align="center" gap={4}>
          <IconButton aria-label="Back" icon={<ArrowLeft size={24} />} onClick={() => navigate('/operations')} variant="ghost" />
          <Box>
            <Flex align="center" gap={3}>
              <Heading size="lg" fontWeight={800} color={textColor}>
                {batch.title}
              </Heading>
              {getStatusBadge(batch.status)}
            </Flex>
            <Text color={mutedTextColor} fontSize="md">
              {operationLogs.length} operaciones en este lote
            </Text>
            {batch.status === 'RETURNED' && batch.justification && (
              <Text color="red.500" fontSize="sm" mt={1}>
                <b>Rechazado:</b> {batch.justification}
              </Text>
            )}
          </Box>
        </Flex>

        <Flex gap={2}>
          {canEdit && (
            <>
              <Button 
                colorScheme="gray" 
                leftIcon={<Plus size={16} />} 
                onClick={() => {
                  setFormData({
                    employeeIds: [], companyId: '', date: new Date().toISOString().slice(0, 10), type: 'HORA_EXTRA',
                    hoursQty: 0, hourType: 'SIMPLE', bonusQty: 1, bonusAmount: 0, taskDescription: ''
                  });
                  onOpen();
                }}
              >
                Nuevo Registro
              </Button>
              <Button 
                colorScheme="blue" 
                leftIcon={<Send size={16} />} 
                onClick={handleSendToManager}
              >
                Enviar a Gerencia
              </Button>
            </>
          )}

          {isManagerOrAdmin && batch.status === 'PENDING_MANAGER' && (
            <>
              <Button colorScheme="red" variant="outline" leftIcon={<X size={16} />} onClick={handleRejectBatch}>Rechazar Lote</Button>
              <Button colorScheme="green" leftIcon={<Check size={16} />} onClick={handleApproveBatch}>Aprobar Lote Completo</Button>
            </>
          )}
        </Flex>
      </Flex>


      <HStack mb={4} spacing={4} bg={bg} p={4} borderRadius="lg" shadow="sm">
        <FormControl w="200px">
          <FormLabel fontSize="xs" color={mutedTextColor}>Mes</FormLabel>
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} size="sm" />
        </FormControl>
        <FormControl w="150px">
          <FormLabel fontSize="xs" color={mutedTextColor}>Tipo</FormLabel>
          <Select size="sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="HORA_EXTRA">Horas Extras</option>
            <option value="BONO">Bonos</option>
          </Select>
        </FormControl>
        <FormControl w="150px">
          <FormLabel fontSize="xs" color={mutedTextColor}>Estado</FormLabel>
          <Select size="sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">Todos</option>
            {tabIndex === 0 ? (
              <>
                <option value="PENDING_MANAGER">Pendientes</option>
                <option value="RETURNED">Devueltos</option>
              </>
            ) : (
              <>
                <option value="APPROVED_MANAGER">Aprobados</option>
                <option value="PROCESSED_PAYROLL">Procesados</option>
              </>
            )}
          </Select>
        </FormControl>
      </HStack>

      {selectedRowIds.length > 0 && isManagerOrAdmin && (
        <HStack mb={4} p={3} bg={bulkBg} borderRadius="md" shadow="sm" justify="space-between">
          <Text fontSize="sm" fontWeight="bold" color={bulkTextColor}>
            {selectedRowIds.length} solicitudes seleccionadas
          </Text>
          <HStack>
            <Button size="sm" colorScheme="orange" onClick={handleBulkReject}>Devolver Seleccionados</Button>
            <Button size="sm" colorScheme="blue" onClick={handleBulkApprove}>Aprobar Seleccionados</Button>
          </HStack>
        </HStack>
      )}

      <Box bg={bg} borderRadius="lg" overflow="hidden" overflowX="auto" shadow="sm">
        <Table variant="simple" size="sm">
          <Thead bg={theadBg}>
            <Tr>
              {isManagerOrAdmin && (
                <Th w="40px">
                  <Checkbox 
                    colorScheme="brand" 
                    isChecked={selectedRowIds.length === pendingVisibleLogs.length && pendingVisibleLogs.length > 0}
                    isIndeterminate={selectedRowIds.length > 0 && selectedRowIds.length < pendingVisibleLogs.length}
                    onChange={handleSelectAllRows}
                    isDisabled={pendingVisibleLogs.length === 0}
                  />
                </Th>
              )}
              <Th color={theadTextColor}>Fecha</Th>
              <Th color={theadTextColor}>Empresa</Th>
              <Th color={theadTextColor}>Empleado</Th>
              <Th color={theadTextColor}>Tipo</Th>
              <Th color={theadTextColor}>Detalle (Horas/Monto)</Th>
              <Th color={theadTextColor}>Tarea</Th>
              <Th color={theadTextColor}>Estado</Th>
              <Th color={theadTextColor}>Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredLogs.map(log => (
              <Tr key={log.id}>
                {isManagerOrAdmin && (
                  <Td>
                    {log.status === 'PENDING_MANAGER' ? (
                      <Checkbox 
                        colorScheme="brand" 
                        isChecked={selectedRowIds.includes(log.id)} 
                        onChange={() => toggleRowSelection(log.id)} 
                      />
                    ) : null}
                  </Td>
                )}
                <Td>{log.date}</Td>
                <Td>{log.companyData ? log.companyData.nombre_comercial : 'S/E'}</Td>
                <Td>{log.Employee ? [log.Employee.primer_nombre, log.Employee.segundo_nombre, log.Employee.otro_nombre, log.Employee.primer_apellido, log.Employee.segundo_apellido].filter(Boolean).join(' ') : 'Desconocido'}</Td>
                <Td>{log.type === 'HORA_EXTRA' ? 'Hrs Extras' : 'Bono'}</Td>
                <Td>
                  {log.type === 'HORA_EXTRA' 
                    ? `${log.hoursQty} hrs (${log.hourType})`
                    : `Q${log.bonusAmount}`
                  }
                </Td>
                <Td maxW="200px" isTruncated>{log.taskDescription}</Td>
                <Td>{getStatusBadge(log.status)}</Td>
                <Td>
                  <HStack spacing={2}>
                    <Tooltip label="Ver Detalles" hasArrow>
                      <IconButton aria-label="Ver Detalles" size={{ base: 'xs', md: 'sm' }} icon={<Eye size={16} />} variant="ghost" colorScheme="teal" onClick={() => { setSelectedLog(log); onDetailsOpen(); }} transition="all 0.3s" />
                    </Tooltip>
                    {!isManagerOrAdmin && !isReadOnly && log.status === 'RETURNED' && (
                      <Tooltip label="Editar y Reenviar" hasArrow>
                        <IconButton aria-label="Editar" size={{ base: 'xs', md: 'sm' }} icon={<Edit2 size={16} />} variant="ghost" colorScheme="blue" onClick={() => openEdit(log)} transition="all 0.3s" />
                      </Tooltip>
                    )}
                    {isManagerOrAdmin && log.status === 'PENDING_MANAGER' && (
                      <>
                        <Tooltip label="Aprobar" hasArrow>
                          <IconButton aria-label="Aprobar" size={{ base: 'xs', md: 'sm' }} icon={<Check size={16} />} variant="ghost" colorScheme="blue" onClick={() => handleApprove(log.id)} transition="all 0.3s" />
                        </Tooltip>
                        <Tooltip label="Devolver" hasArrow>
                          <IconButton aria-label="Devolver" size={{ base: 'xs', md: 'sm' }} icon={<X size={16} />} variant="ghost" colorScheme="orange" onClick={() => handleReject(log.id)} transition="all 0.3s" />
                        </Tooltip>
                      </>
                    )}
                    {!isReadOnly && log.status !== 'PROCESSED_PAYROLL' && (
                      <Tooltip label="Eliminar" hasArrow>
                        <IconButton aria-label="Eliminar" size={{ base: 'xs', md: 'sm' }} icon={<Trash2 size={16} />} variant="ghost" colorScheme="red" onClick={() => handleDelete(log.id)} transition="all 0.3s" />
                      </Tooltip>
                    )}
                  </HStack>
                </Td>
              </Tr>
            ))}
            {filteredLogs.length === 0 && (
              <Tr><Td colSpan={7} textAlign="center" color="gray.500" py={4}>No hay registros para este periodo</Td></Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Modal Agregar Registro */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={bg} color={textColor}>
          <ModalHeader>Nuevo Registro de Operación</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Empleados</FormLabel>
                <Flex mb={2} gap={2} wrap="wrap" align="center" justify="space-between">
                    <Flex gap={2} wrap="wrap" flex="1">
                      {user?.idDepartamento && !isGlobalRole ? (
                        <Input 
                          size="sm" 
                          flex={1} 
                          minW="140px" 
                          bg={bg} 
                          isReadOnly 
                          value={departments?.find(d => String(d.id) === String(user.idDepartamento))?.nombre_dimension || user.idDepartamento} 
                          title={departments?.find(d => String(d.id) === String(user.idDepartamento))?.nombre_dimension || user.idDepartamento}
                          opacity={0.8}
                          cursor="not-allowed"
                        />
                      ) : (
                        <Menu closeOnSelect={false}>
                          <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                            {modalAreaFilter.length > 0 ? `${modalAreaFilter.length} Deptos...` : 'Departamento...'}
                          </MenuButton>
                          <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                            <MenuOptionGroup type="checkbox" value={modalAreaFilter} onChange={setModalAreaFilter}>
                              {departments?.map(d => (
                                <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre_dimension}</MenuItemOption>
                              ))}
                            </MenuOptionGroup>
                          </MenuList>
                        </Menu>
                      )}
                      
                      {user?.role?.toUpperCase() !== 'SOLICITANTE' && (
                        <>
                          <Menu closeOnSelect={false}>
                            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                              {modalFilterArea.length > 0 ? `${modalFilterArea.length} Áreas...` : 'Área...'}
                            </MenuButton>
                            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                              <MenuOptionGroup type="checkbox" value={modalFilterArea} onChange={setModalFilterArea}>
                                {areas?.map(a => (
                                  <MenuItemOption key={a.id} value={String(a.id)} fontSize="sm">{a.nombre}</MenuItemOption>
                                ))}
                              </MenuOptionGroup>
                            </MenuList>
                          </Menu>

                          <Menu closeOnSelect={false}>
                            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                              {modalFilterDiv.length > 0 ? `${modalFilterDiv.length} Divs...` : 'División...'}
                            </MenuButton>
                            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                              <MenuOptionGroup type="checkbox" value={modalFilterDiv} onChange={setModalFilterDiv}>
                                {divisions?.map(d => (
                                  <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre}</MenuItemOption>
                                ))}
                              </MenuOptionGroup>
                            </MenuList>
                          </Menu>

                          <Menu closeOnSelect={false}>
                            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                              {modalFilterSubdiv.length > 0 ? `${modalFilterSubdiv.length} Subdivs...` : 'Subdivisión...'}
                            </MenuButton>
                            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                              <MenuOptionGroup type="checkbox" value={modalFilterSubdiv} onChange={setModalFilterSubdiv}>
                                {subdivisions?.map(s => (
                                  <MenuItemOption key={s.id} value={String(s.id)} fontSize="sm">{s.nombre}</MenuItemOption>
                                ))}
                              </MenuOptionGroup>
                            </MenuList>
                          </Menu>

                          <Menu closeOnSelect={false}>
                            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                              {modalFilterDim5.length > 0 ? `${modalFilterDim5.length} Dim 5...` : 'Dimensión 5...'}
                            </MenuButton>
                            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                              <MenuOptionGroup type="checkbox" value={modalFilterDim5} onChange={setModalFilterDim5}>
                                {dimension5s?.map(d => (
                                  <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre}</MenuItemOption>
                                ))}
                              </MenuOptionGroup>
                            </MenuList>
                          </Menu>
                        </>
                      )}
                    </Flex>
                    
                    <Button size="sm" flexShrink={0} variant="outline" colorScheme="brand" borderRadius="md" onClick={handleSelectAllEmployees}>
                      {formData.employeeIds.length === filteredModalEmployees.length && filteredModalEmployees.length > 0 ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                    </Button>
                  </Flex>
                <Input 
                  size="sm" 
                  placeholder="Buscar empleado por nombre..." 
                  value={modalSearchQuery} 
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  mb={2}
                />
                <Box maxH="250px" overflowY="auto" borderWidth="1px" borderRadius="md" p={2}>
                  <CheckboxGroup colorScheme="brand" value={formData.employeeIds} onChange={(values) => setFormData({...formData, employeeIds: values})}>
                    <VStack align="start" spacing={1}>
                      {(() => {
                        const groups = {};
                        filteredModalEmployees.forEach(emp => {
                          let groupName = 'Sin Departamento';
                          if (modalFilterDim5.length > 0) {
                            const dim = dimension5s?.find(d => String(d.id) === String(emp.dimension5Id));
                            groupName = dim?.nombre || 'Sin Dimensión 5';
                          } else if (modalFilterSubdiv.length > 0) {
                            const dim = subdivisions?.find(s => String(s.id) === String(emp.subdivisionId));
                            groupName = dim?.nombre || 'Sin Subdivisión';
                          } else if (modalFilterDiv.length > 0) {
                            const dim = divisions?.find(d => String(d.id) === String(emp.divisionId));
                            groupName = dim?.nombre || 'Sin División';
                          } else if (modalFilterArea.length > 0) {
                            const dim = areas?.find(a => String(a.id) === String(emp.areaId));
                            groupName = dim?.nombre || 'Sin Área';
                          } else {
                            const dept = departments?.find(d => String(d.id) === String(emp.departmentId));
                            groupName = dept?.nombre_dimension || emp.departmentData?.nombre_dimension || 'Sin Departamento';
                          }
                          
                          if (!groups[groupName]) groups[groupName] = [];
                          groups[groupName].push(emp);
                        });
                        return Object.keys(groups).sort().map(groupName => (
                          <Box key={groupName} w="100%">
                            <Text fontSize="xs" fontWeight="bold" color="brand.400" textTransform="uppercase" mt={2} mb={1} borderBottomWidth="1px" borderColor="gray.600" pb={1}>
                              {groupName}
                            </Text>
                            {groups[groupName].map(emp => (
                              <Checkbox key={emp.id} value={emp.id.toString()} w="100%" py={0.5}>
                                {[emp.primer_nombre, emp.segundo_nombre, emp.otro_nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ')}
                              </Checkbox>
                            ))}
                          </Box>
                        ));
                      })()}
                      {filteredModalEmployees.length === 0 && <Text fontSize="sm" color="gray.500">No hay empleados en esta área</Text>}
                    </VStack>
                  </CheckboxGroup>
                </Box>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">Empresa a cargar</FormLabel>
                <Select size="sm" value={formData.companyId} onChange={(e) => setFormData({...formData, companyId: e.target.value})}>
                  <option value="" disabled>Selecciona una empresa</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.nombre_comercial}</option>)}
                </Select>
              </FormControl>

              <HStack w="full" spacing={4}>
                <FormControl isRequired flex={1}>
                  <FormLabel fontSize="sm">Fecha</FormLabel>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </FormControl>
                <FormControl flex={1}>
                  <FormLabel fontSize="sm">Tipo de Registro</FormLabel>
                  <Select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                    <option value="HORA_EXTRA">Horas Extras</option>
                    <option value="BONO">Bono</option>
                  </Select>
                </FormControl>
              </HStack>

              {formData.type === 'HORA_EXTRA' && (
                <HStack w="100%">
                  <FormControl flex={1}>
                    <FormLabel fontSize="sm">Cantidad de Horas</FormLabel>
                    <Input type="number" step="0.5" value={formData.hoursQty} onChange={(e) => setFormData({...formData, hoursQty: e.target.value})} />
                  </FormControl>
                  <FormControl flex={1}>
                    <FormLabel fontSize="sm">Tipo de Hora</FormLabel>
                    <Select value={formData.hourType} onChange={(e) => setFormData({...formData, hourType: e.target.value})}>
                      <option value="SIMPLE">Simples</option>
                      <option value="DOBLE">Dobles</option>
                      <option value="NOCTURNA">Nocturnas</option>
                    </Select>
                  </FormControl>
                </HStack>
              )}

              {formData.type === 'BONO' && (
                <VStack w="100%" spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm">Concepto Predeterminado</FormLabel>
                    <Select 
                      placeholder="Seleccionar concepto por defecto..."
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const [amount] = val.split('|');
                          setFormData({...formData, bonusAmount: amount});
                        }
                      }}
                    >
                      <option value="225|Producción">Producción (Q 225.00)</option>
                      <option value="240|Bodega y Logística">Bodega y Logística (Q 240.00)</option>
                      <option value="250|Mantenimiento 1">Mantenimiento 1 (Q 250.00)</option>
                      <option value="275|Mantenimiento 2">Mantenimiento 2 (Q 275.00)</option>
                    </Select>
                  </FormControl>
                  <FormControl isRequired w="100%">
                    <FormLabel fontSize="sm">Monto del Bono (Q)</FormLabel>
                    <Input type="number" step="0.01" value={formData.bonusAmount} onChange={(e) => setFormData({...formData, bonusAmount: e.target.value})} />
                  </FormControl>
                </VStack>
              )}

              <FormControl isRequired>
                <FormLabel fontSize="sm">Tarea Realizada (Descripción)</FormLabel>
                <Input value={formData.taskDescription} onChange={(e) => setFormData({...formData, taskDescription: e.target.value})} placeholder="Ej. Empaque de 4 fardos..." />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
            <Button colorScheme="brand" onClick={handleSave}>Guardar Registro</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Detalles */}
      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="md" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={bg} color={textColor}>
          <ModalHeader>Detalles de la Solicitud</ModalHeader>
          <ModalBody>
            {selectedLog && (
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Empleado</Text>
                  <Text fontSize="md">{selectedLog.Employee ? [selectedLog.Employee.primer_nombre, selectedLog.Employee.segundo_nombre, selectedLog.Employee.otro_nombre, selectedLog.Employee.primer_apellido, selectedLog.Employee.segundo_apellido].filter(Boolean).join(' ') : 'Desconocido'}</Text>
                </Box>
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <GridItem>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Fecha</Text>
                    <Text fontSize="md">{selectedLog.date}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Tipo</Text>
                    <Text fontSize="md">{selectedLog.type === 'HORA_EXTRA' ? 'Horas Extras' : 'Bono'}</Text>
                  </GridItem>
                </Grid>
                
                {selectedLog.type === 'HORA_EXTRA' ? (
                  <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                    <GridItem>
                      <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Cantidad de Horas</Text>
                      <Text fontSize="md">{selectedLog.hoursQty}</Text>
                    </GridItem>
                    <GridItem>
                      <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Tipo de Hora</Text>
                      <Text fontSize="md">{selectedLog.hourType}</Text>
                    </GridItem>
                  </Grid>
                ) : (
                  <Box>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Monto del Bono</Text>
                    <Text fontSize="md">Q{selectedLog.bonusAmount}</Text>
                  </Box>
                )}

                <Box>
                  <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Tarea / Descripción</Text>
                  <Text fontSize="md" p={3} bg={detailBg} borderRadius="md" mt={1}>
                    {selectedLog.taskDescription}
                  </Text>
                </Box>

                {selectedLog.justification && (
                  <Box>
                    <Text fontSize="xs" color="orange.500" textTransform="uppercase" fontWeight="bold">Motivo de Devolución</Text>
                    <Text fontSize="md" p={3} bg="orange.50" color="orange.800" borderRadius="md" mt={1}>
                      {selectedLog.justification}
                    </Text>
                  </Box>
                )}

                <Box pt={2}>
                  <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold" mb={1}>Estado Actual</Text>
                  {getStatusBadge(selectedLog.status)}
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="brand" onClick={onDetailsClose}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* AlertDialog (Confirmaciones) */}
      <AlertDialog isCentered isOpen={confirmState.isOpen} leastDestructiveRef={cancelRef} onClose={() => setConfirmState({ isOpen: false, action: null, data: null })}>
        <AlertDialogOverlay backdropFilter="blur(4px)">
          <AlertDialogContent bg={bg} color={textColor}>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Confirmar Acción
            </AlertDialogHeader>
            <AlertDialogBody>
              {confirmState.action === 'SAVE' && (
                <VStack align="stretch" spacing={3}>
                  <Text>¿Estás seguro de que deseas guardar estos registros?</Text>
                  {user?.role?.toUpperCase() === 'SOLICITANTE' && (
                    <Text fontSize="sm" color="blue.500" fontWeight="medium">
                      Nota: Se enviará una notificación por correo a tu gerente de área para su aprobación.
                    </Text>
                  )}
                </VStack>
              )}
              {confirmState.action === 'APPROVE' && '¿Deseas aprobar esta solicitud de operación?'}
              {confirmState.action === 'REJECT' && (
                <VStack align="stretch" spacing={3}>
                  <Text>¿Estás seguro de que deseas devolver esta solicitud al solicitante?</Text>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Justificación / Motivo</FormLabel>
                    <Input 
                      placeholder="Indica qué debe corregir el solicitante..." 
                      value={confirmState.justification}
                      onChange={(e) => setConfirmState({...confirmState, justification: e.target.value})}
                    />
                  </FormControl>
                </VStack>
              )}
              {confirmState.action === 'BULK_APPROVE' && `¿Deseas aprobar las ${selectedRowIds.length} solicitudes seleccionadas?`}
              {confirmState.action === 'BULK_REJECT' && (
                <VStack align="stretch" spacing={3}>
                  <Text>{`¿Deseas devolver las ${selectedRowIds.length} solicitudes seleccionadas?`}</Text>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Justificación / Motivo (Aplica a todas)</FormLabel>
                    <Input 
                      placeholder="Indica qué deben corregir..." 
                      value={confirmState.justification}
                      onChange={(e) => setConfirmState({...confirmState, justification: e.target.value})}
                    />
                  </FormControl>
                </VStack>
              )}
              {confirmState.action === 'DELETE' && '¿Estás seguro de que deseas eliminar este registro permanentemente?'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setConfirmState({ isOpen: false, action: null, data: null })} variant="ghost">Cancelar</Button>
              <Button 
                colorScheme={['DELETE', 'REJECT', 'BULK_REJECT'].includes(confirmState.action) ? 'red' : 'blue'} 
                onClick={executeConfirm} 
                ml={3}
              >
                {confirmState.action === 'SAVE' ? 'Guardar' : confirmState.action === 'DELETE' ? 'Eliminar' : 'Confirmar'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Modal Editar y Reenviar */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="2xl" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={bg} color={textColor}>
          <ModalHeader>Editar y Reenviar Solicitud</ModalHeader>
          <ModalBody>
            {editFormData && (
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" color={mutedTextColor}>
                  Corrige los datos de la solicitud y vuelve a enviarla para su aprobación.
                </Text>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Empleado</FormLabel>
                  <Flex mb={2} gap={2} wrap="wrap">
                    {user?.idDepartamento && !isGlobalRole ? (
                      <Input 
                        size="sm" 
                        flex={1} 
                        minW="140px" 
                        bg={bg} 
                        isReadOnly 
                        value={departments?.find(d => String(d.id) === String(user.idDepartamento))?.nombre_dimension || user.idDepartamento} 
                        title={departments?.find(d => String(d.id) === String(user.idDepartamento))?.nombre_dimension || user.idDepartamento}
                        opacity={0.8}
                        cursor="not-allowed"
                      />
                    ) : (
                      <Menu closeOnSelect={false}>
                        <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                          {editModalAreaFilter.length > 0 ? `${editModalAreaFilter.length} Deptos...` : 'Departamento...'}
                        </MenuButton>
                        <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                          <MenuOptionGroup type="checkbox" value={editModalAreaFilter} onChange={setEditModalAreaFilter}>
                            {departments?.map(d => (
                              <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre_dimension}</MenuItemOption>
                            ))}
                          </MenuOptionGroup>
                        </MenuList>
                      </Menu>
                    )}

                    {user?.role?.toUpperCase() !== 'SOLICITANTE' && (
                      <>
                        <Menu closeOnSelect={false}>
                          <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                            {editModalFilterArea.length > 0 ? `${editModalFilterArea.length} Áreas...` : 'Área...'}
                          </MenuButton>
                          <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                            <MenuOptionGroup type="checkbox" value={editModalFilterArea} onChange={setEditModalFilterArea}>
                              {areas?.map(a => (
                                <MenuItemOption key={a.id} value={String(a.id)} fontSize="sm">{a.nombre}</MenuItemOption>
                              ))}
                            </MenuOptionGroup>
                          </MenuList>
                        </Menu>

                        <Menu closeOnSelect={false}>
                          <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                            {editModalFilterDiv.length > 0 ? `${editModalFilterDiv.length} Divs...` : 'División...'}
                          </MenuButton>
                          <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                            <MenuOptionGroup type="checkbox" value={editModalFilterDiv} onChange={setEditModalFilterDiv}>
                              {divisions?.map(d => (
                                <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre}</MenuItemOption>
                              ))}
                            </MenuOptionGroup>
                          </MenuList>
                        </Menu>

                        <Menu closeOnSelect={false}>
                          <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                            {editModalFilterSubdiv.length > 0 ? `${editModalFilterSubdiv.length} Subdivs...` : 'Subdivisión...'}
                          </MenuButton>
                          <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                            <MenuOptionGroup type="checkbox" value={editModalFilterSubdiv} onChange={setEditModalFilterSubdiv}>
                              {subdivisions?.map(s => (
                                <MenuItemOption key={s.id} value={String(s.id)} fontSize="sm">{s.nombre}</MenuItemOption>
                              ))}
                            </MenuOptionGroup>
                          </MenuList>
                        </Menu>

                        <Menu closeOnSelect={false}>
                          <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} flex={1} minW="140px" textAlign="left" fontWeight="normal" bg={bg} borderRadius="md" px={3}>
                            {editModalFilterDim5.length > 0 ? `${editModalFilterDim5.length} Dim 5...` : 'Dimensión 5...'}
                          </MenuButton>
                          <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                            <MenuOptionGroup type="checkbox" value={editModalFilterDim5} onChange={setEditModalFilterDim5}>
                              {dimension5s?.map(d => (
                                <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre}</MenuItemOption>
                              ))}
                            </MenuOptionGroup>
                          </MenuList>
                        </Menu>
                      </>
                    )}
                  </Flex>
                  <Input 
                    size="sm" 
                    placeholder="Buscar empleado por nombre..." 
                    value={editModalSearchQuery} 
                    onChange={(e) => setEditModalSearchQuery(e.target.value)}
                    mb={2}
                  />
                  <Box maxH="250px" overflowY="auto" borderWidth="1px" borderRadius="md" p={2}>
                    <RadioGroup colorScheme="brand" value={editFormData.employeeId.toString()} onChange={(val) => setEditFormData({...editFormData, employeeId: val})}>
                      <VStack align="start" spacing={1}>
                        {(() => {
                          const groups = {};
                          filteredEditModalEmployees.forEach(emp => {
                            const dept = departments?.find(d => String(d.id) === String(emp.departmentId));
                            const groupName = dept?.nombre_dimension || emp.departmentData?.nombre_dimension || 'Sin Departamento';
                            if (!groups[groupName]) groups[groupName] = [];
                            groups[groupName].push(emp);
                          });
                          return Object.keys(groups).sort().map(groupName => (
                            <Box key={groupName} w="100%">
                              <Text fontSize="xs" fontWeight="bold" color="brand.400" textTransform="uppercase" mt={2} mb={1} borderBottomWidth="1px" borderColor="gray.600" pb={1}>
                                {groupName}
                              </Text>
                              {groups[groupName].map(emp => (
                                <Radio key={emp.id} value={emp.id.toString()} w="100%" py={0.5}>
                                  {[emp.primer_nombre, emp.segundo_nombre, emp.otro_nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ')}
                                </Radio>
                              ))}
                            </Box>
                          ));
                        })()}
                        {filteredEditModalEmployees.length === 0 && <Text fontSize="sm" color="gray.500">No hay empleados en esta área</Text>}
                      </VStack>
                    </RadioGroup>
                  </Box>
                </FormControl>
                {editFormData.type === 'HORA_EXTRA' ? (
                  <>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm">Cantidad de Horas</FormLabel>
                      <Input type="number" step="0.5" value={editFormData.hoursQty} onChange={(e) => setEditFormData({...editFormData, hoursQty: e.target.value})} />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm">Tipo de Hora Extra</FormLabel>
                      <Select value={editFormData.hourType} onChange={(e) => setEditFormData({...editFormData, hourType: e.target.value})}>
                        <option value="SIMPLE">Simple</option>
                        <option value="DOBLE">Doble</option>
                        <option value="NOCTURNA">Nocturna</option>
                      </Select>
                    </FormControl>
                  </>
                ) : (
                  <VStack w="100%" spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel fontSize="sm">Concepto Predeterminado</FormLabel>
                      <Select 
                        placeholder="Seleccionar concepto por defecto..."
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const [amount] = val.split('|');
                            setEditFormData({...editFormData, bonusAmount: amount});
                          }
                        }}
                      >
                        <option value="225|Producción">Producción (Q 225.00)</option>
                        <option value="240|Bodega y Logística">Bodega y Logística (Q 240.00)</option>
                        <option value="250|Mantenimiento 1">Mantenimiento 1 (Q 250.00)</option>
                        <option value="275|Mantenimiento 2">Mantenimiento 2 (Q 275.00)</option>
                      </Select>
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm">Monto del Bono</FormLabel>
                      <Input type="number" step="0.01" value={editFormData.bonusAmount} onChange={(e) => setEditFormData({...editFormData, bonusAmount: e.target.value})} />
                    </FormControl>
                  </VStack>
                )}
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Justificación / Tarea Realizada</FormLabel>
                  <Input value={editFormData.taskDescription} onChange={(e) => setEditFormData({...editFormData, taskDescription: e.target.value})} />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            {user?.role?.toUpperCase() === 'SOLICITANTE' && (
              <Text fontSize="sm" color="blue.500" fontWeight="medium" flex="1" mr={4}>
                Se enviará una notificación a tu gerente.
              </Text>
            )}
            <Button variant="ghost" mr={3} onClick={onEditClose}>Cancelar</Button>
            <Button colorScheme="blue" onClick={handleEditSave}>Guardar y Reenviar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
}
