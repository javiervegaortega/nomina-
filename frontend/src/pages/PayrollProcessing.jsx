import React, { useState, useMemo, useContext, useEffect } from 'react';
import {
  FileText, Check, X, Edit3, CheckCircle2,
  ChevronRight, ChevronDown, ChevronUp, AlertCircle, DollarSign, Clock,
  Calculator, Building2, Plus, ArrowLeft, Trash2, Calendar, Search, LayoutGrid, List, User, Edit2, Eye, Filter
} from 'lucide-react';
import { AppContext } from '../App';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import { formatQ, calculateMonthlyISR } from '../data/mockData';
import {
  getEmployeePayrollSnapshot,
  getEmployeeBillingCostSnapshot,
  getCuotaLaboralRate,
  getRecurringDeductionFactor
} from '../utils/payrollCalculator';
import {
  getNetPayable,
  inferPeriodTypeFromDate,
  buildPayrollDraftTitle,
  formatLocalDateKey,
  toPayrollDateISO,
  formatPayrollDisplayDate,
  countBlockingOperationalBonuses,
  countApprovedOperationalBonuses
} from '../utils/payrollPeriod';
import EmployeeIncidences from '../components/EmployeeIncidences';
import EmployeeDeductions from '../components/EmployeeDeductions';
import EmployeeSummaryModal from '../components/EmployeeSummaryModal';
import {
  Box, Flex, Text, Heading, Button, SimpleGrid, Avatar, IconButton,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  FormControl, FormLabel, Input, Select, InputGroup, InputLeftElement, Textarea,
  Tabs, TabList, Tab,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  Badge, Divider, useColorModeValue, Center, Tag, HStack, VStack, Checkbox, ButtonGroup, Card, CardHeader, CardBody, CardFooter, Stat, StatLabel, StatNumber, StatGroup, Skeleton, SkeletonText,
  AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, useDisclosure,
  Drawer, DrawerBody, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton, TabPanels, TabPanel, InputRightAddon,
  Menu, MenuButton, MenuList, MenuItemOption, MenuOptionGroup, Tooltip, Collapse, useBreakpointValue
} from '@chakra-ui/react';
import { matchesDepartmentFilter, normalizeMultiFilter, resolveEmployeeDepartment } from '../utils/orgFilters';

const TABS = [
  { id: 'payments', label: 'Listado Pagos', icon: FileText },
  { id: 'distribution', label: 'Distribución de Costos', icon: Building2 },
  { id: 'observations', label: 'Observaciones', icon: Edit3 },
];

/** Resuelve un valor de empresa (id, nombre comercial o NIT) al id numérico/string de BD. */
const resolveCompanyId = (raw, companiesList = []) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const found = companiesList.find((c) =>
    String(c.id) === String(raw)
    || c.nombre_comercial === raw
    || c.nit === raw
  );
  return found ? String(found.id) : null;
};

