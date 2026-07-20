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
import { Plus, Check, X, Trash2, Eye, Edit2, ChevronDown, ArrowLeft, Send, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { formatQuincenaLabel, findMatchingActiveDraft } from '../utils/payrollPeriod';

export default function OperationLogs() {
  const { id: batchId } = useParams();
  const navigate = useNavigate();
  const {
    employees, departments, areas, divisions, subdivisions, dimension5s, companies,
    addOperationLog, updateOperationLogStatus, deleteOperationLog, updateOperationLog,
    activePayrolls, injectApprovedLogIntoActiveDrafts, revertLogFromActiveDrafts, isLoading
  } = useContext(DataContext);
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
  const { isOpen: isEmailOpen, onOpen: onEmailOpen, onClose: onEmailClose } = useDisclosure();
  const [emailPreview, setEmailPreview] = useState({ subject: '', html: '' });
  const [emailLoading, setEmailLoading] = useState(false);
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
      companyId: log.companyId || log.companyData?.id || '',
      date: log.date || new Date().toISOString().slice(0, 10),
      type: log.type,
      hoursQty: log.hoursQty,
      hourType: log.hourType || 'SIMPLE',
      bonusAmount: log.bonusAmount,
      taskDescription: log.taskDescription
    });
    onEditOpen();
  };

  const getMissingPayrollMessage = (date, companyId) => {
    const company = companies.find((c) => String(c.id) === String(companyId));
    const companyName = company?.nombre_comercial || 'la empresa seleccionada';
    const quincena = formatQuincenaLabel(date) || 'esa quincena';
    return `No hay nómina activa para ${companyName} en ${quincena}`;
  };

  const hasMatchingActivePayroll = (date, companyId) =>
    !!findMatchingActiveDraft(activePayrolls, date, companyId, companies);

  const handleEditSave = async () => {
    if (!editFormData.taskDescription || !editFormData.employeeId || !editFormData.date || !editFormData.companyId) {
      toast.warning('Completa la descripción, empleado, fecha y empresa');
      return;
    }
    if (!hasMatchingActivePayroll(editFormData.date, editFormData.companyId)) {
      toast.error(getMissingPayrollMessage(editFormData.date, editFormData.companyId));
      return;
    }
    try {
      await updateOperationLog(editFormData.id, {
        employeeId: Number(editFormData.employeeId),
        companyId: Number(editFormData.companyId),
        date: editFormData.date,
        hoursQty: editFormData.type === 'HORA_EXTRA' ? Number(editFormData.hoursQty) : 0,
        hourType: editFormData.hourType,
        bonusAmount: editFormData.type === 'BONO' ? Number(editFormData.bonusAmount) : 0,
        taskDescription: editFormData.taskDescription
      });
      await fetchBatch();
      toast.success('Registro corregido exitosamente');
      onEditClose();
    } catch (e) {
      toast.error(e.message || 'Error al guardar');
    }
  };

  const [confirmState, setConfirmState] = useState({ isOpen: false, action: null, data: null, justification: '' });
  const cancelRef = React.useRef();

  const isManagerOrAdmin = ['gerente', 'nomina', 'admin'].includes(user?.role?.toLowerCase());
  const isNominaRole = ['admin', 'nomina', 'auditor'].includes(user?.role?.toLowerCase());
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
      if (filterMonth && (!log.date || !String(log.date).startsWith(filterMonth))) return false;
      if (filterType !== 'ALL' && log.type !== filterType) return false;
      if (filterStatus !== 'ALL' && log.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [operationLogs, filterMonth, filterType, filterStatus]);

  const handleSave = () => {
    if (formData.employeeIds.length === 0 || !formData.date || !formData.taskDescription || !formData.companyId) {
      toast.warning('Selecciona al menos un empleado, la empresa y completa los campos requeridos');
      return;
    }
    if (!hasMatchingActivePayroll(formData.date, formData.companyId)) {
      toast.error(getMissingPayrollMessage(formData.date, formData.companyId));
      return;
    }
    setConfirmState({ isOpen: true, action: 'SAVE', data: null });
  };

  const handleApprove = (id) => setConfirmState({ isOpen: true, action: 'APPROVE', data: id });
  const handleReject = (id) => setConfirmState({ isOpen: true, action: 'REJECT', data: id });
  const handleRejectToManager = (id) => setConfirmState({ isOpen: true, action: 'REJECT_TO_MANAGER', data: id });
  const handleDelete = (id) => setConfirmState({ isOpen: true, action: 'DELETE', data: id });

  const handleBulkApprove = () => setConfirmState({ isOpen: true, action: 'BULK_APPROVE', data: null });
  const handleBulkReject = () => setConfirmState({ isOpen: true, action: 'BULK_REJECT', data: null });
  const handleBulkRejectToManager = () => setConfirmState({ isOpen: true, action: 'BULK_REJECT_TO_MANAGER', data: null });

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
        const log = operationLogs.find((l) => String(l.id) === String(data));
        await updateOperationLogStatus(data, 'APPROVED_MANAGER', null, null, false, log);
        await fetchBatch();
        toast.success('Solicitud aprobada');
      } else if (action === 'REJECT') {
        const log = operationLogs.find((l) => String(l.id) === String(data));
        await updateOperationLogStatus(data, 'RETURNED', null, justification, false, log);
        await fetchBatch();
        toast.success('Solicitud devuelta al solicitante');
      } else if (action === 'REJECT_TO_MANAGER') {
        const log = operationLogs.find((l) => String(l.id) === String(data));
        await updateOperationLogStatus(data, 'PENDING_MANAGER', null, justification, true, log);
        await fetchBatch();
        toast.success('Solicitud devuelta al gerente');
      } else if (action === 'BULK_APPROVE') {
        const promises = selectedRowIds.map((id) => {
          const log = operationLogs.find((l) => String(l.id) === String(id));
          return updateOperationLogStatus(id, 'APPROVED_MANAGER', null, null, false, log);
        });
        await Promise.all(promises);
        await fetchBatch();
        setSelectedRowIds([]);
        toast.success(`${selectedRowIds.length} solicitudes aprobadas`);
      } else if (action === 'BULK_REJECT') {
        const promises = selectedRowIds.map((id) => {
          const log = operationLogs.find((l) => String(l.id) === String(id));
          return updateOperationLogStatus(id, 'RETURNED', null, justification, false, log);
        });
        await Promise.all(promises);
        await fetchBatch();
        setSelectedRowIds([]);
        toast.success(`${selectedRowIds.length} solicitudes devueltas`);
      } else if (action === 'BULK_REJECT_TO_MANAGER') {
        const promises = selectedRowIds.map((id) => {
          const log = operationLogs.find((l) => String(l.id) === String(id));
          return updateOperationLogStatus(id, 'PENDING_MANAGER', null, justification, true, log);
        });
        await Promise.all(promises);
        await fetchBatch();
        setSelectedRowIds([]);
        toast.success(`${selectedRowIds.length} solicitudes devueltas al gerente`);
      } else if (action === 'DELETE') {
        await deleteOperationLog(data);
        await fetchBatch();
        toast.success('Registro eliminado');
      }
    } catch (e) {
      toast.error(e.message || 'Hubo un error al procesar la acción');
    }
  };

  const getStatusBadge = (status) => {
    const badgeProps = { variant: "subtle", borderRadius: "full", px: 2.5, py: 0.5, textTransform: "capitalize", fontWeight: "medium", fontSize: "xs" };
    switch(status) {
      case 'DRAFT': return <Badge colorScheme="gray" {...badgeProps}>Borrador</Badge>;
      case 'PENDING_MANAGER': return <Badge colorScheme="yellow" {...badgeProps}>Pdte. Gerente</Badge>;
      case 'APPROVED_MANAGER': return <Badge colorScheme="blue" {...badgeProps}>Aprobado</Badge>;
      case 'RETURNED': return <Badge colorScheme="orange" {...badgeProps}>Devuelto</Badge>;
      case 'PROCESSED_PAYROLL': return <Badge colorScheme="green" {...badgeProps}>En Nómina</Badge>;
      default: return <Badge {...badgeProps}>{status}</Badge>;
    }
  };

  const pendingVisibleLogs = useMemo(
    () => filteredLogs.filter(l => l.status === 'PENDING_MANAGER'),
    [filteredLogs]
  );

  const {
    paginatedData: paginatedLogs,
    currentPage,
    totalPages,
    totalItems,
    limit,
    goToNextPage,
    goToPreviousPage,
    changeLimit
  } = usePagination(filteredLogs, 25);
  
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
    if (!operationLogs || operationLogs.length === 0) {
      toast.warning('Agrega al menos un registro (bono o horas extra) antes de enviar el lote a gerencia');
      return;
    }
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
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Error al enviar');
      }
    } catch (e) {
      toast.error('Error al enviar');
    }
  };

  const handleApproveBatch = async () => {
    if (!operationLogs || operationLogs.length === 0) {
      toast.warning('No se puede aprobar un lote sin registros');
      return;
    }
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
        const logsToInject = operationLogs.filter((l) => l.status !== 'PROCESSED_PAYROLL');
        logsToInject.forEach((log) => injectApprovedLogIntoActiveDrafts({ ...log, status: 'APPROVED_MANAGER' }));
        toast.success('Lote aprobado');
        navigate('/operations');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Error al aprobar');
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
        operationLogs
          .filter((l) => l.status === 'APPROVED_MANAGER')
          .forEach((log) => revertLogFromActiveDrafts(log));
        toast.success('Lote rechazado');
        navigate('/operations');
      }
    } catch (e) {
      toast.error('Error al rechazar');
    }
  };

  const handleRejectBatchToManager = async () => {
    const note = prompt('Justificación del rechazo al gerente:');
    if (!note) return;
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await fetch(`http://localhost:3000/api/operation-batches/${batchId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'PENDING_MANAGER', justification: note, rejectionFromNomina: true })
      });
      if (res.ok) {
        operationLogs
          .filter((l) => l.status === 'APPROVED_MANAGER')
          .forEach((log) => revertLogFromActiveDrafts(log));
        toast.success('Lote devuelto al gerente');
        await fetchBatch();
      } else {
        toast.error('Error al rechazar');
      }
    } catch (e) {
      toast.error('Error al rechazar');
    }
  };

  const handleViewEmail = async () => {
    setEmailLoading(true);
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await fetch(`http://localhost:3000/api/operation-batches/${batchId}/email-preview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmailPreview(data);
        onEmailOpen();
      } else {
        toast.error('No se pudo cargar la vista previa del correo');
      }
    } catch (e) {
      toast.error('Error al cargar vista previa');
    }
    setEmailLoading(false);
  };

  const handleResendEmail = async () => {
    setEmailLoading(true);
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await fetch(`http://localhost:3000/api/operation-batches/${batchId}/notify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Correo reenviado al gerente');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error al reenviar');
      }
    } catch (e) {
      toast.error('Error al reenviar correo');
    }
    setEmailLoading(false);
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
            {batch.status === 'PENDING_MANAGER' && batch.justification && (
              <Text color="orange.500" fontSize="sm" mt={1}>
                <b>Devuelto por Nómina:</b> {batch.justification}
              </Text>
            )}
          </Box>
        </Flex>

        <Flex gap={2} flexWrap="wrap">
          <Button
            variant="outline"
            leftIcon={<Mail size={16} />}
            onClick={handleViewEmail}
            isLoading={emailLoading}
            borderRadius="lg"
          >
            Ver correo
          </Button>

          {canEdit && (
            <>
              <Button 
                colorScheme="brand" 
                leftIcon={<Plus size={16} />} 
                onClick={() => {
                  setFormData({
                    employeeIds: [], companyId: '', date: new Date().toISOString().slice(0, 10), type: 'HORA_EXTRA',
                    hoursQty: 0, hourType: 'SIMPLE', bonusQty: 1, bonusAmount: 0, taskDescription: ''
                  });
                  onOpen();
                }}
                borderRadius="lg" 
                transition="all 0.3s"
                _hover={{ shadow: 'lg' }}
                variant="outline"
              >
                Nuevo Registro
              </Button>
              <Button 
                colorScheme="brand" 
                leftIcon={<Send size={16} />} 
                onClick={handleSendToManager}
                isDisabled={!operationLogs || operationLogs.length === 0}
                title={!operationLogs || operationLogs.length === 0 ? 'Agrega al menos un registro antes de enviar' : undefined}
                borderRadius="lg" 
                transition="all 0.3s"
                _hover={{ shadow: 'lg' }}
              >
                Enviar a Gerencia
              </Button>
            </>
          )}
          {canEdit && (!operationLogs || operationLogs.length === 0) && (
            <Text fontSize="sm" color="orange.400" alignSelf="center">
              Agrega al menos un registro para poder enviar el lote
            </Text>
          )}

          {isManagerOrAdmin && batch.status === 'PENDING_MANAGER' && (
            <>
              <Button colorScheme="red" variant="outline" leftIcon={<X size={16} />} onClick={handleRejectBatch} borderRadius="lg" transition="all 0.3s" _hover={{ shadow: 'lg' }}>Devolver a Solicitante</Button>
              <Button
                colorScheme="green"
                leftIcon={<Check size={16} />}
                onClick={handleApproveBatch}
                isDisabled={!operationLogs || operationLogs.length === 0}
                borderRadius="lg"
                transition="all 0.3s"
                _hover={{ shadow: 'lg' }}
              >
                Aprobar Lote Completo
              </Button>
            </>
          )}

          {isNominaRole && batch.status === 'APPROVED_MANAGER' && (
            <Button colorScheme="orange" variant="outline" leftIcon={<X size={16} />} onClick={handleRejectBatchToManager} borderRadius="lg" transition="all 0.3s" _hover={{ shadow: 'lg' }}>
              Rechazar a Gerente
            </Button>
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
        <FormControl w="180px">
          <FormLabel fontSize="xs" color={mutedTextColor}>Estado</FormLabel>
          <Select size="sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="PENDING_MANAGER">Pdte. Gerente</option>
            <option value="APPROVED_MANAGER">Aprobado</option>
            <option value="RETURNED">Devuelto</option>
            <option value="PROCESSED_PAYROLL">En Nómina</option>
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
              <Th color={theadTextColor}>Quincena</Th>
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
            {paginatedLogs.map(log => (
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
                <Td>
                  {log.date}
                  <Text fontSize="xs" color="gray.500">
                    {new Date(log.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Td>
                <Td whiteSpace="nowrap">{formatQuincenaLabel(log.date)}</Td>
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
                        <Tooltip label="Devolver a Solicitante" hasArrow>
                          <IconButton aria-label="Devolver" size={{ base: 'xs', md: 'sm' }} icon={<X size={16} />} variant="ghost" colorScheme="orange" onClick={() => handleReject(log.id)} transition="all 0.3s" />
                        </Tooltip>
                      </>
                    )}
                    {isNominaRole && log.status === 'APPROVED_MANAGER' && (
                      <Tooltip label="Rechazar a Gerente" hasArrow>
                        <IconButton aria-label="Rechazar a Gerente" size={{ base: 'xs', md: 'sm' }} icon={<X size={16} />} variant="ghost" colorScheme="orange" onClick={() => handleRejectToManager(log.id)} transition="all 0.3s" />
                      </Tooltip>
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
        {filteredLogs.length > 0 && (
          <Box px={2} py={3}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              limit={limit}
              goToNextPage={goToNextPage}
              goToPreviousPage={goToPreviousPage}
              changeLimit={changeLimit}
            />
          </Box>
        )}
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

              {formData.date && formData.companyId && !hasMatchingActivePayroll(formData.date, formData.companyId) && (
                <Box w="100%" p={3} borderRadius="md" bg="orange.50" borderWidth="1px" borderColor="orange.200">
                  <Text fontSize="sm" color="orange.700">
                    {getMissingPayrollMessage(formData.date, formData.companyId)}. No se puede guardar hasta que exista una nómina abierta para esa empresa y quincena.
                  </Text>
                </Box>
              )}

              {formData.date && formData.companyId && hasMatchingActivePayroll(formData.date, formData.companyId) && (
                <Text fontSize="sm" color={mutedTextColor}>
                  Quincena: {formatQuincenaLabel(formData.date)}
                </Text>
              )}

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
            <Button
              colorScheme="brand"
              onClick={handleSave}
              isDisabled={formData.date && formData.companyId && !hasMatchingActivePayroll(formData.date, formData.companyId)}
            >
              Guardar Registro
            </Button>
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
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <GridItem>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Empleado</Text>
                    <Text fontSize="md">
                      {selectedLog.Employee ? [selectedLog.Employee.primer_nombre, selectedLog.Employee.segundo_nombre, selectedLog.Employee.otro_nombre, selectedLog.Employee.primer_apellido, selectedLog.Employee.segundo_apellido].filter(Boolean).join(' ') : 'Desconocido'}
                    </Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Área</Text>
                    <Text fontSize="md">
                      {selectedLog.Employee && areas?.find(a => String(a.id) === String(selectedLog.Employee.areaId))?.nombre || 'No asignada'}
                    </Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Empresa</Text>
                    <Text fontSize="md">
                      {selectedLog.companyData ? selectedLog.companyData.nombre_comercial : 'S/E'}
                    </Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Fecha</Text>
                    <Text fontSize="md">{selectedLog.date}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Quincena</Text>
                    <Text fontSize="md">{formatQuincenaLabel(selectedLog.date)}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Tipo</Text>
                    <Text fontSize="md">{selectedLog.type === 'HORA_EXTRA' ? 'Horas Extras' : 'Bono'}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Estado</Text>
                    <Box mt={1}>{getStatusBadge(selectedLog.status)}</Box>
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
                      <Text fontSize="md">
                        {selectedLog.hourType === 'SIMPLE' ? 'Simple (1x)' : selectedLog.hourType === 'DOBLE' ? 'Doble (2x)' : selectedLog.hourType}
                      </Text>
                    </GridItem>
                  </Grid>
                ) : (
                  <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                    <GridItem>
                      <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Cantidad de Bonos</Text>
                      <Text fontSize="md">{selectedLog.bonusQty || 1}</Text>
                    </GridItem>
                    <GridItem>
                      <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold">Monto Unitario</Text>
                      <Text fontSize="md">Q{parseFloat(selectedLog.bonusAmount).toFixed(2)}</Text>
                    </GridItem>
                  </Grid>
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
              {confirmState.action === 'REJECT_TO_MANAGER' && (
                <VStack align="stretch" spacing={3}>
                  <Text>¿Deseas devolver esta solicitud al gerente para su revisión?</Text>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Justificación del rechazo</FormLabel>
                    <Input 
                      placeholder="Indica qué debe revisar o corregir el gerente..." 
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
                colorScheme={['DELETE', 'REJECT', 'BULK_REJECT', 'REJECT_TO_MANAGER', 'BULK_REJECT_TO_MANAGER'].includes(confirmState.action) ? 'red' : 'blue'} 
                onClick={executeConfirm} 
                ml={3}
                isDisabled={['REJECT', 'BULK_REJECT', 'REJECT_TO_MANAGER', 'BULK_REJECT_TO_MANAGER'].includes(confirmState.action) && !confirmState.justification?.trim()}
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

                <FormControl isRequired>
                  <FormLabel fontSize="sm">Empresa a cargar</FormLabel>
                  <Select
                    size="sm"
                    value={editFormData.companyId || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, companyId: e.target.value })}
                  >
                    <option value="" disabled>Selecciona una empresa</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre_comercial}</option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm">Fecha</FormLabel>
                  <Input
                    type="date"
                    value={editFormData.date || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  />
                </FormControl>

                {editFormData.date && editFormData.companyId && !hasMatchingActivePayroll(editFormData.date, editFormData.companyId) && (
                  <Box w="100%" p={3} borderRadius="md" bg="orange.50" borderWidth="1px" borderColor="orange.200">
                    <Text fontSize="sm" color="orange.700">
                      {getMissingPayrollMessage(editFormData.date, editFormData.companyId)}
                    </Text>
                  </Box>
                )}

                {editFormData.date && (
                  <Text fontSize="sm" color={mutedTextColor}>
                    Quincena: {formatQuincenaLabel(editFormData.date)}
                  </Text>
                )}

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
            <Button
              colorScheme="blue"
              onClick={handleEditSave}
              isDisabled={
                !editFormData ||
                (editFormData.date &&
                  editFormData.companyId &&
                  !hasMatchingActivePayroll(editFormData.date, editFormData.companyId))
              }
            >
              Guardar y Reenviar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Vista Previa Correo */}
      <Modal isOpen={isEmailOpen} onClose={onEmailClose} size="3xl" isCentered scrollBehavior="inside">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={bg} color={textColor} maxH="90vh">
          <ModalHeader>Vista Previa del Correo</ModalHeader>
          <ModalBody>
            <Text fontSize="sm" color={mutedTextColor} mb={2}>Asunto:</Text>
            <Text fontWeight="bold" mb={4}>{emailPreview.subject}</Text>
            <Box
              border="1px solid"
              borderColor={detailBg}
              borderRadius="md"
              overflow="hidden"
              bg="white"
              dangerouslySetInnerHTML={{ __html: emailPreview.html }}
            />
          </ModalBody>
          <ModalFooter>
            {batch.status === 'PENDING_MANAGER' && (
              <Button
                colorScheme="teal"
                leftIcon={<Send size={16} />}
                onClick={handleResendEmail}
                isLoading={emailLoading}
                mr={3}
              >
                Reenviar
              </Button>
            )}
            <Button colorScheme="brand" onClick={onEmailClose}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
}
