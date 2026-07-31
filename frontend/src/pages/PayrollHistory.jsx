import React, { useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { DataContext } from '../context/DataContext';
import { AppContext } from '../context/AppContext';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { AuthContext } from '../context/AuthContext';
import { History, Calendar, Trash2, Eye, Download, FileText, ArrowLeft, Building2, X, Search, ChevronDown, LayoutGrid, RotateCcw } from 'lucide-react';
import { formatQ, CUOTA_LABORAL_RATE, CUOTA_PATRONAL_RATE, IRTRA_INTECAP_RATE } from '../data/mockData';
import { getNetPayable, getNetTotal } from '../utils/payrollPeriod';
import { calculateEmployeePayroll } from '../utils/payrollCalculator';
import { exportPayrollReportExcel } from '../utils/payrollReports';
import { exportNominaGeneralExcel } from '../utils/nominaGeneralExport';
import { exportVerificadorExcel } from '../utils/verificadorExcel';
import { exportSolicitudChequesExcel } from '../utils/solicitudChequesExcel';
import { matchesDepartmentFilter, normalizeMultiFilter, resolveEmployeeDepartment } from '../utils/orgFilters';
import ReportPreviewModal from '../components/ReportPreviewModal';
import EmployeeSummaryModal from '../components/EmployeeSummaryModal';
import { apiFetch } from '../utils/api';
import {
  Box, Flex, Heading, Text, Button, Input, Select, Textarea, FormControl, FormLabel,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  IconButton, Badge, Avatar, HStack, VStack,
  InputGroup, InputLeftElement, useColorModeValue,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, ModalCloseButton, Divider, SimpleGrid,
  Menu, MenuButton, MenuList, MenuItem, MenuItemOption, MenuOptionGroup,
  Skeleton, SkeletonText, ButtonGroup, Tooltip, Collapse
} from '@chakra-ui/react';

const getHtml2Canvas = () => import('html2canvas').then(m => m.default);
const getJsPDF = () => import('jspdf').then(m => m.default);
const downloadWorkbookReport = async (sheets, filename) => {
  const { generateAndDownloadExcel } = await import('../utils/excelWorkerClient');
  return generateAndDownloadExcel('workbook-report', { sheets }, filename);
};

const canAuditPayroll = (role) =>
  role === 'AUDITOR' || role === 'ADMIN' || role === 'GERENTE GENERAL';

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/** Clave de sección: YYYY-MM */
export const getPeriodKey = (group) => {
  const d = new Date(group?.date || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const formatPeriodLabel = (key) => {
  const [y, m] = String(key || '').split('-');
  const monthName = MONTH_NAMES_ES[Number(m) - 1] || m || '';
  return `${monthName} ${y}`.trim();
};

export const getEmployeeFullName = (e) => {
  if (!e) return '';
  const parts = [
    e.primer_nombre, 
    e.segundo_nombre, 
    e.otro_nombre, 
    e.primer_apellido, 
    e.segundo_apellido, 
    e.apellido_casada
  ].filter(Boolean);
  
  if (parts.length > 0) return parts.join(' ');
  return `${e.nombres || ''} ${e.apellidos || ''}`.trim() || 'Empleado';
};

const ensureEmployeeCalculation = (employee, periodType) => {
  const calculated = employee?.calculated;
  if (
    calculated?.gross != null
    && calculated?.ded != null
    && calculated?.net != null
  ) {
    return employee;
  }
  return calculateEmployeePayroll(employee || {}, periodType);
};

const getCatalogBonuses = (employee) => {
  if (employee?.calculated?.bonusesSum != null) {
    return Number(employee.calculated.bonusesSum) || 0;
  }
  return Object.values(employee?.appliedBonuses || {})
    .reduce((sum, value) => sum + (Number(value) || 0), 0);
};

/** ID de la nómina en historial (grupos se arman por título+empresa). */
export const resolveGroupPayrollId = (group) => {
  if (!group?.records?.length) return null;
  const inAudit = group.records.find((r) => r.status === 'auditoria');
  return (inAudit || group.records[0]).id;
};

const parseJsonMaybe = (raw) => {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

/** Normaliza un valor de empresa (id / nombre / nit) al nombre comercial si existe. */
const resolveCompanyDisplayName = (raw, companiesList = []) => {
  if (raw == null || raw === '') return null;
  const found = companiesList.find((c) =>
    String(c.id) === String(raw)
    || c.nombre_comercial === raw
    || c.nit === raw
  );
  return found ? (found.nombre_comercial || found.nit || String(found.id)) : String(raw).trim();
};

/** Clave estable de empresa(s) de un registro de historial (una nómina = una empresa). */
const getPayrollCompanyKey = (payroll, companiesList = []) => {
  const summary = parseJsonMaybe(payroll?.summary);
  const fromSummary = Array.isArray(summary?.companies) ? summary.companies : [];
  const ids = [];
  fromSummary.forEach((raw) => {
    const found = companiesList.find((c) =>
      String(c.id) === String(raw)
      || c.nombre_comercial === raw
      || c.nit === raw
    );
    ids.push(found ? String(found.id) : String(raw).trim());
  });
  if (ids.length === 0) {
    let emps = payroll?.data || payroll?.employees || [];
    if (typeof emps === 'string') {
      try { emps = JSON.parse(emps); } catch { emps = []; }
    }
    (Array.isArray(emps) ? emps : []).forEach((e) => {
      if (e?.empresa_principal != null) ids.push(String(e.empresa_principal));
      else if (e?.company) {
        const found = companiesList.find((c) =>
          c.nombre_comercial === e.company || c.nit === e.company
        );
        if (found) ids.push(String(found.id));
      }
    });
  }
  const unique = [...new Set(ids.filter(Boolean))].sort();
  return unique.length ? unique.join('|') : 'sin-empresa';
};

export default function PayrollHistory() {
  const { payrollHistory, deletePayroll, auditorApprovePayroll, auditorRejectPayroll, companies, areas, activePayrolls, deleteOperationLog, addOperationLog, isLoading } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'AUDITOR';
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  
  // Reactivation Modal State
  const [reactivationGroup, setReactivationGroup] = useState(null);
  const [conceptoReactivacion, setConceptoReactivacion] = useState('');
  const [isReactivating, setIsReactivating] = useState(false);

  // Reject Modal State (list view)
  const [rejectGroup, setRejectGroup] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState({});

  const toggleMonth = useCallback((key) => {
    setExpandedMonths((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Agrupar por título + empresa (el título auto no incluye empresa y unía nóminas distintas)
  const groupedHistory = useMemo(() => {
    const groups = {};
    payrollHistory.forEach((p) => {
      const t = p.title || 'Nómina sin título';
      const companyKey = getPayrollCompanyKey(p, companies);
      const groupKey = `${t}::${companyKey}`;
      if (!groups[groupKey]) {
        const periodDate = p.createdAt || p.closedAt || new Date().toISOString();
        groups[groupKey] = {
          groupKey,
          title: t,
          companyKey,
          date: periodDate,
          createdAt: periodDate,
          closedAt: p.closedAt || null,
          periodType: p.periodType || '1ra',
          records: [],
          status: p.status || 'cerrada',
          employeesCount: 0,
          grossTotal: 0,
          netTotal: 0,
          companies: new Set()
        };
      }

      const g = groups[groupKey];
      g.records.push(p);

      const summary = parseJsonMaybe(p.summary);
      const hasInlineData = (() => {
        let emps = p.data || p.employees || [];
        if (typeof emps === 'string') {
          try { emps = JSON.parse(emps); } catch { emps = []; }
        }
        return Array.isArray(emps) && emps.length > 0;
      })();

      if (summary && summary.employeesCount > 0 && !hasInlineData) {
        g.employeesCount += summary.employeesCount || 0;
        g.grossTotal += summary.grossTotal || 0;
        g.netTotal += summary.netTotal || 0;
        (summary.companies || []).forEach((c) => {
          const name = resolveCompanyDisplayName(c, companies);
          if (name) g.companies.add(name);
        });
      } else if (hasInlineData) {
        let emps = p.data || p.employees || [];
        if (typeof emps === 'string') {
          try { emps = JSON.parse(emps); } catch (e) { emps = []; }
        }
        if (!Array.isArray(emps)) emps = [];
        g.employeesCount += emps.length;

        let grossSum = 0;
        let netSum = 0;
        const periodType = p.periodType || g.periodType || '1ra';
        emps.forEach((rawEmployee) => {
          const e = ensureEmployeeCalculation(rawEmployee, periodType);
          grossSum += Number(e.calculated.gross) || 0;
          netSum += getNetPayable(e, periodType);
        });

        g.grossTotal += grossSum;
        g.netTotal += netSum;

        emps.forEach((e) => {
          if (!e.empresa_principal) return;
          const name = resolveCompanyDisplayName(e.empresa_principal, companies);
          if (name) g.companies.add(name);
        });
      }

      const recordPeriodDate = p.createdAt || p.closedAt;
      if (recordPeriodDate && new Date(recordPeriodDate) > new Date(g.date)) {
        g.date = recordPeriodDate;
        g.createdAt = recordPeriodDate;
      }
      if (
        p.closedAt
        && (!g.closedAt || new Date(p.closedAt) > new Date(g.closedAt))
      ) {
        g.closedAt = p.closedAt;
      }
      if (p.status === 'auditoria') {
        g.status = 'auditoria';
      } else if (g.status !== 'auditoria') {
        g.status = p.status || 'cerrada';
      }
    });

    return Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [payrollHistory, companies]);

  const companyFilterOptions = useMemo(() => {
    const names = new Set();
    groupedHistory.forEach((g) => {
      Array.from(g.companies || []).forEach((c) => names.add(c));
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
  }, [groupedHistory]);

  const filteredHistory = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return groupedHistory.filter((g) => {
      const companiesArr = Array.from(g.companies || []);
      const companiesStr = companiesArr.join(' ').toLowerCase();
      const matchesSearch = !q
        || g.title.toLowerCase().includes(q)
        || companiesStr.includes(q);
      if (!matchesSearch) return false;
      if (periodFilter !== 'all' && (g.periodType || '1ra') !== periodFilter) return false;
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (companyFilter !== 'all' && !companiesArr.includes(companyFilter)) return false;
      return true;
    });
  }, [groupedHistory, searchTerm, periodFilter, statusFilter, companyFilter]);

  const pagination = usePagination(filteredHistory, 10);

  const periodSections = useMemo(() => {
    const sections = {};
    pagination.paginatedData.forEach((g) => {
      const key = getPeriodKey(g);
      if (!sections[key]) {
        sections[key] = {
          key,
          label: formatPeriodLabel(key),
          groups: [],
          employeesCount: 0,
          grossTotal: 0,
          netTotal: 0,
          sortDate: g.date
        };
      }
      sections[key].groups.push(g);
      sections[key].employeesCount += g.employeesCount || 0;
      sections[key].grossTotal += g.grossTotal || 0;
      sections[key].netTotal += g.netTotal || 0;
      if (new Date(g.date) > new Date(sections[key].sortDate)) {
        sections[key].sortDate = g.date;
      }
    });

    const buildQuincena = (periodType, groups) => {
      const filtered = groups
        .filter((g) => (g.periodType || '1ra') === periodType)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      if (filtered.length === 0) return null;
      return {
        periodType,
        label: periodType === '2da' ? '2da Quincena' : '1ra Quincena',
        groups: filtered,
        employeesCount: filtered.reduce((s, g) => s + (g.employeesCount || 0), 0),
        grossTotal: filtered.reduce((s, g) => s + (g.grossTotal || 0), 0),
        netTotal: filtered.reduce((s, g) => s + (g.netTotal || 0), 0)
      };
    };

    return Object.values(sections)
      .map((section) => ({
        ...section,
        groups: [...section.groups].sort((a, b) => new Date(b.date) - new Date(a.date)),
        quincenas: ['1ra', '2da']
          .map((pt) => buildQuincena(pt, section.groups))
          .filter(Boolean)
      }))
      .sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
  }, [pagination.paginatedData]);

  const handleApprovePayroll = async (group) => {
    const payrollId = resolveGroupPayrollId(group);
    if (!payrollId) {
      showToast('No se encontró el ID de la nómina', 'error');
      return;
    }
    confirmAction('¿Aprobar esta nómina y devolverla a borradores para su cierre final?', async () => {
      try {
        await auditorApprovePayroll(payrollId);
        showToast('Nómina aprobada correctamente', 'success');
      } catch {
        showToast('Error al aprobar la nómina', 'error');
      }
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectGroup) return;
    if (!rejectNote.trim()) {
      showToast('Debes ingresar una justificación', 'error');
      return;
    }
    const payrollId = resolveGroupPayrollId(rejectGroup);
    if (!payrollId) {
      showToast('No se encontró el ID de la nómina', 'error');
      return;
    }
    setIsRejecting(true);
    try {
      await auditorRejectPayroll(payrollId, rejectNote);
      showToast('Nómina rebotada a borradores exitosamente', 'success');
      setRejectGroup(null);
      setRejectNote('');
    } catch {
      showToast('Error al enviar a corrección', 'error');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDeleteGroup = (group) => {
    const label = group?.title || 'Nómina';
    const companyLabel = group?.companies?.size
      ? ` (${Array.from(group.companies).join(', ')})`
      : '';
    const records = group?.records || [];
    confirmAction(
      `¿Seguro que desea eliminar "${label}${companyLabel}"? Se borrarán ${records.length} nómina(s).`,
      () => {
        records.forEach((r) => deletePayroll(r.id));
        showToast('Registro eliminado exitosamente', 'info');
        if (selectedGroup && selectedGroup.groupKey === group.groupKey) setSelectedGroup(null);
      }
    );
  };

  const handleRequestReactivation = (group) => {
    setReactivationGroup(group);
    setConceptoReactivacion('');
  };

  const submitReactivation = async () => {
    if (!reactivationGroup) return;
    const payrollIds = reactivationGroup.records.map(r => r.id);
    
    setIsReactivating(true);
    try {
      const token = localStorage.getItem('nomina-token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const response = await apiFetch('/api/payrolls/request-reactivation', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          payrollIds, 
          concepto: conceptoReactivacion 
        })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al solicitar reactivación');
      }
      
      showToast('Solicitud de reactivación enviada por correo', 'success');
      setReactivationGroup(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsReactivating(false);
    }
  };

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const toolbarBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const headerBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const selectBg = useColorModeValue('white', 'gray.800');

  if (selectedGroup) {
    return <PayrollHistoryDetail group={selectedGroup} onBack={() => setSelectedGroup(null)} />;
  }

  if (isLoading) {
    return (
      <Box p={{ base: 3, md: 6, lg: 8 }}>
        <Box mb={6}>
          <Skeleton height="28px" width="240px" mb={2} borderRadius="md" />
          <Skeleton height="16px" width="420px" borderRadius="md" />
        </Box>
        <Skeleton height="72px" mb={5} borderRadius="xl" />
        <VStack spacing={5} align="stretch">
          {[1, 2, 3].map((i) => (
            <Box key={i} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden">
              <Box p={4} borderBottomWidth="1px" borderColor={borderColor}>
                <Skeleton height="18px" width="220px" mb={3} borderRadius="md" />
                <HStack spacing={4}>
                  <Skeleton height="14px" width="100px" borderRadius="md" />
                  <Skeleton height="14px" width="120px" borderRadius="md" />
                  <Skeleton height="14px" width="120px" borderRadius="md" />
                </HStack>
              </Box>
              <Box p={3}>
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} height="36px" mb={2} borderRadius="md" />
                ))}
              </Box>
            </Box>
          ))}
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Box mb={6}>
        <Heading size="lg" fontWeight={800} mb={1}>
          Historial de Nóminas
        </Heading>
        <Text color="gray.500">
          Registro inmutable de procesos de nómina cerrados y agrupados por mes
        </Text>
      </Box>

      <Flex
        gap={3}
        flexWrap="wrap"
        align="center"
        bg={toolbarBg}
        p={4}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={borderColor}
        mb={5}
      >
        <InputGroup flex="1" minW="200px" maxW="360px" size="sm">
          <InputLeftElement pointerEvents="none">
            <Search size={16} color="gray" />
          </InputLeftElement>
          <Input
            placeholder="Buscar por título o empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            bg={selectBg}
            borderRadius="md"
          />
        </InputGroup>

        <Select
          size="sm"
          w={{ base: '100%', sm: '160px' }}
          bg={selectBg}
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
        >
          <option value="all">Todas las quincenas</option>
          <option value="1ra">1ra Quincena</option>
          <option value="2da">2da Quincena</option>
        </Select>

        <Select
          size="sm"
          w={{ base: '100%', sm: '160px' }}
          bg={selectBg}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="cerrada">Cerrada</option>
          <option value="auditoria">En Auditoría</option>
        </Select>

        <Select
          size="sm"
          w={{ base: '100%', sm: '200px' }}
          bg={selectBg}
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="all">Todas las empresas</option>
          {companyFilterOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </Select>
      </Flex>

      <Text fontSize="sm" color="gray.500" mb={4}>
        {filteredHistory.length} nómina{filteredHistory.length !== 1 ? 's' : ''} · agrupadas por mes · clic para ver quincenas
      </Text>

      <VStack spacing={5} align="stretch">
        {periodSections.map((section) => {
          const isExpanded = !!expandedMonths[section.key];
          return (
            <Box
              key={section.key}
              bg={cardBg}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={borderColor}
              shadow="sm"
              overflow="hidden"
            >
              <Box
                as="button"
                type="button"
                w="100%"
                textAlign="left"
                p={{ base: 4, md: 5 }}
                borderBottomWidth={isExpanded ? '1px' : '0'}
                borderColor={borderColor}
                bg={headerBg}
                cursor="pointer"
                _hover={{ opacity: 0.95 }}
                onClick={() => toggleMonth(section.key)}
                aria-expanded={isExpanded}
              >
                <Flex justify="space-between" align="start" gap={3} flexWrap="wrap">
                  <Box>
                    <HStack spacing={2} mb={1} flexWrap="wrap">
                      <Flex align="center" gap={1.5} color="brand.400">
                        <Box
                          as="span"
                          display="inline-flex"
                          transition="transform 0.2s"
                          transform={isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'}
                        >
                          <ChevronDown size={16} />
                        </Box>
                        <Calendar size={16} />
                        <Text fontSize="md" fontWeight={800}>{section.label}</Text>
                      </Flex>
                    </HStack>
                    <Text fontSize="xs" color="gray.500">
                      {section.groups.length} nómina{section.groups.length !== 1 ? 's' : ''} en este mes
                      {!isExpanded ? ' · clic para ver quincenas' : ''}
                    </Text>
                  </Box>
                  <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3} minW={{ base: '100%', sm: '360px' }}>
                    <Box>
                      <Text fontSize="xxs" color="gray.500" textTransform="uppercase" fontWeight={700}>Empleados</Text>
                      <Text fontWeight="bold">{section.employeesCount}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xxs" color="gray.500" textTransform="uppercase" fontWeight={700}>Bruto</Text>
                      <Text fontWeight="bold" fontFamily="mono">{formatQ(section.grossTotal)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xxs" color="gray.500" textTransform="uppercase" fontWeight={700}>Neto</Text>
                      <Text fontWeight="bold" fontFamily="mono" color="gold.500">{formatQ(section.netTotal)}</Text>
                    </Box>
                  </SimpleGrid>
                </Flex>
              </Box>

              <Collapse in={isExpanded} animateOpacity>
                <VStack spacing={0} align="stretch">
                  {section.quincenas.map((quincena, qIdx) => (
                    <Box
                      key={`${section.key}-${quincena.periodType}`}
                      borderTopWidth={qIdx > 0 ? '1px' : '0'}
                      borderColor={borderColor}
                    >
                      <Box px={{ base: 4, md: 5 }} py={3} bg={toolbarBg}>
                        <Flex justify="space-between" align="center" gap={3} flexWrap="wrap">
                          <HStack spacing={2}>
                            <Badge colorScheme={quincena.periodType === '2da' ? 'purple' : 'teal'}>
                              {quincena.label}
                            </Badge>
                            <Text fontSize="xs" color="gray.500">
                              {quincena.groups.length} nómina{quincena.groups.length !== 1 ? 's' : ''}
                            </Text>
                          </HStack>
                          <HStack spacing={4} fontSize="sm" flexWrap="wrap">
                            <Text color="gray.500">
                              Empleados: <Text as="span" fontWeight={700} color="inherit">{quincena.employeesCount}</Text>
                            </Text>
                            <Text color="gray.500">
                              Bruto: <Text as="span" fontWeight={700} fontFamily="mono" color="inherit">{formatQ(quincena.grossTotal)}</Text>
                            </Text>
                            <Text color="gray.500">
                              Neto: <Text as="span" fontWeight={700} fontFamily="mono" color="gold.500">{formatQ(quincena.netTotal)}</Text>
                            </Text>
                          </HStack>
                        </Flex>
                      </Box>

                      <TableContainer overflowX="auto">
                        <Table variant="simple" size="sm">
                          <Thead bg={headerBg}>
                            <Tr>
                              <Th>Título</Th>
                              <Th>Empresa</Th>
                              <Th>Fecha</Th>
                              <Th>Estado</Th>
                              <Th isNumeric>Empleados</Th>
                              <Th isNumeric>Bruto</Th>
                              <Th isNumeric>Neto</Th>
                              <Th textAlign="right">Acciones</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {quincena.groups.map((group) => {
                              const companiesLabel = group.companies.size === 0
                                ? 'Sin empresa'
                                : Array.from(group.companies).join(', ');
                              return (
                                <Tr key={group.groupKey || `${group.title}::${companiesLabel}`} _hover={{ bg: toolbarBg }}>
                                  <Td maxW="280px">
                                    <Text fontWeight={700} noOfLines={2}>{group.title}</Text>
                                  </Td>
                                  <Td maxW="200px">
                                    <Flex align="center" gap={1}>
                                      <Building2 size={14} />
                                      <Text fontSize="sm" noOfLines={2}>{companiesLabel}</Text>
                                    </Flex>
                                  </Td>
                                  <Td whiteSpace="nowrap">{new Date(group.date).toLocaleDateString()}</Td>
                                  <Td>
                                    <Badge colorScheme={group.status === 'auditoria' ? 'orange' : 'gray'}>
                                      {group.status === 'auditoria' ? 'En Auditoría' : 'Cerrada'}
                                    </Badge>
                                  </Td>
                                  <Td isNumeric>{group.employeesCount}</Td>
                                  <Td isNumeric fontFamily="mono">{formatQ(group.grossTotal)}</Td>
                                  <Td isNumeric fontFamily="mono" fontWeight={800} color="gold.500">{formatQ(group.netTotal)}</Td>
                                  <Td textAlign="right">
                                    <HStack spacing={1} justify="flex-end">
                                      <Tooltip label="Ver detalle">
                                        <IconButton
                                          aria-label="Ver Detalle"
                                          icon={<Eye size={16} />}
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setSelectedGroup(group)}
                                        />
                                      </Tooltip>
                                      {group.status === 'auditoria' && canAuditPayroll(user?.role) && (
                                        <>
                                          <Tooltip label="Aprobar Nómina">
                                            <Button size="sm" colorScheme="green" variant="ghost" onClick={() => handleApprovePayroll(group)}>
                                              Aprobar
                                            </Button>
                                          </Tooltip>
                                          <Tooltip label="Corregir Nómina">
                                            <Button
                                              size="sm"
                                              colorScheme="red"
                                              variant="ghost"
                                              onClick={() => {
                                                setRejectGroup(group);
                                                setRejectNote('');
                                              }}
                                            >
                                              Corregir
                                            </Button>
                                          </Tooltip>
                                        </>
                                      )}
                                      {!isReadOnly && group.periodType === '2da' && (user?.role === 'ADMIN' || user?.role === 'NOMINA' || user?.role === 'GERENTE GENERAL') && (
                                        <Tooltip label="Solicitar Reactivación">
                                          <IconButton
                                            aria-label="Reactivar Nómina"
                                            icon={<RotateCcw size={16} />}
                                            size="sm"
                                            colorScheme="blue"
                                            variant="ghost"
                                            onClick={() => handleRequestReactivation(group)}
                                          />
                                        </Tooltip>
                                      )}
                                      {!isReadOnly && (
                                        <Tooltip label="Eliminar registro">
                                          <IconButton
                                            aria-label="Eliminar Registro"
                                            icon={<Trash2 size={16} />}
                                            size="sm"
                                            colorScheme="red"
                                            variant="ghost"
                                            onClick={() => handleDeleteGroup(group)}
                                          />
                                        </Tooltip>
                                      )}
                                    </HStack>
                                  </Td>
                                </Tr>
                              );
                            })}
                          </Tbody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))}
                </VStack>
              </Collapse>
            </Box>
          );
        })}

        {filteredHistory.length === 0 && (
          <VStack spacing={4} py={12} align="center" color="gray.500">
            <History size={48} opacity={0.3} />
            <Heading size="sm">
              {groupedHistory.length === 0 ? 'Historial Vacío' : 'Sin resultados'}
            </Heading>
            <Text fontSize="sm">
              {groupedHistory.length === 0
                ? 'Aún no hay nóminas procesadas en el sistema.'
                : 'No hay nóminas que coincidan con los filtros actuales.'}
            </Text>
          </VStack>
        )}
      </VStack>

      {pagination.paginatedData.length > 0 && (
        <Box mt={8}>
          <Pagination {...pagination} />
        </Box>
      )}

      {/* Reactivation Modal */}
      <Modal isOpen={!!reactivationGroup} onClose={() => setReactivationGroup(null)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Solicitar Reactivación</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              Ingresa el motivo o concepto por el cual solicitas la reactivación de la nómina <strong>{reactivationGroup?.title}</strong>. Esto se enviará por correo a Gerencia General.
            </Text>
            <FormControl>
              <FormLabel>Concepto / Motivo</FormLabel>
              <Textarea 
                placeholder="Ej. Error en cálculos de IGSS, se necesita corregir un empleado..." 
                value={conceptoReactivacion}
                onChange={(e) => setConceptoReactivacion(e.target.value)}
                rows={4}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setReactivationGroup(null)} isDisabled={isReactivating}>
              Cancelar
            </Button>
            <Button colorScheme="blue" onClick={submitReactivation} isLoading={isReactivating} loadingText="Enviando...">
              Solicitar Reactivación
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reject / Correct Modal (list view) */}
      <Modal isOpen={!!rejectGroup} onClose={() => { setRejectGroup(null); setRejectNote(''); }} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color="red.500">Enviar a Corrección</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4} fontSize="sm" color="gray.600">
              Por favor, detalla qué es lo que está incorrecto en esta nómina. El operador de nóminas verá esta justificación y podrá editarla.
            </Text>
            <Textarea
              placeholder="Ej. El bono del empleado X está mal calculado..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => { setRejectGroup(null); setRejectNote(''); }} mr={3} isDisabled={isRejecting}>
              Cancelar
            </Button>
            <Button colorScheme="red" isLoading={isRejecting} onClick={handleConfirmReject}>
              Confirmar Rechazo
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
}
function calculateGroupTotals(groupData, periodType) {
  let totSalarioOrd = 0, totBonInc = 0, totBonDec = 0, totBonos = 0, totDevengado = 0;
  let totHorasSimples = 0, totValSimple = 0, totHorasDobles = 0, totValDouble = 0, totOtrosIngresos = 0, totSalarioTotal = 0;
  let totIgss = 0, totIsr = 0, totCafe = 0, totCell = 0, totUniform = 0, totShoes = 0, totEquipo = 0, totProduct = 0, totBancos = 0, totPrestamo = 0, totOtros = 0, totJudiciales = 0, totSeguro = 0, totParqueo = 0, totBoleta = 0, totOtrosEgresos = 0, totTotalEgresos = 0;
  let totLiquido = 0, totQuincena1 = 0, totQuincena2 = 0;

  groupData.forEach(rawEmployee => {
    const e = ensureEmployeeCalculation(rawEmployee, periodType);
    const calculated = e.calculated;
    const baseSalary = Number(calculated.baseSalary) || 0;
    const bonusLey = Number(calculated.bonusLey) || 0;
    const bonusDec = Number(calculated.bonusDec) || 0;
    const bonos = (Number(calculated.bonos) || 0) + getCatalogBonuses(e);
    const comisiones = Number(e.extras?.comisiones) || 0;
    const devengado = baseSalary + bonusLey + bonusDec + bonos;

    const simplesQty = Number(e.extras?.simplesQty) || 0;
    const simplesVal = Number(e.extras?.simplesVal) || 0;
    const doblesQty = Number(e.extras?.doblesQty) || 0;
    const doblesVal = Number(e.extras?.doblesVal) || 0;
    const otrosIngresos = (Number(e.extras?.otrosIngresos) || 0)
      + (Number(e.extras?.vacacionesVal) || 0)
      + (Number(e.extras?.ventasEconomicas) || 0)
      + comisiones;
    const salarioTotal = Number(calculated.gross) || 0;

    const proDedRow = calculated.proratedDeductions || e.deductions || {};
    const igss = Number(proDedRow.igss) || 0;
    const isr = Number(proDedRow.isr) || 0;
    const cafe = Number(proDedRow.cafe) || 0;
    const cell = Number(proDedRow.cell) || 0;
    const uniform = Number(proDedRow.uniform) || 0;
    const shoes = Number(proDedRow.shoes) || 0;
    const equipo = Number(proDedRow.equipo) || 0;
    const product = Number(proDedRow.product) || 0;
    const bancos = Number(proDedRow.bancos) || 0;
    const prestamo_empresa = Number(proDedRow.prestamo_empresa) || 0;
    const otros = Number(proDedRow.otros) || 0;
    const judiciales = Number(proDedRow.judiciales) || 0;
    const seguro = Number(proDedRow.seguro) || 0;
    const parqueo = Number(proDedRow.parqueo) || 0;
    const boleto_de_ornato = Number(proDedRow.boleto_de_ornato) || 0;
    const otros_egresos = Number(proDedRow.otros_egresos) || 0;
    const anticipo = Number(e.anticipo1ra) || 0;
    
    const totalEgresos = Number(calculated.ded) || 0;
    const liquido = getNetTotal(e);
    const q1 = periodType === '2da' ? anticipo : liquido;
    const liquidoPagar = getNetPayable(e, periodType);
    const q2 = periodType === '2da' ? liquidoPagar : 0;

    totSalarioOrd += baseSalary;
    totBonInc += bonusLey;
    totBonDec += bonusDec;
    totBonos += bonos;
    totDevengado += devengado;
    totHorasSimples += simplesQty;
    totValSimple += simplesVal;
    totHorasDobles += doblesQty;
    totValDouble += doblesVal;
    totOtrosIngresos += otrosIngresos;
    totSalarioTotal += salarioTotal;

    totIgss += igss;
    totIsr += isr;
    totCafe += cafe;
    totCell += cell;
    totUniform += uniform;
    totShoes += shoes;
    totEquipo += equipo;
    totProduct += product;
    totBancos += bancos;
    totPrestamo += prestamo_empresa;
    totOtros += otros;
    totJudiciales += judiciales;
    totSeguro += seguro;
    totParqueo += parqueo;
    totBoleta += boleto_de_ornato;
    totOtrosEgresos += otros_egresos;
    totTotalEgresos += totalEgresos;
    totLiquido += liquido;
    totQuincena1 += q1;
    totQuincena2 += q2;
  });

  return {
    totSalarioOrd, totBonInc, totBonDec, totBonos, totDevengado,
    totHorasSimples, totValSimple, totHorasDobles, totValDouble, totOtrosIngresos, totSalarioTotal,
    totIgss, totIsr, totCafe, totCell, totUniform, totShoes, totEquipo, totProduct, totBancos, totPrestamo, totOtros, totJudiciales, totSeguro, totParqueo, totBoleta, totOtrosEgresos, totTotalEgresos,
    totLiquido, totQuincena1, totQuincena2
  };
}

function PayrollHistoryDetail({ group, onBack }) {
  const { bonuses, areas, departments, divisions, subdivisions, companies, dimension5s, approvePayroll, auditorApprovePayroll, auditorRejectPayroll } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'AUDITOR';
  const [selectedVoucherEmp, setSelectedVoucherEmp] = useState(null);
  const [activeGroup, setActiveGroup] = useState(group);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [printBoletas, setPrintBoletas] = useState(false);

  useEffect(() => {
    setActiveGroup(group);
  }, [group]);

  useEffect(() => {
    const needsLoad = group.records.some((r) => {
      const raw = r.data || r.employees;
      if (!raw) return true;
      if (typeof raw === 'string') return raw.length < 3;
      return !Array.isArray(raw) || raw.length === 0;
    });
    if (!needsLoad) return;

    let cancelled = false;
    setLoadingDetail(true);
    const token = localStorage.getItem('nomina-token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    Promise.all(
      group.records.map((r) =>
        apiFetch(`/api/payrolls/${r.id}`, { headers })
          .then((res) => (res.ok ? res.json() : r))
          .catch(() => r)
      )
    ).then((records) => {
      if (cancelled) return;
      setActiveGroup({ ...group, records });
      setLoadingDetail(false);
    });

    return () => { cancelled = true; };
  }, [group]);

  useEffect(() => {
    const onAfterPrint = () => setPrintBoletas(false);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const handlePrintBoletas = useCallback(() => {
    setPrintBoletas(true);
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 150);
    });
  }, []);

  // Auditor reject states
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Filter states
  const [filterArea, setFilterArea] = useState([]);
  const [filterDept, setFilterDept] = useState([]);
  const [filterDiv, setFilterDiv] = useState([]);
  const [filterSubdiv, setFilterSubdiv] = useState([]);
  const [filterDim5, setFilterDim5] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('detailed');
  const [previewReportType, setPreviewReportType] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedSummaryEmp, setSelectedSummaryEmp] = useState(null);

  const handleOpenPreview = (type) => {
    setPreviewReportType(type);
    setIsPreviewModalOpen(true);
  };

  // Combine and calculate
  const companyMap = useMemo(
    () => new Map((companies || []).map((c) => [String(c.id), c.nombre_comercial])),
    [companies]
  );
  const areaMap = useMemo(
    () => new Map((areas || []).map((a) => [String(a.id), a.nombre || ''])),
    [areas]
  );

  const { data, totals } = useMemo(() => {
    const emps = [];
    let grossTotal = 0, dedTotal = 0, patronalTotal = 0;
    
    activeGroup.records.forEach(r => {
      let list = r.data || r.employees || [];
      if (typeof list === 'string') {
        try { list = JSON.parse(list); } catch(e) { list = []; }
      }
      if (!Array.isArray(list)) list = [];
      
      const companyName = activeGroup.companies.size > 0 ? Array.from(activeGroup.companies)[0] : 'Sin empresa';
      
      list.forEach(rawEmployee => {
        const e = ensureEmployeeCalculation(rawEmployee, activeGroup.periodType);
        const empCompany = companyMap.get(String(e.empresa_principal))
          || e.company
          || companyName;
        const gross = Number(e.calculated.gross) || 0;
        const ded = Number(e.calculated.ded) || 0;
        const patronal = (Number(e.calculated.patronal) || 0)
          + (Number(e.calculated.irtraIntecap) || 0);
        
        grossTotal += gross;
        dedTotal += ded;
        patronalTotal += patronal;
        
        emps.push({
          ...e,
          company: empCompany
        });
      });
    });
    
    // Apply filters
    const filteredEmps = emps.filter(e => {
      const estadoNorm = String(e.estado || 'Activo').trim().toLowerCase();
      if (filterStatus === 'Activo' && estadoNorm !== 'activo') return false;
      if (filterStatus === 'De Baja' && estadoNorm !== 'de baja') return false;

      const area = e.areaId || e.id_area;
      const div = e.divisionId || e.id_division;
      const subdiv = e.subdivisionId || e.id_subdivision;
      const dim5 = e.nivel_5 || e.dimension_5;

      if (!matchesDepartmentFilter(e, filterDept, departments)) return false;
      if (filterArea.length > 0 && !filterArea.includes(String(area))) return false;
      if (filterDiv.length > 0 && !filterDiv.includes(String(div))) return false;
      if (filterSubdiv.length > 0 && !filterSubdiv.includes(String(subdiv))) return false;
      if (filterDim5.length > 0 && !filterDim5.includes(String(dim5))) return false;
      
      if (searchQuery) {
        const term = searchQuery.toLowerCase();
        const fullName = getEmployeeFullName(e).toLowerCase();
        const job = (e.puesto || '').toLowerCase();
        if (!fullName.includes(term) && !job.includes(term)) return false;
      }
      return true;
    }).sort((a, b) => {
      const areaA = areaMap.get(String(a.areaId || a.id_area)) || '';
      const areaB = areaMap.get(String(b.areaId || b.id_area)) || '';
      
      const compArea = areaA.localeCompare(areaB);
      if (compArea !== 0) return compArea;

      const nameA = getEmployeeFullName(a).toLowerCase();
      const nameB = getEmployeeFullName(b).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Recalculate totals for filtered emps
    let fGrossTotal = 0, fDedTotal = 0, fPatronalTotal = 0, fNetTotal = 0;
    filteredEmps.forEach(e => {
      fGrossTotal += e.calculated.gross;
      fDedTotal += e.calculated.ded;
      fNetTotal += getNetPayable(e, activeGroup.periodType);
      fPatronalTotal += e.calculated.patronal != null
        ? (e.calculated.patronal + (e.calculated.irtraIntecap || 0))
        : e.calculated.baseSalary * (CUOTA_PATRONAL_RATE + IRTRA_INTECAP_RATE);
    });
    
    return { data: filteredEmps, totals: { grossTotal: fGrossTotal, dedTotal: fDedTotal, patronalTotal: fPatronalTotal, netTotal: fNetTotal } };
  }, [activeGroup, filterStatus, filterDept, filterArea, filterDiv, filterSubdiv, filterDim5, searchQuery, areas, departments, companyMap, areaMap]);

  const tablePagination = usePagination(data, 25);

  const groupedData = useMemo(() => {
    if (filterDept.length === 0 && filterArea.length === 0 && filterDiv.length === 0 && filterSubdiv.length === 0 && filterDim5.length === 0) {
      return [{ title: '', data }];
    }

    const groups = {};
    data.forEach(e => {
      const area = e.areaId || e.id_area;
      const div = e.divisionId || e.id_division;
      const subdiv = e.subdivisionId || e.id_subdivision;
      const dim5 = e.nivel_5 || e.dimension_5;

      const keyParts = [];
      if (filterDept.length > 0) {
        const { name: deptName } = resolveEmployeeDepartment(e, departments);
        keyParts.push(`Depto: ${deptName}`);
      }
      if (filterDiv.length > 0) {
        const divName = divisions?.find(d => String(d.id) === String(div))?.nombre || 'Sin División';
        keyParts.push(`División: ${divName}`);
      }
      if (filterArea.length > 0) {
        const areaName = areas?.find(a => String(a.id) === String(area))?.nombre || 'Sin Área';
        keyParts.push(`Área: ${areaName}`);
      }
      if (filterSubdiv.length > 0) {
        const subdivName = subdivisions?.find(s => String(s.id) === String(subdiv))?.nombre || 'Sin Subdivisión';
        keyParts.push(`Subdivisión: ${subdivName}`);
      }
      if (filterDim5.length > 0) {
        const d5Name = dimension5s?.find(d => String(d.id) === String(dim5) || d.nombre === dim5)?.nombre || dim5 || 'Sin Dim 5';
        keyParts.push(`Dim 5: ${d5Name}`);
      }
      
      const key = keyParts.length > 0 ? keyParts.join(' | ') : 'Otros';
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    
    return Object.keys(groups).sort().map(key => ({
      title: key,
      data: groups[key]
    }));
  }, [data, filterDept, filterArea, filterDiv, filterSubdiv, filterDim5, divisions, areas, departments, subdivisions, dimension5s]);

  const exportExcel = async () => {
    try {
      showToast('Generando Excel de Nómina General...', 'success');
      await exportNominaGeneralExcel({
        employees: data,
        group,
        totals
      });
    } catch (err) {
      console.error(err);
      showToast('No se pudo generar el Excel de Nómina General.', 'error');
    }
  };

  const exportExcelCheques = async () => {
    showToast('Generando Solicitud de Cheques...', 'success');
    const chequesData = data.filter(e => String(e.tipo_de_pago).toLowerCase() === 'cheque');
    if (chequesData.length === 0) {
      showToast('No hay empleados configurados para pago en Cheque.', 'warning');
      return;
    }
    await exportSolicitudChequesExcel({ employees: data, group, companies });
  };

  const exportExcelVerificador = async () => {
    showToast('Generando Verificador de Pago...', 'success');
    await exportVerificadorExcel({ employees: data, group, companies });
  };

  const exportExcelIgss = async () => {
    showToast('Generando Recibo e IGSS...', 'success');
    
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = [];
      comps[compName].push(e);
    });

    const sheets = [];
    
    Object.keys(comps).forEach(compName => {
      const rows = comps[compName].map((e, idx) => {
        const anticipo = e.anticipo1ra || 0;
        const net = getNetTotal(e);
        const netPayable = getNetPayable(e, group.periodType);
        const q1 = group.periodType === '2da' ? anticipo : net;
        const q2 = group.periodType === '2da' ? netPayable : 0;
        // gross ya incluye HE y otros ingresos — no sumar de nuevo
        const totalIngresos = e.calculated.gross;
        const proDed = e.calculated?.proratedDeductions || e.deductions || {};

        return {
          'No.': idx + 1,
          'NOMBRE EN NOMINA': getEmployeeFullName(e),
          'NUMERO DE CUENTA': e.no_cuenta || '',
          'NOMBRE EN BANCO': getEmployeeFullName(e),
          'PUESTO': e.puesto || 'N/A',
          'Dias laborados': e.days ?? 30,
          'Salario ordinario': e.calculated.baseSalary,
          'bono': (Number(e.calculated.bonusLey) || 0)
            + (Number(e.calculated.bonusDec) || 0)
            + (Number(e.calculated.bonos) || 0)
            + getCatalogBonuses(e),
          'horas simples': e.extras?.simplesQty || 0,
          'total  horas simples': e.extras?.simplesVal || 0,
          'horas dobles': e.extras?.doblesQty || 0,
          'total horas dobles': e.extras?.doblesVal || 0,
          'otros ingresos': (e.extras?.otrosIngresos || 0) + (e.extras?.vacacionesVal || 0) + (e.extras?.ventasEconomicas || 0),
          'total ingresos': totalIngresos,
          'igss': proDed.igss || 0,
          'isr': proDed.isr || 0,
          'bantrab': proDed.bancos || 0,
          'prestamo': proDed.prestamo_empresa || 0,
          'celular': proDed.cell || 0,
          'UNIFORME': proDed.uniform || 0,
          'CALZADO': proDed.shoes || 0,
          'CAFETERIA': proDed.cafe || 0,
          'otros egresos': (proDed.otros || 0) + (proDed.judiciales || 0) + (proDed.seguro || 0) + (proDed.parqueo || 0) + (proDed.boleto_de_ornato || 0) + (proDed.otros_egresos || 0),
          'total egresos': e.calculated.ded,
          'LIQUIDO A RECIBIR': net,
          'PRIMERA QUINCENA': q1,
          'SEGUNDA QUINCENA': q2,
          'NUMERO DE AFILIACION': e.no_igss || '',
          'SALARIO AFECTO A IGSS': e.calculated.baseSalary
        };
      });
      
      let sheetName = compName.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      if (!sheetName) sheetName = "Empresa";
      sheets.push({ name: sheetName, rows, mode: 'json' });
    });

    await downloadWorkbookReport(
      sheets,
      `Recibo_IGSS_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`
    );
  };

  const exportExcelLibroSalarios = async () => {
    showToast('Generando Libro de Salarios...', 'success');
    
    // Agrupar por empresa para hojas separadas (opcional, o todo junto)
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = [];
      comps[compName].push(e);
    });

    const sheets = [];

    Object.keys(comps).forEach(compName => {
      let counter = 1;
      const rows = comps[compName].map(e => {
        const calculated = e.calculated;
        const proDed = calculated.proratedDeductions || e.deductions || {};
        const base = Number(e.sueldo_ordinario) || 0;
        const devengado = Number(calculated.baseSalary) || 0;
        const isr = Number(proDed.isr) || 0;
        const igss = Number(proDed.igss) || 0;
        const bono = (Number(calculated.bonusLey) || 0)
          + (Number(calculated.bonusDec) || 0)
          + (Number(calculated.bonos) || 0)
          + getCatalogBonuses(e);
        const payrollDeductions = Number(calculated.ded) || 0;
        const otherDed = Math.max(0, payrollDeductions - igss - isr);
        const totalDed = payrollDeductions;
        const totalDev = Number(calculated.gross) || 0;
        const horasExtra = (Number(e.extras?.simplesVal) || 0) + (Number(e.extras?.doblesVal) || 0);
        const days = e.days ?? 30;

        return {
          'No.': counter++,
          'Nombre Completo': getEmployeeFullName(e),
          'Puesto / Ocupación': e.puesto || '',
          'Sueldo Ordinario Base': base,
          'Días Trabajados': days,
          'Sueldo Devengado': devengado,
          'Horas Extras': horasExtra,
          'Bonificación Incentivo': bono,
          'Total Devengado': totalDev,
          'Descuento IGSS': igss,
          'Descuento ISR': isr,
          'Otros Descuentos': otherDed,
          'Total Descuentos': totalDed,
          'Sueldo Líquido a Recibir': getNetTotal(e),
          'Firma del Empleado': '_______________________'
        };
      });

      let sheetName = compName.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      if (!sheetName) sheetName = "Empresa";
      sheets.push({
        name: sheetName,
        rows,
        mode: 'json',
        columnWidths: [5, 35, 20, 15, 12, 15, 15, 15, 15, 15, 15, 15, 15, 18, 30]
      });
    });

    await downloadWorkbookReport(
      sheets,
      `Libro_Salarios_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`
    );
  };

  const cleanName = (name) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, "").toUpperCase();
  const getConcept = () => `pago salario de ${group.periodType === '2da' ? '2DA' : '1RA'} quincena ${group.title.replace(/[^a-zA-Z0-9 ]/g, '')}`;

  const exportPlantillaPromerica = async () => {
    showToast('Generando Plantilla Promerica...', 'success');
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = [];
      comps[compName].push(e);
    });

    const sheets = [];

    Object.keys(comps).forEach(compName => {
      const aoa = [];
      const concepto = getConcept();
      let totalPlantilla = 0;
      let totalCheques = 0;
      
      const transfers = comps[compName].filter(e => String(e.tipo_de_pago).toLowerCase() !== 'cheque');
      const cheques = comps[compName].filter(e => String(e.tipo_de_pago).toLowerCase() === 'cheque');

      transfers.forEach(e => {
        const net = getNetPayable(e, group.periodType);
        totalPlantilla += net;
        aoa.push([
          e.numero_cuenta || '',
          cleanName(getEmployeeFullName(e)),
          net.toFixed(2),
          concepto
        ]);
      });

      aoa.push(['', '', '']); // empty row
      aoa.push(['', 'Total Plantilla de ' + compName.toUpperCase(), totalPlantilla.toFixed(2), '']);
      aoa.push(['', '', '']); // empty row

      if (cheques.length > 0) {
        cheques.forEach(e => {
          const net = getNetPayable(e, group.periodType);
          totalCheques += net;
          aoa.push([
            'CHEQUE',
            cleanName(getEmployeeFullName(e)),
            net.toFixed(2),
            concepto
          ]);
        });
        aoa.push(['', '', '']);
        aoa.push(['', 'Total Cheques', totalCheques.toFixed(2), '']);
      }
      
      aoa.push(['', '', '']);
      aoa.push(['', 'Total Nómina', (totalPlantilla + totalCheques).toFixed(2), '']);

      let sheetName = compName.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      if (!sheetName) sheetName = "Empresa";
      sheets.push({
        name: sheetName,
        rows: aoa,
        mode: 'aoa',
        columnWidths: [20, 40, 15, 50]
      });
    });

    await downloadWorkbookReport(
      sheets,
      `Plantilla_Promerica_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`
    );
  };

  const exportPlantillaIndustrial = async () => {
    showToast('Generando Plantilla Industrial...', 'success');
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = [];
      comps[compName].push(e);
    });

    const sheets = [];

    Object.keys(comps).forEach(compName => {
      const aoa = [];
      const concepto = getConcept();
      let totalPlantilla = 0;
      let totalCheques = 0;
      let correlativo = 1;
      
      const transfers = comps[compName].filter(e => String(e.tipo_de_pago).toLowerCase() !== 'cheque');
      const cheques = comps[compName].filter(e => String(e.tipo_de_pago).toLowerCase() === 'cheque');

      transfers.forEach(e => {
        const net = getNetPayable(e, group.periodType);
        totalPlantilla += net;
        const ind = e.tipo_cuenta?.toLowerCase() === 'ahorro' ? 2 : 1;
        aoa.push([
          ind,
          e.numero_cuenta || '',
          correlativo++,
          cleanName(getEmployeeFullName(e)),
          net.toFixed(2),
          concepto
        ]);
      });

      aoa.push(['', '', '', '', '']); // empty row
      aoa.push(['', '', 'TOTAL PLANTILLA', totalPlantilla.toFixed(2), '']);
      aoa.push(['', '', '', '', '']); // empty row

      if (cheques.length > 0) {
        cheques.forEach(e => {
          const net = getNetPayable(e, group.periodType);
          totalCheques += net;
          aoa.push([
            1, // Assuming 1 for checks
            'CHEQUE',
            correlativo++,
            cleanName(getEmployeeFullName(e)),
            net.toFixed(2),
            concepto
          ]);
        });
        aoa.push(['', '', '', '', '']);
        aoa.push(['', '', 'TOTAL CHEQUES', totalCheques.toFixed(2), '']);
      }
      
      aoa.push(['', '', '', '', '']);
      aoa.push(['', '', 'Total Nómina', (totalPlantilla + totalCheques).toFixed(2), '']);

      let sheetName = compName.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      if (!sheetName) sheetName = "Empresa";
      sheets.push({
        name: sheetName,
        rows: aoa,
        mode: 'aoa',
        columnWidths: [5, 20, 10, 40, 15, 50]
      });
    });

    await downloadWorkbookReport(
      sheets,
      `Plantilla_Industrial_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`
    );
  };

  const exportPDF = async () => {
    showToast('Generando PDF...', 'success');
    const element = document.getElementById('voucher-content');
    if (!element) return;
    
    try {
      const canvas = await (await getHtml2Canvas())(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new (await getJsPDF())('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Boleta_${getEmployeeFullName(selectedVoucherEmp).replace(/[^a-z0-9]/gi, '_')}.pdf`);
    } catch (err) {
      showToast('Error al generar PDF', 'error');
    }
  };

  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const theadBg = useColorModeValue('gray.100', 'gray.900');
  const tdBg = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  if (loadingDetail) {
    return (
      <Box p={{ base: 3, md: 6, lg: 8 }}>
        <Flex align="center" gap={4} mb={6}>
          <IconButton aria-label="Back" icon={<ArrowLeft size={20} />} onClick={onBack} variant="ghost" />
          <Text color="gray.500">Cargando detalle de nómina...</Text>
        </Flex>
        <Skeleton height="420px" borderRadius="xl" />
      </Box>
    );
  }

  const payrollGroup = activeGroup;

  const handleApprovePayroll = () => {
    const payrollId = resolveGroupPayrollId(group);
    if (!payrollId) {
      showToast('No se encontró el ID de la nómina', 'error');
      return;
    }
    confirmAction('¿Aprobar esta nómina y devolverla a borradores para su cierre final?', async () => {
      try {
        await auditorApprovePayroll(payrollId);
        showToast('Nómina aprobada correctamente', 'success');
        onBack();
      } catch {
        showToast('Error al aprobar la nómina', 'error');
      }
    });
  };

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }} sx={{ '@media print': { p: 0 } }}>
      {/* Screen-only content */}
      <Box sx={{ '@media print': { display: 'none' } }}>
      {/* Header */}
      <Flex justify="space-between" align={{ base: 'stretch', md: 'flex-start' }} direction={{ base: 'column', md: 'row' }} mb={6} wrap="wrap" gap={4}>
        <Flex align="flex-start" gap={4}>
          <IconButton aria-label="Back" icon={<ArrowLeft size={20} />} onClick={onBack} variant="ghost" />
          <Box>
            <Flex align="center" gap={{ base: 2, md: 3 }} flexWrap="wrap">
              <Heading size={{ base: 'sm', md: 'md' }} fontWeight={800}>{group.title}</Heading>
              <Badge colorScheme={group.status === 'auditoria' ? 'orange' : 'gray'} variant="subtle" fontWeight={700}>
                {group.status === 'auditoria' ? 'En Auditoría' : 'Cerrada'}
              </Badge>
              <Badge colorScheme={group.periodType === '2da' ? 'purple' : 'teal'} variant="subtle" fontWeight={700}>
                {group.periodType === '2da' ? '2da Quincena' : '1ra Quincena'}
              </Badge>
            </Flex>
            <Text fontSize="sm" color="gray.500">
              {data.length} empleados procesados en este periodo
            </Text>
            {group.notes && (
              <Box mt={2} p={3} bg={useColorModeValue('brand.50', 'brand.900')} borderRadius="md" borderLeft="4px solid" borderColor="brand.500">
                <Text fontSize="xs" fontWeight="bold" color="brand.600" textTransform="uppercase" mb={1}>Notas / Observaciones</Text>
                <Text fontSize="sm" color={useColorModeValue('gray.700', 'gray.300')} whiteSpace="pre-wrap">{group.notes}</Text>
              </Box>
            )}
          </Box>
        </Flex>
        <Flex gap={2} wrap="wrap">
          {group.status === 'auditoria' && canAuditPayroll(user?.role) && (
            <>
              <Button colorScheme="green" onClick={handleApprovePayroll} size={{ base: 'sm', md: 'md' }}>
                Aprobar Nómina
              </Button>
              <Button colorScheme="red" variant="outline" onClick={() => setIsRejectModalOpen(true)} size={{ base: 'sm', md: 'md' }}>
                Corregir Nómina
              </Button>
            </>
          )}
          <Menu>
            <MenuButton as={Button} colorScheme="green" leftIcon={<Download size={16} />} rightIcon={<ChevronDown size={16} />} size={{ base: 'sm', md: 'md' }}>
              <Text display={{ base: 'none', sm: 'inline' }}>Exportar Excel</Text>
              <Text display={{ base: 'inline', sm: 'none' }}>Excel</Text>
            </MenuButton>
            <MenuList zIndex={50} shadow="lg">
              <MenuItem onClick={exportExcel}>Nómina General</MenuItem>
              <MenuItem onClick={exportExcelCheques}>Sol. Cheques</MenuItem>
              <MenuItem onClick={exportExcelVerificador}>Verificador de Pagos</MenuItem>
              <MenuItem onClick={exportExcelIgss}>Recibo e IGSS</MenuItem>
              <MenuItem onClick={exportExcelLibroSalarios} fontWeight="bold" color="purple.500">Libro de Salarios</MenuItem>
              <Divider my={1} />
              <MenuItem onClick={exportPlantillaPromerica} color="green.600" fontWeight="bold">Plantilla Banco Promerica</MenuItem>
              <MenuItem onClick={exportPlantillaIndustrial} color="blue.600" fontWeight="bold">Plantilla Banco Industrial</MenuItem>
            </MenuList>
          </Menu>
          <Menu>
            <MenuButton as={Button} colorScheme="red" leftIcon={<FileText size={16} />} rightIcon={<ChevronDown size={16} />} size={{ base: 'sm', md: 'md' }}>
              <Text display={{ base: 'none', sm: 'inline' }}>Reportería PDF</Text>
              <Text display={{ base: 'inline', sm: 'none' }}>PDF</Text>
            </MenuButton>
            <MenuList zIndex={50} shadow="lg">
              <MenuItem onClick={() => handleOpenPreview('verificador')} fontWeight="bold">Verificador de Pago</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('cheques')}>Solicitud de Cheques</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('nomina')}>Nómina General</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('igss')}>Recibo e IGSS</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('libro')} color="purple.500" fontWeight="bold">Libro de Salarios</MenuItem>
              <Divider my={1} />
              <MenuItem onClick={() => handleOpenPreview('promerica')} color="green.600" fontWeight="bold">Plantilla Banco Promerica</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('industrial')} color="blue.600" fontWeight="bold">Plantilla Banco Industrial</MenuItem>
            </MenuList>
          </Menu>
          <Button colorScheme="purple" leftIcon={<FileText size={16} />} onClick={handlePrintBoletas} size={{ base: 'sm', md: 'md' }}>
            Imprimir Boletas (PDF)
          </Button>
        </Flex>
      </Flex>

      {/* Filters bar */}
      <Flex gap={{ base: 2, md: 4 }} wrap="wrap" mb={4} align={{ base: 'stretch', md: 'center' }} justify="space-between" direction={{ base: 'column', md: 'row' }}>
        <HStack spacing={{ base: 2, md: 3 }} wrap="wrap" flex="1">
          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterDept.length > 0 ? `${filterDept.length} Deptos...` : 'Departamento...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterDept} onChange={(v) => setFilterDept(normalizeMultiFilter(v))}>
                {(departments || []).map(d => (
                  <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre_dimension}</MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>

          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterArea.length > 0 ? `${filterArea.length} Áreas...` : 'Área...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterArea} onChange={setFilterArea}>
                {(areas || []).map(a => (
                  <MenuItemOption key={a.id} value={String(a.id)} fontSize="sm">{a.nombre}</MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>

          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterDiv.length > 0 ? `${filterDiv.length} Divisiones...` : 'División...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterDiv} onChange={setFilterDiv}>
                {(divisions || []).map(d => (
                  <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre}</MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>

          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterSubdiv.length > 0 ? `${filterSubdiv.length} Subdiv...` : 'Subdivisión...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterSubdiv} onChange={setFilterSubdiv}>
                {(subdivisions || []).map(s => (
                  <MenuItemOption key={s.id} value={String(s.id)} fontSize="sm">{s.nombre}</MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>

          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterDim5.length > 0 ? `${filterDim5.length} Dim 5...` : 'Dimensión 5...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterDim5} onChange={setFilterDim5}>
                {(dimension5s || []).map(d => (
                  <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre}</MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>
          
          <Select 
            placeholder="Estado..." 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            w={{ base: '100%', sm: '120px' }}
            size="sm"
            borderRadius="md"
          >
            <option value="ALL">Todos</option>
            <option value="Activo">Activo</option>
            <option value="De Baja">De Baja</option>
          </Select>
          <Tooltip label={filterArea.length === areas.length ? 'Quitar agrupación por área' : 'Agrupar todos los empleados por su área'} hasArrow>
            <Button 
              size="sm" 
              variant={filterArea.length === areas.length ? 'solid' : 'outline'}
              colorScheme="brand"
              borderRadius="md"
              leftIcon={<LayoutGrid size={14} />}
              onClick={() => {
                if (filterArea.length === areas.length) {
                  setFilterArea([]);
                } else {
                  setFilterArea(areas.map(a => String(a.id)));
                }
              }}
            >
              Por Área
            </Button>
          </Tooltip>
        </HStack>

        <HStack maxW={{ base: '100%', lg: '600px' }} spacing={{ base: 2, md: 3 }} w={{ base: '100%', md: 'auto' }} flexWrap={{ base: 'wrap', lg: 'nowrap' }}>
          <InputGroup size="sm" w={{ base: '100%', lg: '300px' }}>
            <InputLeftElement pointerEvents="none">
              <Search size={14} color="gray.400" />
            </InputLeftElement>
            <Input 
              placeholder="Buscar por nombre o puesto..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              bg={tdBg}
              borderRadius="md"
            />
          </InputGroup>
          <ButtonGroup size="sm" isAttached variant="outline">
            <Button 
              isActive={viewMode === 'summary'} 
              onClick={() => setViewMode('summary')}
              bg={viewMode === 'summary' ? 'brand.500' : tdBg}
              color={viewMode === 'summary' ? 'white' : 'inherit'}
              _hover={{ bg: viewMode === 'summary' ? 'brand.600' : hoverBg }}
            >
              Vista Resumen
            </Button>
            <Button 
              isActive={viewMode === 'detailed'} 
              onClick={() => setViewMode('detailed')}
              bg={viewMode === 'detailed' ? 'brand.500' : tdBg}
              color={viewMode === 'detailed' ? 'white' : 'inherit'}
              _hover={{ bg: viewMode === 'detailed' ? 'brand.600' : hoverBg }}
            >
              Vista Detallada
            </Button>
          </ButtonGroup>
        </HStack>
      </Flex>

      {/* Summary strip */}
      <Flex 
        p={{ base: 4, md: 6 }} 
        mb={6} 
        borderRadius="xl" 
        border="1px solid" 
        borderColor={borderColor} 
        gap={{ base: 4, md: 8 }} 
        direction={{ base: 'column', sm: 'row' }}
        wrap="wrap" 
        align={{ base: 'stretch', sm: 'center' }}
        bg={tdBg}
      >
        <SummaryStat label="Costo Bruto Total" value={formatQ(totals.grossTotal)} />
        <Divider orientation="vertical" h="40px" />
        <SummaryStat label="Deducciones Totales" value={formatQ(totals.dedTotal)} color="red.500" />
        <Divider orientation="vertical" h="40px" />
        <SummaryStat label="Cuota Patronal Estimada" value={formatQ(totals.patronalTotal)} color="orange.400" />
        <Divider orientation="vertical" h="40px" />
        <SummaryStat label="Desembolso Neto" value={formatQ(totals.netTotal)} color="brand.500" large />
      </Flex>

      {/* Spreadsheet Table (Read-Only) */}
      <Heading size="xs" color="gray.500" textTransform="uppercase" mb={3} letterSpacing="wider">
        Desglose Completo de Pagos
      </Heading>

      {groupedData.map((groupData, gIdx) => {
        const groupTotals = calculateGroupTotals(groupData.data, payrollGroup.periodType);
        const usePagination = groupedData.length === 1 && !groupData.title;
        const displayRows = usePagination ? tablePagination.paginatedData : groupData.data;
        const rowOffset = usePagination ? (tablePagination.currentPage - 1) * tablePagination.limit : 0;
        return (
          <Box key={gIdx} mb={8}>
            {groupData.title && (
              <Flex align="center" justify="space-between" mb={3} p={3} bg="blue.50" _dark={{ bg: 'blue.900' }} borderRadius="md" borderLeft="4px solid" borderColor="brand.500">
                <Heading size="sm" color="brand.700" _dark={{ color: 'brand.200' }}>{groupData.title}</Heading>
                <Badge colorScheme="blue" variant="solid">{groupData.data.length} Empleados</Badge>
              </Flex>
            )}
            <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" overflowY="auto" bg={tdBg} maxH="550px">
        <Table variant="simple" size="sm" layout="fixed" style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content' }}>
          <Thead position="sticky" top={0} zIndex={15}>
            <Tr bg={theadBg}>
              <Th minW="60px" w="60px" position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">No.</Th>
              <Th minW="200px" w="200px" position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Nombre Empleado</Th>
              <Th minW="120px" w="120px" position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Empresa</Th>
              <Th minW="120px" w="120px" position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="10px">Puesto</Th>
              
              <Th minW="75px" w="75px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Días Lab.</Th>
              <Th minW="120px" w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">S. Ordinario</Th>
              {viewMode === 'detailed' && (
                <>
                  <Th minW="120px" w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bon. Incentivo</Th>
                  <Th minW="140px" w="140px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bono Dec. 37-2001</Th>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bonos</Th>
                  <Th minW="120px" w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">T. Devengado</Th>
                  <Th minW="80px" w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Simples</Th>
                  <Th minW="110px" w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Simp</Th>
                  <Th minW="80px" w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Dobles</Th>
                  <Th minW="110px" w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Dobl</Th>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Otros Ingr.</Th>
                </>
              )}
              <Th minW="130px" w="130px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="gold.500">Salario Total</Th>
              
              {viewMode === 'detailed' && (
                <>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">IGSS</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">ISR</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Cafetería</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Celular</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Uniforme</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Calzado</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Equipo</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Producto</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Bantrab</Th>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Préstamo</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Otros</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Judiciales</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Seguro</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Parqueo</Th>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Bol. Ornato</Th>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Otros Egr.</Th>
                </>
            
              )}
              <Th minW="130px" w="130px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.500">Total Egresos</Th>
              
              <Th minW="120px" w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">Liquido a Recibir</Th>
              {group.periodType === '2da' && (
                <>
                  <Th minW="110px" w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">1ra Quincena</Th>
                  <Th minW="110px" w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">2da Quincena</Th>
                </>
              )}
              <Th minW="80px" w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" textAlign="center">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {displayRows.map((e, idx) => {
              const { baseSalary, bonusLey, bonusDec, bonos, gross, ded } = e.calculated || {};
              const bonosTotal = (bonos || 0) + getCatalogBonuses(e);
              const tDevengado = (baseSalary || 0) + (bonusLey || 0) + (bonusDec || 0) + bonosTotal;
              const proDed = e.calculated?.proratedDeductions || e.deductions || {};
              const anticipo = e.anticipo1ra || 0;
              const is2da = payrollGroup.periodType === '2da';
              const liquido = getNetTotal(e);
              const q1 = is2da ? anticipo : liquido;
              const liquidoPagar = getNetPayable(e, payrollGroup.periodType);
              const q2 = is2da ? liquidoPagar : 0;
              const otrosIngresosShow = (Number(e.extras?.otrosIngresos) || 0)
                + (Number(e.extras?.vacacionesVal) || 0)
                + (Number(e.extras?.ventasEconomicas) || 0);

              return (
                <Tr key={e.id + '-' + idx} _hover={{ bg: hoverBg }}>
                  <Td position="sticky" left={0} zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontWeight="bold" fontSize="xs">
                    {rowOffset + idx + 1}
                  </Td>
                  <Td position="sticky" left="60px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontWeight="600" color="brand.500" fontSize="xs" isTruncated maxW="200px">
                    {getEmployeeFullName(e)}
                  </Td>
                  <Td position="sticky" left="260px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontSize="xs" isTruncated maxW="120px">
                    {e.company || 'Sin empresa'}
                  </Td>
                  <Td position="sticky" left="380px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="xs" isTruncated maxW="120px">
                    {e.puesto || 'Sin Puesto'}
                  </Td>

                  <Td fontSize="xs">{e.days ?? 30}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(baseSalary)}</Td>
                  {viewMode === 'detailed' && (
                    <>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(bonusLey)}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(bonusDec)}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(bonosTotal)}</Td>
                      <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(tDevengado)}</Td>
                      
                      <Td fontSize="xs">{e.extras?.simplesQty || 0}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(e.extras?.simplesVal || 0)}</Td>
                      <Td fontSize="xs">{e.extras?.doblesQty || 0}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(e.extras?.doblesVal || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(otrosIngresosShow)}</Td>
                    </>
                  )}
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(gross)}</Td>

                  {viewMode === 'detailed' && (
                    <>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.igss) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.isr) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.cafe) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.cell) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.uniform) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.shoes) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.equipo) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.product) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.bancos) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.prestamo_empresa) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.otros) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.judiciales) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.seguro) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.parqueo) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.boleto_de_ornato) || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(Number(proDed.otros_egresos) || 0)}</Td>
                    </>
                  )}
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(ded)}</Td>
                  
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(liquido)}</Td>
                  {is2da && (
                    <>
                      <Td fontFamily="mono" fontSize="xs" color="gray.500">{formatQ(q1)}</Td>
                      <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="green.500">{formatQ(q2)}</Td>
                    </>
                  )}
                  
                  <Td textAlign="center">
                    <HStack spacing={1} justify="center">
                      <IconButton 
                        aria-label="Ver Resumen" 
                        icon={<Eye size={15} />} 
                        size="xs" 
                        colorScheme="gray" 
                        variant="ghost"
                        title="Ver detalle de pago"
                        onClick={() => setSelectedSummaryEmp(e)} 
                      />
                      <IconButton 
                        aria-label="Ver Boleta" 
                        icon={<FileText size={15} />} 
                        size="xs" 
                        colorScheme="brand" 
                        variant="ghost"
                        title="Ver boleta de pago"
                        onClick={() => setSelectedVoucherEmp(e)} 
                      />
                    </HStack>
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
          {/* Footer totals */}
          <Thead position="sticky" bottom={0} zIndex={15} bg={theadBg}>
            <Tr borderTop="2px solid" borderColor="brand.500">
              <Th position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}>TOTAL</Th>
              <Th position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}>CONSOLIDADO</Th>
              <Th position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}></Th>
              <Th position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)"></Th>
              
              <Th>{groupData.data.length} Empleados</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totSalarioOrd)}</Th>
              {viewMode === 'detailed' && (
                <>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totBonInc)}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totBonDec)}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totBonos)}</Th>
                  <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(groupTotals.totDevengado)}</Th>
                  
                  <Th>{groupTotals.totHorasSimples}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totValSimple)}</Th>
                  <Th>{groupTotals.totHorasDobles}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totValDouble)}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totOtrosIngresos)}</Th>
                </>
              )}
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(groupTotals.totSalarioTotal)}</Th>
              
              {viewMode === 'detailed' && (
                <>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totIgss)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totIsr)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totCafe)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totCell)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totUniform)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totShoes)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totEquipo)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totProduct)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totBancos)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totPrestamo)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totOtros)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totJudiciales)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totSeguro)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totParqueo)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totBoleta)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totOtrosEgresos)}</Th>
                </>
              )}
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(groupTotals.totTotalEgresos)}</Th>
              
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(groupTotals.totLiquido)}</Th>
              {group.periodType === '2da' && (
                <>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totQuincena1)}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totQuincena2)}</Th>

                </>
              )}
              <Th></Th>
            </Tr>
          </Thead>
        </Table>
        </Box>
        {usePagination && (
          <Box mt={3}>
            <Pagination
              currentPage={tablePagination.currentPage}
              totalPages={tablePagination.totalPages}
              totalItems={tablePagination.totalItems}
              limit={tablePagination.limit}
              goToNextPage={tablePagination.goToNextPage}
              goToPreviousPage={tablePagination.goToPreviousPage}
              changeLimit={tablePagination.changeLimit}
            />
          </Box>
        )}
          </Box>
        );
      })}

      {/* Voucher slip display Modal */}
      {selectedVoucherEmp && (
        <Modal isOpen={!!selectedVoucherEmp} onClose={() => setSelectedVoucherEmp(null)} size={{ base: 'full', md: 'xl' }}>
          <ModalOverlay />
          <ModalContent borderRadius="xl">
            <ModalHeader fontWeight={800} borderBottom="1px solid" borderColor={borderColor}>
              Boleta de Pago
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody p={0} bg="white">
              {/* Captured printable voucher container */}
              <Box id="voucher-content" p={{ base: 4, md: 8 }}>
                <BoletaTemplate emp={selectedVoucherEmp} group={group} companies={companies} />
              </Box>
            </ModalBody>
            <ModalFooter bg={tdBg} borderTop="1px solid" borderColor={borderColor}>
              <Button variant="ghost" mr={3} onClick={() => setSelectedVoucherEmp(null)}>Cerrar</Button>
              <Button colorScheme="brand" leftIcon={<FileText size={16} />} onClick={exportPDF}>
                Descargar PDF boleta
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      </Box>

      {/* Hidden Print Container for Bulk Export */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 6mm; }
        }
      `}</style>
      {printBoletas && (
      <Box display="none" sx={{ '@media print': { display: 'block', bg: 'white', color: 'black' } }}>
        {(() => {
          const allPrintableEmployees = data;
          if (allPrintableEmployees.length === 0) return null;
          const chunks = [];
          for (let i = 0; i < allPrintableEmployees.length; i += 2) {
            chunks.push(allPrintableEmployees.slice(i, i + 2));
          }
          return chunks.map((chunk, idx) => (
            <Box 
              key={`page-${idx}`}
              sx={{
                pageBreakAfter: idx === chunks.length - 1 ? 'auto' : 'always',
                pageBreakInside: 'avoid',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                gap: '4px',
                p: 0,
              }}
            >
              {/* Top Half: Employee 1 — 2 identical copies side by side */}
              <Flex gap="10px" w="100%" flex="1" maxH="46%" pt="15px">
                <Box flex={1} border="1px solid #ccc" p="6px" overflow="hidden"><BoletaTemplate emp={chunk[0]} group={group} companies={companies} isPrint /></Box>
                <Box flex={1} border="1px solid #ccc" p="6px" overflow="hidden"><BoletaTemplate emp={chunk[0]} group={group} companies={companies} isPrint /></Box>
              </Flex>

              {/* Dashed cut line */}
              <Box sx={{ borderTop: '2px dashed #999', mx: 0, my: '25px', opacity: 0.5 }} />

              {/* Bottom Half: Employee 2 (if exists) */}
              {chunk[1] ? (
                <Flex gap="10px" w="100%" flex="1" maxH="46%" pb="15px">
                  <Box flex={1} border="1px solid #ccc" p="6px" overflow="hidden"><BoletaTemplate emp={chunk[1]} group={group} companies={companies} isPrint /></Box>
                  <Box flex={1} border="1px solid #ccc" p="6px" overflow="hidden"><BoletaTemplate emp={chunk[1]} group={group} companies={companies} isPrint /></Box>
                </Flex>
              ) : (
                <Flex gap="10px" w="100%" flex="1" maxH="46%" opacity={0}></Flex>
              )}
            </Box>
          ));
        })()}
      </Box>
      )}

      <ReportPreviewModal 
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        reportType={previewReportType}
        group={payrollGroup}
        data={data}
        companies={companies}
        areas={areas}
      />
      <EmployeeSummaryModal
        isOpen={!!selectedSummaryEmp}
        onClose={() => setSelectedSummaryEmp(null)}
        employee={selectedSummaryEmp}
        companies={companies}
        periodType={payrollGroup?.periodType || '1ra'}
      />

      <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color="red.500">Enviar a Corrección</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4} fontSize="sm" color="gray.600">
              Por favor, detalla qué es lo que está incorrecto en esta nómina. El operador de nóminas verá esta justificación y podrá editarla.
            </Text>
            <Textarea 
              placeholder="Ej. El bono del empleado X está mal calculado..." 
              value={rejectNote} 
              onChange={e => setRejectNote(e.target.value)} 
              rows={4}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)} mr={3}>Cancelar</Button>
            <Button colorScheme="red" isLoading={isRejecting} onClick={async () => {
              if (!rejectNote.trim()) return showToast('Debes ingresar una justificación', 'error');
              setIsRejecting(true);
              try {
                await auditorRejectPayroll(resolveGroupPayrollId(group), rejectNote);
                showToast('Nómina rebotada a borradores exitosamente', 'success');
                setIsRejectModalOpen(false);
                onBack();
              } catch (e) {
                showToast('Error al enviar a corrección', 'error');
              } finally {
                setIsRejecting(false);
              }
            }}>
              Confirmar Rechazo
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
}

function BoletaTemplate({ emp, group, isPrint, companies }) {
  if (!emp) return null;

  const fullName = getEmployeeFullName(emp);
  const puesto = emp.puesto || 'N/A';
  const companyObj = companies?.find(c => c.id == emp.empresa_principal);
  const companyName = companyObj?.nombre_comercial || emp.company || 'EMPRESA';
  const companySubtitle = companyObj?.razon_social || '';
  const companyNit = companyObj?.nit ? `NIT: ${companyObj.nit}` : '';
  const periodo = group?.title || 'PERÍODO';
  const fechaPago = group?.date ? new Date(group.date).toLocaleDateString('es-GT') : new Date().toLocaleDateString('es-GT');

  const days = emp.days ?? 30;
  const baseSalary = emp.calculated?.baseSalary || 0;
  const bonusLey = emp.calculated?.bonusLey || 0;
  const bonusDec = emp.calculated?.bonusDec || 0;
  const bonos = (Number(emp.calculated?.bonos) || 0) + getCatalogBonuses(emp);
  const simplesQty = emp.extras?.simplesQty || 0;
  const simplesVal = emp.extras?.simplesVal || 0;
  const doblesQty = emp.extras?.doblesQty || 0;
  const doblesVal = emp.extras?.doblesVal || 0;
  const otrosIngresos = (Number(emp.extras?.otrosIngresos) || 0)
    + (Number(emp.extras?.comisiones) || 0);
  const gross = emp.calculated?.gross || 0;

  const proDedBoleta = emp.calculated?.proratedDeductions || emp.deductions || {};
  const igss = Number(proDedBoleta.igss) || 0;
  const bancos = Number(proDedBoleta.bancos) || 0;
  const prestamoBoleta = Number(proDedBoleta.prestamo_empresa) || 0;
  const isr = Number(proDedBoleta.isr) || 0;
  const cell = Number(proDedBoleta.cell) || 0;
  const anticipo = Number(emp.anticipo1ra) || 0;
  const otrosDesc = (Number(proDedBoleta.cafe) || 0) + (Number(proDedBoleta.uniform) || 0) +
    (Number(proDedBoleta.shoes) || 0) + (Number(proDedBoleta.equipo) || 0) +
    (Number(proDedBoleta.product) || 0) + (Number(proDedBoleta.otros) || 0) +
    (Number(proDedBoleta.judiciales) || 0) + (Number(proDedBoleta.seguro) || 0) +
    (Number(proDedBoleta.parqueo) || 0) + (Number(proDedBoleta.boleto_de_ornato) || 0) +
    prestamoBoleta;
  const net = getNetTotal(emp);
  const pagoQuincena = getNetPayable(emp, group?.periodType);

  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00');

  const IRow = ({ label, value }) => (
    <Flex justify="space-between" align="baseline" py="3.5px" borderBottom="1px dotted" borderColor="gray.100">
      <Text fontSize="7.5px" color="gray.700">{label}</Text>
      <Text fontSize="7.5px" fontFamily="mono" fontWeight="600" color="gray.900">{value}</Text>
    </Flex>
  );

  const DRow = ({ label, value }) => (
    <Flex justify="space-between" align="baseline" py="3.5px" borderBottom="1px dotted" borderColor="gray.100">
      <Text fontSize="7.5px" color="gray.700">{label}</Text>
      <Text fontSize="7.5px" fontFamily="mono" fontWeight="600" color="red.700">{value}</Text>
    </Flex>
  );

  return (
    // h="100%" + display="flex" + flexDirection="column" makes footer stick to bottom
    // eliminating blank white space below the signature
    <Box
      w="100%"
      h="100%"
      display="flex"
      flexDirection="column"
      fontFamily="'Arial', sans-serif"
      bg="white"
      color="black"
      fontSize="8px"
      p={2}
      sx={{ '@media print': { pageBreakInside: 'avoid' } }}
    >
      {/* ── HEADER ─────────────────────────────────────────── */}
      <Flex justify="space-between" align="flex-start" pb={2} mb={2} borderBottom="2px solid black">
        <Box>
          <Text fontSize="15px" fontWeight="900" letterSpacing="tight" lineHeight="1">{companyName.toUpperCase()}</Text>
          {companySubtitle && companySubtitle !== companyName && (
            <Text fontSize="6px" color="gray.500" letterSpacing="widest" mt="1px">{companySubtitle.toUpperCase()}</Text>
          )}
          {companyNit && <Text fontSize="6px" color="gray.400">{companyNit}</Text>}
        </Box>
        <Box textAlign="right">
          <Text fontSize="8px" fontWeight="700" color="gray.700">Recibo de Pago de Sueldos y Salarios</Text>
        </Box>
      </Flex>

      {/* ── EMPLOYEE INFO + EL VALOR ─────────────────────── */}
      <Flex justify="space-between" align="flex-start" mb={2} pb={2} borderBottom="1px solid" borderColor="gray.300">
        <SimpleGrid columns={2} spacing={4} flex="1" mr={4}>
          <Box>
            <Flex gap={2} mb="1px">
              <Text color="gray.500" minW="60px" fontSize="7px">Nombre:</Text>
              <Text fontWeight="bold" fontSize="7px">{fullName}</Text>
            </Flex>
            <Flex gap={2} mb="1px">
              <Text color="gray.500" minW="60px" fontSize="7px">Puesto:</Text>
              <Text fontSize="7px">{puesto}</Text>
            </Flex>
          </Box>
          <Box>
            <Flex gap={2} mb="1px">
              <Text color="gray.500" minW="70px" fontSize="7px">Recibe de:</Text>
              <Text fontWeight="bold" fontSize="7px">{companyName.toUpperCase()}</Text>
            </Flex>
            <Flex gap={2}>
              <Text color="gray.500" minW="70px" fontSize="7px">Por concepto de:</Text>
              <Text fontWeight="bold" fontSize="7px">{periodo.toUpperCase()}</Text>
            </Flex>
          </Box>
        </SimpleGrid>
        <Box textAlign="right" whiteSpace="nowrap">
          <Text fontSize="7px" color="gray.500">Pago de esta quincena:</Text>
          <Text fontSize="11px" fontWeight="900" fontFamily="mono">Q &nbsp;{fmt(pagoQuincena)}</Text>
        </Box>
      </Flex>

      {/* ── MAIN BODY: Two columns side by side ──────────── */}
      {/* flex="1" makes this section grow to fill available space */}
      <SimpleGrid columns={2} spacing={4} flex="1">

        {/* LEFT: (+) Desglose */}
        <Box>
          <Flex justify="space-between" align="center" bg="gray.800" color="white" px={2} py="3px" borderRadius="2px" mb={1}>
            <Text fontWeight="bold" fontSize="7.5px" color="green">(+) DESGLOSE DE INGRESOS</Text>
            <Text fontWeight="bold" fontSize="7.5px">Monto (Q)</Text>
          </Flex>

          <IRow label="Días Laborados en el mes" value={days} />
          <IRow label="Sueldo Devengado" value={fmt(baseSalary)} />
          <IRow label="Bonificación Incentivo Decrs. 37-2001 y 78-89" value={fmt(bonusLey + bonusDec + bonos)} />
          <IRow label={`Horas extras diurnas (${simplesQty} hrs)`} value={fmt(simplesVal)} />
          <IRow label={`Horas extras nocturnas (${doblesQty} hrs)`} value={fmt(doblesVal)} />
          <IRow label="Otros Ingresos Mensuales" value={fmt(otrosIngresos)} />

          <Flex justify="space-between" align="baseline" pt="2px" mt="2px" borderTop="1.5px solid black">
            <Text fontSize="7.5px" fontWeight="bold">TOTAL INGRESOS DE MES</Text>
            <Text fontSize="7.5px" fontFamily="mono" fontWeight="bold">{fmt(gross)}</Text>
          </Flex>
        </Box>

        {/* RIGHT: (-) Descuentos */}
        <Box>
          <Flex justify="space-between" align="center" bg="red.700" color="white" px={2} py="3px" borderRadius="2px" mb={1}>
            <Text fontWeight="bold" fontSize="7.5px"  color="red">(-) DESCUENTOS</Text>
            <Text fontWeight="bold" fontSize="7.5px">Monto (Q)</Text>
          </Flex>

          <DRow label="IGSS Mensual" value={fmt(igss)} />
          <DRow label="Bancos Mensual" value={fmt(bancos)} />
          <DRow label="ISR Mensual" value={fmt(isr)} />
          <DRow label="Celulares" value={fmt(cell)} />
          <DRow label="Otros Egresos Mensuales" value={fmt(otrosDesc)} />
          <DRow label="Primera Quincena (anticipo)" value={fmt(anticipo)} />

          <Flex justify="space-between" align="baseline" pt="2px" mt="2px" borderTop="1.5px solid black">
            <Text fontSize="7.5px" fontWeight="bold" color="black">LÍQUIDO A RECIBIR</Text>
            <Text fontSize="9px" fontFamily="mono" fontWeight="900" color="black">{fmt(net)}</Text>
          </Flex>
        </Box>

      </SimpleGrid>

      {/* ── FOOTER — mt="auto" pushes it to bottom, no blank space ── */}
      <Flex justify="space-between" align="flex-end" pt={2} mt="auto">
        <Box>
          <Box borderBottom="1px solid black" w="180px" />
          <Text fontSize="7px" textAlign="center" mt="1px" fontWeight="600">{fullName}</Text>
        </Box>
        <Text fontSize="7px" color="gray.600">Guatemala, {fechaPago}</Text>
      </Flex>
    </Box>
  );
}


function SummaryStat({ label, value, color, large }) {
  return (
    <Box>
      <Text fontSize={{ base: '2xs', md: 'xs' }} fontWeight={600} color="gray.500" textTransform="uppercase" letterSpacing="0.05em" mb={1}>
        {label}
      </Text>
      <Text fontFamily="mono" fontWeight={800} fontSize={large ? { base: 'xl', md: '2xl' } : { base: 'lg', md: 'xl' }} color={color || 'gold.500'} letterSpacing="-0.02em">
        {value}
      </Text>
    </Box>
  );
}
