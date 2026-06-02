import React, { useState, useMemo, useContext } from 'react';
import {
  Save, Download, FileText, Check, X, Edit3,
  ChevronRight, AlertCircle, DollarSign, Clock,
  Calculator, Building2, Plus, ArrowLeft, Trash2, Calendar, Search, LayoutGrid, List, User, Edit2
} from 'lucide-react';
import { AppContext } from '../App';
import { DataContext } from '../context/DataContext';
import { CUOTA_PATRONAL_RATE, CUOTA_LABORAL_RATE, formatQ } from '../data/mockData';
import {
  Box, Flex, Text, Heading, Button, SimpleGrid, Avatar, IconButton,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  FormControl, FormLabel, Input, Select, InputGroup, InputLeftElement,
  Tabs, TabList, Tab,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  Badge, Divider, useColorModeValue, Center, Tag, HStack, VStack, Checkbox, ButtonGroup, Card, CardHeader, CardBody, CardFooter, Stat, StatLabel, StatNumber, StatGroup,
  AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, useDisclosure
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
  const { activePayrolls, deleteActivePayroll, createActivePayroll, updateDraftMetadata, companies } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  const [showModal, setShowModal] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [title, setTitle] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');

  const handleCreateOrUpdate = async () => {
    if (!title || !selectedCompany) return;
    
    if (editingDraftId) {
      await updateDraftMetadata(editingDraftId, title, [selectedCompany], draftDate ? new Date(draftDate).toISOString() : new Date().toISOString());
      setShowModal(false);
      showToast('Borrador actualizado', 'success');
    } else {
      const newId = createActivePayroll(title, [selectedCompany]);
      setShowModal(false);
      onSelectDraft(newId);
    }
  };

  const openEditModal = (draft) => {
    setEditingDraftId(draft.id);
    setTitle(draft.title || '');
    const dateStr = draft.createdAt ? new Date(draft.createdAt).toISOString().split('T')[0] : '';
    setDraftDate(dateStr);
    
    let comp = '';
    if (Array.isArray(draft.companies) && draft.companies.length > 0) comp = draft.companies[0];
    else if (typeof draft.companies === 'string') {
      try { const parsed = JSON.parse(draft.companies); comp = parsed[0] || ''; } catch(e) {}
    }
    setSelectedCompany(comp);
    setShowModal(true);
  };

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');

  return (
    <Box p={{ base: 4, md: 6 }}>
      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4}>
        <Box>
          <Heading size="lg" fontWeight={800} mb={1}>
            Nóminas en Progreso
          </Heading>
          <Text color="gray.500">
            Borradores activos que aún no han sido procesados definitivamente.
          </Text>
        </Box>
        <Button 
          colorScheme="brand" 
          leftIcon={<Plus size={16} />} 
          borderRadius="lg" 
          onClick={() => {
            setEditingDraftId(null);
            setTitle('');
            setDraftDate(new Date().toISOString().split('T')[0]);
            setSelectedCompany('');
            setShowModal(true);
          }}
        >
          Nueva Nómina
        </Button>
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
            _hover={{ transform: 'translateY(-4px)', boxShadow: 'lg' }}
          >
            <Flex position="absolute" top={3} right={3} gap={1}>
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
            </Flex>
            
            <Flex align="center" gap={4} mb={5}>
              <Center w="44px" h="44px" borderRadius="full" bg="brand.50" color="brand.500">
                <Calendar size={20} />
              </Center>
              <Box>
                <Heading size="sm" fontWeight={700} maxW="200px" isTruncated>{draft.title}</Heading>
                <Text fontSize="xs" color="gray.500">
                  Creada: {new Date(draft.createdAt).toLocaleDateString()}
                </Text>
              </Box>
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
                    return <Badge size="sm">Todas</Badge>;
                  }
                  return (
                    <Flex gap={1} wrap="wrap">
                      {companiesArr.map(c => <Badge key={c} colorScheme="brand" variant="subtle">{c}</Badge>)}
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
            bg={useColorModeValue('gray.50', 'whiteAlpha.50')}
          >
            <Text color="gray.500">
              No hay nóminas en progreso. Crea una nueva para comenzar.
            </Text>
          </Box>
        )}
      </SimpleGrid>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="md">
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
                <FormLabel>Empresa</FormLabel>
                <Select
                  value={selectedCompany}
                  onChange={e => setSelectedCompany(e.target.value)}
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