const getDraftPrimaryCompanyRaw = (draft) => {
  if (!draft) return null;
  if (Array.isArray(draft.companies) && draft.companies.length > 0) return draft.companies[0];
  if (typeof draft.companies === 'string') {
    try {
      const parsed = JSON.parse(draft.companies);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch (_) { /* ignore */ }
  }
  return null;
};

/** ISR mensual: manda la retención del maestro (como en el Excel); fórmula solo de fallback. */
const monthlyIsrOf = (emp) =>
  (emp.isr !== undefined && emp.isr !== null && emp.isr !== '')
    ? (Number(emp.isr) || 0)
    : calculateMonthlyISR(
      Number(emp.sueldo_ordinario) || 0,
      Number(emp.bon_dec_37_2001) || 0,
      getCuotaLaboralRate(emp)
    );

/** ISR acumulado: mitad con <=15 días y total mensual con >15 días. */
const periodIsrOf = (emp, daysWorked, periodType) => {
  const isSecond = periodType === '2da'
    || emp.totalIsr !== undefined
    || emp.isr1ra !== undefined;
  const factor = getRecurringDeductionFactor(daysWorked);
  if (isSecond) {
    const total = (emp.totalIsr !== undefined && emp.totalIsr !== null && emp.totalIsr !== '')
      ? (Number(emp.totalIsr) || 0)
      : monthlyIsrOf(emp);
    return Math.max(0, Number((total * factor).toFixed(2)));
  }
  return Number((monthlyIsrOf(emp) * factor).toFixed(2)) || 0;
};

/** Recalcula solo descuentos que provienen de montos mensuales del maestro. */
const masterRecurringDeductionsOf = (emp, daysWorked) => {
  const factor = getRecurringDeductionFactor(daysWorked);
  const result = {};
  const assign = (key, amount) => {
    const monthly = Number(amount) || 0;
    if (monthly !== 0) result[key] = Number((monthly * factor).toFixed(2));
  };
  assign('bancos', (Number(emp.bantrab) || 0) + (Number(emp.bancos) || 0));
  assign('prestamo_empresa', emp.prestamo_empresa);
  assign('judiciales', emp.judiciales);
  assign('seguro', emp.seguro);
  assign('parqueo', emp.parqueo);
  assign('boleto_de_ornato', emp.boleto_de_ornato);
  assign(
    'otros_egresos',
    (Number(emp.otros_egresos) || 0) + (Number(emp.otro_descuentos) || 0)
  );
  return result;
};

/** Base afecta al IGSS del período: sueldo prorrateado + extras (sin bono decreto/incentivo). */
const igssBaseOf = (emp, baseSalary) => {
  const ex = emp.extras || {};
  return baseSalary
    + (Number(ex.simplesVal) || 0)
    + (Number(ex.doblesVal) || 0)
    + (Number(ex.comisiones) || 0)
    + (Number(ex.otrosIngresos) || 0)
    + (Number(ex.vacacionesVal) || 0)
    + (Number(ex.ventasEconomicas) || 0);
};

export default function PayrollProcessing() {
  const [selectedDraftId, setSelectedDraftId] = useState(null);

  if (selectedDraftId) {
    return <PayrollEditor draftId={selectedDraftId} onBack={() => setSelectedDraftId(null)} />;
  }

  return <PayrollHub onSelectDraft={setSelectedDraftId} />;
}

function PayrollHub({ onSelectDraft }) {
  const { 
    activePayrolls, 
    deleteActivePayroll, 
    createActivePayroll, 
    updateDraftMetadata, 
    companies, 
    dimension5s,
    operationLogs,
    isLoading 
  } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'AUDITOR';
  const [showModal, setShowModal] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [title, setTitle] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [periodType, setPeriodType] = useState('1ra');
  const [notes, setNotes] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [periodTouched, setPeriodTouched] = useState(false);

  const handleCreateOrUpdate = async () => {
    if (!title || !selectedCompany || selectedCompany === 'ALL') return;
    
    const companiesPayload = [selectedCompany];

    if (editingDraftId) {
      try {
        await updateDraftMetadata(editingDraftId, title, companiesPayload, draftDate ? toPayrollDateISO(draftDate) : toPayrollDateISO(), periodType, notes);
        setShowModal(false);
        showToast('Borrador actualizado', 'success');
      } catch (err) {
        showToast(err.message, 'danger');
      }
    } else {
      const selectedCompanyId = resolveCompanyId(selectedCompany, companies);
      const isDuplicate = Boolean(selectedCompanyId) && activePayrolls.some((p) => {
        const draftCompanyId = resolveCompanyId(getDraftPrimaryCompanyRaw(p), companies);
        return draftCompanyId && draftCompanyId === selectedCompanyId;
      });

      const createAction = async () => {
        try {
          const newId = await createActivePayroll(title, companiesPayload, periodType, draftDate ? toPayrollDateISO(draftDate) : toPayrollDateISO(), notes);
          setShowModal(false);
          if (periodType === '2da') {
            showToast('Nómina 2ª creada. Se generó el lote de bonos en Reporte Operativo.', 'success');
          }
          onSelectDraft(newId);
        } catch (err) {
          showToast(err.message, 'danger');
        }
      };

      if (isDuplicate) {
        confirmAction('Ya existe un borrador activo para esta empresa. ¿Deseas crear otro?', createAction);
      } else {
        createAction();
      }
    }
  };

  const openEditModal = (draft) => {
    setEditingDraftId(draft.id);
    setTitle(draft.title || '');
    setPeriodType(draft.periodType || '1ra');
    setDraftDate(draft.createdAt ? formatLocalDateKey(draft.createdAt) : '');
    setNotes(draft.notes || '');
    setTitleTouched(false);
    setPeriodTouched(true);
    
    let comp = '';
    if (Array.isArray(draft.companies) && draft.companies.length > 0) {
      const raw = draft.companies[0];
      const found = companies.find(c =>
        String(c.id) === String(raw) ||
        c.nombre_comercial === raw ||
        c.nit === raw
      );
      comp = found ? (found.nombre_comercial || found.nit) : String(raw);
    } else if (typeof draft.companies === 'string') {
      try { 
        const parsed = JSON.parse(draft.companies); 
        if (parsed.length > 0) {
          const raw = parsed[0];
          const found = companies.find(c =>
            String(c.id) === String(raw) ||
            c.nombre_comercial === raw ||
            c.nit === raw
          );
          comp = found ? (found.nombre_comercial || found.nit) : String(raw);
        }
      } catch(e) {}
    }
    setSelectedCompany(comp);
    setShowModal(true);
  };

  const openCreateModal = () => {
    const today = formatLocalDateKey(new Date());
    const inferredPeriod = inferPeriodTypeFromDate(today);
    setEditingDraftId(null);
    setNotes('');
    setDraftDate(today);
    setSelectedCompany('');
    setPeriodType(inferredPeriod);
    setTitle(buildPayrollDraftTitle(today, inferredPeriod));
    setTitleTouched(false);
    setPeriodTouched(false);
    setShowModal(true);
  };

  const handleDraftDateChange = (value) => {
    setDraftDate(value);
    const nextPeriod = (!editingDraftId && !periodTouched)
      ? inferPeriodTypeFromDate(value)
      : periodType;
    if (!editingDraftId && !periodTouched) {
      setPeriodType(nextPeriod);
    }
    if (!titleTouched) {
      setTitle(buildPayrollDraftTitle(value, nextPeriod, selectedCompany));
    }
  };

  const handlePeriodTypeChange = (value) => {
    setPeriodType(value);
    setPeriodTouched(true);
    if (!titleTouched) {
      setTitle(buildPayrollDraftTitle(draftDate, value, selectedCompany));
    }
  };

  const handleCompanyChange = (value) => {
    setSelectedCompany(value);
    if (!editingDraftId && !titleTouched) {
      setTitle(buildPayrollDraftTitle(draftDate, periodType, value));
    }
  };

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const emptyStateBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  if (isLoading) {
    return (
      <Box p={{ base: 3, md: 6, lg: 8 }}>
        <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} mb={6} wrap="wrap" gap={4}>
          <Box>
            <Skeleton height="28px" width="260px" mb={2} borderRadius="md" />
            <Skeleton height="16px" width="380px" borderRadius="md" />
          </Box>
          <Skeleton height="40px" width="160px" borderRadius="lg" />
        </Flex>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={6}>
          {[1, 2, 3].map(i => (
            <Box key={i} p={6} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
              <Flex align="center" gap={4} mb={5}>
                <Skeleton boxSize="44px" borderRadius="full" />
                <Box flex="1">
                  <Skeleton height="16px" width="140px" mb={2} borderRadius="md" />
                  <Skeleton height="12px" width="100px" borderRadius="md" />
                </Box>
              </Flex>
              <SkeletonText mt={2} noOfLines={3} spacing="3" skeletonHeight="10px" />
              <Skeleton height="36px" width="100%" mt={6} borderRadius="lg" />
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    );
  }

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} mb={6} wrap="wrap" gap={4}>
        <Box>
          <Heading size="lg" fontWeight={800} mb={1}>
            Nóminas en Progreso
          </Heading>
          <Text color="gray.500">
            Borradores activos que aún no han sido procesados definitivamente.
          </Text>
        </Box>
        {!isReadOnly && (
          <Button 
            colorScheme="brand" 
            leftIcon={<Plus size={16} />} 
            borderRadius="lg" 
            onClick={openCreateModal}
          >
            Nueva Nómina
          </Button>
        )}
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={6}>
        {activePayrolls.map(draft => (
          <Box 
            key={draft.id}
            p={6} 
            bg={cardBg} 
            borderRadius="xl" 
            border="1px solid" 
            borderColor={borderColor}
            position="relative"
            transition="all 0.3s"
            _hover={{ boxShadow: 'lg' }}
          >
            <Flex justify="space-between" align="flex-start" mb={5}>
              <Flex align="center" gap={4} overflow="hidden">
                <Center w="44px" h="44px" borderRadius="full" bg="brand.50" color="brand.500" flexShrink={0}>
                  <Calendar size={20} />
                </Center>
                <Box minW="0">
                  <Heading size="sm" fontWeight={700} isTruncated title={draft.title}>{draft.title}</Heading>
                  <Badge colorScheme={draft.periodType === '2da' ? 'purple' : 'teal'} mt={1} mb={1} mr={1}>
                    {draft.periodType === '2da' ? '2da Quincena' : '1ra Quincena'}
                  </Badge>
                  {draft.isApproved && (
                    <Badge colorScheme="green" mt={1} mb={1} mr={1}>Visto Bueno</Badge>
                  )}
                  {draft.correctionNote && (
                    <Badge colorScheme="red" mt={1} mb={1}>Con Errores</Badge>
                  )}
                  <Text fontSize="xs" color="gray.500">
                    Creada: {formatPayrollDisplayDate(draft.createdAt)}
                  </Text>
                </Box>
              </Flex>
              <Flex gap={1} flexShrink={0} ml={2} mt={-1} mr={-1}>
                {!isReadOnly && !draft.isApproved && (
                  <>
                    <IconButton 
                      aria-label="Edit draft"
                      icon={<Edit2 size={16} />}
                      colorScheme="blue"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(draft)}
                    />
                    <IconButton 
                      aria-label="Delete draft"
                      icon={<Trash2 size={16} />}
                      colorScheme="red"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        confirmAction('¿Eliminar este borrador? Se perderán todos los avances.', async () => {
                          try {
                            await deleteActivePayroll(draft.id);
                            showToast('Borrador eliminado', 'info');
                          } catch (error) {
                            showToast(error.message || 'No se pudo eliminar el borrador', 'error');
                          }
                        });
                      }}
                    />
                  </>
                )}
              </Flex>
            </Flex>

            <Box mb={6}>
              <Text fontSize="sm" color="gray.500" mb={2}>
                Empleados: <Text as="span" fontWeight={700} color="brand.500">{Array.isArray(draft.employees) ? draft.employees.length : (typeof draft.employees === 'string' ? JSON.parse(draft.employees).length : 0)}</Text>
              </Text>
              {draft.periodType === '2da' && (() => {
                let comps = draft.companies;
                if (typeof comps === 'string') {
                  try { comps = JSON.parse(comps); } catch { comps = []; }
                }
                const companyId = Array.isArray(comps) ? comps[0] : comps;
                const pending = countBlockingOperationalBonuses(operationLogs, companyId, draft.createdAt);
                const approved = countApprovedOperationalBonuses(operationLogs, companyId, draft.createdAt);
                return (
                  <Text fontSize="sm" color={pending > 0 ? 'orange.500' : 'gray.500'} mb={2} fontWeight={pending > 0 ? 600 : 400}>
                    Bonos: {pending} pendientes / {approved} aprobados
                  </Text>
                );
              })()}
              <Box>
                <Text fontSize="sm" color="gray.500" mb={1}>Empresas:</Text>
                {(() => {
                  let companiesArr = [];
                  if (Array.isArray(draft.companies)) companiesArr = draft.companies;
                  else if (typeof draft.companies === 'string') {
                    try { companiesArr = JSON.parse(draft.companies); } catch(e) {}
                  }
                  if (!companiesArr || companiesArr.length === 0) {
                    return <Badge colorScheme="orange" variant="subtle" size="sm">Sin empresa</Badge>;
                  }
                  return (
                    <Flex gap={1} wrap="wrap">
                      {companiesArr.map(cId => {
                        const comp = companies.find(comp => comp.id?.toString() === cId?.toString() || comp.nombre_comercial === cId);
                        const displayName = comp ? (comp.nombre_comercial || comp.nit) : cId;
                        return <Badge key={cId} colorScheme="brand" variant="subtle">{displayName}</Badge>;
                      })}
                    </Flex>
                  );
                })()}
              </Box>
            </Box>

            <Button 
              variant="outline" 
              w="100%" 
              justifyContent="space-between" 
              rightIcon={<ChevronRight size={16} />} 
              onClick={() => onSelectDraft(draft.id)} 
              borderRadius="lg"
            >
              {draft.isApproved ? 'Abrir (solo cierre)' : 'Continuar Editando'}
            </Button>
          </Box>
        ))}

        {activePayrolls.length === 0 && (
          <Box 
            gridColumn="1 / -1" 
            p={10} 
            textAlign="center" 
            borderRadius="xl" 
            border="2px dashed" 
            borderColor={borderColor}
            bg={emptyStateBg}
          >
            <Text color="gray.500">
              No hay nóminas en progreso. Crea una nueva para comenzar.
            </Text>
          </Box>
        )}
      </SimpleGrid>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} size={{ base: 'full', md: 'md' }}>
        <ModalOverlay />
        <ModalContent borderRadius="xl">
          <ModalHeader fontWeight={800}>{editingDraftId ? 'Editar Borrador' : 'Crear Nuevo Borrador'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Título del Periodo</FormLabel>
                <Input
                  autoFocus
                  placeholder="Ej: Primera Quincena del mes de Febrero 2026"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    setTitleTouched(true);
                  }}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Fecha de Nómina</FormLabel>
                <Input
                  type="date"
                  value={draftDate}
                  onChange={e => handleDraftDateChange(e.target.value)}
                  isDisabled={!!editingDraftId}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Periodo</FormLabel>
                <Select
                  value={periodType}
                  onChange={e => handlePeriodTypeChange(e.target.value)}
                  isDisabled={!!editingDraftId}
                >
                  <option value="1ra">Primera Quincena</option>
                  <option value="2da">Segunda Quincena</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Empresa</FormLabel>
                <Select
                  value={selectedCompany}
                  onChange={e => handleCompanyChange(e.target.value)}
                  isDisabled={!!editingDraftId}
                >
                  <option value="">Seleccione una empresa...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.nombre_comercial || c.nit}>{c.nombre_comercial || c.nit}</option>
                  ))}
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={borderColor}>
            <Button variant="ghost" mr={3} onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button colorScheme="brand" onClick={handleCreateOrUpdate} isDisabled={!title.trim() || !selectedCompany}>
              {editingDraftId ? 'Guardar Cambios' : 'Generar Borrador'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

const DraftNotesEditor = ({ draft, updateDraftMetadata, isReadOnly = false }) => {
  const [localNotes, setLocalNotes] = useState(draft?.notes || '');
  const bg = useColorModeValue('white', 'gray.800');
  
  useEffect(() => {
    setLocalNotes(draft?.notes || '');
  }, [draft?.notes]);

  return (
    <Box mt={3} w={{ base: "100%", md: "400px", lg: "500px" }}>
      <Text fontSize="xs" fontWeight="bold" color="brand.600" textTransform="uppercase" mb={1}>Notas / Observaciones</Text>
      <Textarea 
        placeholder="Ingrese notas sobre el borrador de nómina..." 
        value={localNotes}
        isReadOnly={isReadOnly}
        onChange={(e) => {
          if (isReadOnly) return;
          setLocalNotes(e.target.value);
        }}
        onBlur={() => {
          if (isReadOnly) return;
          if (localNotes !== (draft?.notes || '')) {
            updateDraftMetadata(draft.id, draft.title, draft.companies, draft.createdAt, draft.periodType, localNotes);
          }
        }}
        size="sm"
        bg={bg}
        rows={2}
        resize="vertical"
      />
    </Box>
  );
};

function PayrollEditor({ draftId, onBack }) {
  const { 
    activePayrolls, 
    updateActivePayroll, 
    updateDraftMetadata,
    closePayroll,
    bonuses,
    areas,
    departments,
    divisions,
    subdivisions,
    companies,
    dimension5s,
    employees
  } = useContext(DataContext);
  
  const { confirmAction, showToast } = useContext(AppContext);
  const { user } = useContext(AuthContext);
  const isAuditor = user?.role === 'AUDITOR';
  
  const draft = activePayrolls.find(p => p.id === draftId);
  const data = draft?.employees || [];
  // Bloqueo: auditor siempre; nómina aprobada no se edita (solo cierre definitivo)
  const isReadOnly = isAuditor || !!draft?.isApproved;

  const [tabIndex, setTabIndex] = useState(0);
  const [editingCell, setEditingCell] = useState(null); // { id, field, type }
  const [summaryEmp, setSummaryEmp] = useState(null);
  
  const { isOpen: isAlertOpen, onOpen: onAlertOpen, onClose: onAlertClose } = useDisclosure();
  const cancelRef = React.useRef();

  // Filtering states
  const [filterArea, setFilterArea] = useState([]);
  const [filterDept, setFilterDept] = useState([]);
  const [filterDiv, setFilterDiv] = useState([]);
  const [filterSubdiv, setFilterSubdiv] = useState([]);
  const [filterDim5, setFilterDim5] = useState([]);
  const [filterCompany, setFilterCompany] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ACTIVO');
  const [searchQuery, setSearchQuery] = useState('');

  const tab = TABS[tabIndex].id;

  const handleChange = (id, section, field, value) => {
    if (isReadOnly) return;
    const periodType = draft?.periodType || '1ra';
    const newData = data.map(e => {
      if (e.id !== id) return e;

      let updated = { ...e };

      if (section === 'root') {
        const numericValue = Number(value) || 0;
        updated[field] = field === 'days'
          ? Math.min(30, Math.max(0, numericValue))
          : numericValue;
      } else if (section === 'extras') {
        updated.extras = { ...e.extras, [field]: Number(value) || 0 };
      } else if (section === 'deductions') {
        updated.deductions = { ...e.deductions, [field]: Number(value) || 0 };
      } else if (section === 'appliedBonuses') {
        updated.appliedBonuses = { ...e.appliedBonuses, [field]: Number(value) || 0 };
      }

      // 1. Recalculate simplesVal & doblesVal automatically if simplesQty or doblesQty changes
      if (section === 'extras' && (field === 'simplesQty' || field === 'doblesQty')) {
        const sueldoOrd = Number(e.sueldo_ordinario) || 0;
        const hourRate = sueldoOrd / 30 / 8;
        if (field === 'simplesQty') {
          updated.extras.simplesVal = (hourRate * 1.5 * Number(value)) || 0;
        } else {
          updated.extras.doblesVal = (hourRate * 2 * Number(value)) || 0;
        }
      }

      // 2. Recalculate igss / isr based on salary and days worked (3% si jubilado)
      const currentDays = (section === 'root' && field === 'days')
        ? updated.days
        : (e.days ?? 30);
      const baseFactor = currentDays / 30;
      const sueldoOrd = Number(e.sueldo_ordinario) || 0;
      const baseSalary = sueldoOrd * baseFactor;
      const laboralRate = getCuotaLaboralRate(e);

      // Total ISR (solo 2ª): es el ISR mensual del cálculo acumulado.
      if (section === 'root' && field === 'totalIsr') {
        updated.deductions = {
          ...updated.deductions,
          isr: periodIsrOf(updated, currentDays, periodType)
        };
      }

      if (section === 'root' && field === 'days') {
        updated.deductions = {
          ...updated.deductions,
          ...masterRecurringDeductionsOf(updated, currentDays),
          igss: laboralRate === 0 ? 0 : Number((igssBaseOf(updated, baseSalary) * laboralRate).toFixed(2)) || 0,
          isr: periodIsrOf(updated, currentDays, periodType)
        };
      }

      return updated;
    });

    updateActivePayroll(draftId, newData).then((result) => {
      if (result?.success === false) {
        showToast(result.error || 'No se pudieron validar los cálculos de nómina.', 'error');
      }
    });
  };

  const handleSaveIncidence = async (empId, newIncidence, dQ) => {
    // Save directly to the local payroll draft since there's no global incidence API
    const periodType = draft?.periodType || '1ra';
    const newData = data.map(emp => {
      if (emp.id === empId) {
        const currentDays = emp.days ?? 30;
        const updated = {
          ...emp,
          days: Math.max(0, currentDays - dQ),
          incidences: [...(emp.incidences || []), newIncidence]
        };
        // Recalculate igss / isr based on new days (3% si jubilado)
        const baseFactor = updated.days / 30;
        const sueldoOrd = Number(emp.sueldo_ordinario) || 0;
        const baseSalary = sueldoOrd * baseFactor;
        const laboralRate = getCuotaLaboralRate(emp);
        updated.deductions = {
          ...updated.deductions,
          ...masterRecurringDeductionsOf(updated, updated.days),
          igss: laboralRate === 0 ? 0 : Number((igssBaseOf(updated, baseSalary) * laboralRate).toFixed(2)) || 0,
          isr: periodIsrOf(updated, updated.days, periodType)
        };
        
        return updated;
      }
      return emp;
    });
    const result = await updateActivePayroll(draftId, newData);
    showToast(
      result?.success === false ? (result.error || 'No se pudo validar la incidencia.') : 'Incidencia guardada',
      result?.success === false ? 'error' : 'success'
    );
  };

  const handleDeleteIncidence = async (empId, incId, daysToRestore) => {
    const periodType = draft?.periodType || '1ra';
    const newData = data.map(emp => {
      if (emp.id === empId) {
        const filtered = (emp.incidences || []).filter(i => i.id !== incId);
        const updated = {
          ...emp,
          days: Math.min(30, (emp.days ?? 30) + daysToRestore),
          incidences: filtered
        };
        // Recalculate igss / isr based on new days (3% si jubilado)
        const baseFactor = updated.days / 30;
        const sueldoOrd = Number(emp.sueldo_ordinario) || 0;
        const baseSalary = sueldoOrd * baseFactor;
        const laboralRate = getCuotaLaboralRate(emp);
        updated.deductions = {
          ...updated.deductions,
          ...masterRecurringDeductionsOf(updated, updated.days),
          igss: laboralRate === 0 ? 0 : Number((igssBaseOf(updated, baseSalary) * laboralRate).toFixed(2)) || 0,
          isr: periodIsrOf(updated, updated.days, periodType)
        };

        return updated;
      }
      return emp;
    });
    const result = await updateActivePayroll(draftId, newData);
    showToast(
      result?.success === false ? (result.error || 'No se pudo validar la eliminación.') : 'Incidencia eliminada',
      result?.success === false ? 'error' : 'info'
    );
  };

  const handleSaveDeduction = async (empId, newDeduction) => {
    const newData = data.map(emp => {
      if (emp.id === empId) {
        const currentDeductionTotal = Number(emp.deductions?.[newDeduction.type]) || 0;
        const updated = {
          ...emp,
          deductions: {
            ...emp.deductions,
            [newDeduction.type]: currentDeductionTotal + newDeduction.quotaAmount
          },
          deductionsHistory: [...(emp.deductionsHistory || []), newDeduction]
        };
        return updated;
      }
      return emp;
    });
    const result = await updateActivePayroll(draftId, newData);
    showToast(
      result?.success === false ? (result.error || 'No se pudo validar el descuento.') : 'Descuento guardado',
      result?.success === false ? 'error' : 'success'
    );
  };

  const handleDeleteDeduction = async (empId, dedId, dedType, quotaAmount) => {
    const newData = data.map(emp => {
      if (emp.id === empId) {
        const filtered = (emp.deductionsHistory || []).filter(d => d.id !== dedId);
        const currentDeductionTotal = Number(emp.deductions?.[dedType]) || 0;
        const updated = {
          ...emp,
          deductions: {
            ...emp.deductions,
            [dedType]: Math.max(0, currentDeductionTotal - quotaAmount)
          },
          deductionsHistory: filtered
        };
        return updated;
      }
      return emp;
    });
    const result = await updateActivePayroll(draftId, newData);
    showToast(
      result?.success === false ? (result.error || 'No se pudo validar la eliminación.') : 'Descuento eliminado',
      result?.success === false ? 'error' : 'info'
    );
  };

  const confirmClose = async () => {
    if (draft?.periodType === '2da' && draft?.missingAnticipoWarning) {
      showToast(
        'No se puede continuar: primero debe existir una 1ª quincena cerrada del mismo mes y empresa.',
        'error'
      );
      onAlertClose();
      return;
    }
    const result = await closePayroll(draftId);
    if (result.success) {
      showToast('Nómina cerrada exitosamente', 'success');
      onAlertClose();
      onBack();
    } else {
      showToast(result.error || 'No se pudo cerrar la nómina', 'error');
      onAlertClose();
    }
  };

  // Filter employees
  const filteredEmployees = useMemo(() => {
    const normalize = (str) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
    const employeesByDpi = new Map((employees || []).map(emp => [String(emp.dpi), emp]));
    const areasById = new Map((areas || []).map(area => [String(area.id), area]));
    const selectedDepts = normalizeMultiFilter(filterDept);
    const selectedAreas = normalizeMultiFilter(filterArea);
    const selectedDivs = normalizeMultiFilter(filterDiv);
    const selectedSubdivs = normalizeMultiFilter(filterSubdiv);
    const selectedDim5s = normalizeMultiFilter(filterDim5);
    const selectedCompanies = normalizeMultiFilter(filterCompany);

    const filtered = data.filter(e => {
      const fullName = [e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ');
      const matchSearch = normalize(fullName).includes(normalize(searchQuery)) || normalize(e.puesto).includes(normalize(searchQuery));
      
      const liveEmp = employeesByDpi.get(String(e.dpi)) || e;
      const mergedEmp = { ...e, ...liveEmp, departmentId: liveEmp.departmentId ?? e.departmentId, departamento_laboral: liveEmp.departamento_laboral || e.departamento_laboral };
      const area = liveEmp.areaId || e.areaId;
      const div = liveEmp.divisionId || e.divisionId;
      const subdiv = liveEmp.subdivisionId || e.subdivisionId;
      const dim5 = liveEmp.nivel_5 || liveEmp.dimension_5 || e.nivel_5 || e.dimension_5;
      const company = liveEmp.empresa_principal || e.empresa_principal || liveEmp.companyId || e.companyId;

      const matchArea = selectedAreas.length === 0 || selectedAreas.includes(String(area));
      const matchDept = matchesDepartmentFilter(mergedEmp, selectedDepts, departments);
      const matchDiv = selectedDivs.length === 0 || selectedDivs.includes(String(div));
      const matchSubdiv = selectedSubdivs.length === 0 || selectedSubdivs.includes(String(subdiv));
      const matchDim5 = selectedDim5s.length === 0 || selectedDim5s.includes(String(dim5));
      const matchCompany = selectedCompanies.length === 0 || selectedCompanies.includes(String(company));
      
      let matchStatus = true;
      if (filterStatus !== 'ALL') {
        const empStatus = (e.estado || '').toUpperCase();
        const selStatus = filterStatus.toUpperCase();
        matchStatus = empStatus === selStatus;
      }

      return matchSearch && matchArea && matchDept && matchDiv && matchSubdiv && matchDim5 && matchCompany && matchStatus;
    });

    return filtered.sort((a, b) => {
      const liveEmpA = employeesByDpi.get(String(a.dpi)) || a;
      const liveEmpB = employeesByDpi.get(String(b.dpi)) || b;
      
      const areaA = areasById.get(String(liveEmpA.areaId || a.areaId))?.nombre || '';
      const areaB = areasById.get(String(liveEmpB.areaId || b.areaId))?.nombre || '';
      
      const compArea = areaA.localeCompare(areaB);
      if (compArea !== 0) return compArea;

      const nameA = [a.primer_nombre, a.segundo_nombre, a.otro_nombre, a.primer_apellido, a.segundo_apellido].filter(Boolean).join(' ').trim();
      const nameB = [b.primer_nombre, b.segundo_nombre, b.otro_nombre, b.primer_apellido, b.segundo_apellido].filter(Boolean).join(' ').trim();
      return nameA.localeCompare(nameB);
    });
  }, [data, searchQuery, filterArea, filterDept, filterDiv, filterSubdiv, filterDim5, filterCompany, filterStatus, areas, departments, employees]);

  // General totals calculation
  const totals = useMemo(() => {
    let grossTotal = 0, dedTotal = 0, patronalTotal = 0, netTotal = 0;
    const periodType = draft?.periodType || '1ra';
    data.forEach(e => {
      if (e.calculated) {
        grossTotal += e.calculated.gross || 0;
        dedTotal += e.calculated.ded || 0;
        patronalTotal += (e.calculated.patronal || 0) + (e.calculated.irtraIntecap || 0);
      } else {
        const baseFactor = (e.days ?? 30) / 30;
        const sueldoOrd = Number(e.sueldo_ordinario) || 0;
        grossTotal += sueldoOrd * baseFactor;
      }
      netTotal += getNetPayable(e, periodType);
    });
    return { grossTotal, dedTotal, patronalTotal, netTotal };
  }, [data, draft?.periodType]);

  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');

  if (!draft) return null;

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'flex-start' }} direction={{ base: 'column', md: 'row' }} mb={6} wrap="wrap" gap={4}>
        <Flex align="flex-start" gap={3} minW={0} flex="1">
          <IconButton aria-label="Back" icon={<ArrowLeft size={24} />} onClick={onBack} variant="ghost" flexShrink={0} />
          <Box minW={0} flex="1">
            <Flex align="center" gap={{ base: 2, md: 3 }} flexWrap="wrap">
              <Heading size={{ base: 'sm', md: 'md' }} fontWeight={800} noOfLines={2} minW={0}>
                {draft.title}
              </Heading>
              <Badge colorScheme="orange" variant="subtle" fontWeight={700}>Borrador</Badge>
              {draft.isApproved && <Badge colorScheme="green" variant="subtle" fontWeight={700}>Visto Bueno Auditoría</Badge>}
            </Flex>
            <Text fontSize="sm" color="gray.500">
              {data.length} empleados en esta nómina
            </Text>
            <DraftNotesEditor draft={draft} updateDraftMetadata={updateDraftMetadata} isReadOnly={isReadOnly} />
          </Box>
        </Flex>

        <Flex gap={2} w={{ base: '100%', md: 'auto' }} flexShrink={0}>
          {!isAuditor && (
            <Button 
              bg={draft.isApproved ? "green.500" : "red.500"}
              color="white"
              leftIcon={<CheckCircle2 size={16} />} 
              onClick={onAlertOpen}
              isDisabled={draft.periodType === '2da' && draft.missingAnticipoWarning}
              w={{ base: '100%', md: 'auto' }}
              _hover={{ bg: draft.isApproved ? 'green.600' : 'red.600', animation: 'none', transform: 'none' }}
            >
              {draft.isApproved ? 'Cerrar Definitivamente' : 'Enviar a Auditoría'}
            </Button>
          )}
        </Flex>
      </Flex>

        {draft.missingAnticipoWarning && draft.periodType === '2da' && (
          <Box mb={6} p={4} bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="md" _dark={{ bg: 'orange.900', borderColor: 'orange.600' }}>
            <Text color="orange.800" fontWeight="bold" mb={1} _dark={{ color: 'orange.100' }}>Sin anticipo de 1ª quincena</Text>
            <Text color="orange.700" fontSize="sm" _dark={{ color: 'orange.200' }}>
              No se encontró una nómina de 1ª quincena cerrada del mismo mes/empresas.
              El anticipo quedó en Q0 y la nómina no puede enviarse ni cerrarse hasta resolverlo.
            </Text>
          </Box>
        )}

        {draft.correctionNote && (
          <Box mb={6} p={4} bg="red.50" border="1px solid" borderColor="red.200" borderRadius="md">
            <Text color="red.700" fontWeight="bold" mb={2}>⚠️ Auditoría solicita correcciones:</Text>
            <Text color="red.600" whiteSpace="pre-wrap">{draft.correctionNote}</Text>
          </Box>
        )}

      {/* Summary strip */}
      <SimpleGrid
        columns={{ base: 2, lg: 4 }}
        spacing={{ base: 3, md: 4 }}
        p={{ base: 3, md: 5 }}
        mb={6}
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        bg={useColorModeValue('white', 'gray.800')}
      >
        <Box p={{ base: 2, md: 3 }} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <SummaryStat label="Costo Bruto Total" value={formatQ(totals.grossTotal)} />
        </Box>
        <Box p={{ base: 2, md: 3 }} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <SummaryStat label="Deducciones Totales" value={formatQ(totals.dedTotal)} color="red.500" />
        </Box>
        <Box p={{ base: 2, md: 3 }} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <SummaryStat label="Cuota Patronal Estimada" value={formatQ(totals.patronalTotal)} color="orange.400" />
        </Box>
        <Box p={{ base: 2, md: 3 }} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
          <SummaryStat label="Neto a Pagar" value={formatQ(totals.netTotal)} color="brand.500" large />
        </Box>
      </SimpleGrid>

      {/* Tabs */}
      <Box mb={6}>
        <Tabs index={tabIndex} onChange={setTabIndex} colorScheme="brand">
          <TabList
            borderBottomColor={borderColor}
            overflowX="auto"
            overflowY="hidden"
            flexWrap="nowrap"
            css={{
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': { height: '4px' },
            }}
          >
            {TABS.map(t => (
              <Tab key={t.id} fontWeight={600} flexShrink={0} whiteSpace="nowrap">
                <Flex align="center" gap={2}>
                  <t.icon size={16} />
                  {t.label}
                </Flex>
              </Tab>
            ))}
          </TabList>
        </Tabs>
      </Box>

      {/* Tab content */}
      <Box animation="fadeIn 0.3s ease">
        {tab === 'payments' && (
          <ListadoPagosTab 
            data={filteredEmployees} 
            periodType={draft?.periodType || '1ra'}
            onChange={handleChange} 
            editingCell={editingCell} 
            setEditingCell={setEditingCell}
            areas={areas}
            departments={departments}
            divisions={divisions}
            subdivisions={subdivisions}
            filterArea={filterArea}
            setFilterArea={setFilterArea}
            filterDept={filterDept}
            setFilterDept={setFilterDept}
            filterDiv={filterDiv}
            setFilterDiv={setFilterDiv}
            filterSubdiv={filterSubdiv}
            setFilterSubdiv={setFilterSubdiv}
            filterDim5={filterDim5}
            setFilterDim5={setFilterDim5}
            filterCompany={filterCompany}
            setFilterCompany={setFilterCompany}
            dimension5s={dimension5s}
            employees={employees}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleClose={confirmClose}
            handleSaveIncidence={handleSaveIncidence}
            handleDeleteIncidence={handleDeleteIncidence}
            handleSaveDeduction={handleSaveDeduction}
            handleDeleteDeduction={handleDeleteDeduction}
            handleOpenSummary={setSummaryEmp}
            isReadOnly={isReadOnly}
            draftDateStr={draft?.createdAt}
            companies={companies}
          />
        )}
        {tab === 'distribution' && <DistributionTab data={data} periodType={draft?.periodType || '1ra'} />}
        {tab === 'observations' && (
          <Box p={6} bg={useColorModeValue('white', 'gray.800')} borderRadius="xl" borderWidth="1px" borderColor={borderColor}>
            <Heading size="sm" mb={4}>Observaciones del periodo</Heading>
            <DraftNotesEditor draft={draft} updateDraftMetadata={updateDraftMetadata} isReadOnly={isReadOnly} />
            <Text fontSize="sm" color="gray.500" mt={4} mb={6}>
              Estas notas se conservan al enviar a auditoría o cerrar la nómina.
            </Text>
            <Divider mb={4} />
            <Heading size="sm" mb={3}>Observaciones por empleado</Heading>
            {data.filter(e => (e.observaciones || '').trim()).length === 0 ? (
              <Text fontSize="sm" color="gray.500">Ningún empleado en este borrador tiene observaciones en su expediente.</Text>
            ) : (
              <TableContainer>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Empleado</Th>
                      <Th>Observaciones</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.filter(e => (e.observaciones || '').trim()).map(e => (
                      <Tr key={e.id}>
                        <Td fontWeight="semibold" whiteSpace="nowrap">
                          {[e.primer_nombre, e.primer_apellido].filter(Boolean).join(' ')}
                        </Td>
                        <Td whiteSpace="pre-wrap">{e.observaciones}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
        
        <EmployeeSummaryModal
          isOpen={!!summaryEmp}
          onClose={() => setSummaryEmp(null)}
          employee={summaryEmp}
          companies={companies}
          periodType={draft?.periodType || '1ra'}
        />
      </Box>

      <AlertDialog isOpen={isAlertOpen} leastDestructiveRef={cancelRef} onClose={onAlertClose}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="xl">
            <AlertDialogHeader fontSize="lg" fontWeight="800" color={draft.isApproved ? "green.500" : "red.500"}>
              {draft.isApproved ? 'Cerrar Nómina Definitivamente' : 'Enviar a Auditoría'}
            </AlertDialogHeader>

            <AlertDialogBody color="gray.600">
              {draft.isApproved ? (
                <>
                  <Text mb={3}>
                    ¿Cerrar definitivamente esta nómina? Ya tiene el visto bueno de auditoría.
                    No se podrá editar sin reactivación (solo 2ª quincena / fin de mes).
                  </Text>
                  <Text fontSize="sm" fontWeight="600">
                    Empleados: {data.length} · Periodo: {draft.periodType === '2da' ? '2da Quincena' : '1ra Quincena'} · Neto estimado: {formatQ(totals.netTotal)}
                  </Text>
                </>
              ) : (
                <>
                  <Text mb={3}>
                    ¿Enviar esta nómina a Auditoría? Saldrá de borradores y pasará al Historial en revisión.
                  </Text>
                  <Text fontSize="sm" fontWeight="600">
                    Empleados: {data.length} · Periodo: {draft.periodType === '2da' ? '2da Quincena' : '1ra Quincena'} · Neto estimado: {formatQ(totals.netTotal)}
                  </Text>
                </>
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onAlertClose} variant="ghost">
                Cancelar
              </Button>
              <Button colorScheme={draft.isApproved ? "green" : "red"} onClick={confirmClose} ml={3} borderRadius="md">
                {draft.isApproved ? 'Sí, Cerrar Nómina' : 'Sí, Enviar a Auditoría'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>


    </Box>
  );
}

function calculateGroupTotals(groupData, periodType) {
  let totSalarioOrd = 0, totBonInc = 0, totBonDec = 0, totBonos = 0, totDevengado = 0;
  let totHorasSimples = 0, totValSimple = 0, totHorasDobles = 0, totValDouble = 0, totOtrosIngresos = 0, totSalarioTotal = 0;
  let totIgss = 0, totTotalIsr = 0, totIsr = 0, totCafe = 0, totCell = 0, totUniform = 0, totShoes = 0, totEquipo = 0, totProduct = 0, totBancos = 0, totPrestamo = 0, totOtros = 0, totJudiciales = 0, totSeguro = 0, totParqueo = 0, totBoleta = 0, totOtrosEgresos = 0, totTotalEgresos = 0;
  let totLiquido = 0, totQuincena1 = 0, totQuincena2 = 0;
  const money2 = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;

  groupData.forEach(e => {
    const baseFactor = (e.days ?? 30) / 30;
    const sueldoOrd = Number(e.sueldo_ordinario) || 0;
    const bonInc = Number(e.bon_incentivo) || 0;
    const bonDec = Number(e.bon_dec_37_2001) || 0;
    const calc = e.calculated || {};

    const baseSalary = calc.baseSalary != null
      ? Number(calc.baseSalary)
      : money2(sueldoOrd * baseFactor);
    const bonusLey = calc.bonusLey != null
      ? Number(calc.bonusLey)
      : money2(bonInc * baseFactor);
    const bonusDec = calc.bonusDec != null
      ? Number(calc.bonusDec)
      : money2(bonDec * baseFactor);
    const bonos = calc.bonos != null || calc.bonusesSum != null
      ? (Number(calc.bonos) || 0) + (Number(calc.bonusesSum) || 0)
      : money2(e.extras?.bonos)
        + Object.values(e.appliedBonuses || {}).reduce((s, v) => s + money2(v), 0);
    const comisiones = money2(e.extras?.comisiones);
    const vacacionesVal = money2(e.extras?.vacacionesVal);
    const ventasEconomicas = money2(e.extras?.ventasEconomicas);
    // T. Devengado = sueldos + bonos (sin HE / otros / vacaciones / ventas)
    const devengado = baseSalary + bonusLey + bonusDec + bonos;

    const simplesQty = Number(e.extras?.simplesQty) || 0;
    const simplesVal = money2(e.extras?.simplesVal);
    const doblesQty = Number(e.extras?.doblesQty) || 0;
    const doblesVal = money2(e.extras?.doblesVal);
    const otrosIngresos = money2(e.extras?.otrosIngresos) + vacacionesVal + ventasEconomicas;
    const salarioTotal = e.calculated?.gross != null
      ? Number(e.calculated.gross)
      : (devengado + simplesVal + doblesVal + otrosIngresos + comisiones);

    const proDed = e.calculated?.proratedDeductions || e.deductions || {};
    const igss = Number(proDed.igss) || 0;
    const isr = Number(proDed.isr) || 0;
    const cafe = Number(proDed.cafe) || 0;
    const cell = Number(proDed.cell) || 0;
    const uniform = Number(proDed.uniform) || 0;
    const shoes = Number(proDed.shoes) || 0;
    const equipo = Number(proDed.equipo) || 0;
    const product = Number(proDed.product) || 0;
    const bancos = Number(proDed.bancos) || 0;
    const prestamo_empresa = Number(proDed.prestamo_empresa) || 0;
    const otros = Number(proDed.otros) || 0;
    const judiciales = Number(proDed.judiciales) || 0;
    const seguro = Number(proDed.seguro) || 0;
    const parqueo = Number(proDed.parqueo) || 0;
    const boleto_de_ornato = Number(proDed.boleto_de_ornato) || 0;
    const otros_egresos = Number(proDed.otros_egresos) || 0;
    const anticipo = Number(e.anticipo1ra) || 0;
    
    const totalEgresos = e.calculated?.ded != null
      ? Number(e.calculated.ded)
      : (igss + isr + cafe + cell + uniform + shoes + equipo + product + bancos + prestamo_empresa + otros + judiciales + seguro + parqueo + boleto_de_ornato + otros_egresos);
    const liquido = e.calculated?.net != null ? Number(e.calculated.net) : (salarioTotal - totalEgresos);
    const q1 = periodType === '2da' ? anticipo : liquido;
    const q2 = periodType === '2da' ? (liquido - anticipo) : 0;
    const liquidoPagar = periodType === '2da' ? q2 : liquido;

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
    totTotalIsr += (e.totalIsr !== undefined && e.totalIsr !== null && e.totalIsr !== '')
      ? (Number(e.totalIsr) || 0)
      : monthlyIsrOf(e);
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
    totLiquido += liquidoPagar;
    totQuincena1 += q1;
    totQuincena2 += q2;
  });

  return {
    totSalarioOrd, totBonInc, totBonDec, totBonos, totDevengado,
    totHorasSimples, totValSimple, totHorasDobles, totValDouble, totOtrosIngresos, totSalarioTotal,
    totIgss, totTotalIsr, totIsr, totCafe, totCell, totUniform, totShoes, totEquipo, totProduct, totBancos, totPrestamo, totOtros, totJudiciales, totSeguro, totParqueo, totBoleta, totOtrosEgresos, totTotalEgresos,
    totLiquido, totQuincena1, totQuincena2
  };
}

function ListadoPagosTab({ 
  data, periodType, onChange, editingCell, setEditingCell, 
  areas, departments, divisions, subdivisions, dimension5s, employees,
  filterArea, setFilterArea, 
  filterDept, setFilterDept, 
  filterDiv, setFilterDiv,
  filterSubdiv, setFilterSubdiv,
  filterDim5, setFilterDim5,
  filterCompany, setFilterCompany,
  filterStatus, setFilterStatus,
  searchQuery, setSearchQuery,
  handleClose, handleSaveIncidence, handleDeleteIncidence,
  handleSaveDeduction, handleDeleteDeduction, handleOpenSummary,
  isReadOnly, draftDateStr, companies: companiesProp
}) {
  const { companies } = useContext(DataContext);
  const [viewMode, setViewMode] = useState('summary');
  const [highlightedRows, setHighlightedRows] = useState(new Set());
  const toggleRowHighlight = (id) => {
    setHighlightedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const highlightColor = useColorModeValue('yellow.100', 'yellow.800');
  const liquidoBg = useColorModeValue('brand.50', 'brand.900');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const theadBg = useColorModeValue('gray.100', 'gray.900');
  const tdBg = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const opLogBg = useColorModeValue('white', 'gray.800');
  const opLogBorder = useColorModeValue('1px solid var(--chakra-colors-gray-200)', 'none');
  const ajusteBonosBg = useColorModeValue('blue.50', 'blue.900');
  const taskDescColor = useColorModeValue('gray.600', 'gray.300');

  // Drawer State
  const { isOpen: isDrawerOpen, onOpen: onDrawerOpen, onClose: onDrawerClose } = useDisclosure();
  const { isOpen: isFiltersOpen, onToggle: onToggleFilters } = useDisclosure();
  const [selectedEmp, setSelectedEmp] = useState(null);
  const filtersAlwaysVisible = useBreakpointValue({ base: false, md: true }) ?? false;
  const stickyExtended = useBreakpointValue({ base: false, lg: true }) ?? false;
  const showFilterGrid = filtersAlwaysVisible || isFiltersOpen;
  const activeFilterCount = [
    filterCompany, filterDept, filterArea, filterDiv, filterSubdiv, filterDim5,
  ].reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0)
    + (filterStatus && filterStatus !== 'ALL' && filterStatus !== 'Activo' ? 1 : 0);

  const EDITABLE_FIELDS = {
    summary: ['days'],
    detailed: periodType === '2da'
      ? ['days', 'bonos', 'simplesQty', 'simplesVal', 'doblesQty', 'doblesVal', 'otrosIngresos', 'igss', 'totalIsr', 'isr', 'cafe', 'cell', 'uniform', 'shoes', 'equipo', 'product', 'bancos', 'prestamo_empresa', 'otros', 'judiciales', 'seguro', 'parqueo', 'boleto_de_ornato', 'otros_egresos']
      : ['days', 'bonos', 'simplesQty', 'simplesVal', 'doblesQty', 'doblesVal', 'otrosIngresos', 'igss', 'isr', 'cafe', 'cell', 'uniform', 'shoes', 'equipo', 'product', 'bancos', 'prestamo_empresa', 'otros', 'judiciales', 'seguro', 'parqueo', 'boleto_de_ornato', 'otros_egresos']
  };

  const handleNavigation = (currentId, currentField, key, shiftKey) => {
    const fields = EDITABLE_FIELDS[viewMode];
    const fieldIndex = fields.indexOf(currentField);
    const empIndex = data.findIndex(e => e.id === currentId);
    
    if (fieldIndex === -1 || empIndex === -1) return;
    
    let nextEmpIndex = empIndex;
    let nextFieldIndex = fieldIndex;
    
    if (key === 'ArrowDown' || (key === 'Enter' && !shiftKey)) {
      nextEmpIndex = Math.min(empIndex + 1, data.length - 1);
    } else if (key === 'ArrowUp' || (key === 'Enter' && shiftKey)) {
      nextEmpIndex = Math.max(empIndex - 1, 0);
    } else if (key === 'ArrowRight' || (key === 'Tab' && !shiftKey)) {
      if (fieldIndex < fields.length - 1) {
        nextFieldIndex = fieldIndex + 1;
      } else if (empIndex < data.length - 1) {
        nextEmpIndex = empIndex + 1;
        nextFieldIndex = 0;
      }
    } else if (key === 'ArrowLeft' || (key === 'Tab' && shiftKey)) {
      if (fieldIndex > 0) {
        nextFieldIndex = fieldIndex - 1;
      } else if (empIndex > 0) {
        nextEmpIndex = empIndex - 1;
        nextFieldIndex = fields.length - 1;
      }
    }
    
    if (nextEmpIndex !== empIndex || nextFieldIndex !== fieldIndex) {
      setTimeout(() => {
        setEditingCell({ id: data[nextEmpIndex].id, field: fields[nextFieldIndex] });
      }, 0);
    } else if (key === 'Enter' || key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleOpenDrawer = (emp) => {
    setSelectedEmp(emp);
    onDrawerOpen();
  };

  const companyList = companiesProp || companies || [];

  const groupedData = useMemo(() => {
    if (filterDept.length === 0 && filterArea.length === 0 && filterDiv.length === 0 && filterSubdiv.length === 0 && filterDim5.length === 0 && filterCompany.length === 0) {
      return [{ title: '', data }];
    }

    const groups = {};
    data.forEach(e => {
      const liveEmp = employees?.find(emp => String(emp.dpi) === String(e.dpi)) || e;
      const mergedEmp = { ...e, ...liveEmp, departmentId: liveEmp.departmentId ?? e.departmentId, departamento_laboral: liveEmp.departamento_laboral || e.departamento_laboral };
      const { name: deptName } = resolveEmployeeDepartment(mergedEmp, departments);
      const area = liveEmp.areaId || e.areaId;
      const div = liveEmp.divisionId || e.divisionId;
      const subdiv = liveEmp.subdivisionId || e.subdivisionId;
      const dim5 = liveEmp.nivel_5 || liveEmp.dimension_5 || e.nivel_5 || e.dimension_5;
      const company = liveEmp.empresa_principal || e.empresa_principal || liveEmp.companyId || e.companyId;

      const keyParts = [];
      if (filterCompany.length > 0) {
        const companyName = companyList.find(c => String(c.id) === String(company))?.nombre_comercial || 'Sin Empresa';
        keyParts.push(`Empresa: ${companyName}`);
      }
      if (filterDept.length > 0) {
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
  }, [data, filterDept, filterArea, filterDiv, filterSubdiv, filterDim5, filterCompany, divisions, areas, departments, subdivisions, dimension5s, employees, companyList]);

  const filterMenuBtnProps = {
    size: 'sm',
    variant: 'outline',
    rightIcon: <ChevronDown size={14} />,
    w: '100%',
    textAlign: 'left',
    fontWeight: 'normal',
    bg: tdBg,
    borderRadius: 'md',
    px: 3,
  };

  return (
    <Box>
      {/* Filters bar */}
      <VStack align="stretch" spacing={3} mb={4}>
        {!filtersAlwaysVisible && (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Filter size={14} />}
            rightIcon={isFiltersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            onClick={onToggleFilters}
            justifyContent="space-between"
            w="100%"
          >
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
        )}

        <Collapse in={showFilterGrid} animateOpacity>
          <SimpleGrid columns={{ base: 2, md: 3, xl: 4 }} spacing={2} mb={0}>
            <Menu closeOnSelect={false}>
              <MenuButton as={Button} {...filterMenuBtnProps}>
                {filterCompany.length > 0 ? `${filterCompany.length} Empresas...` : 'Empresa...'}
              </MenuButton>
              <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                <MenuOptionGroup type="checkbox" value={filterCompany} onChange={setFilterCompany}>
                  {companyList.map(c => (
                    <MenuItemOption key={c.id} value={String(c.id)} fontSize="sm">{c.nombre_comercial || c.nit || `Empresa ${c.id}`}</MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>

            <Menu closeOnSelect={false}>
              <MenuButton as={Button} {...filterMenuBtnProps}>
                {filterDept.length > 0 ? `${filterDept.length} Deptos...` : 'Departamento...'}
              </MenuButton>
              <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                <MenuOptionGroup type="checkbox" value={filterDept} onChange={(v) => setFilterDept(normalizeMultiFilter(v))}>
                  {departments.map(d => (
                    <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre_dimension}</MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>

            <Menu closeOnSelect={false}>
              <MenuButton as={Button} {...filterMenuBtnProps}>
                {filterArea.length > 0 ? `${filterArea.length} Áreas...` : 'Área...'}
              </MenuButton>
              <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
                <MenuOptionGroup type="checkbox" value={filterArea} onChange={setFilterArea}>
                  {areas.map(a => (
                    <MenuItemOption key={a.id} value={String(a.id)} fontSize="sm">{a.nombre}</MenuItemOption>
                  ))}
                </MenuOptionGroup>
              </MenuList>
            </Menu>

            <Menu closeOnSelect={false}>
              <MenuButton as={Button} {...filterMenuBtnProps}>
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
              <MenuButton as={Button} {...filterMenuBtnProps}>
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
              <MenuButton as={Button} {...filterMenuBtnProps}>
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
              size="sm"
              borderRadius="md"
              bg={tdBg}
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
                w="100%"
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
          </SimpleGrid>
        </Collapse>

        <Flex
          gap={2}
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'stretch', md: 'center' }}
        >
          <InputGroup size="sm" flex="1">
            <InputLeftElement pointerEvents="none">
              <Search size={16} color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Buscar por Nombre / Puesto..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              borderRadius="md"
              bg={tdBg}
            />
          </InputGroup>
          <ButtonGroup size="sm" isAttached variant="outline" w={{ base: '100%', md: 'auto' }}>
            <Button flex={{ base: 1, md: 'initial' }} onClick={() => setViewMode('summary')} isActive={viewMode === 'summary'}>Vista Resumen</Button>
            <Button flex={{ base: 1, md: 'initial' }} onClick={() => setViewMode('detailed')} isActive={viewMode === 'detailed'}>Vista Detallada</Button>
          </ButtonGroup>
        </Flex>
      </VStack>

      {periodType === '2da' && (
        <Text fontSize="sm" color="gray.500" mb={3}>
          Total ISR: edítalo en Vista Detallada. La 2ª quincena usa el ISR mensual completo y después descuenta el anticipo neto de la 1ª.
        </Text>
      )}

      {/* Spreadsheet Table or Summary View */}
      {groupedData.map((group, gIdx) => {
        const groupData = group.data;
        const columnTotals = calculateGroupTotals(groupData, periodType);

        return (
          <Box key={gIdx} mb={8}>
            {group.title && (
              <Heading size="sm" mb={3} color="brand.600" bg={liquidoBg} p={2} borderRadius="md" display="inline-flex" alignItems="center" gap={2}>
                {group.title} <Badge colorScheme="brand" borderRadius="full">{groupData.length}</Badge>
              </Heading>
            )}
            {viewMode === 'detailed' ? (
              <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" overflowY="auto" bg={tdBg} maxH="550px" css={{ WebkitOverflowScrolling: 'touch' }}>
              <Table variant="simple" size="sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }} minW="2800px">
                <Thead position="sticky" top={0} zIndex={15}>
                  <Tr>
                    {/* Sticky Headers */}
                    <Th w="60px" minW="60px" position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">No.</Th>
                    <Th w="200px" minW="160px" position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap" boxShadow={stickyExtended ? undefined : '4px 0 8px -4px rgba(0,0,0,0.15)'}>Nombre Empleado</Th>
                    <Th w="120px" minW="100px" position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '260px' : undefined} zIndex={stickyExtended ? 20 : undefined} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">Empresa</Th>
                    <Th w="120px" minW="100px" position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '380px' : undefined} zIndex={stickyExtended ? 20 : undefined} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" boxShadow={stickyExtended ? '4px 0 8px -4px rgba(0,0,0,0.15)' : undefined} fontSize="10px" whiteSpace="nowrap">Puesto</Th>
                    
                    {/* Normal Headers */}
                    <Th w="75px" minW="70px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">Días Lab.</Th>
                    <Th w="120px" minW="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">S. Ordinario</Th>
                    <Th w="120px" minW="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">Bon. Incentivo</Th>
                    <Th w="140px" minW="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">Bono Dec. 37-2001</Th>
                    <Th w="100px" minW="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">Bonos</Th>
                    <Th w="120px" minW="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500" whiteSpace="nowrap">T. Devengado</Th>
                    
                    <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Simples</Th>
                    <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Simp</Th>
                    <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Dobles</Th>
                    <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Dobl</Th>
                    <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Otros Ingr.</Th>
                    <Th w="130px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="gold.500">Salario Total</Th>
                    
                    <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">IGSS</Th>
                    {periodType === '2da' && (
                      <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400" title="ISR total del mes. Al cerrar se guarda en la ficha.">
                        Total ISR
                      </Th>
                    )}
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">
                      {periodType === '2da' ? 'ISR mensual' : 'ISR'}
                    </Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Cafetería</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Celular</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Uniforme</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Calzado</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Equipo</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Producto</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Bantrab</Th>
                    <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Préstamo</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Otros</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Judiciales</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Seguro</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Parqueo</Th>
                    <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Bol. Ornato</Th>
                    <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Otros Egr.</Th>
                    <Th w="130px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.500">Total Egresos</Th>
                    
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">Liquido a Recibir</Th>
                    {periodType === '2da' && (
                      <>
                        <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">1ra Quincena</Th>
                        <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">2da Quincena</Th>
                      </>
                    )}
                    <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Acciones</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {groupData.map((e, i) => {
                    // Use calculated properties from backend
                    const baseSalary = e.calculated?.baseSalary || 0;
                    const bonusLey = e.calculated?.bonusLey || 0;
                    const bonusDec = e.calculated?.bonusDec || 0;
                    const bonos = (e.calculated?.bonos || 0) + (e.calculated?.bonusesSum || 0);
                    // T. Devengado = sueldos + bonos; Salario Total = bruto completo (gross)
                    const devengado = baseSalary + bonusLey + bonusDec + bonos;
                    const salarioTotal = e.calculated?.gross != null ? Number(e.calculated.gross) : devengado;

                    const simplesQty = Number(e.extras?.simplesQty) || 0;
                    const simplesVal = Number(e.extras?.simplesVal) || 0;
                    const doblesQty = Number(e.extras?.doblesQty) || 0;
                    const doblesVal = Number(e.extras?.doblesVal) || 0;
                    const otrosIngresos = (Number(e.extras?.otrosIngresos) || 0)
                      + (Number(e.extras?.vacacionesVal) || 0)
                      + (Number(e.extras?.ventasEconomicas) || 0);

                    const proDed = e.calculated?.proratedDeductions || e.deductions || {};
                    const igss = Number(proDed.igss) || 0;
                    const isr = Number(proDed.isr) || 0;
                    const cafe = Number(proDed.cafe) || 0;
                    const cell = Number(proDed.cell) || 0;
                    const uniform = Number(proDed.uniform) || 0;
                    const shoes = Number(proDed.shoes) || 0;
                    const equipo = Number(proDed.equipo) || 0;
                    const product = Number(proDed.product) || 0;
                    const bancos = Number(proDed.bancos) || 0;
                    const prestamo_empresa = Number(proDed.prestamo_empresa) || 0;
                    const otros = Number(proDed.otros) || 0;
                    const judiciales = Number(proDed.judiciales) || 0;
                    const seguro = Number(proDed.seguro) || 0;
                    const parqueo = Number(proDed.parqueo) || 0;
                    const boleto_de_ornato = Number(proDed.boleto_de_ornato) || 0;
                    const otros_egresos = Number(proDed.otros_egresos) || 0;
                    const anticipo = Number(e.anticipo1ra) || 0;

                    const totalEgresos = e.calculated?.ded || 0;
                    const liquido = e.calculated?.net || 0;
                    const q1 = periodType === '2da' ? anticipo : liquido;
                    const q2 = periodType === '2da' ? liquido - anticipo : 0;
                    const liquidoPagar = getNetPayable(e, periodType);

                    const isHighlighted = highlightedRows.has(e.id);
                    const rowBg = isHighlighted ? highlightColor : 'transparent';
                    const stickyBg = isHighlighted ? highlightColor : tdBg;

                    return (
                      <Tr key={e.id} _hover={{ bg: isHighlighted ? highlightColor : hoverBg }} bg={rowBg} onDoubleClick={() => toggleRowHighlight(e.id)} userSelect="none">
                        {/* Sticky Cells */}
                        <Td position="sticky" left={0} zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontWeight="bold" fontSize="xs" cursor="pointer">
                          {i + 1}
                        </Td>
                        <Td position="sticky" left="60px" zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontWeight="600" color="brand.500" fontSize="xs" isTruncated maxW="200px" title={[e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ')} cursor="pointer" boxShadow={stickyExtended ? undefined : '4px 0 8px -4px rgba(0,0,0,0.15)'}>
                          {[e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ')}
                        </Td>
                        <Td position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '260px' : undefined} zIndex={stickyExtended ? 5 : undefined} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontSize="xs" isTruncated maxW="120px" title={companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'} whiteSpace="nowrap">
                          {companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'}
                        </Td>
                        <Td position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '380px' : undefined} zIndex={stickyExtended ? 5 : undefined} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} boxShadow={stickyExtended ? '4px 0 8px -4px rgba(0,0,0,0.15)' : undefined} fontSize="xs" isTruncated maxW="120px" whiteSpace="nowrap">
                          {e.puesto || 'Sin Puesto'}
                        </Td>

                        {/* Editable and Calculated Cells */}
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="days" section="root" value={e.days} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                        <Td fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(baseSalary)}</Td>
                        <Td fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(bonusLey)}</Td>
                        <Td fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(bonusDec)}</Td>
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="bonos" section="extras" value={e.extras?.bonos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(devengado)}</Td>
                        
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="simplesQty" section="extras" value={e.extras?.simplesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="simplesVal" section="extras" value={e.extras?.simplesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="doblesQty" section="extras" value={e.extras?.doblesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="doblesVal" section="extras" value={e.extras?.doblesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="otrosIngresos" section="extras" value={e.extras?.otrosIngresos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(salarioTotal)}</Td>

                        <EditableCell onNavigate={handleNavigation} id={e.id} field="igss" section="deductions" value={igss} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        {periodType === '2da' && (
                          <EditableCell
                            onNavigate={handleNavigation}
                            id={e.id}
                            field="totalIsr"
                            section="root"
                            value={e.totalIsr !== undefined && e.totalIsr !== null && e.totalIsr !== '' ? e.totalIsr : monthlyIsrOf(e)}
                            onChange={onChange}
                            editing={editingCell}
                            setEditing={setEditingCell}
                            width={85}
                            isMoney
                            isDanger
                          />
                        )}
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="isr" section="deductions" value={isr} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="cafe" section="deductions" value={cafe} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="cell" section="deductions" value={cell} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="uniform" section="deductions" value={uniform} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="shoes" section="deductions" value={shoes} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="equipo" section="deductions" value={equipo} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="product" section="deductions" value={product} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="bancos" section="deductions" value={bancos} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="prestamo_empresa" section="deductions" value={prestamo_empresa} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={85} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="otros" section="deductions" value={otros} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="judiciales" section="deductions" value={judiciales} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="seguro" section="deductions" value={seguro} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="parqueo" section="deductions" value={parqueo} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="boleto_de_ornato" section="deductions" value={boleto_de_ornato} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={85} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="otros_egresos" section="deductions" value={otros_egresos} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={85} isMoney isDanger />
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(totalEgresos)}</Td>
                        
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500" bg={liquidoBg}>
                          {formatQ(liquidoPagar)}
                        </Td>
                        {periodType === '2da' && (
                          <>
                            <Td fontFamily="mono" fontSize="xs" color="gray.500" title="Anticipo 1ra quincena">{formatQ(q1)}</Td>
                            <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="green.500">{formatQ(q2)}</Td>
                          </>
                        )}
                        <Td textAlign="center">
                          <HStack justify="center" spacing={2}>
                            {!isReadOnly && (
                              <Tooltip label="Editar Egresos" placement="top" hasArrow>
                                <IconButton 
                                  size="xs" 
                                  colorScheme="brand" 
                                  variant="ghost" 
                                  icon={<Edit2 size={14} />} 
                                  onClick={() => handleOpenDrawer(e)}
                                  aria-label="Editar"
                                />
                              </Tooltip>
                            )}
                            <Tooltip label="Resumen de Pagos" placement="top" hasArrow>
                              <IconButton 
                                size="xs" 
                                colorScheme="blue" 
                                variant="ghost" 
                                icon={<Eye size={14} />} 
                                onClick={() => handleOpenSummary(e)}
                                aria-label="Ver Resumen"
                              />
                            </Tooltip>
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
                {/* Footer with column totals */}
                <Thead position="sticky" bottom={0} zIndex={15} bg={theadBg}>
                  <Tr borderTop="2px solid" borderColor="brand.500">
                    <Th position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} whiteSpace="nowrap">TOTAL</Th>
                    <Th position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} whiteSpace="nowrap" boxShadow={stickyExtended ? undefined : '4px 0 8px -4px rgba(0,0,0,0.15)'}>CONSOLIDADO</Th>
                    <Th position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '260px' : undefined} zIndex={stickyExtended ? 20 : undefined} bg={theadBg} borderRight="1px solid" borderColor={borderColor}></Th>
                    <Th position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '380px' : undefined} zIndex={stickyExtended ? 20 : undefined} bg={theadBg} borderRight="1px solid" borderColor={borderColor} boxShadow={stickyExtended ? '4px 0 8px -4px rgba(0,0,0,0.15)' : undefined}></Th>
                    
                    <Th whiteSpace="nowrap">{groupData.length} Emps</Th>
                    <Th fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(columnTotals.totSalarioOrd)}</Th>
                    <Th fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(columnTotals.totBonInc)}</Th>
                    <Th fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(columnTotals.totBonDec)}</Th>
                    <Th fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(columnTotals.totBonos)}</Th>
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500" whiteSpace="nowrap">{formatQ(columnTotals.totDevengado)}</Th>
                    
                    <Th>{columnTotals.totHorasSimples}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totValSimple)}</Th>
                    <Th>{columnTotals.totHorasDobles}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totValDouble)}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totOtrosIngresos)}</Th>
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(columnTotals.totSalarioTotal)}</Th>
                    
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totIgss)}</Th>
                    {periodType === '2da' && (
                      <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totTotalIsr)}</Th>
                    )}
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totIsr)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totCafe)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totCell)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totUniform)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totShoes)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totEquipo)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totProduct)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totBancos)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totPrestamo)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totOtros)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totJudiciales)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totSeguro)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totParqueo)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totBoleta)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totOtrosEgresos)}</Th>
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(columnTotals.totTotalEgresos)}</Th>
                    
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(columnTotals.totLiquido)}</Th>
                    {periodType === '2da' && (
                      <>
                        <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totQuincena1)}</Th>
                        <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totQuincena2)}</Th>
                      </>
                    )}
                    <Th></Th>
                  </Tr>
                </Thead>
              </Table>
            </Box>
            ) : (
              <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" overflowY="auto" bg={tdBg} maxH="550px" css={{ WebkitOverflowScrolling: 'touch' }}>
              <Table variant="simple" size="sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }} minW="1200px">
                <Thead position="sticky" top={0} zIndex={15}>
                  <Tr>
                    {/* Sticky Headers */}
                    <Th w="60px" minW="60px" position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">No.</Th>
                    <Th w="200px" minW="160px" position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap" boxShadow={stickyExtended ? undefined : '4px 0 8px -4px rgba(0,0,0,0.15)'}>Nombre Empleado</Th>
                    <Th w="120px" minW="100px" position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '260px' : undefined} zIndex={stickyExtended ? 20 : undefined} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">Empresa</Th>
                    <Th w="120px" minW="100px" position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '380px' : undefined} zIndex={stickyExtended ? 20 : undefined} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" boxShadow={stickyExtended ? '4px 0 8px -4px rgba(0,0,0,0.15)' : undefined} fontSize="10px" whiteSpace="nowrap">Puesto</Th>
                    
                    {/* Resumen Headers */}
                    <Th w="75px" minW="70px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">Días Lab.</Th>
                    <Th w="120px" minW="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">S. Ordinario</Th>
                    <Th w="120px" minW="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">Bonificaciones</Th>
                    <Th w="120px" minW="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="gold.500" whiteSpace="nowrap">Ingresos Extras</Th>
                    <Th w="120px" minW="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.500" whiteSpace="nowrap">Total Egresos</Th>
                    <Th w="120px" minW="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500" whiteSpace="nowrap">Líquido a Recibir</Th>
                    {periodType === '2da' && (
                      <>
                        <Th w="110px" minW="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">1ra Quincena</Th>
                        <Th w="110px" minW="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" whiteSpace="nowrap">2da Quincena</Th>
                      </>
                    )}
                    <Th w="120px" minW="90px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" textAlign="center" whiteSpace="nowrap">Acciones</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {groupData.map((e, i) => {
                    const baseSalary = e.calculated?.baseSalary || 0;
                    const bonusLey = e.calculated?.bonusLey || 0;
                    const bonusDec = e.calculated?.bonusDec || 0;
                    const bonos = (e.calculated?.bonos || 0) + (e.calculated?.bonusesSum || 0);
                    const totalExtras = bonos + (e.calculated?.extrasTotal || 0);
                    const devengado = e.calculated?.gross || 0;
                    const totalEgresos = e.calculated?.ded || 0;
                    const liquido = e.calculated?.net || 0;

                    const anticipo = Number(e.anticipo1ra) || 0;
                    const q1 = periodType === '2da' ? anticipo : liquido;
                    const q2 = periodType === '2da' ? liquido - anticipo : 0;
                    const liquidoPagar = getNetPayable(e, periodType);

                    const isHighlighted = highlightedRows.has(e.id);
                    const rowBg = isHighlighted ? highlightColor : 'transparent';
                    const stickyBg = isHighlighted ? highlightColor : tdBg;

                    return (
                      <Tr key={e.id} _hover={{ bg: isHighlighted ? highlightColor : hoverBg }} bg={rowBg} onDoubleClick={() => toggleRowHighlight(e.id)} userSelect="none">
                        <Td position="sticky" left={0} zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontWeight="bold" fontSize="xs" cursor="pointer" whiteSpace="nowrap">
                          {i + 1}
                        </Td>
                        <Td position="sticky" left="60px" zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontWeight="600" color="brand.500" fontSize="xs" isTruncated maxW="200px" title={[e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ')} cursor="pointer" boxShadow={stickyExtended ? undefined : '4px 0 8px -4px rgba(0,0,0,0.15)'}>
                          {[e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ')}
                        </Td>
                        <Td position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '260px' : undefined} zIndex={stickyExtended ? 5 : undefined} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontSize="xs" isTruncated maxW="120px" title={companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'} whiteSpace="nowrap">
                          {companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'}
                        </Td>
                        <Td position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '380px' : undefined} zIndex={stickyExtended ? 5 : undefined} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} boxShadow={stickyExtended ? '4px 0 8px -4px rgba(0,0,0,0.15)' : undefined} fontSize="xs" isTruncated maxW="120px" whiteSpace="nowrap">
                          {e.puesto || 'Sin Puesto'}
                        </Td>

                        <EditableCell id={e.id} field="days" section="root" value={e.days} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                        <Td fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(baseSalary)}</Td>
                        <Td fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(bonusLey + bonusDec)}</Td>
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500" whiteSpace="nowrap">{formatQ(totalExtras)}</Td>
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500" whiteSpace="nowrap">{formatQ(totalEgresos)}</Td>
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500" bg={liquidoBg} whiteSpace="nowrap">{formatQ(liquidoPagar)}</Td>
                        
                        {periodType === '2da' && (
                          <>
                            <Td fontFamily="mono" fontSize="xs" color="gray.500" title="Anticipo 1ra quincena">{formatQ(q1)}</Td>
                            <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="green.500">{formatQ(q2)}</Td>
                          </>
                        )}
                        <Td textAlign="center">
                          <HStack justify="center" spacing={2}>
                            <Tooltip label="Editar Egresos" placement="top" hasArrow>
                              <IconButton 
                                size="xs" 
                                colorScheme="brand" 
                                variant="ghost" 
                                icon={<Edit2 size={14} />} 
                                onClick={() => handleOpenDrawer(e)}
                                aria-label="Editar"
                              />
                            </Tooltip>
                            <Tooltip label="Resumen de Pagos" placement="top" hasArrow>
                              <IconButton 
                                size="xs" 
                                colorScheme="blue" 
                                variant="ghost" 
                                icon={<Eye size={14} />} 
                                onClick={() => handleOpenSummary(e)}
                                aria-label="Ver Resumen"
                              />
                            </Tooltip>
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
                {/* Footer with column totals */}
                <Thead position="sticky" bottom={0} zIndex={15} bg={theadBg}>
                  <Tr borderTop="2px solid" borderColor="brand.500">
                    <Th position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} whiteSpace="nowrap">TOTAL</Th>
                    <Th position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} whiteSpace="nowrap" boxShadow={stickyExtended ? undefined : '4px 0 8px -4px rgba(0,0,0,0.15)'}>CONSOLIDADO</Th>
                    <Th position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '260px' : undefined} zIndex={stickyExtended ? 20 : undefined} bg={theadBg} borderRight="1px solid" borderColor={borderColor}></Th>
                    <Th position={stickyExtended ? 'sticky' : 'static'} left={stickyExtended ? '380px' : undefined} zIndex={stickyExtended ? 20 : undefined} bg={theadBg} borderRight="1px solid" borderColor={borderColor} boxShadow={stickyExtended ? '4px 0 8px -4px rgba(0,0,0,0.15)' : undefined}></Th>
                    
                    <Th whiteSpace="nowrap">{groupData.length} Emps</Th>
                    <Th fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(columnTotals.totSalarioOrd)}</Th>
                    <Th fontFamily="mono" fontSize="xs" whiteSpace="nowrap">{formatQ(columnTotals.totBonInc + columnTotals.totBonDec)}</Th>
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500" whiteSpace="nowrap">{formatQ(columnTotals.totBonos + columnTotals.totValSimple + columnTotals.totValDouble + columnTotals.totOtrosIngresos)}</Th>
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500" whiteSpace="nowrap">{formatQ(columnTotals.totTotalEgresos)}</Th>
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500" whiteSpace="nowrap">{formatQ(columnTotals.totLiquido)}</Th>
                    {periodType === '2da' && (
                      <>
                        <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totQuincena1)}</Th>
                        <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totQuincena2)}</Th>
                      </>
                    )}
                    <Th></Th>
                  </Tr>
                </Thead>
              </Table>
            </Box>
            )}
          </Box>
        );
      })}

      {/* Action buttons and indicators in footer */}


      {/* Employee Drawer */}
      <Drawer isOpen={isDrawerOpen} placement="right" onClose={onDrawerClose} size={{ base: 'full', md: 'md' }}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" borderColor={borderColor}>
            <Flex align="center" gap={3}>
              <Avatar size="sm" icon={<User size={16} />} bg="brand.500" />
              <Box>
                <Heading size="sm" isTruncated>{selectedEmp ? `${selectedEmp.primer_nombre || selectedEmp.nombres || ''} ${selectedEmp.primer_apellido || selectedEmp.apellidos || ''}` : ''}</Heading>
                <Text fontSize="xs" color="gray.500">{selectedEmp?.puesto || 'Sin Puesto'}</Text>
              </Box>
            </Flex>
          </DrawerHeader>

          <DrawerBody p={0}>
            {selectedEmp && (
              <Tabs isFitted colorScheme="brand" size="sm">
                <TabList bg={theadBg} position="sticky" top={0} zIndex={5}>
                  <Tab fontWeight="semibold">Deducciones</Tab>
                  <Tab fontWeight="semibold">Incidencias</Tab>
                  <Tab fontWeight="semibold" color="brand.500">Detalle Operativo</Tab>
                </TabList>

                <TabPanels>


                  {/* Tab 2: Deductions */}
                  <TabPanel p={4}>
                    <EmployeeDeductions
                      employee={selectedEmp}
                      onSave={handleSaveDeduction}
                      onDelete={handleDeleteDeduction}
                    />
                  </TabPanel>

                  {/* Tab 3: Incidences */}
                  <TabPanel p={4}>
                    <EmployeeIncidences 
                      employee={selectedEmp} 
                      onSave={handleSaveIncidence} 
                      onDelete={handleDeleteIncidence}
                      draftDateStr={draftDateStr}
                      periodType={periodType}
                    />
                  </TabPanel>

                  {/* Tab 4: Operativo */}
                  <TabPanel p={4}>
                    <VStack align="stretch" spacing={4}>
                      <Box bg={ajusteBonosBg} p={4} borderRadius="md" border="1px solid" borderColor="blue.200">
                        <FormControl>
                          <FormLabel fontSize="sm" fontWeight="bold" color="blue.600" mb={1}>Ajuste Manual de Bonos (Q)</FormLabel>
                          <Text fontSize="xs" color="gray.500" mb={2}>Si necesitas sobrescribir el total de bonos aprobados, modifícalo aquí.</Text>
                          <Input size="sm" type="number" bg="white" _dark={{ bg: 'gray.800' }} borderRadius="md" value={selectedEmp.extras?.bonos ?? ''} 
                            onChange={(e) => {
                              onChange(selectedEmp.id, 'extras', 'bonos', e.target.value);
                              setSelectedEmp(prev => ({...prev, extras: {...prev.extras, bonos: e.target.value}}));
                            }} 
                            placeholder="0.00"
                          />
                        </FormControl>
                      </Box>
                      
                      <Divider />

                      <Text fontWeight="bold" fontSize="sm" color="gray.600">Historial de Reportes Operativos</Text>
                      {selectedEmp.operationLogs && selectedEmp.operationLogs.length > 0 ? (
                        selectedEmp.operationLogs.map(log => (
                          <Box key={log.id} p={3} bg={opLogBg} borderRadius="md" border={opLogBorder} borderLeft="3px solid" borderLeftColor={log.type === 'BONO' ? 'brand.400' : 'yellow.400'}>
                            <HStack justify="space-between" mb={1}>
                              <Badge colorScheme={log.type === 'BONO' ? 'brand' : 'yellow'}>{log.type === 'BONO' ? 'Bono' : 'Hrs Extras'}</Badge>
                              <Text fontSize="xs" color="gray.400">{log.date}</Text>
                            </HStack>
                            <Text fontSize="sm" fontWeight="bold" mb={1}>
                              {log.type === 'BONO' ? `Monto: Q${log.bonusAmount}` : `${log.hoursQty} hrs (${log.hourType})`}
                            </Text>
                            <Text fontSize="xs" color={taskDescColor}>{log.taskDescription}</Text>
                          </Box>
                        ))
                      ) : (
                        <Text fontSize="sm" color="gray.500" textAlign="center" mt={4}>
                          No hay reportes operativos asociados a esta quincena.
                        </Text>
                      )}
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            )}
          </DrawerBody>

          <DrawerFooter borderTopWidth="1px" borderColor={borderColor}>
            <Button colorScheme="brand" w="100%" onClick={onDrawerClose}>
              Hecho
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

    </Box>
  );
}

