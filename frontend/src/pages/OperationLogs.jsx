import React, { useState, useContext, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Heading, Table, Thead, Tbody, Tr, Th, Td, IconButton, Button,
  HStack, Select, Input, Badge, useDisclosure, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel,
  VStack, Text, Checkbox, CheckboxGroup, Radio, RadioGroup, useColorModeValue, Tooltip, Grid, GridItem,
  AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay,
  Tabs, TabList, Tab, Skeleton, Flex,
  Menu, MenuButton, MenuList, MenuOptionGroup, MenuItemOption
} from '@chakra-ui/react';
import { Plus, Check, X, Trash2, Eye, Edit2, ChevronDown, ArrowLeft, Send, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import {
  formatQuincenaLabel,
  findMatchingActiveDraft,
  findMatchingPayrollDraft,
  isBonusOperationalDateAllowed
} from '../utils/payrollPeriod';

const getEmployeePrincipalCompanyId = (employee) => String(
  employee?.empresa_principal ?? employee?.companyId ?? employee?.id_empresa ?? ''
);

const getEmployeeDimension5Value = (employee) => String(
  employee?.nivel_5 ?? employee?.dimension_5 ?? ''
);

const MONTH_NUMBER_BY_NAME = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
};

const getAutomaticBatchMonth = (batch) => {
  const datedLog = (batch?.logs || []).find((log) => /^\d{4}-\d{2}/.test(String(log?.date || '')));
  if (datedLog) return String(datedLog.date).slice(0, 7);
  if (batch?.purpose !== 'BONOS_2DA') return '';

  const normalizedTitle = String(batch?.title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const match = normalizedTitle.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})\b/);
  return match ? `${match[2]}-${MONTH_NUMBER_BY_NAME[match[1]]}` : '';
};

