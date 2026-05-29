import React, { useState, useMemo, useContext } from 'react';
import {
  Save, Download, FileText, Check, X, Edit3,
  ChevronRight, AlertCircle, DollarSign, Clock,
  Calculator, Building2, Plus, ArrowLeft, Trash2, Calendar
} from 'lucide-react';
import { AppContext } from '../App';
import { DataContext } from '../context/DataContext';
import { CUOTA_PATRONAL_RATE, CUOTA_LABORAL_RATE, formatQ } from '../data/mockData';
import {
  Box, Flex, Text, Heading, Button, SimpleGrid, Avatar, IconButton,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  FormControl, FormLabel, Input, Select,
  Tabs, TabList, Tab,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  Badge, Divider, useColorModeValue, Center, Tag, HStack, VStack,
} from '@chakra-ui/react';

const TABS = [
  { id: 'income', label: 'Ingresos Variables', icon: DollarSign },
  { id: 'deductions', label: 'Deducciones', icon: AlertCircle },
  { id: 'summary', label: 'Pre-Nómina', icon: Calculator },
  { id: 'distribution', label: 'Distribución', icon: Building2 },
];

const DEDUCTION_LABELS = {
  isr: 'ISR', bank: 'Bancos', cell: 'Celular', cafe: 'Cafetería',
  product: 'Producto', insurance: 'Seguro', other: 'Otros', shoes: 'Calzado', uniform: 'Uniforme',
};

export default function PayrollProcessing() {
  const [selectedDraftId, setSelectedDraftId] = useState(null);

  if (selectedDraftId) {
    return <PayrollEditor draftId={selectedDraftId} onBack={() => setSelectedDraftId(null)} />;
  }

  return <PayrollHub onSelectDraft={setSelectedDraftId} />;
}