function PayrollEditor({ draftId, onBack }) {
  const { activePayrolls, updateActivePayroll, closePayroll, bonuses, areas, departments } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  
  const draft = activePayrolls.find(p => p.id === draftId);
  const data = draft?.employees || [];

  const [tabIndex, setTabIndex] = useState(0);
  const [editingCell, setEditingCell] = useState(null); // { id, field, type }
  
  const { isOpen: isAlertOpen, onOpen: onAlertOpen, onClose: onAlertClose } = useDisclosure();
  const cancelRef = React.useRef();

  // Filtering states
  const [filterArea, setFilterArea] = useState('');
  const [filterDept, setFilterDept] = useState('');
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

  const confirmClose = () => {
    closePayroll(draftId);
    showToast('Nómina cerrada exitosamente', 'success');
    onAlertClose();
    onBack();
  };

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return data.filter(e => {
      const fullName = `${e.primer_nombre || e.nombres || ''} ${e.primer_apellido || e.apellidos || ''}`.toLowerCase();
      const matchSearch = fullName.includes(searchQuery.toLowerCase()) || (e.puesto || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchArea = !filterArea || e.areaId?.toString() === filterArea;
      
      const matchDept = !filterDept || e.departamento_laboral === filterDept || e.departmentId?.toString() === filterDept;

      return matchSearch && matchArea && matchDept;
    });
  }, [data, searchQuery, filterArea, filterDept]);

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
    <Box p={{ base: 4, md: 6 }}>
      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4}>
        <Flex align="center" gap={4}>
          <IconButton aria-label="Back" icon={<ArrowLeft size={24} />} onClick={onBack} variant="ghost" />
          <Box>
            <Flex align="center" gap={3}>
              <Heading size="md" fontWeight={800}>{draft.title}</Heading>
              <Badge colorScheme="orange" variant="subtle" fontWeight={700}>Borrador</Badge>
            </Flex>
            <Text fontSize="sm" color="gray.500">
              {data.length} empleados en esta nómina
            </Text>
          </Box>
        </Flex>
        <Flex gap={2}>
          <Button 
            colorScheme="red" 
            leftIcon={<Check size={16} />} 
            onClick={onAlertOpen}
            _hover={{ bg: 'red.600', animation: 'none', transform: 'none' }}
          >
            Cerrar Nómina
          </Button>
        </Flex>
      </Flex>

      {/* Summary strip */}
      <Flex 
        p={6} 
        mb={6} 
        borderRadius="xl" 
        border="1px solid" 
        borderColor={borderColor} 
        gap={8} 
        wrap="wrap" 
        align="center"
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
            onChange={handleChange} 
            editingCell={editingCell} 
            setEditingCell={setEditingCell}
            areas={areas}
            departments={departments}
            filterArea={filterArea}
            setFilterArea={setFilterArea}
            filterDept={filterDept}
            setFilterDept={setFilterDept}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleClose={onAlertOpen}
          />
        )}
        {tab === 'distribution' && <DistributionTab data={data} />}
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

