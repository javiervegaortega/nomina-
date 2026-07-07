import React, { useState, useMemo, useContext, useEffect } from 'react';
import {
  Save, Download, FileText, Check, X, Edit3,
  ChevronRight, ChevronDown, ChevronUp, AlertCircle, DollarSign, Clock,
  Calculator, Building2, Plus, ArrowLeft, Trash2, Calendar, Search, LayoutGrid, List, User, Edit2, Eye
} from 'lucide-react';
import { AppContext } from '../App';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import { CUOTA_PATRONAL_RATE, CUOTA_LABORAL_RATE, formatQ } from '../data/mockData';
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
  Menu, MenuButton, MenuList, MenuItemOption, MenuOptionGroup, Tooltip
} from '@chakra-ui/react';

const TABS = [
  { id: 'payments', label: 'Listado Pagos', icon: FileText },
  { id: 'distribution', label: 'Distribución de Costos', icon: Building2 },
];

export default function PayrollProcessing() {
  const [selectedDraftId, setSelectedDraftId] = useState(null);

  if (selectedDraftId) {
    return <PayrollEditor draftId={selectedDraftId} onBack={() => setSelectedDraftId(null)} />;
  }

  return <PayrollHub onSelectDraft={setSelectedDraftId} />;
}

function PayrollHub({ onSelectDraft }) {
  const { activePayrolls, deleteActivePayroll, createActivePayroll, updateDraftMetadata, companies, isLoading } = useContext(DataContext);
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

  const handleCreateOrUpdate = async () => {
    if (!title || !selectedCompany) return;
    
    const companiesPayload = selectedCompany === 'ALL' ? [] : [selectedCompany];

    if (editingDraftId) {
      await updateDraftMetadata(editingDraftId, title, companiesPayload, draftDate ? new Date(draftDate).toISOString() : new Date().toISOString(), periodType, notes);
      setShowModal(false);
      showToast('Borrador actualizado', 'success');
    } else {
      const isDuplicate = activePayrolls.some(p => {
        let pComp = 'ALL';
        if (Array.isArray(p.companies) && p.companies.length > 0) pComp = p.companies[0];
        else if (typeof p.companies === 'string') {
          try { 
            const parsed = JSON.parse(p.companies); 
            if (parsed.length > 0) pComp = parsed[0]; 
          } catch(e) {}
        }
        return p.title === title || pComp === selectedCompany;
      });

      const createAction = async () => {
        try {
          const newId = await createActivePayroll(title, companiesPayload, periodType, draftDate ? new Date(draftDate).toISOString() : new Date().toISOString(), notes);
          setShowModal(false);
          onSelectDraft(newId);
        } catch (err) {
          showToast(err.message, 'danger');
        }
      };

      if (isDuplicate) {
        confirmAction('Ya existe un borrador activo con el mismo nombre y/o empresa principal. ¿Estás seguro de que deseas crear otro borrador con estos datos?', createAction);
      } else {
        createAction();
      }
    }
  };

  const openEditModal = (draft) => {
    setEditingDraftId(draft.id);
    setTitle(draft.title || '');
    setPeriodType(draft.periodType || '1ra');
    const dateStr = draft.createdAt ? new Date(draft.createdAt).toISOString().split('T')[0] : '';
    setDraftDate(dateStr);
    setNotes(draft.notes || '');
    
    let comp = 'ALL';
    if (Array.isArray(draft.companies) && draft.companies.length > 0) comp = draft.companies[0];
    else if (typeof draft.companies === 'string') {
      try { 
        const parsed = JSON.parse(draft.companies); 
        if (parsed.length > 0) comp = parsed[0]; 
      } catch(e) {}
    }
    setSelectedCompany(comp);
    setShowModal(true);
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
            onClick={() => {
              setEditingDraftId(null);
              setTitle('');
              setNotes('');
              setDraftDate(new Date().toISOString().split('T')[0]);
              setSelectedCompany('');
              setPeriodType('1ra');
              setShowModal(true);
            }}
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
                  <Badge colorScheme={draft.periodType === '2da' ? 'purple' : 'teal'} mt={1} mb={1}>
                    {draft.periodType === '2da' ? '2da Quincena' : '1ra Quincena'}
                  </Badge>
                  <Text fontSize="xs" color="gray.500">
                    Creada: {new Date(draft.createdAt).toLocaleDateString()}
                  </Text>
                </Box>
              </Flex>
              <Flex gap={1} flexShrink={0} ml={2} mt={-1} mr={-1}>
                {!isReadOnly && (
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
                        confirmAction('¿Eliminar este borrador? Se perderán todos los avances.', () => {
                          deleteActivePayroll(draft.id);
                          showToast('Borrador eliminado', 'info');
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
              <Box>
                <Text fontSize="sm" color="gray.500" mb={1}>Empresas:</Text>
                {(() => {
                  let companiesArr = [];
                  if (Array.isArray(draft.companies)) companiesArr = draft.companies;
                  else if (typeof draft.companies === 'string') {
                    try { companiesArr = JSON.parse(draft.companies); } catch(e) {}
                  }
                  if (!companiesArr || companiesArr.length === 0) {
                    return <Badge colorScheme="purple" variant="subtle" size="sm">Todas las empresas</Badge>;
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
              Continuar Editando
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
                  placeholder="Ej: Primera Quincena Febrero 2026"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Fecha de Nómina</FormLabel>
                <Input
                  type="date"
                  value={draftDate}
                  onChange={e => setDraftDate(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Periodo</FormLabel>
                <Select
                  value={periodType}
                  onChange={e => setPeriodType(e.target.value)}
                >
                  <option value="1ra">Primera Quincena</option>
                  <option value="2da">Segunda Quincena</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Empresa</FormLabel>
                <Select
                  value={selectedCompany}
                  onChange={e => setSelectedCompany(e.target.value)}
                >
                  <option value="">Seleccione una empresa...</option>
                  <option value="ALL">Todas las empresas</option>
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

const DraftNotesEditor = ({ draft, updateDraftMetadata }) => {
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
        onChange={(e) => setLocalNotes(e.target.value)}
        onBlur={() => {
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
    companies
  } = useContext(DataContext);
  
  const { confirmAction, showToast } = useContext(AppContext);
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'AUDITOR';
  
  const draft = activePayrolls.find(p => p.id === draftId);
  const data = draft?.employees || [];

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
  const [filterStatus, setFilterStatus] = useState('ACTIVO');
  const [searchQuery, setSearchQuery] = useState('');

  const tab = TABS[tabIndex].id;

  const handleChange = (id, section, field, value) => {
    const newData = data.map(e => {
      if (e.id !== id) return e;

      let updated = { ...e };

      if (section === 'root') {
        updated[field] = Number(value) || 0;
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
          updated.extras.simplesVal = Number((hourRate * 1.5 * Number(value)).toFixed(2)) || 0;
        } else {
          updated.extras.doblesVal = Number((hourRate * 2 * Number(value)).toFixed(2)) || 0;
        }
      }

      // 2. Recalculate igss based on salary and days worked
      const currentDays = (section === 'root' && field === 'days') ? Number(value) || 0 : e.days || 30;
      const baseFactor = currentDays / 30;
      const sueldoOrd = Number(e.sueldo_ordinario) || 0;
      const baseSalary = sueldoOrd * baseFactor;
      
      // Update IGSS automatically (can still be overwritten manually since igss is in deductions)
      if (section === 'root' && field === 'days') {
        updated.deductions.igss = Number((baseSalary * 0.0483).toFixed(2)) || 0;
      }

      return updated;
    });

    updateActivePayroll(draftId, newData);
  };

  const handleSaveIncidence = (empId, newIncidence, dQ) => {
    // Save directly to the local payroll draft since there's no global incidence API
    const newData = data.map(emp => {
      if (emp.id === empId) {
        const currentDays = emp.days || 30;
        const updated = {
          ...emp,
          days: Math.max(0, currentDays - dQ),
          incidences: [...(emp.incidences || []), newIncidence]
        };
        // Recalculate igss based on new days
        const baseFactor = updated.days / 30;
        const sueldoOrd = Number(emp.sueldo_ordinario) || 0;
        const baseSalary = sueldoOrd * baseFactor;
        updated.deductions = { ...updated.deductions, igss: Number((baseSalary * 0.0483).toFixed(2)) || 0 };
        
        return updated;
      }
      return emp;
    });
    updateActivePayroll(draftId, newData);
    showToast('Incidencia guardada', 'success');
  };

  const handleDeleteIncidence = (empId, incId, daysToRestore) => {
    const newData = data.map(emp => {
      if (emp.id === empId) {
        const filtered = (emp.incidences || []).filter(i => i.id !== incId);
        const updated = {
          ...emp,
          days: (emp.days || 30) + daysToRestore,
          incidences: filtered
        };
        // Recalculate igss based on new days
        const baseFactor = updated.days / 30;
        const sueldoOrd = Number(emp.sueldo_ordinario) || 0;
        const baseSalary = sueldoOrd * baseFactor;
        updated.deductions = { ...updated.deductions, igss: Number((baseSalary * 0.0483).toFixed(2)) || 0 };

        return updated;
      }
      return emp;
    });
    updateActivePayroll(draftId, newData);
    showToast('Incidencia eliminada', 'info');
  };

  const handleSaveDeduction = (empId, newDeduction) => {
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
    updateActivePayroll(draftId, newData);
    showToast('Descuento guardado', 'success');
  };

  const handleDeleteDeduction = (empId, dedId, dedType, quotaAmount) => {
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
    updateActivePayroll(draftId, newData);
    showToast('Descuento eliminado', 'info');
  };

  const confirmClose = async () => {
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
    const filtered = data.filter(e => {
      const fullName = [e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ');
      const matchSearch = normalize(fullName).includes(normalize(searchQuery)) || normalize(e.puesto).includes(normalize(searchQuery));
      
      const matchArea = filterArea.length === 0 || filterArea.includes(e.areaId?.toString());
      const matchDept = filterDept.length === 0 || filterDept.includes(e.departamento_laboral) || filterDept.includes(e.departmentId?.toString());
      const matchDiv = filterDiv.length === 0 || filterDiv.includes(e.divisionId?.toString());
      const matchSubdiv = filterSubdiv.length === 0 || filterSubdiv.includes(e.subdivisionId?.toString());
      
      let matchStatus = true;
      if (filterStatus !== 'ALL') {
        const empStatus = (e.estado || '').toUpperCase();
        const selStatus = filterStatus.toUpperCase();
        matchStatus = empStatus === selStatus;
      }

      return matchSearch && matchArea && matchDept && matchDiv && matchSubdiv && matchStatus;
    });

    return filtered.sort((a, b) => {
      const areaA = areas?.find(area => String(area.id) === String(a.areaId))?.nombre || '';
      const areaB = areas?.find(area => String(area.id) === String(b.areaId))?.nombre || '';
      
      const compArea = areaA.localeCompare(areaB);
      if (compArea !== 0) return compArea;

      const nameA = [a.primer_nombre, a.segundo_nombre, a.otro_nombre, a.primer_apellido, a.segundo_apellido].filter(Boolean).join(' ').trim();
      const nameB = [b.primer_nombre, b.segundo_nombre, b.otro_nombre, b.primer_apellido, b.segundo_apellido].filter(Boolean).join(' ').trim();
      return nameA.localeCompare(nameB);
    });
  }, [data, searchQuery, filterArea, filterDept, filterDiv, filterSubdiv, filterStatus, areas]);

  // General totals calculation
  const totals = useMemo(() => {
    let grossTotal = 0, dedTotal = 0, patronalTotal = 0;
    data.forEach(e => {
      const baseFactor = (e.days || 30) / 30;
      const sueldoOrd = Number(e.sueldo_ordinario) || 0;
      const bonInc = Number(e.bon_incentivo) || 0;
      const bonDec = Number(e.bon_dec_37_2001) || 0;

      const baseSalary = sueldoOrd * baseFactor;
      const bonusLey = bonInc * baseFactor;
      const bonusDec = bonDec * baseFactor;
      
      const bonos = Number(e.extras?.bonos) || 0;
      const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
      const extrasTotal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);

      const gross = baseSalary + bonusLey + bonusDec + bonos + extrasTotal + bonusesSum;
      const ded = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);
      const patronal = baseSalary * CUOTA_PATRONAL_RATE;
      
      grossTotal += gross;
      dedTotal += ded;
      patronalTotal += patronal;
    });
    return { grossTotal, dedTotal, patronalTotal, netTotal: grossTotal - dedTotal };
  }, [data]);

  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');

  if (!draft) return null;

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'flex-start' }} direction={{ base: 'column', md: 'row' }} mb={6} wrap="wrap" gap={4}>
        <Flex align="flex-start" gap={4}>
          <IconButton aria-label="Back" icon={<ArrowLeft size={24} />} onClick={onBack} variant="ghost" />
          <Box>
            <Flex align="center" gap={{ base: 2, md: 3 }} flexWrap="wrap">
              <Heading size={{ base: 'sm', md: 'md' }} fontWeight={800}>{draft.title}</Heading>
              <Badge colorScheme="orange" variant="subtle" fontWeight={700}>Borrador</Badge>
            </Flex>
            <Text fontSize="sm" color="gray.500">
              {data.length} empleados en esta nómina
            </Text>
            <DraftNotesEditor draft={draft} updateDraftMetadata={updateDraftMetadata} />
          </Box>
        </Flex>
        <Flex gap={2}>
          {!isReadOnly && (
            <Button 
              bg="red.500"
              color="white"
              leftIcon={<Check size={16} />} 
              onClick={onAlertOpen}
              _hover={{ bg: 'red.600', animation: 'none', transform: 'none' }}
            >
              Cerrar Nómina
            </Button>
          )}
        </Flex>
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
        bg={useColorModeValue('white', 'gray.800')}
      >
        <SummaryStat label="Costo Bruto Total" value={formatQ(totals.grossTotal)} />
        <Divider orientation="vertical" h="40px" />
        <SummaryStat label="Deducciones Totales" value={formatQ(totals.dedTotal)} color="red.500" />
        <Divider orientation="vertical" h="40px" />
        <SummaryStat label="Cuota Patronal Estimada" value={formatQ(totals.patronalTotal)} color="orange.400" />
        <Divider orientation="vertical" h="40px" />
        <SummaryStat label="Neto a Pagar" value={formatQ(totals.netTotal)} color="brand.500" large />
      </Flex>

      {/* Tabs */}
      <Box mb={6}>
        <Tabs index={tabIndex} onChange={setTabIndex} colorScheme="brand">
          <TabList borderBottomColor={borderColor}>
            {TABS.map(t => (
              <Tab key={t.id} fontWeight={600}>
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
          />
        )}
        {tab === 'distribution' && <DistributionTab data={data} />}
        
        <EmployeeSummaryModal
          isOpen={!!summaryEmp}
          onClose={() => setSummaryEmp(null)}
          employee={summaryEmp}
          companies={companies}
        />
      </Box>

      <AlertDialog
        isOpen={isAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onAlertClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="xl">
            <AlertDialogHeader fontSize="lg" fontWeight="800" color="red.500">
              Cerrar Nómina
            </AlertDialogHeader>

            <AlertDialogBody color="gray.600">
              ¿Estás seguro de cerrar esta nómina? Se moverá al <strong>Historial</strong> y ya no podrá ser editada. Esta acción es irreversible.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onAlertClose} variant="ghost" borderRadius="md">
                Cancelar
              </Button>
              <Button colorScheme="red" onClick={confirmClose} ml={3} borderRadius="md">
                Sí, Cerrar Nómina
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
  let totIgss = 0, totIsr = 0, totCafe = 0, totCell = 0, totUniform = 0, totShoes = 0, totEquipo = 0, totProduct = 0, totBancos = 0, totOtros = 0, totJudiciales = 0, totSeguro = 0, totParqueo = 0, totBoleta = 0, totOtrosEgresos = 0, totTotalEgresos = 0;
  let totLiquido = 0, totQuincena1 = 0, totQuincena2 = 0;

  groupData.forEach(e => {
    const baseFactor = (e.days || 30) / 30;
    const sueldoOrd = Number(e.sueldo_ordinario) || 0;
    const bonInc = Number(e.bon_incentivo) || 0;
    const bonDec = Number(e.bon_dec_37_2001) || 0;

    const baseSalary = sueldoOrd * baseFactor;
    const bonusLey = bonInc * baseFactor;
    const bonusDec = bonDec * baseFactor;
    const bonos = Number(e.extras?.bonos) || 0;
    const devengado = baseSalary + bonusLey + bonusDec + bonos;

    const simplesQty = Number(e.extras?.simplesQty) || 0;
    const simplesVal = Number(e.extras?.simplesVal) || 0;
    const doblesQty = Number(e.extras?.doblesQty) || 0;
    const doblesVal = Number(e.extras?.doblesVal) || 0;
    const otrosIngresos = Number(e.extras?.otrosIngresos) || 0;
    const salarioTotal = devengado + simplesVal + doblesVal + otrosIngresos;

    const igss = Number(e.deductions?.igss) || 0;
    const isr = Number(e.deductions?.isr) || 0;
    const cafe = Number(e.deductions?.cafe) || 0;
    const cell = Number(e.deductions?.cell) || 0;
    const uniform = Number(e.deductions?.uniform) || 0;
    const shoes = Number(e.deductions?.shoes) || 0;
    const equipo = Number(e.deductions?.equipo) || 0;
    const product = Number(e.deductions?.product) || 0;
    const bancos = Number(e.deductions?.bancos) || 0;
    const otros = Number(e.deductions?.otros) || 0;
    const judiciales = Number(e.deductions?.judiciales) || 0;
    const seguro = Number(e.deductions?.seguro) || 0;
    const parqueo = Number(e.deductions?.parqueo) || 0;
    const boleto_de_ornato = Number(e.deductions?.boleto_de_ornato) || 0;
    const otros_egresos = Number(e.deductions?.otros_egresos) || 0;
    const anticipo = Number(e.anticipo1ra) || 0;
    
    const totalEgresos = igss + isr + cafe + cell + uniform + shoes + equipo + product + bancos + otros + judiciales + seguro + parqueo + boleto_de_ornato + otros_egresos;
    const liquido = salarioTotal - totalEgresos; // For 2da, this is the FULL month's net
    const q1 = periodType === '2da' ? anticipo : liquido;
    const q2 = periodType === '2da' ? liquido - anticipo : 0;

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
    totIgss, totIsr, totCafe, totCell, totUniform, totShoes, totEquipo, totProduct, totBancos, totOtros, totJudiciales, totSeguro, totParqueo, totBoleta, totOtrosEgresos, totTotalEgresos,
    totLiquido, totQuincena1, totQuincena2
  };
}

function ListadoPagosTab({ 
  data, periodType, onChange, editingCell, setEditingCell, 
  areas, departments, divisions, subdivisions,
  filterArea, setFilterArea, 
  filterDept, setFilterDept, 
  filterDiv, setFilterDiv,
  filterSubdiv, setFilterSubdiv,
  filterStatus, setFilterStatus,
  searchQuery, setSearchQuery,
  handleClose, handleSaveIncidence, handleDeleteIncidence,
  handleSaveDeduction, handleDeleteDeduction, handleOpenSummary,
  isReadOnly
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
  const [selectedEmp, setSelectedEmp] = useState(null);

  const EDITABLE_FIELDS = {
    summary: ['days'],
    detailed: ['days', 'bonos', 'simplesQty', 'simplesVal', 'doblesQty', 'doblesVal', 'otrosIngresos', 'igss', 'isr', 'cafe', 'cell', 'uniform', 'shoes', 'equipo', 'product', 'bancos', 'otros', 'judiciales', 'seguro', 'parqueo', 'boleto_de_ornato', 'otros_egresos']
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

  const groupedData = useMemo(() => {
    if (filterDept.length === 0 && filterArea.length === 0 && filterDiv.length === 0 && filterSubdiv.length === 0) {
      return [{ title: '', data }];
    }

    const groups = {};
    data.forEach(e => {
      const keyParts = [];
      if (filterDept.length > 0) {
        keyParts.push(`Depto: ${e.departamento_laboral || 'Sin Departamento'}`);
      }
      if (filterDiv.length > 0) {
        const divName = divisions?.find(d => String(d.id) === String(e.divisionId))?.nombre || 'Sin División';
        keyParts.push(`División: ${divName}`);
      }
      if (filterArea.length > 0) {
        const areaName = areas?.find(a => String(a.id) === String(e.areaId))?.nombre || 'Sin Área';
        keyParts.push(`Área: ${areaName}`);
      }
      if (filterSubdiv.length > 0) {
        const subdivName = subdivisions?.find(s => String(s.id) === String(e.subdivisionId))?.nombre || 'Sin Subdivisión';
        keyParts.push(`Subdivisión: ${subdivName}`);
      }
      
      const key = keyParts.length > 0 ? keyParts.join(' | ') : 'Otros';
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });

    return Object.keys(groups).sort().map(key => ({
      title: key,
      data: groups[key]
    }));
  }, [data, filterDept, filterArea, filterDiv, filterSubdiv, divisions, areas, subdivisions]);

  const { confirmAction, showToast } = useContext(AppContext);

  return (
    <Box>
      {/* Filters bar */}
      <Flex gap={{ base: 2, md: 4 }} wrap="wrap" mb={4} align={{ base: 'stretch', md: 'center' }} justify="space-between" direction={{ base: 'column', md: 'row' }}>
        <HStack spacing={{ base: 2, md: 3 }} wrap="wrap" flex="1">
          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterDept.length > 0 ? `${filterDept.length} Deptos...` : 'Departamento...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterDept} onChange={setFilterDept}>
                {departments.map(d => (
                  <MenuItemOption key={d.id} value={d.nombre_dimension} fontSize="sm">{d.nombre_dimension}</MenuItemOption>
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
                {areas.map(a => (
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
              <Search size={16} color="gray.400" />
            </InputLeftElement>
            <Input 
              placeholder="Buscar por Nombre / Puesto..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              borderRadius="md"
            />
          </InputGroup>
          <ButtonGroup size="sm" isAttached variant="outline" w={{ base: '100%', lg: 'auto' }}>
            <Button onClick={() => setViewMode('summary')} isActive={viewMode === 'summary'}>Vista Resumen</Button>
            <Button onClick={() => setViewMode('detailed')} isActive={viewMode === 'detailed'}>Vista Detallada</Button>
          </ButtonGroup>
        </HStack>
      </Flex>

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
              <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" overflowY="auto" bg={tdBg} maxH="550px">
              <Table variant="simple" size="sm" layout="fixed" style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content' }}>
                <Thead position="sticky" top={0} zIndex={15}>
                  <Tr>
                    {/* Sticky Headers */}
                    <Th w="60px" position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">No.</Th>
                    <Th w="200px" position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Nombre Empleado</Th>
                    <Th w="120px" position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Empresa</Th>
                    <Th w="120px" position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="10px">Puesto</Th>
                    
                    {/* Normal Headers */}
                    <Th w="75px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Días Lab.</Th>
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">S. Ordinario</Th>
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bon. Incentivo</Th>
                    <Th w="140px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bono Dec. 37-2001</Th>
                    <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bonos</Th>
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">T. Devengado</Th>
                    
                    <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Simples</Th>
                    <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Simp</Th>
                    <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Dobles</Th>
                    <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Dobl</Th>
                    <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Otros Ingr.</Th>
                    <Th w="130px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="gold.500">Salario Total</Th>
                    
                    <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">IGSS</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">ISR</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Cafetería</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Celular</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Uniforme</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Calzado</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Equipo</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Producto</Th>
                    <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Bancos</Th>
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
                    // Real-time calculations per row
                    const baseFactor = (e.days || 30) / 30;
                    const sueldoOrd = Number(e.sueldo_ordinario) || 0;
                    const bonInc = Number(e.bon_incentivo) || 0;
                    const bonDec = Number(e.bon_dec_37_2001) || 0;

                    const baseSalary = sueldoOrd * baseFactor;
                    const bonusLey = bonInc * baseFactor;
                    const bonusDec = bonDec * baseFactor;
                    
                    const bonos = Number(e.extras?.bonos) || 0;
                    const devengado = baseSalary + bonusLey + bonusDec + bonos;

                    const simplesQty = Number(e.extras?.simplesQty) || 0;
                    const simplesVal = Number(e.extras?.simplesVal) || 0;
                    const doblesQty = Number(e.extras?.doblesQty) || 0;
                    const doblesVal = Number(e.extras?.doblesVal) || 0;
                    const otrosIngresos = Number(e.extras?.otrosIngresos) || 0;
                    
                    const salarioTotal = devengado + simplesVal + doblesVal + otrosIngresos;

                    const igss = Number(e.deductions?.igss) || 0;
                    const isr = Number(e.deductions?.isr) || 0;
                    const cafe = Number(e.deductions?.cafe) || 0;
                    const cell = Number(e.deductions?.cell) || 0;
                    const uniform = Number(e.deductions?.uniform) || 0;
                    const shoes = Number(e.deductions?.shoes) || 0;
                    const equipo = Number(e.deductions?.equipo) || 0;
                    const product = Number(e.deductions?.product) || 0;
                    const bancos = Number(e.deductions?.bancos) || 0;
                    const otros = Number(e.deductions?.otros) || 0;
                    const judiciales = Number(e.deductions?.judiciales) || 0;
                    const seguro = Number(e.deductions?.seguro) || 0;
                    const parqueo = Number(e.deductions?.parqueo) || 0;
                    const boleto_de_ornato = Number(e.deductions?.boleto_de_ornato) || 0;
                    const otros_egresos = Number(e.deductions?.otros_egresos) || 0;
                    const anticipo = Number(e.anticipo1ra) || 0;

                    const totalEgresos = igss + isr + cafe + cell + uniform + shoes + equipo + product + bancos + otros + judiciales + seguro + parqueo + boleto_de_ornato + otros_egresos;
                    const liquido = salarioTotal - totalEgresos;
                    const q1 = periodType === '2da' ? anticipo : liquido;
                    const q2 = periodType === '2da' ? liquido - anticipo : 0;

                    const isHighlighted = highlightedRows.has(e.id);
                    const rowBg = isHighlighted ? highlightColor : 'transparent';
                    const stickyBg = isHighlighted ? highlightColor : tdBg;

                    return (
                      <Tr key={e.id} _hover={{ bg: isHighlighted ? highlightColor : hoverBg }} bg={rowBg} onDoubleClick={() => toggleRowHighlight(e.id)} userSelect="none">
                        {/* Sticky Cells */}
                        <Td position="sticky" left={0} zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontWeight="bold" fontSize="xs" cursor="pointer">
                          {i + 1}
                        </Td>
                        <Td position="sticky" left="60px" zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontWeight="600" color="brand.500" fontSize="xs" isTruncated maxW="200px" title={[e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ')} cursor="pointer">
                          {[e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ')}
                        </Td>
                        <Td position="sticky" left="260px" zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontSize="xs" isTruncated maxW="120px" title={companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'}>
                          {companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'}
                        </Td>
                        <Td position="sticky" left="380px" zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="xs" isTruncated maxW="120px">
                          {e.puesto || 'Sin Puesto'}
                        </Td>

                        {/* Editable and Calculated Cells */}
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="days" section="root" value={e.days} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                        <Td fontFamily="mono" fontSize="xs">{formatQ(baseSalary)}</Td>
                        <Td fontFamily="mono" fontSize="xs">{formatQ(bonusLey)}</Td>
                        <Td fontFamily="mono" fontSize="xs">{formatQ(bonusDec)}</Td>
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="bonos" section="extras" value={e.extras?.bonos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(devengado)}</Td>
                        
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="simplesQty" section="extras" value={e.extras?.simplesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="simplesVal" section="extras" value={e.extras?.simplesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="doblesQty" section="extras" value={e.extras?.doblesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="doblesVal" section="extras" value={e.extras?.doblesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="otrosIngresos" section="extras" value={e.extras?.otrosIngresos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(salarioTotal)}</Td>

                        <EditableCell onNavigate={handleNavigation} id={e.id} field="igss" section="deductions" value={e.deductions?.igss || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="isr" section="deductions" value={e.deductions?.isr || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="cafe" section="deductions" value={e.deductions?.cafe || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="cell" section="deductions" value={e.deductions?.cell || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="uniform" section="deductions" value={e.deductions?.uniform || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="shoes" section="deductions" value={e.deductions?.shoes || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="equipo" section="deductions" value={e.deductions?.equipo || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="product" section="deductions" value={e.deductions?.product || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="bancos" section="deductions" value={e.deductions?.bancos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="otros" section="deductions" value={e.deductions?.otros || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="judiciales" section="deductions" value={e.deductions?.judiciales || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="seguro" section="deductions" value={e.deductions?.seguro || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="parqueo" section="deductions" value={e.deductions?.parqueo || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="boleto_de_ornato" section="deductions" value={e.deductions?.boleto_de_ornato || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={85} isMoney isDanger />
                        <EditableCell onNavigate={handleNavigation} id={e.id} field="otros_egresos" section="deductions" value={e.deductions?.otros_egresos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={85} isMoney isDanger />
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(totalEgresos)}</Td>
                        
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500" bg={liquidoBg}>
                          {periodType === '2da' ? formatQ(liquido) : formatQ(liquido)}
                        </Td>
                        {periodType === '2da' && (
                          <>
                            <Td fontFamily="mono" fontSize="xs" color="gray.500">{formatQ(q1)}</Td>
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
                    <Th position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}>TOTAL</Th>
                    <Th position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}>CONSOLIDADO</Th>
                    <Th position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}></Th>
                    <Th position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)"></Th>
                    
                    <Th>{groupData.length} Emps</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totSalarioOrd)}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totBonInc)}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totBonDec)}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totBonos)}</Th>
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(columnTotals.totDevengado)}</Th>
                    
                    <Th>{columnTotals.totHorasSimples}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totValSimple)}</Th>
                    <Th>{columnTotals.totHorasDobles}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totValDouble)}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totOtrosIngresos)}</Th>
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(columnTotals.totSalarioTotal)}</Th>
                    
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totIgss)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totIsr)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totCafe)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totCell)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totUniform)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totShoes)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totEquipo)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totProduct)}</Th>
                    <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totBancos)}</Th>
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
              <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" overflowY="auto" bg={tdBg} maxH="550px">
              <Table variant="simple" size="sm" layout="fixed" style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content' }}>
                <Thead position="sticky" top={0} zIndex={15}>
                  <Tr>
                    {/* Sticky Headers */}
                    <Th w="60px" position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">No.</Th>
                    <Th w="200px" position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Nombre Empleado</Th>
                    <Th w="120px" position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Empresa</Th>
                    <Th w="120px" position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="10px">Puesto</Th>
                    
                    {/* Resumen Headers */}
                    <Th w="75px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Días Lab.</Th>
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">S. Ordinario</Th>
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bonificaciones</Th>
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="gold.500">Ingresos Extras</Th>
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.500">Total Egresos</Th>
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">Líquido a Recibir</Th>
                    {periodType === '2da' && (
                      <>
                        <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">1ra Quincena</Th>
                        <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">2da Quincena</Th>
                      </>
                    )}
                    <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" textAlign="center">Acciones</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {groupData.map((e, i) => {
                    const baseFactor = (e.days || 30) / 30;
                    const sueldoOrd = Number(e.sueldo_ordinario) || 0;
                    const bonInc = Number(e.bon_incentivo) || 0;
                    const bonDec = Number(e.bon_dec_37_2001) || 0;
                    const baseSalary = sueldoOrd * baseFactor;
                    const bonusLey = bonInc * baseFactor;
                    const bonusDec = bonDec * baseFactor;
                    const bonos = Number(e.extras?.bonos) || 0;
                    const devengado = baseSalary + bonusLey + bonusDec + bonos;
                    const simplesVal = Number(e.extras?.simplesVal) || 0;
                    const doblesVal = Number(e.extras?.doblesVal) || 0;
                    const otrosIngresos = Number(e.extras?.otrosIngresos) || 0;
                    const totalExtras = bonos + simplesVal + doblesVal + otrosIngresos;
                    const salarioTotal = devengado + simplesVal + doblesVal + otrosIngresos;
                    const totalEgresos = (Number(e.deductions?.igss)||0) + (Number(e.deductions?.isr)||0) + (Number(e.deductions?.cafe)||0) + (Number(e.deductions?.cell)||0) + (Number(e.deductions?.uniform)||0) + (Number(e.deductions?.shoes)||0) + (Number(e.deductions?.equipo)||0) + (Number(e.deductions?.product)||0) + (Number(e.deductions?.bancos)||0) + (Number(e.deductions?.otros)||0) + (Number(e.deductions?.judiciales)||0) + (Number(e.deductions?.seguro)||0) + (Number(e.deductions?.parqueo)||0) + (Number(e.deductions?.boleto_de_ornato)||0) + (Number(e.deductions?.otros_egresos)||0);
                    const liquido = salarioTotal - totalEgresos;
                    const anticipo = Number(e.anticipo1ra) || 0;
                    const q1 = periodType === '2da' ? anticipo : liquido;
                    const q2 = periodType === '2da' ? liquido - anticipo : 0;

                    const isHighlighted = highlightedRows.has(e.id);
                    const rowBg = isHighlighted ? highlightColor : 'transparent';
                    const stickyBg = isHighlighted ? highlightColor : tdBg;

                    return (
                      <Tr key={e.id} _hover={{ bg: isHighlighted ? highlightColor : hoverBg }} bg={rowBg} onDoubleClick={() => toggleRowHighlight(e.id)} userSelect="none">
                        <Td position="sticky" left={0} zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontWeight="bold" fontSize="xs" cursor="pointer">
                          {i + 1}
                        </Td>
                        <Td position="sticky" left="60px" zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontWeight="600" color="brand.500" fontSize="xs" isTruncated maxW="200px" title={[e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ')} cursor="pointer">
                          {[e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ')}
                        </Td>
                        <Td position="sticky" left="260px" zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} fontSize="xs" isTruncated maxW="120px" title={companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'}>
                          {companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'}
                        </Td>
                        <Td position="sticky" left="380px" zIndex={5} bg={stickyBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="xs" isTruncated maxW="120px">
                          {e.puesto || 'Sin Puesto'}
                        </Td>

                        <EditableCell id={e.id} field="days" section="root" value={e.days} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                        <Td fontFamily="mono" fontSize="xs">{formatQ(baseSalary)}</Td>
                        <Td fontFamily="mono" fontSize="xs">{formatQ(bonusLey + bonusDec)}</Td>
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(totalExtras)}</Td>
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(totalEgresos)}</Td>
                        <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500" bg={liquidoBg}>{formatQ(liquido)}</Td>
                        
                        {periodType === '2da' && (
                          <>
                            <Td fontFamily="mono" fontSize="xs" color="gray.500">{formatQ(q1)}</Td>
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
                    <Th position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}>TOTAL</Th>
                    <Th position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}>CONSOLIDADO</Th>
                    <Th position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}></Th>
                    <Th position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)"></Th>
                    
                    <Th>{groupData.length} Emps</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totSalarioOrd)}</Th>
                    <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totBonInc + columnTotals.totBonDec)}</Th>
                    <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(columnTotals.totBonos + columnTotals.totValSimple + columnTotals.totValDouble + columnTotals.totOtrosIngresos)}</Th>
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
                              onChange(selectedEmp.id, 'bonos', e.target.value, 'extras');
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

function DistributionTab({ data }) {
  const { companies: COMPANIES } = useContext(DataContext);
  const [expandedCompany, setExpandedCompany] = useState(null);

  const companyTotals = COMPANIES.map(c => {
    let salary = 0, bonus = 0, extras = 0, patronal = 0;
    const employees = [];
    data.filter(e => (e.estado || '').toUpperCase() === 'ACTIVO').forEach(e => {
      const distData = typeof e.dist === 'string' ? JSON.parse(e.dist) : e.dist;
      const pct = (distData?.[c.id] || 0) / 100;
      if (pct > 0) {
        const baseFactor = (e.days || 30) / 30;
        const sueldoOrd = Number(e.sueldo_ordinario) || 0;
        const bonInc = Number(e.bon_incentivo) || 0;
        
        const eSalary = (sueldoOrd * baseFactor) * pct;
        const eBonus = (bonInc * baseFactor) * pct;
        const eExtras = ((e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0)) * pct;
        const ePatronal = (sueldoOrd * baseFactor) * CUOTA_PATRONAL_RATE * pct;
        
        salary += eSalary;
        bonus += eBonus;
        extras += eExtras;
        patronal += ePatronal;

        const fullName = [e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido, e.apellido_casada].filter(Boolean).join(' ') || e.nombres || 'Empleado sin nombre';

        employees.push({
           ...e,
           fullName,
           pct,
           eSalary,
           eBonus,
           eExtras,
           ePatronal,
           eTotal: eSalary + eBonus + eExtras + ePatronal
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
                              <Th fontSize="xs">% Pago</Th>
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