function DistributionTab({ data, periodType = '1ra' }) {
  const { companies: COMPANIES } = useContext(DataContext);
  const [expandedCompany, setExpandedCompany] = useState(null);

  const companyTotals = COMPANIES.map(c => {
    let salary = 0, bonus = 0, extras = 0, patronal = 0;
    const employees = [];
    data.filter(e => (e.estado || '').toUpperCase() === 'ACTIVO').forEach(e => {
      const parseDistribution = (value) => {
        if (!value) return {};
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
          } catch {
            return {};
          }
        }
        return typeof value === 'object' && !Array.isArray(value) ? value : {};
      };
      const principalId = Number(e.empresa_principal || e.companyId || e.id_empresa);
      const rawGeneralDist = parseDistribution(e.dist);
      const hasGeneral = Object.values(rawGeneralDist).some(value => (Number(value) || 0) > 0);
      const generalDist = hasGeneral ? rawGeneralDist : { [principalId]: 100 };
      const componentDist = parseDistribution(e.component_dist);
      const selectComponentDist = (key) => {
        const override = parseDistribution(componentDist[key]);
        return Object.values(override).some(value => (Number(value) || 0) > 0)
          ? override
          : generalDist;
      };
      const bonusDist = selectComponentDist('bonuses');
      const extrasDist = selectComponentDist('extras');
      const generalPct = (Number(generalDist[c.id]) || 0) / 100;
      const bonusesPct = (Number(bonusDist[c.id]) || 0) / 100;
      const extrasPct = (Number(extrasDist[c.id]) || 0) / 100;

      if (generalPct > 0 || bonusesPct > 0 || extrasPct > 0) {
        const payrollSnap = getEmployeePayrollSnapshot(e, periodType);
        const snap = getEmployeeBillingCostSnapshot(e, payrollSnap);
        const employerTotal = (snap.patronal || 0) + (snap.irtraIntecap || 0);
        const igssBase = (snap.igssBase || 0) || ((snap.baseSalary || 0) + (snap.extrasTotal || 0));
        const extrasEmployer = igssBase > 0
          ? employerTotal * (snap.extrasTotal || 0) / igssBase
          : 0;
        const generalEmployer = employerTotal - extrasEmployer;
        const bonusesCost = (snap.bonos || 0) + (snap.bonusesSum || 0);
        const extrasCost = (snap.extrasTotal || 0) + extrasEmployer;
        // El componente general absorbe solo el residuo contable de redondeo,
        // igual que el servicio de facturación.
        const generalCost = (snap.companyCost || 0) - bonusesCost - extrasCost;
        const eTotal = (generalCost * generalPct)
          + (bonusesCost * bonusesPct)
          + (extrasCost * extrasPct);
        let eSalary = snap.baseSalary * generalPct;
        const eBonus = (snap.bonusDec + snap.bonusLey) * generalPct;
        const eExtras = ((snap.bonos + snap.bonusesSum) * bonusesPct)
          + (snap.extrasTotal * extrasPct);
        const ePatronal = (generalEmployer * generalPct) + (extrasEmployer * extrasPct);
        eSalary += eTotal - (eSalary + eBonus + eExtras + ePatronal);
        
        salary += eSalary;
        bonus += eBonus;
        extras += eExtras;
        patronal += ePatronal;

        const fullName = [e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ') || e.nombres || 'Empleado sin nombre';

        employees.push({
           ...e,
           fullName,
           pct: snap.companyCost > 0 ? eTotal / snap.companyCost : 0,
           generalPct,
           bonusesPct,
           extrasPct,
           eSalary,
           eBonus,
           eExtras,
           ePatronal,
           eTotal
        });
      }
    });
    return { ...c, salary, bonus, extras, patronal, total: salary + bonus + extras + patronal, employees };
  }).filter(c => c.total > 0);
  
  const grandTotal = companyTotals.reduce((s, c) => s + c.total, 0);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const trackBg = useColorModeValue('gray.100', 'whiteAlpha.200');
  const footerBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  return (
    <Box>
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4} mb={6}>
        {companyTotals.map((c, i) => (
          <Box key={c.id} p={6} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
            <Flex align="center" gap={3} mb={3}>
              <Box w="12px" h="12px" borderRadius="full" bg={c.color || 'brand.500'} boxShadow={`0 0 10px ${c.color || 'var(--chakra-colors-brand-500)'}`} />
              <Heading size="sm" fontWeight={700}>{c.nombre_comercial || c.nit}</Heading>
            </Flex>
            <Text fontSize="2xl" fontFamily="mono" fontWeight={800} color="gold.500" mb={1}>
              {formatQ(c.total)}
            </Text>
            <Text fontSize="xs" color="gray.500" mb={3}>
              {grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0}% del costo total
            </Text>
            <Box h="6px" borderRadius="full" bg={trackBg} overflow="hidden">
              <Box h="100%" bg={c.color || 'brand.500'} w={`${grandTotal > 0 ? (c.total / grandTotal) * 100 : 0}%`} />
            </Box>
          </Box>
        ))}
      </SimpleGrid>

      <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" bg={cardBg}>
        <Table variant="modern" size="sm" minW="800px">
          <Thead>
            <Tr>
              <Th>Empresa</Th>
              <Th>Salarios Ordinarios</Th>
              <Th>Bonos Ley</Th>
              <Th>H. Extras y Otros</Th>
              <Th>Cuota Patronal Estimada</Th>
              <Th isNumeric>Costo Total Asignado</Th>
            </Tr>
          </Thead>
          <Tbody>
            {companyTotals.map(c => {
              const isExpanded = expandedCompany === c.id;
              return (
              <React.Fragment key={c.id}>
                <Tr 
                  onClick={() => setExpandedCompany(isExpanded ? null : c.id)}
                  cursor="pointer"
                  _hover={{ bg: trackBg }}
                >
                  <Td>
                    <Flex align="center" gap={2}>
                      <Box w="10px" h="10px" borderRadius="full" bg={c.color || 'brand.500'} />
                      <Text fontSize="sm" fontWeight={600} color="brand.500">{c.nombre_comercial || c.nit}</Text>
                    </Flex>
                  </Td>
                  <Td fontFamily="mono">{formatQ(c.salary)}</Td>
                  <Td fontFamily="mono">{formatQ(c.bonus)}</Td>
                  <Td fontFamily="mono">{formatQ(c.extras)}</Td>
                  <Td fontFamily="mono" color="orange.400">{formatQ(c.patronal)}</Td>
                  <Td isNumeric>
                    <Flex justify="flex-end" align="center" gap={3}>
                      <Text fontSize="sm" fontFamily="mono" fontWeight={700} color="gold.500">{formatQ(c.total)}</Text>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Flex>
                  </Td>
                </Tr>
                {isExpanded && (
                  <Tr bg={footerBg}>
                    <Td colSpan={6} p={0}>
                      <Box p={4} m={2} bg={cardBg} borderRadius="md" border="1px solid" borderColor={borderColor}>
                        <Text fontSize="sm" fontWeight={600} mb={3}>Empleados que contribuyen a {c.nombre_comercial || c.nit}</Text>
                        <Table size="sm" variant="simple">
                          <Thead>
                            <Tr>
                              <Th fontSize="xs">Empleado</Th>
                              <Th fontSize="xs">% Efectivo</Th>
                              <Th fontSize="xs">Salario Ord.</Th>
                              <Th fontSize="xs">Bonos Ley</Th>
                              <Th fontSize="xs">Extras</Th>
                              <Th fontSize="xs">Patronal</Th>
                              <Th fontSize="xs" isNumeric>Total</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {c.employees.map((emp, idx) => (
                              <Tr key={emp.id + '-' + idx} _hover={{ bg: trackBg }}>
                                <Td fontSize="xs" fontWeight={500}>{emp.fullName}</Td>
                                <Td fontSize="xs">{(emp.pct * 100).toFixed(1)}%</Td>
                                <Td fontFamily="mono" fontSize="xs">{formatQ(emp.eSalary)}</Td>
                                <Td fontFamily="mono" fontSize="xs">{formatQ(emp.eBonus)}</Td>
                                <Td fontFamily="mono" fontSize="xs">{formatQ(emp.eExtras)}</Td>
                                <Td fontFamily="mono" fontSize="xs" color="orange.400">{formatQ(emp.ePatronal)}</Td>
                                <Td fontFamily="mono" fontSize="xs" fontWeight={600} color="gold.500" isNumeric>{formatQ(emp.eTotal)}</Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    </Td>
                  </Tr>
                )}
              </React.Fragment>
            )})}
            <Tr bg={footerBg}>
              <Td fontWeight={800} color="brand.500">GRAN TOTAL</Td>
              <Td fontFamily="mono" fontWeight={700}>{formatQ(companyTotals.reduce((s, c) => s + c.salary, 0))}</Td>
              <Td fontFamily="mono" fontWeight={700}>{formatQ(companyTotals.reduce((s, c) => s + c.bonus, 0))}</Td>
              <Td fontFamily="mono" fontWeight={700}>{formatQ(companyTotals.reduce((s, c) => s + c.extras, 0))}</Td>
              <Td fontFamily="mono" fontWeight={700} color="orange.400">{formatQ(companyTotals.reduce((s, c) => s + c.patronal, 0))}</Td>
              <Td isNumeric>
                <Text fontSize="md" fontFamily="mono" fontWeight={800} color="brand.500">{formatQ(grandTotal)}</Text>
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}

function EditableCell({ id, field, section, value, onChange, editing, setEditing, width, isMoney, isDanger, onNavigate, isReadOnly }) {
  const isEditing = !isReadOnly && editing?.id === id && editing?.field === field;
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  if (isEditing) {
    return (
      <Td p={1}>
        <Input
          type="number"
          size="sm"
          autoFocus
          defaultValue={value}
          onBlur={(e) => {
            onChange(id, section, field, e.target.value);
            setEditing(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onChange(id, section, field, e.target.value);
              if (onNavigate) {
                onNavigate(id, field, 'Enter', e.shiftKey);
              } else {
                setEditing(null);
              }
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
              e.preventDefault();
              onChange(id, section, field, e.target.value);
              if (onNavigate) {
                onNavigate(id, field, e.key, e.shiftKey);
              }
            } else if (e.key === 'Escape') {
              setEditing(null);
            }
          }}
          w={`${width}px`}
          minW="50px"
          fontSize="xs"
          h="26px"
          p={1}
        />
      </Td>
    );
  }

  return (
    <Td
      onClick={() => {
        if (!isReadOnly) setEditing({ id, field });
      }}
      cursor={isReadOnly ? 'default' : 'pointer'}
      transition="background-color 0.2s"
      _hover={!isReadOnly ? { bg: hoverBg } : {}}
      title={isReadOnly ? '' : 'Haz clic para editar'}
    >
      <Text 
        fontSize="xs" 
        fontFamily="monospace"
        color={(isMoney && value > 0 && !isDanger) ? 'gold.500' : (isDanger && value > 0) ? 'red.500' : 'inherit'}
        display="inline-block"
        minW="40px"
      >
        {isMoney && value > 0 ? formatQ(value) : value}
        {isMoney && value === 0 && <Text as="span" color="gray.500">—</Text>}
      </Text>
    </Td>
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