function ListadoPagosTab({ 
  data, onChange, editingCell, setEditingCell, 
  areas, departments, 
  filterArea, setFilterArea, 
  filterDept, setFilterDept, 
  searchQuery, setSearchQuery,
  handleClose 
}) {
  const { companies } = useContext(DataContext);
  const [viewMode, setViewMode] = useState('table');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const theadBg = useColorModeValue('gray.100', 'gray.900');
  const tdBg = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  // Compute column totals for the footer
  const columnTotals = useMemo(() => {
    let totSalarioOrd = 0, totBonInc = 0, totBonDec = 0, totBonos = 0, totDevengado = 0;
    let totHorasSimples = 0, totValSimple = 0, totHorasDobles = 0, totValDouble = 0, totOtrosIngresos = 0, totSalarioTotal = 0;
    let totIgss = 0, totIsr = 0, totCafe = 0, totCell = 0, totUniform = 0, totShoes = 0, totEquipo = 0, totProduct = 0, totBancos = 0, totOtros = 0, totJudiciales = 0, totSeguro = 0, totParqueo = 0, totBoleta = 0, totOtrosEgresos = 0, totTotalEgresos = 0;
    let totLiquido = 0, totQuincena1 = 0, totQuincena2 = 0;

    data.forEach(e => {
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
      
      const totalEgresos = igss + isr + cafe + cell + uniform + shoes + equipo + product + bancos + otros + judiciales + seguro + parqueo + boleto_de_ornato + otros_egresos;
      const liquido = salarioTotal - totalEgresos;
      const q1 = liquido > 0 ? liquido / 2 : 0;
      const q2 = liquido > 0 ? liquido - q1 : 0;

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
  }, [data]);

  const { confirmAction, showToast } = useContext(AppContext);

  return (
    <Box>
      {/* Filters bar */}
      <Flex gap={4} wrap="wrap" mb={4} align="center" justify="space-between">
        <HStack spacing={3} wrap="wrap" flex="1">
          <Select 
            placeholder="Filtrar por Área..." 
            value={filterArea} 
            onChange={e => setFilterArea(e.target.value)}
            w="200px"
            size="sm"
            borderRadius="md"
          >
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.nombre_dimension}</option>
            ))}
          </Select>
          <Select 
            placeholder="Filtrar por Departamento..." 
            value={filterDept} 
            onChange={e => setFilterDept(e.target.value)}
            w="200px"
            size="sm"
            borderRadius="md"
          >
            {departments.map(d => (
              <option key={d.id} value={d.nombre}>{d.nombre}</option>
            ))}
          </Select>
        </HStack>

        <HStack maxW="400px" spacing={3}>
          <InputGroup size="sm">
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
          <ButtonGroup size="sm" isAttached variant="outline">
            <IconButton icon={<List size={16} />} aria-label="Table View" onClick={() => setViewMode('table')} isActive={viewMode === 'table'} />
            <IconButton icon={<LayoutGrid size={16} />} aria-label="Grid View" onClick={() => setViewMode('grid')} isActive={viewMode === 'grid'} />
          </ButtonGroup>
        </HStack>
      </Flex>

      {/* Spreadsheet Table or Grid View */}
      {viewMode === 'table' ? (
        <TableContainer border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" bg={tdBg} maxH="550px">
        <Table variant="simple" size="sm" layout="fixed" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <Thead position="sticky" top={0} zIndex={15}>
            <Tr>
              {/* Sticky Headers */}
              <Th w="60px" position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">No.</Th>
              <Th w="200px" position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Nombre Empleado</Th>
              <Th w="120px" position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Empresa</Th>
              <Th w="120px" position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="10px">Puesto</Th>
              
              {/* Normal Headers */}
              <Th w="75px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Días Lab.</Th>
              <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">S. Ordinario</Th>
              <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bon. Incentivo</Th>
              <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bono Dec. 37-2001</Th>
              <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bonos</Th>
              <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">T. Devengado</Th>
              
              <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Simples</Th>
              <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Simp</Th>
              <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Dobles</Th>
              <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Dobl</Th>
              <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Otros Ingr.</Th>
              <Th w="115px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="gold.500">Salario Total</Th>
              
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
              <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.500">Total Egresos</Th>
              
              <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">Liquido Recibir</Th>
              <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">1ra Quincena</Th>
              <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">2da Quincena</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.map((e, i) => {
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

              const totalEgresos = igss + isr + cafe + cell + uniform + shoes + equipo + product + bancos + otros + judiciales + seguro + parqueo + boleto_de_ornato + otros_egresos;
              const liquido = salarioTotal - totalEgresos;
              const q1 = liquido > 0 ? liquido / 2 : 0;
              const q2 = liquido > 0 ? liquido - q1 : 0;

              return (
                <Tr key={e.id} _hover={{ bg: hoverBg }}>
                  {/* Sticky Cells */}
                  <Td position="sticky" left={0} zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontWeight="bold" fontSize="xs">
                    {i + 1}
                  </Td>
                  <Td position="sticky" left="60px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontWeight="600" color="brand.500" fontSize="xs" isTruncated maxW="200px" title={`${e.primer_nombre || e.nombres || ''} ${e.primer_apellido || e.apellidos || ''}`}>
                    {`${e.primer_nombre || e.nombres || ''} ${e.primer_apellido || e.apellidos || ''}`}
                  </Td>
                  <Td position="sticky" left="260px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontSize="xs" isTruncated maxW="120px" title={companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'}>
                    {companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'}
                  </Td>
                  <Td position="sticky" left="380px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="xs" isTruncated maxW="120px">
                    {e.puesto || 'Sin Puesto'}
                  </Td>

                  {/* Editable and Calculated Cells */}
                  <EditableCell id={e.id} field="days" section="root" value={e.days} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                  <Td fontFamily="mono" fontSize="xs">{formatQ(baseSalary)}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(bonusLey)}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(bonusDec)}</Td>
                  <EditableCell id={e.id} field="bonos" section="extras" value={e.extras?.bonos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(devengado)}</Td>
                  
                  <EditableCell id={e.id} field="simplesQty" section="extras" value={e.extras?.simplesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                  <EditableCell id={e.id} field="simplesVal" section="extras" value={e.extras?.simplesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                  <EditableCell id={e.id} field="doblesQty" section="extras" value={e.extras?.doblesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={60} />
                  <EditableCell id={e.id} field="doblesVal" section="extras" value={e.extras?.doblesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                  <EditableCell id={e.id} field="otrosIngresos" section="extras" value={e.extras?.otrosIngresos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney />
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(salarioTotal)}</Td>

                  <EditableCell id={e.id} field="igss" section="deductions" value={e.deductions?.igss || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="isr" section="deductions" value={e.deductions?.isr || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="cafe" section="deductions" value={e.deductions?.cafe || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="cell" section="deductions" value={e.deductions?.cell || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="uniform" section="deductions" value={e.deductions?.uniform || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="shoes" section="deductions" value={e.deductions?.shoes || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="equipo" section="deductions" value={e.deductions?.equipo || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="product" section="deductions" value={e.deductions?.product || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="bancos" section="deductions" value={e.deductions?.bancos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="otros" section="deductions" value={e.deductions?.otros || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="judiciales" section="deductions" value={e.deductions?.judiciales || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="seguro" section="deductions" value={e.deductions?.seguro || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="parqueo" section="deductions" value={e.deductions?.parqueo || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                  <EditableCell id={e.id} field="boleto_de_ornato" section="deductions" value={e.deductions?.boleto_de_ornato || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={85} isMoney isDanger />
                  <EditableCell id={e.id} field="otros_egresos" section="deductions" value={e.deductions?.otros_egresos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={85} isMoney isDanger />
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(totalEgresos)}</Td>
                  
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(liquido)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="gray.500">{formatQ(q1)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="gray.500">{formatQ(q2)}</Td>
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
              
              <Th>{data.length} Emps</Th>
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
              <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totQuincena1)}</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totQuincena2)}</Th>
            </Tr>
          </Thead>
        </Table>
      </TableContainer>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} spacing={4} maxH="550px" overflowY="auto" p={2}>
          {data.map((e, i) => {
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
            const salarioTotal = devengado + simplesVal + doblesVal + otrosIngresos;
            const totalEgresos = (Number(e.deductions?.igss)||0) + (Number(e.deductions?.isr)||0) + (Number(e.deductions?.cafe)||0) + (Number(e.deductions?.cell)||0) + (Number(e.deductions?.uniform)||0) + (Number(e.deductions?.shoes)||0) + (Number(e.deductions?.equipo)||0) + (Number(e.deductions?.product)||0) + (Number(e.deductions?.bancos)||0) + (Number(e.deductions?.otros)||0) + (Number(e.deductions?.judiciales)||0) + (Number(e.deductions?.seguro)||0) + (Number(e.deductions?.parqueo)||0) + (Number(e.deductions?.boleto_de_ornato)||0) + (Number(e.deductions?.otros_egresos)||0);
            const liquido = salarioTotal - totalEgresos;

            return (
              <Card key={e.id} variant="outline" bg={tdBg} borderColor={borderColor} boxShadow="sm" _hover={{ boxShadow: 'md' }}>
                <CardHeader pb={2}>
                  <Flex align="center" gap={3}>
                    <Avatar size="sm" icon={<User size={16} />} bg="brand.500" />
                    <Box flex="1" overflow="hidden">
                      <Heading size="sm" isTruncated title={`${e.primer_nombre || e.nombres || ''} ${e.primer_apellido || e.apellidos || ''}`}>
                        {`${e.primer_nombre || e.nombres || ''} ${e.primer_apellido || e.apellidos || ''}`}
                      </Heading>
                      <Text fontSize="xs" color="gray.500" isTruncated>{e.puesto || 'Sin Puesto'} - {companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa'}</Text>
                    </Box>
                  </Flex>
                </CardHeader>
                <CardBody py={2}>
                  <StatGroup>
                    <Stat>
                      <StatLabel fontSize="xs">T. Devengado</StatLabel>
                      <StatNumber fontSize="sm" color="brand.500">{formatQ(devengado)}</StatNumber>
                    </Stat>
                    <Stat>
                      <StatLabel fontSize="xs">Líquido</StatLabel>
                      <StatNumber fontSize="sm" color="brand.500">{formatQ(liquido)}</StatNumber>
                    </Stat>
                  </StatGroup>
                  <Divider my={3} />
                  <SimpleGrid columns={2} spacing={2}>
                    <Box>
                      <Text fontSize="10px" color="gray.500" textTransform="uppercase">Días Lab.</Text>
                      <Text fontSize="sm" fontWeight="semibold">{e.days || 30}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="10px" color="gray.500" textTransform="uppercase">Salario Ord.</Text>
                      <Text fontSize="sm" fontWeight="semibold" fontFamily="mono">{formatQ(baseSalary)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="10px" color="gray.500" textTransform="uppercase">Bonificación</Text>
                      <Text fontSize="sm" fontWeight="semibold" fontFamily="mono">{formatQ(bonusLey)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="10px" color="gray.500" textTransform="uppercase">Total Egresos</Text>
                      <Text fontSize="sm" fontWeight="semibold" color="red.500" fontFamily="mono">{formatQ(totalEgresos)}</Text>
                    </Box>
                  </SimpleGrid>
                </CardBody>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      {/* Action buttons and indicators in footer */}
      <Flex justify="space-between" align="center" mt={6} wrap="wrap" gap={4}>
        <Flex gap={3} wrap="wrap">
          <Button 
            variant="outline" 
            colorScheme="brand" 
            size="sm" 
            isDisabled 
            onClick={() => showToast('Configuración de Plantilla Proquima pendiente.', 'info')}
          >
            Plantilla Proquima (Pendiente)
          </Button>
          <Button 
            variant="outline" 
            colorScheme="brand" 
            size="sm" 
            isDisabled 
            onClick={() => showToast('Configuración de Plantilla Unhesa pendiente.', 'info')}
          >
            Plantilla Unhesa (Pendiente)
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            isDisabled 
            onClick={() => showToast('Reporte de Cheques pendiente de configuración.', 'info')}
          >
            Reporte Cheques (Pendiente)
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            isDisabled 
            onClick={() => showToast('Verificador de Pago pendiente de configuración.', 'info')}
          >
            Verificador De Pago (Pendiente)
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
}

function DistributionTab({ data }) {
  const { companies: COMPANIES } = useContext(DataContext);
  const companyTotals = COMPANIES.map(c => {
    let salary = 0, bonus = 0, extras = 0, patronal = 0;
    data.forEach(e => {
      const distData = typeof e.dist === 'string' ? JSON.parse(e.dist) : e.dist;
      const pct = (distData?.[c.id] || 0) / 100;
      const baseFactor = (e.days || 30) / 30;
      
      const sueldoOrd = Number(e.sueldo_ordinario) || 0;
      const bonInc = Number(e.bon_incentivo) || 0;
      
      salary += (sueldoOrd * baseFactor) * pct;
      bonus += (bonInc * baseFactor) * pct;
      extras += ((e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0)) * pct;
      patronal += (sueldoOrd * baseFactor) * CUOTA_PATRONAL_RATE * pct;
    });
    return { ...c, salary, bonus, extras, patronal, total: salary + bonus + extras + patronal };
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
        <Table variant="modern" size="sm">
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
            {companyTotals.map(c => (
              <Tr key={c.id}>
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
                  <Text fontSize="sm" fontFamily="mono" fontWeight={700} color="gold.500">{formatQ(c.total)}</Text>
                </Td>
              </Tr>
            ))}
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

function EditableCell({ id, field, section, value, onChange, editing, setEditing, width, isMoney, isDanger }) {
  const isEditing = editing?.id === id && editing?.field === field;
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
              setEditing(null);
            }
            if (e.key === 'Escape') setEditing(null);
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
      onClick={() => setEditing({ id, field })}
      cursor="pointer"
      transition="background-color 0.2s"
      _hover={{ bg: hoverBg }}
      title="Haz clic para editar"
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
      <Text fontSize="xs" fontWeight={600} color="gray.500" textTransform="uppercase" letterSpacing="0.05em" mb={1}>
        {label}
      </Text>
      <Text fontFamily="mono" fontWeight={800} fontSize={large ? '2xl' : 'xl'} color={color || 'gold.500'} letterSpacing="-0.02em">
        {value}
      </Text>
    </Box>
  );
}