const getDateInMonth = (month) => {
  const [year, monthNumber] = String(month || '').split('-').map(Number);
  if (!year || !monthNumber) return '';
  const currentDay = new Date().getDate();
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(Math.min(currentDay, lastDay)).padStart(2, '0')}`;
};

const formatMoneyQ = (value) =>
  `Q${Number(value || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getHourlyRate = (sueldoOrdinario, hourType = 'SIMPLE') => (
  (Number(sueldoOrdinario) || 0) / 30 / (hourType === 'NOCTURNA' ? 6 : 8)
);

const getOvertimeFactor = (hourType) => (
  ['SIMPLE', 'NOCTURNA'].includes(String(hourType || '').trim().toUpperCase()) ? 1.5 : 0
);

const calcOvertimeAmount = (sueldoOrdinario, hoursQty, hourType) => {
  const hours = Number(hoursQty) || 0;
  const factor = getOvertimeFactor(hourType);
  if (hours <= 0 || factor <= 0) return 0;
  return getHourlyRate(
    sueldoOrdinario,
    String(hourType || '').trim().toUpperCase()
  ) * factor * hours;
};

const resolveEmployeeSalary = (log, employeesList = []) => {
  const fromLog = Number(log?.Employee?.sueldo_ordinario);
  if (Number.isFinite(fromLog) && fromLog > 0) return fromLog;
  const employeeId = log?.employeeId ?? log?.Employee?.id;
  const fromContext = employeesList.find((emp) => String(emp.id) === String(employeeId));
  return Number(fromContext?.sueldo_ordinario) || 0;
};

export default function OperationLogs() {
  const { id: batchId } = useParams();
  const navigate = useNavigate();
  const {
    employees, departments, areas, divisions, subdivisions, dimension5s, companies,
    addOperationLog, updateOperationLogStatus, deleteOperationLog, updateOperationLog,
    activePayrolls, injectApprovedLogIntoActiveDrafts, revertLogFromActiveDrafts,
    flushPendingDraftSaves, isLoading
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
  const [expandedSummaryGroups, setExpandedSummaryGroups] = useState([]);

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
    const matchingDraft = findMatchingPayrollDraft(
      activePayrolls,
      date,
      companyId,
      companies
    );
    if (matchingDraft?.isApproved) {
      return `La nómina de ${companyName} para ${quincena} ya fue aprobada por Auditoría y no admite más bonos ni horas extras`;
    }
    return `No hay nómina activa para ${companyName} en ${quincena}`;
  };

  const hasMatchingActivePayroll = (date, companyId) =>
    !!findMatchingActiveDraft(activePayrolls, date, companyId, companies);

  const handleEditSave = async () => {
    if (!editFormData.taskDescription || !editFormData.employeeId || !editFormData.date || !editEmployeeCompanyId) {
      toast.warning('Completa la descripción, empleado y fecha');
      return;
    }
    if (!hasMatchingActivePayroll(editFormData.date, editEmployeeCompanyId)) {
      toast.error(getMissingPayrollMessage(editFormData.date, editEmployeeCompanyId));
      return;
    }
    if (editFormData.type === 'BONO' && !isBonusOperationalDateAllowed(editFormData.date)) {
      toast.error('Los bonos operativos solo se registran en la 2ª quincena (días 16 al fin de mes).');
      return;
    }
    try {
      const updated = await updateOperationLog(editFormData.id, {
        employeeId: Number(editFormData.employeeId),
        date: editFormData.date,
        hoursQty: editFormData.type === 'HORA_EXTRA' ? Number(editFormData.hoursQty) : 0,
        hourType: editFormData.hourType,
        bonusAmount: editFormData.type === 'BONO' ? Number(editFormData.bonusAmount) : 0,
        taskDescription: editFormData.taskDescription
      });
      await fetchBatch();
      if (updated?.notificationWarning) toast.warning(updated.notificationWarning);
      toast.success('Registro corregido exitosamente');
      onEditClose();
    } catch (e) {
      toast.error(e.message || 'Error al guardar');
    }
  };

  const [confirmState, setConfirmState] = useState({ isOpen: false, action: null, data: null, justification: '' });
  const cancelRef = React.useRef();

  const normalizedRole = String(user?.role || '').toUpperCase();
  const isGlobalManager = ['ADMIN', 'GERENTE GENERAL'].includes(normalizedRole);
  const isAutomaticDepartmentBatch = batch?.purpose === 'BONOS_2DA'
    && !batch?.user?.idDepartamento
    && (batch?.logs || []).length > 0
    && (batch?.logs || []).every(log => String(log?.Employee?.departmentId) === String(user?.idDepartamento));
  const canManagerReviewBatch = isGlobalManager || (
    normalizedRole === 'GERENTE'
    && (isAutomaticDepartmentBatch || (
      user?.idDepartamento
      && batch?.user?.idDepartamento
      && String(user.idDepartamento) === String(batch.user.idDepartamento)
    ))
  );
  const canPayrollReview = ['ADMIN', 'NOMINA'].includes(normalizedRole);
  const canReviewBatch = canManagerReviewBatch || canPayrollReview;
  const isNominaRole = ['ADMIN', 'NOMINA'].includes(normalizedRole);
  const isSolicitante = user?.role?.toUpperCase() === 'SOLICITANTE';
  const isBonos2daBatch = batch?.purpose === 'BONOS_2DA';
  const isReadOnly = user?.role === 'AUDITOR';

  const bg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedTextColor = useColorModeValue('gray.600', 'gray.400');
  const theadBg = useColorModeValue('gray.50', 'gray.900');
  const theadTextColor = useColorModeValue('gray.600', 'gray.400');
  const detailBg = useColorModeValue('gray.50', 'whiteAlpha.100');
  const bulkBg = useColorModeValue('blue.50', 'rgba(14, 165, 233, 0.15)');
  const bulkTextColor = useColorModeValue('blue.700', 'blue.200');
  const infoBorderColor = useColorModeValue('blue.200', 'blue.700');
  const cardBorderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const sectionBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const justifyBg = useColorModeValue('orange.50', 'rgba(237, 137, 54, 0.15)');
  const justifyBorder = useColorModeValue('orange.200', 'orange.700');
  const justifyText = useColorModeValue('orange.800', 'orange.200');
  const timelineDot = useColorModeValue('brand.500', 'brand.300');
  const timelineLine = useColorModeValue('gray.200', 'whiteAlpha.300');

  const overtimeCalcInfo = (
    <Box
      w="full"
      p={3}
      borderRadius="md"
      bg={bulkBg}
      borderWidth="1px"
      borderColor={infoBorderColor}
    >
      <Text fontSize="xs" fontWeight="bold" color={bulkTextColor} mb={1}>
        Cómo se calcula (solo informativo)
      </Text>
      <Text fontSize="xs" color={bulkTextColor} lineHeight="tall">
        Hora simple = Sueldo ordinario ÷ 30 ÷ 8
      </Text>
      <Text fontSize="xs" color={bulkTextColor} lineHeight="tall">
        • Simples: horas × valor hora × 1.5
      </Text>
      <Text fontSize="xs" color={bulkTextColor} lineHeight="tall">
        • Nocturnas: sueldo ÷ 30 ÷ 6 × 1.5 × horas
      </Text>
      <Text fontSize="xs" color={bulkTextColor} mt={1} opacity={0.85}>
        El monto se aplica al liquidar la nómina según el sueldo del empleado.
      </Text>
    </Box>
  );

  const availableEmployees = useMemo(() => {
    let filtered = employees;

    if (String(user?.role || '').toUpperCase() === 'SOLICITANTE'
      && user?.idDepartamento !== undefined
      && user?.idDepartamento !== null
      && user.idDepartamento !== '') {
      filtered = employees.filter(
        emp => String(emp.departmentId) === String(user.idDepartamento)
      );
    }

    return filtered
      .filter(emp => emp.estado && emp.estado.toUpperCase() === 'ACTIVO')
      .sort((a, b) => {
        const nameA = [a.primer_nombre, a.segundo_nombre, a.otro_nombre, a.primer_apellido, a.segundo_apellido].filter(Boolean).join(' ').trim();
        const nameB = [b.primer_nombre, b.segundo_nombre, b.otro_nombre, b.primer_apellido, b.segundo_apellido].filter(Boolean).join(' ').trim();
        return nameA.localeCompare(nameB);
      });
  }, [employees, user]);

  const [modalAreaFilter, setModalAreaFilter] = useState([]);
  const [modalFilterArea, setModalFilterArea] = useState([]);
  const [modalFilterDiv, setModalFilterDiv] = useState([]);
  const [modalFilterSubdiv, setModalFilterSubdiv] = useState([]);
  const [modalFilterDim5, setModalFilterDim5] = useState([]);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    employeeIds: [],
    date: new Date().toISOString().slice(0, 10),
    type: 'HORA_EXTRA',
    hoursQty: 0,
    hourType: 'SIMPLE',
    bonusQty: 1,
    bonusAmount: 0,
    taskDescription: ''
  });

  // Los lotes automáticos pertenecen a una quincena concreta. El filtro no
  // debe depender del mes actual del navegador, porque puede ocultar un
  // registro recién creado para un lote del mes siguiente.
  useEffect(() => {
    const batchMonth = getAutomaticBatchMonth(batch);
    if (!batchMonth) return;
    setFilterMonth(batchMonth);
    setFormData((previous) => ({
      ...previous,
      date: getDateInMonth(batchMonth) || previous.date
    }));
  }, [batch?.id]);

  const selectedEmployeeCompanyId = (() => {
    const selectedIds = new Set(formData.employeeIds.map(String));
    const companyIds = new Set(
      availableEmployees
        .filter(employee => selectedIds.has(String(employee.id)))
        .map(getEmployeePrincipalCompanyId)
        .filter(Boolean)
    );
    return companyIds.size === 1 ? [...companyIds][0] : '';
  })();

  const editEmployeeCompanyId = (() => {
    if (!editFormData?.employeeId) return '';
    return getEmployeePrincipalCompanyId(
      employees.find(employee => String(employee.id) === String(editFormData.employeeId))
    );
  })();

  const filteredModalEmployees = useMemo(() => {
    const normalize = (str) => {
      if (!str) return '';
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    let result = availableEmployees;

    if (isBonos2daBatch && batch?.companyId) {
      result = result.filter(
        employee => getEmployeePrincipalCompanyId(employee) === String(batch.companyId)
      );
    }


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
      result = result.filter(emp => modalFilterDim5.some(id => getEmployeeDimension5Value(emp) === id));
    }

    if (modalSearchQuery.trim()) {
      const query = normalize(modalSearchQuery);
      result = result.filter(emp => {
        const fullName = [emp.primer_nombre, emp.segundo_nombre, emp.otro_nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ');
        return normalize(fullName).includes(query);
      });
    }

    return result;
  }, [availableEmployees, batch, isBonos2daBatch, modalAreaFilter, modalFilterArea, modalFilterDiv, modalFilterSubdiv, modalFilterDim5, modalSearchQuery]);

  const filteredEditModalEmployees = useMemo(() => {
    const normalize = (str) => {
      if (!str) return '';
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    let result = availableEmployees;

    if (isBonos2daBatch && batch?.companyId) {
      result = result.filter(
        employee => getEmployeePrincipalCompanyId(employee) === String(batch.companyId)
      );
    }


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
      result = result.filter(emp => editModalFilterDim5.some(id => getEmployeeDimension5Value(emp) === id));
    }

    if (editModalSearchQuery.trim()) {
      const query = normalize(editModalSearchQuery);
      result = result.filter(emp => {
        const fullName = [emp.primer_nombre, emp.segundo_nombre, emp.otro_nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ');
        return normalize(fullName).includes(query);
      });
    }

    return result;
  }, [availableEmployees, batch, isBonos2daBatch, editModalAreaFilter, editModalFilterArea, editModalFilterDiv, editModalFilterSubdiv, editModalFilterDim5, editModalSearchQuery]);

  const handleSelectAllEmployees = () => {
    if (!selectedEmployeeCompanyId) {
      toast.warning('Selecciona primero un empleado para definir su empresa principal.');
      return;
    }
    const eligibleEmployees = filteredModalEmployees.filter(
      employee => getEmployeePrincipalCompanyId(employee) === selectedEmployeeCompanyId
    );
    const eligibleIds = eligibleEmployees.map(employee => employee.id.toString());
    const allSelected = eligibleIds.length > 0 && eligibleIds.every(
      id => formData.employeeIds.map(String).includes(id)
    );
    setFormData(previous => ({
      ...previous,
      employeeIds: allSelected ? [] : eligibleIds
    }));
  };

  const handleEmployeeSelection = (values) => {
    const selectedIds = new Set(values.map(String));
    const companyIds = new Set(
      availableEmployees
        .filter(employee => selectedIds.has(String(employee.id)))
        .map(getEmployeePrincipalCompanyId)
        .filter(Boolean)
    );
    if (companyIds.size > 1) {
      toast.warning('Solo puedes registrar empleados de una misma empresa principal a la vez.');
      return;
    }
    setFormData(previous => ({ ...previous, employeeIds: values }));
  };

  const handleEditEmployeeChange = (employeeId) => {
    setEditFormData(previous => ({
      ...previous,
      employeeId
    }));
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
    if (formData.employeeIds.length === 0 || !formData.date || !formData.taskDescription || !selectedEmployeeCompanyId) {
      toast.warning('Selecciona al menos un empleado y completa los campos requeridos');
      return;
    }
    if (!hasMatchingActivePayroll(formData.date, selectedEmployeeCompanyId)) {
      toast.error(getMissingPayrollMessage(formData.date, selectedEmployeeCompanyId));
      return;
    }
    if (formData.type === 'BONO' && !isBonusOperationalDateAllowed(formData.date)) {
      toast.error('Los bonos operativos solo se registran en la 2ª quincena (días 16 al fin de mes).');
      return;
    }
    setConfirmState({ isOpen: true, action: 'SAVE', data: null, justification: '' });
  };

  const handleApprove = (id) => setConfirmState({ isOpen: true, action: 'APPROVE', data: id, justification: '' });
  const handleReject = (id) => setConfirmState({ isOpen: true, action: 'REJECT', data: id, justification: '' });
  const handlePayrollReject = (id) => setConfirmState({ isOpen: true, action: 'PAYROLL_REJECT', data: id, justification: '' });
  const handleDelete = (id) => setConfirmState({ isOpen: true, action: 'DELETE', data: id, justification: '' });

  const handleBulkApprove = () => setConfirmState({ isOpen: true, action: 'BULK_APPROVE', data: null, justification: '' });
  const handleBulkReject = () => setConfirmState({ isOpen: true, action: 'BULK_REJECT', data: null, justification: '' });
  const handleBulkPayrollReject = () => setConfirmState({ isOpen: true, action: 'BULK_PAYROLL_REJECT', data: null, justification: '' });

  const executeConfirm = async () => {
    const { action, data, justification } = confirmState;
    setConfirmState({ isOpen: false, action: null, data: null, justification: '' });

    try {
      if (action === 'SAVE') {
        const promises = formData.employeeIds.map(empId => {
          const payload = {
            ...formData,
            employeeId: Number(empId),
            hoursQty: formData.type === 'HORA_EXTRA' ? Number(formData.hoursQty) : 0,
            bonusQty: formData.type === 'BONO' ? Number(formData.bonusQty) : 0,
            bonusAmount: formData.type === 'BONO' ? Number(formData.bonusAmount) : 0,
            batchId: Number(batchId)
          };
          delete payload.employeeIds;
          return addOperationLog(payload);
        });
        const createdLogs = await Promise.all(promises);
        
        await fetchBatch();
        
        onClose();
        setFormData(prev => ({ ...prev, employeeIds: [] }));
        setModalAreaFilter([]);
        const warning = createdLogs.find((log) => log?.notificationWarning)?.notificationWarning;
        if (warning) toast.warning(warning);
        toast.success(`Se agregaron ${formData.employeeIds.length} registros al lote`);
      } else if (action === 'APPROVE') {
        const log = operationLogs.find((l) => String(l.id) === String(data));
        const updated = await updateOperationLogStatus(data, 'APPROVED_MANAGER', null, null, false, log);
        await fetchBatch();
        if (updated?.notificationWarning) toast.warning(updated.notificationWarning);
        toast.success('Solicitud aprobada');
      } else if (action === 'REJECT') {
        const log = operationLogs.find((l) => String(l.id) === String(data));
        await updateOperationLogStatus(data, 'RETURNED', null, justification, false, log);
        await fetchBatch();
        toast.success('Solicitud devuelta al solicitante');
      } else if (action === 'PAYROLL_REJECT') {
        const log = operationLogs.find((l) => String(l.id) === String(data));
        const updated = await updateOperationLogStatus(data, 'RETURNED', null, justification, true, log);
        await fetchBatch();
        if (updated?.notificationWarning) toast.warning(updated.notificationWarning);
        toast.success('Registro devuelto a Operaciones');
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
      } else if (action === 'BULK_PAYROLL_REJECT') {
        const promises = selectedRowIds.map((id) => {
          const log = operationLogs.find((l) => String(l.id) === String(id));
          return updateOperationLogStatus(id, 'RETURNED', null, justification, true, log);
        });
        const updatedLogs = await Promise.all(promises);
        await fetchBatch();
        setSelectedRowIds([]);
        const warning = updatedLogs.find((updated) => updated?.notificationWarning)?.notificationWarning;
        if (warning) toast.warning(warning);
        toast.success(`${selectedRowIds.length} registros devueltos a Operaciones`);
      } else if (action === 'DELETE') {
        await deleteOperationLog(data);
        await fetchBatch();
        toast.success('Registro eliminado');
      }
    } catch (e) {
      toast.error(e.message || 'Hubo un error al procesar la acción');
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'DRAFT': return 'Borrador';
      case 'PENDING_MANAGER': return 'Pdte. Gerente';
      case 'APPROVED_MANAGER': return 'Aprobado Gerencia';
      case 'RETURNED': return 'En corrección';
      case 'PROCESSED_PAYROLL': return 'En Nómina';
      default: return status || '';
    }
  };

  const getReviewActionLabel = (action) => {
    switch (action) {
      case 'CREATED': return 'Creado';
      case 'SUBMITTED_MANAGER': return 'Enviado a gerente';
      case 'MANAGER_APPROVED': return 'Aprobado por gerente';
      case 'MANAGER_RETURNED': return 'Devuelto por gerente';
      case 'PAYROLL_RETURNED': return 'Devuelto por nómina';
      case 'CORRECTED_RESUBMITTED': return 'Corregido y reenviado';
      default: return action || '';
    }
  };

  const formatReviewTransition = (review) => {
    if (review.fromStatus || review.toStatus) {
      const from = review.fromStatus ? getStatusLabel(review.fromStatus) : null;
      const to = getStatusLabel(review.toStatus);
      return from ? `${from} → ${to}` : to;
    }
    return getReviewActionLabel(review.action);
  };

  const getStatusBadge = (status) => {
    const badgeProps = { variant: "subtle", borderRadius: "full", px: 2.5, py: 0.5, textTransform: "capitalize", fontWeight: "medium", fontSize: "xs" };
    switch(status) {
      case 'DRAFT': return <Badge colorScheme="gray" {...badgeProps}>{getStatusLabel(status)}</Badge>;
      case 'PENDING_MANAGER': return <Badge colorScheme="yellow" {...badgeProps}>{getStatusLabel(status)}</Badge>;
      case 'APPROVED_MANAGER': return <Badge colorScheme="blue" {...badgeProps}>{getStatusLabel(status)}</Badge>;
      case 'RETURNED': return <Badge colorScheme="orange" {...badgeProps}>{getStatusLabel(status)}</Badge>;
      case 'PROCESSED_PAYROLL': return <Badge colorScheme="green" {...badgeProps}>{getStatusLabel(status)}</Badge>;
      default: return <Badge {...badgeProps}>{getStatusLabel(status)}</Badge>;
    }
  };

  const DetailField = ({ label, children, colSpan }) => (
    <GridItem colSpan={colSpan}>
      <Box
        p={3}
        h="100%"
        bg={sectionBg}
        borderWidth="1px"
        borderColor={cardBorderColor}
        borderRadius="lg"
      >
        <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold" letterSpacing="wide" mb={1.5}>
          {label}
        </Text>
        <Box fontSize="sm" fontWeight="medium" lineHeight="short">
          {children}
        </Box>
      </Box>
    </GridItem>
  );

  const reviewableVisibleLogs = useMemo(
    () => filteredLogs.filter((log) => (
      (canManagerReviewBatch && log.status === 'PENDING_MANAGER')
      || (canPayrollReview && log.status === 'APPROVED_MANAGER')
    )),
    [filteredLogs, canManagerReviewBatch, canPayrollReview]
  );

  const payrollSummary = useMemo(() => {
    const groups = new Map();
    filteredLogs.forEach((log) => {
      const employeeId = log.employeeId ?? log.Employee?.id ?? 'sin-empleado';
      const companyId = log.companyId ?? log.companyData?.id ?? 'sin-empresa';
      const month = String(log.date || '').slice(0, 7) || 'sin-mes';
      const day = Number(String(log.date || '').slice(8, 10));
      const period = Number.isFinite(day) && day <= 15 ? '1ra' : '2da';
      const key = `${employeeId}|${companyId}|${month}|${period}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          employeeName: log.Employee
            ? [
                log.Employee.primer_nombre,
                log.Employee.segundo_nombre,
                log.Employee.otro_nombre,
                log.Employee.primer_apellido,
                log.Employee.segundo_apellido
              ].filter(Boolean).join(' ')
            : 'Desconocido',
          companyName: log.companyData?.nombre_comercial || 'Sin empresa',
          periodLabel: formatQuincenaLabel(log.date),
          bonusCount: 0,
          bonusTotal: 0,
          simpleQty: 0,
          simpleValue: 0,
          nocturnalQty: 0,
          nocturnalValue: 0,
          correctionCount: 0,
          records: []
        });
      }
      const group = groups.get(key);
      group.records.push(log);
      const hasPayrollReturn = (log.reviews || []).some(
        (review) => review.action === 'PAYROLL_RETURNED'
      );
      if (
        log.status === 'RETURNED'
        || (hasPayrollReturn && !['APPROVED_MANAGER', 'PROCESSED_PAYROLL'].includes(log.status))
      ) {
        group.correctionCount += 1;
      }

      if (!['APPROVED_MANAGER', 'PROCESSED_PAYROLL'].includes(log.status)) return;
      if (log.type === 'BONO') {
        group.bonusCount += Number(log.bonusQty) || 1;
        group.bonusTotal += Number(log.bonusAmount) || 0;
        return;
      }
      const salary = resolveEmployeeSalary(log, employees);
      const amount = calcOvertimeAmount(salary, log.hoursQty, log.hourType);
      if (log.hourType === 'SIMPLE') {
        group.simpleQty += Number(log.hoursQty) || 0;
        group.simpleValue += amount;
      } else if (log.hourType === 'NOCTURNA') {
        group.nocturnalQty += Number(log.hoursQty) || 0;
        group.nocturnalValue += amount;
      }
    });
    return [...groups.values()]
      .map((group) => ({
        ...group,
        variableTotal: group.bonusTotal + group.simpleValue + group.nocturnalValue
      }))
      .sort((left, right) => (
        left.employeeName.localeCompare(right.employeeName, 'es')
        || left.periodLabel.localeCompare(right.periodLabel, 'es')
      ));
  }, [filteredLogs, employees]);

  const selectedLogs = useMemo(
    () => operationLogs.filter((log) => selectedRowIds.includes(log.id)),
    [operationLogs, selectedRowIds]
  );
  const selectedArePayrollApproved = selectedLogs.length > 0
    && selectedLogs.every((log) => log.status === 'APPROVED_MANAGER');
  const selectedAreManagerPending = selectedLogs.length > 0
    && selectedLogs.every((log) => log.status === 'PENDING_MANAGER');

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
    if (selectedRowIds.length === reviewableVisibleLogs.length && reviewableVisibleLogs.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(reviewableVisibleLogs.map(l => l.id));
    }
  };

  const toggleRowSelection = (id) => {
    if (selectedRowIds.includes(id)) {
      setSelectedRowIds(prev => prev.filter(rowId => rowId !== id));
    } else {
      setSelectedRowIds(prev => [...prev, id]);
    }
  };

  const toggleSummaryGroup = (key) => {
    setExpandedSummaryGroups((previous) => (
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key]
    ));
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
      await flushPendingDraftSaves();
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
      await flushPendingDraftSaves();
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
      await flushPendingDraftSaves();
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

  const automaticBatchMonth = getAutomaticBatchMonth(batch);
  const automaticBatchDate = automaticBatchMonth ? `${automaticBatchMonth}-16` : '';
  const editableBatchPayroll = isBonos2daBatch && batch.companyId && automaticBatchDate
    ? findMatchingActiveDraft(
      activePayrolls,
      automaticBatchDate,
      batch.companyId,
      companies
    )
    : null;
  const approvedBatchPayroll = !editableBatchPayroll
    && isBonos2daBatch
    && batch.companyId
    && automaticBatchDate
    ? findMatchingPayrollDraft(
      activePayrolls,
      automaticBatchDate,
      batch.companyId,
      companies
    )
    : null;
  const canAddRecords = ['ADMIN', 'SOLICITANTE'].includes(normalizedRole)
    && (batch.status === 'DRAFT' || isBonos2daBatch)
    && !approvedBatchPayroll?.isApproved;

  const bonusDateBlocked = formData.type === 'BONO' && formData.date && !isBonusOperationalDateAllowed(formData.date);
  const editBonusDateBlocked = editFormData?.type === 'BONO'
    && editFormData?.date
    && !isBonusOperationalDateAllowed(editFormData.date);
  const saveBlockedByPayroll = formData.date && selectedEmployeeCompanyId && !hasMatchingActivePayroll(formData.date, selectedEmployeeCompanyId);
  const saveBlocked = saveBlockedByPayroll || bonusDateBlocked;


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
              {isBonos2daBatch && (
                <Badge colorScheme="purple">Operaciones 2ª</Badge>
              )}
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

          {canAddRecords && (
            <>
              <Button 
                colorScheme="brand" 
                leftIcon={<Plus size={16} />} 
                onClick={() => {
                  const defaultType = 'HORA_EXTRA';
                  const today = new Date();
                  let defaultDate = today.toISOString().slice(0, 10);
                  setFormData({
                    employeeIds: [],
                    date: defaultDate,
                    type: defaultType,
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
              {batch.status === 'DRAFT' && !isBonos2daBatch && (
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
              )}
            </>
          )}
          {canAddRecords && !isBonos2daBatch && (!operationLogs || operationLogs.length === 0) && (
            <Text fontSize="sm" color="orange.400" alignSelf="center">
              Agrega al menos un registro para poder enviar el lote
            </Text>
          )}
          {approvedBatchPayroll?.isApproved && (
            <Text fontSize="sm" color="green.400" alignSelf="center">
              Captura cerrada: Auditoría ya aprobó esta nómina
            </Text>
          )}

          {canManagerReviewBatch && batch.status === 'PENDING_MANAGER' && (
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

        </Flex>
      </Flex>

      {isNominaRole && (
        <Tabs index={tabIndex} onChange={setTabIndex} colorScheme="brand" mb={4}>
          <TabList>
            <Tab>Resumen por persona</Tab>
            <Tab>Detalle de registros</Tab>
          </TabList>
        </Tabs>
      )}

      {isNominaRole && tabIndex === 0 && (
        <Box>
          <HStack mb={4} spacing={4} bg={bg} p={4} borderRadius="lg" shadow="sm">
            <FormControl w="220px">
              <FormLabel fontSize="xs" color={mutedTextColor}>Mes de la nómina</FormLabel>
              <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} size="sm" />
            </FormControl>
          </HStack>
          {selectedArePayrollApproved && (
            <HStack mb={4} p={3} bg={bulkBg} borderRadius="md" justify="space-between">
              <Text fontSize="sm" fontWeight="bold" color={bulkTextColor}>
                {selectedRowIds.length} registros aprobados seleccionados
              </Text>
              <Button size="sm" colorScheme="red" onClick={handleBulkPayrollReject}>
                Rechazar y devolver a Operaciones
              </Button>
            </HStack>
          )}
          <Box bg={bg} borderRadius="lg" overflowX="auto" shadow="sm">
            <Table variant="simple" size="sm">
              <Thead bg={theadBg}>
                <Tr>
                  <Th>Empleado / período</Th>
                  <Th>Empresa</Th>
                  <Th isNumeric>Bonos</Th>
                  <Th isNumeric>Total bonos</Th>
                  <Th isNumeric>Hrs simples</Th>
                  <Th isNumeric>Valor simples</Th>
                  <Th isNumeric>Hrs nocturnas</Th>
                  <Th isNumeric>Valor nocturnas</Th>
                  <Th isNumeric>Total variable</Th>
                  <Th>Correcciones</Th>
                  <Th>Detalle</Th>
                </Tr>
              </Thead>
              <Tbody>
                {payrollSummary.map((group) => (
                  <React.Fragment key={group.key}>
                    <Tr>
                      <Td>
                        <Text fontWeight="semibold">{group.employeeName}</Text>
                        <Text fontSize="xs" color={mutedTextColor}>{group.periodLabel}</Text>
                      </Td>
                      <Td>{group.companyName}</Td>
                      <Td isNumeric>{group.bonusCount}</Td>
                      <Td isNumeric>{formatMoneyQ(group.bonusTotal)}</Td>
                      <Td isNumeric>{group.simpleQty}</Td>
                      <Td isNumeric>{formatMoneyQ(group.simpleValue)}</Td>
                      <Td isNumeric>{group.nocturnalQty}</Td>
                      <Td isNumeric>{formatMoneyQ(group.nocturnalValue)}</Td>
                      <Td isNumeric fontWeight="bold">{formatMoneyQ(group.variableTotal)}</Td>
                      <Td>
                        {group.correctionCount > 0
                          ? <Badge colorScheme="orange">{group.correctionCount} en corrección</Badge>
                          : <Badge colorScheme="green">Sin correcciones</Badge>}
                      </Td>
                      <Td>
                        <Button
                          size="xs"
                          variant="ghost"
                          rightIcon={<ChevronDown size={14} />}
                          onClick={() => toggleSummaryGroup(group.key)}
                        >
                          {expandedSummaryGroups.includes(group.key) ? 'Ocultar' : `Ver ${group.records.length}`}
                        </Button>
                      </Td>
                    </Tr>
                    {expandedSummaryGroups.includes(group.key) && (
                      <Tr>
                        <Td colSpan={11} bg={detailBg} p={3}>
                          <Table size="sm" variant="simple">
                            <Thead>
                              <Tr>
                                <Th w="40px"></Th>
                                <Th>Fecha</Th>
                                <Th>Concepto</Th>
                                <Th>Detalle</Th>
                                <Th>Estado</Th>
                                <Th>Comentario</Th>
                                <Th>Acción</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {group.records.map((log) => {
                                const salary = resolveEmployeeSalary(log, employees);
                                const amount = log.type === 'BONO'
                                  ? Number(log.bonusAmount) || 0
                                  : calcOvertimeAmount(salary, log.hoursQty, log.hourType);
                                return (
                                  <Tr key={log.id}>
                                    <Td>
                                      {log.status === 'APPROVED_MANAGER' && (
                                        <Checkbox
                                          colorScheme="brand"
                                          isChecked={selectedRowIds.includes(log.id)}
                                          onChange={() => toggleRowSelection(log.id)}
                                        />
                                      )}
                                    </Td>
                                    <Td>{log.date}</Td>
                                    <Td>{log.type === 'BONO' ? 'Bono' : `Horas ${String(log.hourType || '').toLowerCase()}`}</Td>
                                    <Td>
                                      {log.type === 'BONO'
                                        ? formatMoneyQ(amount)
                                        : `${log.hoursQty} hrs · ${formatMoneyQ(amount)}`}
                                    </Td>
                                    <Td>{getStatusBadge(log.status)}</Td>
                                    <Td maxW="260px">{log.justification || '—'}</Td>
                                    <Td>
                                      <HStack spacing={1}>
                                        <IconButton
                                          aria-label="Ver detalles"
                                          icon={<Eye size={15} />}
                                          size="xs"
                                          variant="ghost"
                                          onClick={() => { setSelectedLog(log); onDetailsOpen(); }}
                                        />
                                        {log.status === 'APPROVED_MANAGER' && (
                                          <IconButton
                                            aria-label="Rechazar a Operaciones"
                                            icon={<X size={15} />}
                                            size="xs"
                                            colorScheme="red"
                                            variant="ghost"
                                            onClick={() => handlePayrollReject(log.id)}
                                          />
                                        )}
                                      </HStack>
                                    </Td>
                                  </Tr>
                                );
                              })}
                            </Tbody>
                          </Table>
                        </Td>
                      </Tr>
                    )}
                  </React.Fragment>
                ))}
                {payrollSummary.length === 0 && (
                  <Tr>
                    <Td colSpan={11} textAlign="center" py={8} color={mutedTextColor}>
                      No hay registros visibles para el período seleccionado.
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </Box>
        </Box>
      )}

      {(!isNominaRole || tabIndex === 1) && (
      <>
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
            <option value="APPROVED_MANAGER">Aprobado por Gerencia</option>
            <option value="RETURNED">En corrección</option>
            <option value="PROCESSED_PAYROLL">En Nómina</option>
          </Select>
        </FormControl>

      </HStack>

      {selectedRowIds.length > 0 && canReviewBatch && (
        <HStack mb={4} p={3} bg={bulkBg} borderRadius="md" shadow="sm" justify="space-between">
          <Text fontSize="sm" fontWeight="bold" color={bulkTextColor}>
            {selectedRowIds.length} solicitudes seleccionadas
          </Text>
          <HStack>
            {selectedAreManagerPending && canManagerReviewBatch && (
              <>
                <Button size="sm" colorScheme="orange" onClick={handleBulkReject}>Devolver seleccionados</Button>
                <Button size="sm" colorScheme="blue" onClick={handleBulkApprove}>Aprobar seleccionados</Button>
              </>
            )}
            {selectedArePayrollApproved && canPayrollReview && (
              <Button size="sm" colorScheme="red" onClick={handleBulkPayrollReject}>
                Rechazar y devolver a Operaciones
              </Button>
            )}
          </HStack>
        </HStack>
      )}

      <Box bg={bg} borderRadius="lg" overflow="hidden" overflowX="auto" shadow="sm">
        <Table variant="simple" size="sm">
          <Thead bg={theadBg}>
            <Tr>
              {canReviewBatch && (
                <Th w="40px">
                  <Checkbox 
                    colorScheme="brand" 
                    isChecked={selectedRowIds.length === reviewableVisibleLogs.length && reviewableVisibleLogs.length > 0}
                    isIndeterminate={selectedRowIds.length > 0 && selectedRowIds.length < reviewableVisibleLogs.length}
                    onChange={handleSelectAllRows}
                    isDisabled={reviewableVisibleLogs.length === 0}
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
                {canReviewBatch && (
                  <Td>
                    {(
                      (canManagerReviewBatch && log.status === 'PENDING_MANAGER')
                      || (canPayrollReview && log.status === 'APPROVED_MANAGER')
                    ) ? (
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
                  {log.type === 'HORA_EXTRA' ? (
                    (() => {
                      const salary = resolveEmployeeSalary(log, employees);
                      const amount = calcOvertimeAmount(salary, log.hoursQty, log.hourType);
                      return (
                        <Box>
                          <Text>{log.hoursQty} hrs ({log.hourType})</Text>
                          {salary > 0 ? (
                            <Text fontSize="xs" fontWeight="semibold" color="brand.500">
                              {formatMoneyQ(amount)}
                            </Text>
                          ) : null}
                        </Box>
                      );
                    })()
                  ) : (
                    `Q${log.bonusAmount}`
                  )}
                </Td>
                <Td maxW="200px" isTruncated>{log.taskDescription}</Td>
                <Td>{getStatusBadge(log.status)}</Td>

                <Td>
                  <HStack spacing={2}>
                    <Tooltip label="Ver Detalles" hasArrow>
                      <IconButton aria-label="Ver Detalles" size={{ base: 'xs', md: 'sm' }} icon={<Eye size={16} />} variant="ghost" colorScheme="teal" onClick={() => { setSelectedLog(log); onDetailsOpen(); }} transition="all 0.3s" />
                    </Tooltip>
                    {!isReadOnly
                      && log.status === 'RETURNED'
                      && (
                        normalizedRole === 'ADMIN'
                        || (
                          normalizedRole === 'SOLICITANTE'
                          && Number(log.requesterId) === Number(user?.id)
                        )
                      ) && (
                      <Tooltip label="Editar y Reenviar" hasArrow>
                        <IconButton aria-label="Editar" size={{ base: 'xs', md: 'sm' }} icon={<Edit2 size={16} />} variant="ghost" colorScheme="blue" onClick={() => openEdit(log)} transition="all 0.3s" />
                      </Tooltip>
                    )}
                    {canManagerReviewBatch && log.status === 'PENDING_MANAGER' && (
                      <>
                        <Tooltip label="Aprobar" hasArrow>
                          <IconButton aria-label="Aprobar" size={{ base: 'xs', md: 'sm' }} icon={<Check size={16} />} variant="ghost" colorScheme="blue" onClick={() => handleApprove(log.id)} transition="all 0.3s" />
                        </Tooltip>
                        <Tooltip label="Devolver a Solicitante" hasArrow>
                          <IconButton aria-label="Devolver" size={{ base: 'xs', md: 'sm' }} icon={<X size={16} />} variant="ghost" colorScheme="orange" onClick={() => handleReject(log.id)} transition="all 0.3s" />
                        </Tooltip>
                      </>
                    )}
                    {canPayrollReview && log.status === 'APPROVED_MANAGER' && (
                      <Tooltip label="Rechazar y devolver a Operaciones" hasArrow>
                        <IconButton aria-label="Rechazar a Operaciones" size={{ base: 'xs', md: 'sm' }} icon={<X size={16} />} variant="ghost" colorScheme="red" onClick={() => handlePayrollReject(log.id)} transition="all 0.3s" />
                      </Tooltip>
                    )}
                    {!isReadOnly
                      && (
                        normalizedRole === 'ADMIN'
                        || (canAddRecords && log.status === 'PENDING_MANAGER')
                      ) && (
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
      </>
      )}

      {/* Modal Agregar Registro */}
      <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered scrollBehavior="inside">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={bg} color={textColor} maxH="90vh">
          <ModalHeader py={3}>Nuevo Registro de Operación</ModalHeader>
          <ModalBody pb={2}>
            <VStack spacing={3} align="stretch">
              <FormControl isRequired>
                <FormLabel fontSize="sm" mb={1}>Empleados</FormLabel>
                <Flex mb={2} gap={2} wrap="wrap" align="center" justify="space-between">
                    <Flex gap={2} wrap="wrap" flex="1">
                      {isSolicitante && user?.idDepartamento ? (
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
                    
                    <Button size="sm" flexShrink={0} variant="outline" colorScheme="brand" borderRadius="md" onClick={handleSelectAllEmployees} isDisabled={!selectedEmployeeCompanyId}>
                      {formData.employeeIds.length > 0 ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                    </Button>
                  </Flex>
                <Input 
                  size="sm" 
                  placeholder="Buscar empleado por nombre..." 
                  value={modalSearchQuery} 
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  mb={2}
                />
                <Box maxH="160px" overflowY="auto" borderWidth="1px" borderRadius="md" p={2}>
                  <CheckboxGroup colorScheme="brand" value={formData.employeeIds} onChange={handleEmployeeSelection}>
                    <VStack align="start" spacing={1}>
                      {(() => {
                        const groups = {};
                        filteredModalEmployees.forEach(emp => {
                          let groupName = 'Sin Departamento';
                          if (modalFilterDim5.length > 0) {
                            const dim = dimension5s?.find(d => String(d.id) === getEmployeeDimension5Value(emp));
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
                            <Text fontSize="xs" fontWeight="bold" color="brand.400" textTransform="uppercase" mt={1} mb={1} borderBottomWidth="1px" borderColor="gray.600" pb={1}>
                              {groupName}
                            </Text>
                            {groups[groupName].map(emp => (
                              <Checkbox
                                key={emp.id}
                                value={emp.id.toString()}
                                w="100%"
                                py={0.5}
                                isDisabled={!!selectedEmployeeCompanyId && getEmployeePrincipalCompanyId(emp) !== selectedEmployeeCompanyId}
                              >
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

              {formData.date && selectedEmployeeCompanyId && !hasMatchingActivePayroll(formData.date, selectedEmployeeCompanyId) && (
                <Box w="100%" p={2} borderRadius="md" bg="orange.50" borderWidth="1px" borderColor="orange.200">
                  <Text fontSize="sm" color="orange.700">
                    {getMissingPayrollMessage(formData.date, selectedEmployeeCompanyId)}. No se puede guardar hasta que exista una nómina abierta para esa empresa y quincena.
                  </Text>
                </Box>
              )}

              {bonusDateBlocked && (
                <Box w="100%" p={2} borderRadius="md" bg="orange.50" borderWidth="1px" borderColor="orange.200">
                  <Text fontSize="sm" color="orange.700">
                    Los bonos operativos solo se registran en la 2ª quincena (días 16 al fin de mes).
                  </Text>
                </Box>
              )}

              <HStack w="full" spacing={3} align="start">
                <FormControl isRequired flex={1}>
                  <FormLabel fontSize="sm" mb={1}>Empresa principal</FormLabel>
                  <Input
                    size="sm"
                    isReadOnly
                    cursor="not-allowed"
                    value={companies.find(c => String(c.id) === selectedEmployeeCompanyId)?.nombre_comercial || 'Se determina al seleccionar empleados'}
                  />
                </FormControl>
                <FormControl isRequired flex={1}>
                  <FormLabel fontSize="sm" mb={1}>
                    Fecha
                    {formData.date && selectedEmployeeCompanyId && hasMatchingActivePayroll(formData.date, selectedEmployeeCompanyId) && (
                      <Text as="span" fontWeight="normal" color={mutedTextColor} ml={2}>
                        ({formatQuincenaLabel(formData.date)})
                      </Text>
                    )}
                  </FormLabel>
                  <Input size="sm" type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </FormControl>
              </HStack>

              <HStack w="full" spacing={3} align="start">
                <FormControl flex={1}>
                  <FormLabel fontSize="sm" mb={1}>Tipo de Registro</FormLabel>
                  <Select
                    size="sm"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="HORA_EXTRA">Horas Extras</option>
                    <option value="BONO">Bono</option>
                  </Select>
                </FormControl>
                {formData.type === 'HORA_EXTRA' ? (
                  <>
                    <FormControl flex={1}>
                      <FormLabel fontSize="sm" mb={1}>Cantidad de Horas</FormLabel>
                      <Input size="sm" type="number" step="0.5" value={formData.hoursQty} onChange={(e) => setFormData({...formData, hoursQty: e.target.value})} />
                    </FormControl>
                    <FormControl flex={1}>
                      <FormLabel fontSize="sm" mb={1}>Tipo de Hora</FormLabel>
                      <Select size="sm" value={formData.hourType} onChange={(e) => setFormData({...formData, hourType: e.target.value})}>
                        <option value="SIMPLE">Simples</option>
                        <option value="NOCTURNA">Nocturnas</option>
                      </Select>
                    </FormControl>
                  </>
                ) : (
                  <>
                    <FormControl flex={1}>
                      <FormLabel fontSize="sm" mb={1}>Concepto Predeterminado</FormLabel>
                      <Select
                        size="sm"
                        placeholder="Seleccionar concepto..."
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
                    <FormControl isRequired flex={1}>
                      <FormLabel fontSize="sm" mb={1}>Monto del Bono (Q)</FormLabel>
                      <Input size="sm" type="number" step="0.01" value={formData.bonusAmount} onChange={(e) => setFormData({...formData, bonusAmount: e.target.value})} />
                    </FormControl>
                  </>
                )}
              </HStack>

              {formData.type === 'HORA_EXTRA' && overtimeCalcInfo}

              <FormControl isRequired>
                <FormLabel fontSize="sm" mb={1}>Tarea Realizada (Descripción)</FormLabel>
                <Input size="sm" value={formData.taskDescription} onChange={(e) => setFormData({...formData, taskDescription: e.target.value})} placeholder="Ej. Empaque de 4 fardos..." />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter py={3}>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
            <Button
              colorScheme="brand"
              onClick={handleSave}
              isDisabled={saveBlocked}
            >
              Guardar Registro
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Detalles */}
      <Modal isOpen={isDetailsOpen} onClose={onDetailsClose} size="4xl" isCentered scrollBehavior="inside">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={bg} color={textColor} maxH="90vh" mx={4} w="100%">
          <ModalHeader pb={2} borderBottomWidth="1px" borderColor={cardBorderColor}>
            Detalles de la Solicitud
          </ModalHeader>
          <ModalBody py={5}>
            {selectedLog && (
              <Grid
                templateColumns={{ base: '1fr', lg: '1.35fr 1fr' }}
                gap={{ base: 5, lg: 6 }}
                alignItems="start"
              >
                <GridItem>
                  <VStack spacing={4} align="stretch">
                    <Box>
                      <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold" letterSpacing="wide" mb={3}>
                        Información general
                      </Text>
                      <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={3}>
                        <DetailField label="Empleado" colSpan={{ base: 2, md: 1 }}>
                          {selectedLog.Employee
                            ? [selectedLog.Employee.primer_nombre, selectedLog.Employee.segundo_nombre, selectedLog.Employee.otro_nombre, selectedLog.Employee.primer_apellido, selectedLog.Employee.segundo_apellido].filter(Boolean).join(' ')
                            : 'Desconocido'}
                        </DetailField>
                        <DetailField label="Área">
                          {selectedLog.Employee && areas?.find(a => String(a.id) === String(selectedLog.Employee.areaId))?.nombre || 'No asignada'}
                        </DetailField>
                        <DetailField label="Empresa">
                          {selectedLog.companyData ? selectedLog.companyData.nombre_comercial : 'S/E'}
                        </DetailField>
                        <DetailField label="Fecha">{selectedLog.date}</DetailField>
                        <DetailField label="Quincena">{formatQuincenaLabel(selectedLog.date)}</DetailField>
                        <DetailField label="Tipo">
                          {selectedLog.type === 'HORA_EXTRA' ? 'Horas Extras' : 'Bono'}
                        </DetailField>
                        <DetailField label="Estado">{getStatusBadge(selectedLog.status)}</DetailField>
                        <DetailField label="Ingresado por">
                          {selectedLog.requester?.name || 'No disponible'}
                        </DetailField>
                        {selectedLog.type === 'HORA_EXTRA' ? (
                          <>
                            <DetailField label="Cantidad de Horas">{selectedLog.hoursQty}</DetailField>
                            <DetailField label="Tipo de Hora">
                              {selectedLog.hourType === 'SIMPLE'
                                ? 'Simple (/30/8 × 1.5)'
                                : selectedLog.hourType === 'NOCTURNA'
                                  ? 'Nocturna (/30/6 × 1.5)'
                                  : selectedLog.hourType}
                            </DetailField>
                          </>
                        ) : (
                          <>
                            <DetailField label="Cantidad de Bonos">{selectedLog.bonusQty || 1}</DetailField>
                            <DetailField label="Monto Unitario">
                              Q{parseFloat(selectedLog.bonusAmount).toFixed(2)}
                            </DetailField>
                          </>
                        )}
                      </Grid>
                    </Box>

                    {selectedLog.type === 'HORA_EXTRA' && (() => {
                      const salary = resolveEmployeeSalary(selectedLog, employees);
                      const amount = calcOvertimeAmount(salary, selectedLog.hoursQty, selectedLog.hourType);
                      const rate = getHourlyRate(salary, selectedLog.hourType);
                      const factor = getOvertimeFactor(selectedLog.hourType);
                      return (
                        <Box
                          p={4}
                          borderRadius="lg"
                          bg={bulkBg}
                          borderWidth="1px"
                          borderColor={infoBorderColor}
                        >
                          <Text fontSize="xs" color={bulkTextColor} textTransform="uppercase" fontWeight="bold" letterSpacing="wide">
                            Monto estimado a pagar
                          </Text>
                          <Text fontSize="2xl" fontWeight="bold" color={bulkTextColor} lineHeight="short" mt={1}>
                            {salary > 0 ? formatMoneyQ(amount) : '—'}
                          </Text>
                          {salary > 0 ? (
                            <Text fontSize="xs" color={bulkTextColor} mt={1} opacity={0.9}>
                              Valor hora {formatMoneyQ(rate)} × {factor} × {Number(selectedLog.hoursQty) || 0} hrs
                            </Text>
                          ) : (
                            <Text fontSize="xs" color="orange.500" mt={1}>
                              No se encontró el sueldo ordinario del empleado para calcular el monto.
                            </Text>
                          )}
                        </Box>
                      );
                    })()}

                    <Box
                      p={3}
                      bg={sectionBg}
                      borderWidth="1px"
                      borderColor={cardBorderColor}
                      borderRadius="lg"
                    >
                      <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold" letterSpacing="wide" mb={2}>
                        Tarea / Descripción
                      </Text>
                      <Text fontSize="sm" whiteSpace="pre-wrap">
                        {selectedLog.taskDescription || '—'}
                      </Text>
                    </Box>

                    {selectedLog.justification && (
                      <Box
                        p={3}
                        bg={justifyBg}
                        borderWidth="1px"
                        borderColor={justifyBorder}
                        borderRadius="lg"
                      >
                        <Text fontSize="xs" color="orange.500" textTransform="uppercase" fontWeight="bold" letterSpacing="wide" mb={2}>
                          Motivo de Devolución
                        </Text>
                        <Text fontSize="sm" color={justifyText} whiteSpace="pre-wrap">
                          {selectedLog.justification}
                        </Text>
                      </Box>
                    )}
                  </VStack>
                </GridItem>

                <GridItem
                  borderLeftWidth={{ base: 0, lg: '1px' }}
                  borderTopWidth={{ base: '1px', lg: 0 }}
                  borderColor={cardBorderColor}
                  pl={{ base: 0, lg: 6 }}
                  pt={{ base: 4, lg: 0 }}
                >
                  <Text fontSize="xs" color={mutedTextColor} textTransform="uppercase" fontWeight="bold" letterSpacing="wide" mb={4}>
                    Historial de revisión
                  </Text>
                  <Box maxH={{ base: 'none', lg: '60vh' }} overflowY="auto" pr={1}>
                    {(selectedLog.reviews || []).length === 0 ? (
                      <Box
                        p={4}
                        bg={sectionBg}
                        borderWidth="1px"
                        borderColor={cardBorderColor}
                        borderRadius="lg"
                        textAlign="center"
                      >
                        <Text fontSize="sm" color={mutedTextColor}>Sin eventos registrados.</Text>
                      </Box>
                    ) : (
                      <VStack align="stretch" spacing={0}>
                        {(selectedLog.reviews || []).map((review, index, list) => (
                          <Flex key={review.id} gap={3} align="stretch">
                            <Flex direction="column" align="center" w="14px" flexShrink={0}>
                              <Box
                                mt={1}
                                w="10px"
                                h="10px"
                                borderRadius="full"
                                bg={timelineDot}
                                flexShrink={0}
                              />
                              {index < list.length - 1 && (
                                <Box flex="1" w="2px" bg={timelineLine} my={1} minH="24px" />
                              )}
                            </Flex>
                            <Box
                              flex="1"
                              mb={index < list.length - 1 ? 3 : 0}
                              p={3}
                              bg={sectionBg}
                              borderWidth="1px"
                              borderColor={cardBorderColor}
                              borderRadius="lg"
                            >
                              <Flex justify="space-between" gap={3} align="flex-start" mb={1}>
                                <Text fontSize="sm" fontWeight="semibold">
                                  {review.actor?.name || review.actorRole || 'Sistema'}
                                </Text>
                                <Text fontSize="xs" color={mutedTextColor} whiteSpace="nowrap">
                                  {new Date(review.createdAt).toLocaleString('es-GT')}
                                </Text>
                              </Flex>
                              <Badge
                                variant="subtle"
                                colorScheme="gray"
                                borderRadius="md"
                                fontSize="xs"
                                fontWeight="medium"
                                px={2}
                                py={0.5}
                                maxW="100%"
                                whiteSpace="normal"
                                textAlign="left"
                              >
                                {formatReviewTransition(review)}
                              </Badge>
                              {review.comment && (
                                <Text fontSize="sm" mt={2} whiteSpace="pre-wrap" color={textColor}>
                                  {review.comment}
                                </Text>
                              )}
                            </Box>
                          </Flex>
                        ))}
                      </VStack>
                    )}
                  </Box>
                </GridItem>
              </Grid>
            )}
          </ModalBody>
          <ModalFooter py={3} borderTopWidth="1px" borderColor={cardBorderColor}>
            <Button colorScheme="brand" onClick={onDetailsClose}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* AlertDialog (Confirmaciones) */}
      <AlertDialog isCentered isOpen={confirmState.isOpen} leastDestructiveRef={cancelRef} onClose={() => setConfirmState({ isOpen: false, action: null, data: null, justification: '' })}>
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
              {confirmState.action === 'PAYROLL_REJECT' && (
                <VStack align="stretch" spacing={3}>
                  <Text>¿Deseas rechazar este registro y devolverlo a la persona de Operaciones que lo ingresó?</Text>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Comentario para la corrección</FormLabel>
                    <Input 
                      placeholder="Indica qué debe corregir Operaciones..."
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
              {confirmState.action === 'BULK_PAYROLL_REJECT' && (
                <VStack align="stretch" spacing={3}>
                  <Text>{`¿Deseas rechazar y devolver a Operaciones los ${selectedRowIds.length} registros seleccionados?`}</Text>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Comentario para la corrección (aplica a todos)</FormLabel>
                    <Input
                      placeholder="Indica qué debe corregir Operaciones..."
                      value={confirmState.justification}
                      onChange={(e) => setConfirmState({...confirmState, justification: e.target.value})}
                    />
                  </FormControl>
                </VStack>
              )}
              {confirmState.action === 'DELETE' && '¿Estás seguro de que deseas eliminar este registro permanentemente?'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setConfirmState({ isOpen: false, action: null, data: null, justification: '' })} variant="ghost">Cancelar</Button>
              <Button 
                colorScheme={['DELETE', 'REJECT', 'BULK_REJECT', 'PAYROLL_REJECT', 'BULK_PAYROLL_REJECT'].includes(confirmState.action) ? 'red' : 'blue'}
                onClick={executeConfirm} 
                ml={3}
                isDisabled={['REJECT', 'BULK_REJECT', 'PAYROLL_REJECT', 'BULK_PAYROLL_REJECT'].includes(confirmState.action) && !confirmState.justification?.trim()}
              >
                {confirmState.action === 'SAVE' ? 'Guardar' : confirmState.action === 'DELETE' ? 'Eliminar' : 'Confirmar'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Modal Editar y Reenviar */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="3xl" isCentered scrollBehavior="inside">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={bg} color={textColor} maxH="90vh">
          <ModalHeader py={3}>Editar y Reenviar Solicitud</ModalHeader>
          <ModalBody pb={2}>
            {editFormData && (
              <VStack spacing={3} align="stretch">
                <Text fontSize="sm" color={mutedTextColor}>
                  Corrige los datos de la solicitud y vuelve a enviarla para su aprobación.
                </Text>
                <FormControl isRequired>
                  <FormLabel fontSize="sm" mb={1}>Empleado</FormLabel>
                  <Flex mb={2} gap={2} wrap="wrap">
                    {isSolicitante && user?.idDepartamento ? (
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
                  <Box maxH="160px" overflowY="auto" borderWidth="1px" borderRadius="md" p={2}>
                    <RadioGroup colorScheme="brand" value={editFormData.employeeId.toString()} onChange={handleEditEmployeeChange}>
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
                              <Text fontSize="xs" fontWeight="bold" color="brand.400" textTransform="uppercase" mt={1} mb={1} borderBottomWidth="1px" borderColor="gray.600" pb={1}>
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

                {editFormData.date && editEmployeeCompanyId && !hasMatchingActivePayroll(editFormData.date, editEmployeeCompanyId) && (
                  <Box w="100%" p={2} borderRadius="md" bg="orange.50" borderWidth="1px" borderColor="orange.200">
                    <Text fontSize="sm" color="orange.700">
                      {getMissingPayrollMessage(editFormData.date, editEmployeeCompanyId)}
                    </Text>
                  </Box>
                )}

                {editBonusDateBlocked && (
                  <Box w="100%" p={2} borderRadius="md" bg="orange.50" borderWidth="1px" borderColor="orange.200">
                    <Text fontSize="sm" color="orange.700">
                      Los bonos operativos solo se registran en la 2ª quincena (días 16 al fin de mes).
                    </Text>
                  </Box>
                )}

                <HStack w="full" spacing={3} align="start">
                  <FormControl isRequired flex={1}>
                    <FormLabel fontSize="sm" mb={1}>Empresa principal</FormLabel>
                    <Input
                      size="sm"
                      isReadOnly
                      cursor="not-allowed"
                      value={companies.find(c => String(c.id) === editEmployeeCompanyId)?.nombre_comercial || 'Sin empresa principal'}
                    />
                  </FormControl>
                  <FormControl isRequired flex={1}>
                    <FormLabel fontSize="sm" mb={1}>
                      Fecha
                      {editFormData.date && (
                        <Text as="span" fontWeight="normal" color={mutedTextColor} ml={2}>
                          ({formatQuincenaLabel(editFormData.date)})
                        </Text>
                      )}
                    </FormLabel>
                    <Input
                      size="sm"
                      type="date"
                      value={editFormData.date || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    />
                  </FormControl>
                </HStack>

                {editFormData.type === 'HORA_EXTRA' ? (
                  <>
                  <HStack w="full" spacing={3} align="start">
                    <FormControl isRequired flex={1}>
                      <FormLabel fontSize="sm" mb={1}>Cantidad de Horas</FormLabel>
                      <Input size="sm" type="number" step="0.5" value={editFormData.hoursQty} onChange={(e) => setEditFormData({...editFormData, hoursQty: e.target.value})} />
                    </FormControl>
                    <FormControl isRequired flex={1}>
                      <FormLabel fontSize="sm" mb={1}>Tipo de Hora Extra</FormLabel>
                      <Select size="sm" value={editFormData.hourType} onChange={(e) => setEditFormData({...editFormData, hourType: e.target.value})}>
                        <option value="SIMPLE">Simple</option>
                        <option value="NOCTURNA">Nocturna</option>
                      </Select>
                    </FormControl>
                  </HStack>
                  {overtimeCalcInfo}
                  </>
                ) : (
                  <HStack w="full" spacing={3} align="start">
                    <FormControl flex={1}>
                      <FormLabel fontSize="sm" mb={1}>Concepto Predeterminado</FormLabel>
                      <Select
                        size="sm"
                        placeholder="Seleccionar concepto..."
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
                    <FormControl isRequired flex={1}>
                      <FormLabel fontSize="sm" mb={1}>Monto del Bono</FormLabel>
                      <Input size="sm" type="number" step="0.01" value={editFormData.bonusAmount} onChange={(e) => setEditFormData({...editFormData, bonusAmount: e.target.value})} />
                    </FormControl>
                  </HStack>
                )}
                <FormControl isRequired>
                  <FormLabel fontSize="sm" mb={1}>Justificación / Tarea Realizada</FormLabel>
                  <Input size="sm" value={editFormData.taskDescription} onChange={(e) => setEditFormData({...editFormData, taskDescription: e.target.value})} />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter py={3}>
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
                editBonusDateBlocked ||
                (editFormData.date &&
                  editEmployeeCompanyId &&
                  !hasMatchingActivePayroll(editFormData.date, editEmployeeCompanyId))
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