function PayrollHub({ onSelectDraft }) {
  const { activePayrolls, deleteActivePayroll, createActivePayroll, companies } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');

  const handleCreate = () => {
    if (!title || !selectedCompany) return;
    const newId = createActivePayroll(title, [selectedCompany]);
    setShowModal(false);
    onSelectDraft(newId);
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
            setTitle('');
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
            <IconButton 
              aria-label="Delete draft"
              icon={<Trash2 size={18} />}
              colorScheme="red"
              variant="ghost"
              position="absolute"
              top={3}
              right={3}
              onClick={() => {
                confirmAction('¿Eliminar este borrador? Se perderán todos los avances.', () => {
                  deleteActivePayroll(draft.id);
                  showToast('Borrador eliminado', 'info');
                });
              }}
            />
            
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
                Empleados: <Text as="span" fontWeight={700} color="brand.500">{draft.employees.length}</Text>
              </Text>
              <Box>
                <Text fontSize="sm" color="gray.500" mb={1}>Empresas:</Text>
                {draft.companies.length === 0 ? (
                  <Badge size="sm">Todas</Badge>
                ) : (
                  <Flex gap={1} wrap="wrap">
                    {draft.companies.map(c => <Badge key={c} colorScheme="brand" variant="subtle">{c}</Badge>)}
                  </Flex>
                )}
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
          <ModalHeader fontWeight={800}>Crear Nuevo Borrador</ModalHeader>
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
            <Button colorScheme="brand" onClick={handleCreate} isDisabled={!title.trim() || !selectedCompany}>
              Generar Borrador
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

function PayrollEditor({ draftId, onBack }) {
  const { activePayrolls, updateActivePayroll, closePayroll, bonuses } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  
  const draft = activePayrolls.find(p => p.id === draftId);
  const data = draft?.employees || [];

  const [tabIndex, setTabIndex] = useState(0);
  const [editingCell, setEditingCell] = useState(null); // { id, field, type }

  const tab = TABS[tabIndex].id;

  const handleChange = (id, section, field, value) => {
    const newData = data.map(e => {
      if (e.id !== id) return e;
      if (section === 'root') return { ...e, [field]: Number(value) || 0 };
      if (section === 'appliedBonuses') return { ...e, appliedBonuses: { ...e.appliedBonuses, [field]: Number(value) || 0 } };
      return { ...e, [section]: { ...e[section], [field]: Number(value) || 0 } };
    });
    updateActivePayroll(draftId, newData);
  };

  const handleClose = () => {
    confirmAction('¿Estás seguro de cerrar esta nómina? Se moverá al Historial y ya no podrá ser editada.', () => {
      closePayroll(draftId);
      showToast('Nómina cerrada exitosamente', 'success');
      onBack();
    });
  };

  const totals = useMemo(() => {
    let grossTotal = 0, dedTotal = 0, patronalTotal = 0;
    data.forEach(e => {
      const baseFactor = (e.days || 30) / 30;
      const sueldoOrd = Number(e.sueldo_ordinario) || 0;
      const bonInc = Number(e.bon_incentivo) || 0;

      const baseSalary = sueldoOrd * baseFactor;
      const bonusLey = bonInc * baseFactor;
      
      const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
      const gross = baseSalary + bonusLey + (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0) + bonusesSum;
      
      const igssLaboral = baseSalary * CUOTA_LABORAL_RATE;
      const customDed = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);
      const isr = Number(e.isr) || 0;
      const ded = customDed + igssLaboral + isr;
      
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
          <Button variant="outline" leftIcon={<Download size={16} />} onClick={() => showToast('Función en desarrollo', 'info')}>
            Excel
          </Button>
          <Button variant="outline" leftIcon={<FileText size={16} />} onClick={() => showToast('Función en desarrollo', 'info')}>
            PDF
          </Button>
          <Button colorScheme="brand" leftIcon={<Check size={16} />} onClick={handleClose}>
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
        {tab === 'income' && <IncomeTab data={data} onChange={handleChange} editingCell={editingCell} setEditingCell={setEditingCell} />}
        {tab === 'deductions' && <DeductionsTab data={data} onChange={handleChange} editingCell={editingCell} setEditingCell={setEditingCell} />}
        {tab === 'summary' && <SummaryTab data={data} bonuses={bonuses} />}
        {tab === 'distribution' && <DistributionTab data={data} />}
      </Box>
    </Box>
  );
}

function IncomeTab({ data, onChange, editingCell, setEditingCell }) {
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  
  return (
    <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" bg={useColorModeValue('white', 'gray.800')}>
      <Table variant="modern" size="sm">
        <Thead>
          <Tr>
            <Th>Empleado</Th>
            <Th>Días Lab.</Th>
            <Th>H.E. Simples (Cant)</Th>
            <Th>H.E. Simples (Q)</Th>
            <Th>H.E. Dobles (Cant)</Th>
            <Th>H.E. Dobles (Q)</Th>
            <Th>Comisiones</Th>
            <Th>Otros Ingresos</Th>
            <Th isNumeric>Total Bruto</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(e => {
            const baseFactor = (e.days || 30) / 30;
            const sueldoOrd = Number(e.sueldo_ordinario) || 0;
            const bonInc = Number(e.bon_incentivo) || 0;
            const extrasVal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
            const gross = (sueldoOrd * baseFactor) + (bonInc * baseFactor) + extrasVal;
            
            return (
              <Tr key={e.id}>
                <Td>
                  <Flex align="center" gap={3}>
                    <Avatar size="sm" name={`${e.nombres} ${e.apellidos}`} />
                    <Text fontSize="sm" fontWeight={600} color="brand.500">{e.nombres} {e.apellidos}</Text>
                  </Flex>
                </Td>
                <EditableCell id={e.id} field="days" section="root" value={e.days} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={70} />
                <EditableCell id={e.id} field="simplesQty" section="extras" value={e.extras?.simplesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={70} />
                <EditableCell id={e.id} field="simplesVal" section="extras" value={e.extras?.simplesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={90} isMoney />
                <EditableCell id={e.id} field="doblesQty" section="extras" value={e.extras?.doblesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={70} />
                <EditableCell id={e.id} field="doblesVal" section="extras" value={e.extras?.doblesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={90} isMoney />
                <EditableCell id={e.id} field="comisiones" section="extras" value={e.extras?.comisiones || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={100} isMoney />
                <EditableCell id={e.id} field="otrosIngresos" section="extras" value={e.extras?.otrosIngresos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={100} isMoney />
                <Td isNumeric>
                  <Text fontSize="sm" fontFamily="mono" fontWeight={700} color="gold.500">{formatQ(gross)}</Text>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </Box>
  );
}

function DeductionsTab({ data, onChange, editingCell, setEditingCell }) {
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');

  return (
    <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" bg={useColorModeValue('white', 'gray.800')}>
      <Table variant="modern" size="sm">
        <Thead>
          <Tr>
            <Th>Empleado</Th>
            <Th>IGSS (4.83%)</Th>
            {Object.keys(DEDUCTION_LABELS).map(k => <Th key={k}>{DEDUCTION_LABELS[k]}</Th>)}
            <Th isNumeric>Total Deducciones</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(e => {
            const baseFactor = (e.days || 30) / 30;
            const sueldoOrd = Number(e.sueldo_ordinario) || 0;
            const igssLaboral = (sueldoOrd * baseFactor) * CUOTA_LABORAL_RATE;
            const customDed = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);
            const totalDed = customDed + igssLaboral;
            
            return (
              <Tr key={e.id}>
                <Td>
                  <Flex align="center" gap={3}>
                    <Avatar size="sm" name={`${e.nombres} ${e.apellidos}`} />
                    <Text fontSize="sm" fontWeight={600} color="brand.500">{e.nombres} {e.apellidos}</Text>
                  </Flex>
                </Td>
                <Td color="gray.500" fontFamily="mono" title="Calculado automáticamente (4.83% s/ base proporc.)">{formatQ(igssLaboral)}</Td>
                {Object.keys(DEDUCTION_LABELS).map(k => (
                  <EditableCell key={k} id={e.id} field={k} section="deductions" value={e.deductions?.[k] || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                ))}
                <Td isNumeric>
                  <Text fontSize="sm" fontFamily="mono" fontWeight={700} color="red.500">{formatQ(totalDed)}</Text>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </Box>
  );
}

function SummaryTab({ data, bonuses }) {
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  return (
    <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" bg={useColorModeValue('white', 'gray.800')}>
      <Table variant="modern" size="sm">
        <Thead>
          <Tr>
            <Th minW="200px">Empleado</Th>
            <Th>Empresas</Th>
            <Th>Salario</Th>
            <Th>Bono Ley</Th>
            <Th>H. Extras</Th>
            {bonuses?.map(b => (
              <Th key={b.id}>{b.name}</Th>
            ))}
            <Th>Devengado (Bruto)</Th>
            <Th>IGSS</Th>
            <Th>Otras Ded.</Th>
            <Th isNumeric>Neto (Líquido)</Th>
            <Th isNumeric bg={hoverBg}>1ra Quincena</Th>
            <Th isNumeric bg={hoverBg}>2da Quincena</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map(e => {
            const baseFactor = (e.days || 30) / 30;
            const sueldoOrd = Number(e.sueldo_ordinario) || 0;
            const bonInc = Number(e.bon_incentivo) || 0;

            const baseSalary = sueldoOrd * baseFactor;
            const bonusLey = bonInc * baseFactor;
            
            const extrasTotal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
            const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
            const gross = baseSalary + bonusLey + extrasTotal + bonusesSum;
            
            const igssLaboral = baseSalary * CUOTA_LABORAL_RATE;
            const customDed = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);
            const isr = Number(e.isr) || 0;
            const ded = customDed + igssLaboral + isr;
            
            const net = gross - ded;
            const q1 = net > 0 ? net / 2 : 0;
            const q2 = net > 0 ? net - q1 : 0;
            
            return (
              <Tr key={e.id}>
                <Td>
                  <Text fontSize="sm" fontWeight={600} color="brand.500">{e.nombres} {e.apellidos}</Text>
                  <Text fontSize="xs" color="gray.500">{e.puesto_laboral || e.departamento_laboral || 'Sin puesto'}</Text>
                </Td>
                <Td>
                   <Flex gap={1} wrap="wrap">
                    {e.empresas?.map(emp => <Tag key={emp.id} size="sm" variant="subtle">{emp.nombre_comercial}</Tag>)}
                   </Flex>
                </Td>
                <Td fontFamily="mono">{formatQ(baseSalary)}</Td>
                <Td fontFamily="mono">{formatQ(bonusLey)}</Td>
                <Td fontFamily="mono" color={extrasTotal > 0 ? 'gold.500' : 'inherit'}>{extrasTotal > 0 ? formatQ(extrasTotal) : '—'}</Td>
                {bonuses?.map(b => (
                  <Td key={b.id} fontFamily="mono" color="gold.500">{formatQ(e.appliedBonuses?.[b.id] || 0)}</Td>
                ))}
                <Td fontFamily="mono" fontWeight={700} color="gold.500">{formatQ(gross)}</Td>
                <Td fontFamily="mono" color={igssLaboral > 0 ? 'red.500' : 'gray.500'}>{igssLaboral > 0 ? `- ${formatQ(igssLaboral)}` : '—'}</Td>
                <Td fontFamily="mono" color={customDed > 0 ? 'red.500' : 'gray.500'}>{customDed > 0 ? `- ${formatQ(customDed)}` : '—'}</Td>
                <Td isNumeric>
                  <Text fontSize="md" fontFamily="mono" fontWeight={800} color="brand.500">{formatQ(net)}</Text>
                </Td>
                <Td isNumeric bg={hoverBg}>
                  <Text fontSize="sm" fontFamily="mono" color="brand.500">{formatQ(q1)}</Text>
                </Td>
                <Td isNumeric bg={hoverBg}>
                  <Text fontSize="sm" fontFamily="mono" color="brand.500">{formatQ(q2)}</Text>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
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
          minW="60px"
          fontSize="sm"
          h="32px"
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
        fontSize="sm" 
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
