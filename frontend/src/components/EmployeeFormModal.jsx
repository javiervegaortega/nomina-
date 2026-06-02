import React, { useState, useEffect, useContext } from 'react';
import { X, Check, User, Building2, FileSignature, Landmark, MapPin, GraduationCap, Briefcase, FileWarning, Plus, Trash2, Edit3, Baby, Car, Heart } from 'lucide-react';
import {
  Modal, ModalOverlay, ModalContent,
  Box, Flex, Text, Button, Input, Select, Textarea,
  SimpleGrid, FormControl, FormLabel, Checkbox, GridItem,
  useColorModeValue, Icon, HStack, Badge, IconButton,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, VStack
} from '@chakra-ui/react';
import { DataContext } from '../context/DataContext';

function SidebarTab({ active, label, icon: IconComponent, onClick }) {
  const activeBg = useColorModeValue('white', 'rgba(30, 41, 59, 0.8)');
  const hoverBg = useColorModeValue('gray.100', 'whiteAlpha.50');
  const activeColor = useColorModeValue('brand.500', 'brand.400');
  const activeTextColor = useColorModeValue('brand.600', 'brand.200');
  const inactiveTextColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Button
      w="100%"
      justifyContent="flex-start"
      variant="ghost"
      borderRadius="lg"
      py={5}
      px={3}
      bg={active ? activeBg : 'transparent'}
      borderLeft="3px solid"
      borderLeftColor={active ? activeColor : 'transparent'}
      color={active ? activeTextColor : inactiveTextColor}
      fontWeight={active ? 600 : 500}
      fontSize="0.85rem"
      onClick={onClick}
      transition="all 0.2s"
      _hover={{
        bg: active ? activeBg : hoverBg,
        transform: 'translateX(2px)',
      }}
      _active={{ bg: activeBg }}
      leftIcon={<IconComponent size={18} color={active ? undefined : 'currentColor'} />}
      iconSpacing={3}
    >
      {label}
    </Button>
  );
}

const SectionTitle = ({ title }) => {
  const textColor = useColorModeValue('gray.800', 'white');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  return (
    <Box mb={4} mt={6} borderBottom="1px solid" borderColor={borderColor} pb={2}>
      <Text fontSize="xs" fontWeight={700} color={textColor} textTransform="uppercase" letterSpacing="wider">
        {title}
      </Text>
    </Box>
  );
};

const Field = ({ label, val, onChange, type = 'text', required, error, placeholder }) => {
  const labelColor = useColorModeValue('gray.700', 'gray.300');
  const inputBg = useColorModeValue('white', 'whiteAlpha.50');
  const inputBorder = useColorModeValue('gray.200', 'whiteAlpha.100');
  
  return (
    <FormControl isRequired={required} isInvalid={!!error}>
      <FormLabel fontSize="11px" mb={1} color={error ? 'red.500' : labelColor} fontWeight="600" textTransform="uppercase" letterSpacing="wide">
        {label}
      </FormLabel>
      <Input
        size="sm"
        type={type}
        value={val || ''}
        onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        borderRadius="md"
        bg={inputBg}
        borderColor={error ? 'red.400' : inputBorder}
        placeholder={placeholder}
        _hover={{ borderColor: error ? 'red.500' : 'brand.300' }}
        _focus={{ borderColor: error ? 'red.500' : 'brand.500', boxShadow: 'none' }}
      />
      {error && <Text color="red.500" fontSize="xs" mt={1} fontWeight="bold">{error}</Text>}
    </FormControl>
  );
};

const SelectField = ({ label, val, onChange, options, required }) => {
  const labelColor = useColorModeValue('gray.700', 'gray.300');
  const inputBg = useColorModeValue('white', 'whiteAlpha.50');
  const inputBorder = useColorModeValue('gray.200', 'whiteAlpha.100');
  
  return (
    <FormControl isRequired={required}>
      <FormLabel fontSize="11px" mb={1} color={labelColor} fontWeight="600" textTransform="uppercase" letterSpacing="wide">
        {label}
      </FormLabel>
      <Select
        size="sm"
        value={val || ''}
        onChange={e => onChange(e.target.value)}
        borderRadius="md"
        bg={inputBg}
        borderColor={inputBorder}
        _hover={{ borderColor: 'brand.300' }}
        _focus={{ borderColor: 'brand.500', boxShadow: 'none' }}
      >
        <option value="">Seleccione...</option>
        {options.map((opt, i) => (
          <option key={i} value={opt.id || opt.value || opt}>{opt.label || opt.nombre_dimension || opt.nombre || opt}</option>
        ))}
      </Select>
    </FormControl>
  );
};

// ============ RECORD TABLE COMPONENT ============
function RecordTable({ records, columns, onDelete, onEdit, emptyText = 'Sin registros' }) {
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  
  if (!records || records.length === 0) {
    return (
      <Box textAlign="center" p={6} border="1px dashed" borderColor={borderColor} borderRadius="lg">
        <Text fontSize="sm" color="gray.500">{emptyText}</Text>
      </Box>
    );
  }

  return (
    <TableContainer border="1px solid" borderColor={borderColor} borderRadius="lg" maxH="250px" overflowY="auto">
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            {columns.map((col, i) => <Th key={i} fontSize="10px">{col.label}</Th>)}
            <Th fontSize="10px" w="80px">Acciones</Th>
          </Tr>
        </Thead>
        <Tbody>
          {records.map((r, i) => (
            <Tr key={r.id || i} _hover={{ bg: hoverBg }}>
              {columns.map((col, j) => (
                <Td key={j} fontSize="xs">{col.render ? col.render(r.data) : (r.data?.[col.key] || '-')}</Td>
              ))}
              <Td>
                <HStack spacing={1}>
                  {onEdit && <IconButton icon={<Edit3 size={14} />} size="xs" variant="ghost" onClick={() => onEdit(r)} aria-label="Edit" />}
                  {onDelete && <IconButton icon={<Trash2 size={14} />} size="xs" variant="ghost" colorScheme="red" onClick={() => onDelete(r.id)} aria-label="Delete" />}
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
}

// ============ INLINE RECORD FORM ============
function InlineRecordForm({ fields, onSave, onCancel, initialData }) {
  const [formData, setFormData] = useState(initialData || {});
  const inputBg = useColorModeValue('white', 'whiteAlpha.50');

  return (
    <Box p={4} borderRadius="lg" border="1px solid" borderColor="brand.200" bg={useColorModeValue('brand.50', 'whiteAlpha.50')} mb={4}>
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={3} mb={3}>
        {fields.map((f, i) => (
          <FormControl key={i}>
            <FormLabel fontSize="10px" mb={0.5} fontWeight="600" textTransform="uppercase">{f.label}</FormLabel>
            {f.type === 'select' ? (
              <Select size="xs" value={formData[f.key] || ''} onChange={e => setFormData({...formData, [f.key]: e.target.value})} bg={inputBg}>
                <option value="">Seleccione...</option>
                {(f.options || []).map((o, j) => <option key={j} value={o}>{o}</option>)}
              </Select>
            ) : f.type === 'checkbox' ? (
              <Checkbox size="sm" isChecked={!!formData[f.key]} onChange={e => setFormData({...formData, [f.key]: e.target.checked})}>{f.label}</Checkbox>
            ) : (
              <Input size="xs" type={f.type || 'text'} value={formData[f.key] || ''} onChange={e => setFormData({...formData, [f.key]: e.target.value})} bg={inputBg} />
            )}
          </FormControl>
        ))}
      </SimpleGrid>
      <HStack spacing={2}>
        <Button size="xs" colorScheme="brand" leftIcon={<Check size={12} />} onClick={() => onSave(formData)}>Guardar</Button>
        <Button size="xs" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </HStack>
    </Box>
  );
}


export default function EmployeeFormModal({ mode, initialData, onClose, onSave, employees = [], companies, departments, areas, divisions, subdivisions }) {
  const { addEmployeeRecord, updateEmployeeRecord, deleteEmployeeRecord } = useContext(DataContext);
  const [tab, setTab] = useState('personal');
  const [form, setForm] = useState(() => {
    const data = initialData ? { ...initialData } : {};
    if (typeof data.dist === 'string') {
      try { data.dist = JSON.parse(data.dist); } catch(e) { data.dist = {}; }
    }
    return data;
  });

  // Record inline form states
  const [showRecordForm, setShowRecordForm] = useState(null); // 'estudio', 'curso', etc.
  const [editingRecord, setEditingRecord] = useState(null);

  useEffect(() => {
    const data = initialData ? { ...initialData } : {};
    if (typeof data.dist === 'string') {
      try { data.dist = JSON.parse(data.dist); } catch(e) { data.dist = {}; }
    }
    setForm(data);
  }, [initialData]);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const duplicateDpi = employees.find(e => e.dpi === form.dpi && e.id !== form.id && form.dpi?.trim());
  const duplicateIgss = employees.find(e => e.no_igss === form.no_igss && e.id !== form.id && form.no_igss?.trim());

  const handleSave = () => {
    if (distTotal !== 100) return;
    if (duplicateDpi || duplicateIgss) return;
    onSave(form);
  };

  let parsedDistValues = [];
  if (typeof form.dist === 'object' && form.dist !== null) {
    parsedDistValues = Object.values(form.dist);
  } else if (typeof form.dist === 'string') {
    try {
      const parsed = JSON.parse(form.dist);
      parsedDistValues = Object.values(parsed);
      form.dist = parsed;
    } catch(e) {
      parsedDistValues = [];
    }
  }

  const distTotal = parsedDistValues.reduce((a, b) => Number(a) + Number(b), 0);

  const sidebarBg = useColorModeValue('gray.50', '#151923');
  const borderColor = useColorModeValue('gray.200', '#2d3748');
  const footerBg = useColorModeValue('gray.50', '#151923');
  const subtitleColor = useColorModeValue('gray.500', 'gray.400');
  const distBoxBg = useColorModeValue('white', 'whiteAlpha.50');
  const distBoxBorder = useColorModeValue('gray.200', 'whiteAlpha.100');

  // IGSS Auto calculations
  const calcIgssPatronal = (sueldo) => ((Number(sueldo) || 0) * 0.1067).toFixed(2);
  const calcIrtra = () => '20.00';
  const calcIntecap = () => '20.00';
  const calcIgssLaboral = (sueldo) => ((Number(sueldo) || 0) * 0.0483).toFixed(2);

  const igssPatronal = Number(form.igss_patronal) || Number(calcIgssPatronal(form.sueldo_ordinario));
  const irtra = Number(form.irtra) || 20;
  const intecap = Number(form.intecap) || 20;
  const totalIgssPatronal = (igssPatronal + irtra + intecap).toFixed(2);

  // Get records by type
  const getRecords = (type) => (form.records || []).filter(r => r.type === type);

  // Handle record save
  const handleRecordSave = async (type, data) => {
    if (form.id) {
      if (editingRecord) {
        await updateEmployeeRecord(editingRecord.id, data);
        setForm(prev => ({
          ...prev,
          records: (prev.records || []).map(r => r.id === editingRecord.id ? { ...r, data } : r)
        }));
      } else {
        const newRec = await addEmployeeRecord(form.id, type, data);
        if (newRec) {
          setForm(prev => ({
            ...prev,
            records: [...(prev.records || []), newRec]
          }));
        }
      }
    } else {
      // New employee, store locally until save
      const tempRecord = { id: Date.now(), type, data, created_at: new Date().toISOString() };
      setForm(prev => ({
        ...prev,
        records: [...(prev.records || []), tempRecord]
      }));
    }
    setShowRecordForm(null);
    setEditingRecord(null);
  };

  const handleRecordDelete = async (recordId) => {
    if (form.id) {
      await deleteEmployeeRecord(form.id, recordId);
    }
    setForm(prev => ({
      ...prev,
      records: (prev.records || []).filter(r => r.id !== recordId)
    }));
  };

  const TAB_TITLES = {
    personal: 'Datos Personales',
    empresa: 'Empresa Del Empleado',
    contrato: 'DPI / IGSS / Banco',
    planilla: 'Planilla (Devengados y Descuentos)',
    origen: 'Originario e IGSS',
    formacion: 'Formación Académica',
    historial: 'Historial Laboral y Eventos',
    expediente: 'Expediente / Llamadas de Atención',
    familia: 'Familia e Hijos',
    experiencia: 'Experiencia y Vehículos',
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="6xl" isCentered motionPreset="slideInBottom">
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent
        maxW="1100px"
        h="88vh"
        borderRadius="2xl"
        boxShadow="2xl"
        bg={useColorModeValue('white', '#0f111a')}
        overflow="hidden"
        display="flex"
        flexDirection="row"
      >
        {/* SIDEBAR NAV */}
        <Box
          w="260px"
          bg={sidebarBg}
          borderRight="1px solid"
          borderColor={borderColor}
          p={6}
          display="flex"
          flexDirection="column"
        >
          <Box mb={8}>
            <Text fontSize="xl" fontWeight={800} color={useColorModeValue('gray.800', 'white')} letterSpacing="tight">
              Detalle Empleado
            </Text>
            <Text fontSize="xs" color={subtitleColor} mt={1}>
              Modifique la información llenando los campos solicitados
            </Text>
          </Box>

          <Flex direction="column" gap={1} flex={1} overflowY="auto">
            <SidebarTab active={tab === 'personal'} label="Datos Personales" icon={User} onClick={() => setTab('personal')} />
            <SidebarTab active={tab === 'empresa'} label="Empresa y Jerarquía" icon={Building2} onClick={() => setTab('empresa')} />
            <SidebarTab active={tab === 'contrato'} label="Identidad y Banco" icon={FileSignature} onClick={() => setTab('contrato')} />
            <SidebarTab active={tab === 'planilla'} label="Planilla (Salarios)" icon={Landmark} onClick={() => setTab('planilla')} />
            <SidebarTab active={tab === 'origen'} label="Originario e IGSS" icon={MapPin} onClick={() => setTab('origen')} />
            <SidebarTab active={tab === 'formacion'} label="Formación" icon={GraduationCap} onClick={() => setTab('formacion')} />
            <SidebarTab active={tab === 'historial'} label="Historial Laboral" icon={Briefcase} onClick={() => setTab('historial')} />
            <SidebarTab active={tab === 'expediente'} label="Expediente" icon={FileWarning} onClick={() => setTab('expediente')} />
            <SidebarTab active={tab === 'familia'} label="Familia e Hijos" icon={Heart} onClick={() => setTab('familia')} />
            <SidebarTab active={tab === 'experiencia'} label="Experiencia y Vehículos" icon={Car} onClick={() => setTab('experiencia')} />
          </Flex>
        </Box>

        {/* MAIN CONTENT */}
        <Flex flex={1} direction="column" h="100%" position="relative">
          <Box p={6} pb={4} borderBottom="1px solid" borderColor={borderColor}>
            <Flex justify="space-between" align="center">
              <Text fontSize="lg" fontWeight={700}>
                {TAB_TITLES[tab] || ''}
              </Text>
              <Button size="sm" variant="ghost" onClick={onClose} color={subtitleColor} _hover={{ bg: 'whiteAlpha.100' }}>
                <X size={20} />
              </Button>
            </Flex>
          </Box>

          <Box flex={1} overflowY="auto" p={6} css={{ '&::-webkit-scrollbar': { width: '8px' }, '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-whiteAlpha-300)', borderRadius: '10px' } }}>
            
            {/* ═══ DATOS PERSONALES ═══ */}
            {tab === 'personal' && (
              <Box>
                <SectionTitle title="Nombres y Apellidos" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
                  <Field label="Primer Nombre (Obligatorio)" val={form.primer_nombre} onChange={v => handleChange('primer_nombre', v)} required />
                  <Field label="Segundo Nombre" val={form.segundo_nombre} onChange={v => handleChange('segundo_nombre', v)} />
                  <GridItem colSpan={{ base: 1, sm: 2 }}>
                    <Field label="Otros Nombres" val={form.otro_nombre} onChange={v => handleChange('otro_nombre', v)} />
                  </GridItem>
                  <Field label="Primer Apellido (Obligatorio)" val={form.primer_apellido} onChange={v => handleChange('primer_apellido', v)} required />
                  <Field label="Segundo Apellido" val={form.segundo_apellido} onChange={v => handleChange('segundo_apellido', v)} />
                  <GridItem colSpan={{ base: 1, sm: 2 }}>
                    <Field label="Apellido Casada" val={form.apellido_casada} onChange={v => handleChange('apellido_casada', v)} />
                  </GridItem>
                </SimpleGrid>

                <SectionTitle title="Estados del Empleado" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5}>
                  <SelectField label="Estado Empleado (Obligatorio)" val={form.estado} onChange={v => handleChange('estado', v)} options={['Activo', 'Inactivo', 'Nivel 5...']} required />
                  <SelectField label="Estado Civil (Obligatorio)" val={form.estado_civil} onChange={v => handleChange('estado_civil', v)} options={['Soltero/a', 'Casado/a', 'Unido/a', 'Divorciado/a']} required />
                  <SelectField label="Género (Obligatorio)" val={form.genero} onChange={v => handleChange('genero', v)} options={['Masculino', 'Femenino']} required />
                </SimpleGrid>

                <SectionTitle title="Contacto" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
                  <Field label="Teléfono Domiciliar" val={form.telefono} onChange={v => handleChange('telefono', v)} />
                  <Field label="Celular Personal" val={form.telefono_celular} onChange={v => handleChange('telefono_celular', v)} />
                  <Field label="Teléfono Emergencia" val={form.telefono_emergencia} onChange={v => handleChange('telefono_emergencia', v)} />
                  <Field label="Nombre Emergencia" val={form.nombre_emergencia} onChange={v => handleChange('nombre_emergencia', v)} />
                  <GridItem colSpan={{ base: 1, sm: 2 }}>
                    <Field label="Dirección (Obligatorio)" val={form.direccion} onChange={v => handleChange('direccion', v)} required />
                  </GridItem>
                </SimpleGrid>

                <SectionTitle title="Nacimiento y Licencias" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <FormControl isRequired>
                    <FormLabel fontSize="11px" mb={1} color={subtitleColor} fontWeight="600" textTransform="uppercase">Fecha de Nacimiento (Obligatorio)</FormLabel>
                    <Input size="sm" type="date" value={form.fecha_nacimiento?.split('T')[0] || ''} onChange={e => handleChange('fecha_nacimiento', e.target.value)} />
                  </FormControl>
                  <Field label="Edad (Obligatorio)" val={form.edad} onChange={v => handleChange('edad', v)} required />
                  <Field label="Nacionalidad (Obligatorio)" val={form.nacionalidad} onChange={v => handleChange('nacionalidad', v)} required />
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5}>
                  <SelectField label="Tipo Licencia" val={form.tipo_licencia} onChange={v => handleChange('tipo_licencia', v)} options={['A', 'B', 'C', 'M']} />
                  <SelectField label="Clase Licencia" val={form.clase_licencia} onChange={v => handleChange('clase_licencia', v)} options={['Carro', 'Moto', 'Pesado']} />
                  <Field label="No. Licencia" val={form.licencia} onChange={v => handleChange('licencia', v)} />
                </SimpleGrid>
              </Box>
            )}

            {/* ═══ EMPRESA Y JERARQUIA ═══ */}
            {tab === 'empresa' && (
              <Box>
                <SectionTitle title="Jerarquía Corporativa" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={6} mb={8}>
                  <SelectField label="Departamento (OBLIGATORIO)" val={form.departamento_laboral} onChange={v => handleChange('departamento_laboral', v)} options={departments?.map(d=>d.nombre_dimension) || []} required />
                  <SelectField label="Área (OBLIGATORIO)" val={form.areaId} onChange={v => handleChange('areaId', v)} options={areas || []} required />
                  <SelectField label="División (OBLIGATORIO)" val={form.divisionId} onChange={v => handleChange('divisionId', v)} options={divisions || []} required />
                  <SelectField label="Sub División" val={form.subdivisionId} onChange={v => handleChange('subdivisionId', v)} options={subdivisions || []} />
                  <Field label="Nivel 5" val={form.nivel_5} onChange={v => handleChange('nivel_5', v)} />
                  <Field label="Puesto (OBLIGATORIO)" val={form.puesto} onChange={v => handleChange('puesto', v)} required />
                  <Field label="Centro de Costo" val={form.centro_de_costo} onChange={v => handleChange('centro_de_costo', v)} />
                  <Field label="Código Ocupación" val={form.codigo_ocupacion} onChange={v => handleChange('codigo_ocupacion', v)} />
                </SimpleGrid>

                <SectionTitle title="Distribución por Empresa" />
                <Box mb={6} p={5} borderRadius="xl" bg={distBoxBg} border="1px solid" borderColor={distTotal !== 100 ? 'red.400' : distBoxBorder}>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Box>
                      <Text fontSize="sm" fontWeight={700} color={distTotal !== 100 ? 'red.500' : 'inherit'}>Empresas Asignadas</Text>
                      {distTotal !== 100 && (
                        <Text fontSize="xs" color="red.500" fontWeight="bold">
                          Aviso: Por favor asegúrate de que la distribución sume exactamente 100%. (Actual: {distTotal}%)
                        </Text>
                      )}
                    </Box>
                    <Badge colorScheme={distTotal === 100 ? 'green' : 'red'} px={2}>{distTotal}%</Badge>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, md: 3 }} mb={2} px={4} borderBottom="1px solid" borderColor={borderColor} pb={2}>
                    <Text fontSize="xs" fontWeight={700} color={subtitleColor}>Empresa</Text>
                    <Text fontSize="xs" fontWeight={700} color={subtitleColor}>Porcentaje</Text>
                    <Text fontSize="xs" fontWeight={700} color={subtitleColor} textAlign="center">Principal</Text>
                  </SimpleGrid>
                  {companies?.map(c => (
                    <SimpleGrid columns={{ base: 1, md: 3 }} key={c.id} py={3} px={4} borderBottom="1px solid" borderColor={distBoxBorder} alignItems="center" transition="all 0.2s" _hover={{ bg: 'whiteAlpha.100' }}>
                      <Text fontSize="sm" fontWeight={600}>{c.nombre_comercial}</Text>
                      <Box pr={4}>
                        <Input 
                          size="sm" type="number" 
                          value={form.dist?.[c.id] !== undefined ? form.dist[c.id] : 0}
                          onChange={e => handleChange('dist', { ...form.dist, [c.id]: e.target.value === '' ? '' : Number(e.target.value) })}
                          bg="whiteAlpha.50"
                          borderColor={distTotal !== 100 ? 'red.300' : 'inherit'}
                          _focus={{ borderColor: distTotal !== 100 ? 'red.500' : 'brand.500' }}
                        />
                      </Box>
                      <Flex justify="center">
                        <Checkbox 
                          colorScheme="brand" 
                          isChecked={form.empresa_principal === c.id}
                          onChange={() => handleChange('empresa_principal', c.id)}
                        />
                      </Flex>
                    </SimpleGrid>
                  ))}
                </Box>
              </Box>
            )}

            {/* ═══ IDENTIDAD Y CONTRATO ═══ */}
            {tab === 'contrato' && (
              <Box>
                <SectionTitle title="Identificación Legal" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <Field label="DPI" val={form.dpi} onChange={v => handleChange('dpi', v)} error={duplicateDpi ? 'Este DPI ya está registrado' : null} />
                  <Field label="Lugar Emisión DPI" val={form.lugar_emision_dpi} onChange={v => handleChange('lugar_emision_dpi', v)} />
                  <Field label="Emisión DPI" val={form.emision_dpi} onChange={v => handleChange('emision_dpi', v)} />
                  <Field label="NIT" val={form.nit} onChange={v => handleChange('nit', v)} />
                  <Field label="No. IGSS" val={form.no_igss} onChange={v => handleChange('no_igss', v)} error={duplicateIgss ? 'Este No. IGSS ya está registrado' : null} />
                  <Field label="Afiliación IGSS" val={form.afiliacion} onChange={v => handleChange('afiliacion', v)} />
                </SimpleGrid>

                <SectionTitle title="Datos Bancarios" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <Field label="No. Cuenta" val={form.no_cuenta} onChange={v => handleChange('no_cuenta', v)} />
                  <SelectField label="Banco" val={form.banco} onChange={v => handleChange('banco', v)} options={['Banrural', 'Industrial', 'Promerica', 'Bantrab', 'G&T Continental']} />
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5} mb={5}>
                  <SelectField label="Tipo de pago (Obligatorio)" val={form.tipo_de_pago} onChange={v => handleChange('tipo_de_pago', v)} options={['Transferencia', 'Cheque', 'Efectivo']} required />
                  <SelectField label="Tipo de Cuenta" val={form.tipo_cuenta} onChange={v => handleChange('tipo_cuenta', v)} options={['Monetaria', 'Ahorro']} />
                  <SelectField label="Moneda (Obligatorio)" val={form.moneda} onChange={v => handleChange('moneda', v)} options={['GTQ', 'USD']} required />
                </SimpleGrid>

                <SectionTitle title="Información de Contrato" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5}>
                  <FormControl isRequired>
                    <FormLabel fontSize="11px" mb={1} color={subtitleColor} fontWeight="600" textTransform="uppercase">Fecha Inicio (Obligatorio)</FormLabel>
                    <Input size="sm" type="date" value={form.fecha_inicio?.split('T')[0] || ''} onChange={e => handleChange('fecha_inicio', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="11px" mb={1} color={subtitleColor} fontWeight="600" textTransform="uppercase">Fecha Baja</FormLabel>
                    <Input size="sm" type="date" value={form.fecha_baja?.split('T')[0] || ''} onChange={e => handleChange('fecha_baja', e.target.value)} />
                  </FormControl>
                  <SelectField label="Condición laboral" val={form.condicion_laboral} onChange={v => handleChange('condicion_laboral', v)} options={['Quetzal', 'Dólar']} />
                </SimpleGrid>
                {form.fecha_baja && (
                  <Box mt={4}>
                    <Field label="Motivo de Baja" val={form.motivo_baja} onChange={v => handleChange('motivo_baja', v)} />
                  </Box>
                )}
                
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5} mt={5}>
                  <SelectField label="Jornada (Obligatorio)" val={form.jornada} onChange={v => handleChange('jornada', v)} options={['Fija', 'Diurna', 'Nocturna', 'Mixta']} required />
                  <Field label="Horas Laborales" val={form.horas_laborales} onChange={v => handleChange('horas_laborales', v)} type="number" />
                  <Field label="Días Laborados" val={form.dias_laborados} onChange={v => handleChange('dias_laborados', v)} type="number" />
                  <Field label="ID Permisos" val={form.rol_permisos} onChange={v => handleChange('rol_permisos', v)} />
                  <FormControl>
                    <FormLabel fontSize="11px" mb={1} color={subtitleColor} fontWeight="600" textTransform="uppercase">Temporal (Fecha)</FormLabel>
                    <Input size="sm" type="date" value={form.temporal?.split?.('T')?.[0] || ''} onChange={e => handleChange('temporal', e.target.value)} />
                  </FormControl>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5} mt={5}>
                  <FormControl display="flex" alignItems="center" h="100%">
                    <Checkbox isChecked={form.jubilacion} onChange={e => handleChange('jubilacion', e.target.checked)}>
                      <Text fontSize="sm" fontWeight={600} ml={2}>Jubilación</Text>
                    </Checkbox>
                  </FormControl>
                  <Field label="Discapacidad" val={form.discapacidad} onChange={v => handleChange('discapacidad', v)} />
                  <FormControl display="flex" alignItems="center" h="100%">
                    <Checkbox isChecked={form.horas_extra} onChange={e => handleChange('horas_extra', e.target.checked)}>
                      <Text fontSize="sm" fontWeight={600} ml={2}>Horas Extra</Text>
                    </Checkbox>
                  </FormControl>
                </SimpleGrid>
              </Box>
            )}

            {/* ═══ PLANILLA (SALARIOS Y DESCUENTOS) ═══ */}
            {tab === 'planilla' && (
              <Box>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
                  {/* DEVENGADOS */}
                  <Box>
                    <SectionTitle title="Devengados" />
                    <Field label="Sueldo Ordinario (Obligatorio)" type="number" val={form.sueldo_ordinario} onChange={v => handleChange('sueldo_ordinario', v)} required />
                    <Box mt={4}><Field label="Bonificación Decreto 37-2001 (Obligatorio)" type="number" val={form.bon_dec_37_2001 ?? 250} onChange={v => handleChange('bon_dec_37_2001', v)} required /></Box>
                    <Box mt={4}><Field label="Bonificación Incentivo" type="number" val={form.bon_incentivo ?? 0} onChange={v => handleChange('bon_incentivo', v)} /></Box>
                    <Box mt={4}><Field label="Otros Ingresos" type="number" val={form.otro_ingresos ?? 0} onChange={v => handleChange('otro_ingresos', v)} /></Box>
                    <Box mt={4}><Field label="Vacaciones" type="number" val={form.vacaciones ?? 0} onChange={v => handleChange('vacaciones', v)} /></Box>
                    <Box mt={4}><Field label="Ventas Económicas" type="number" val={form.ventas_economicas ?? 0} onChange={v => handleChange('ventas_economicas', v)} /></Box>
                  </Box>

                  {/* DESCUENTOS */}
                  <Box>
                    <SectionTitle title="Descuentos" />
                    <Field label="IGSS laboral (4.83% automático)" type="number" val={form.igss_laboral || calcIgssLaboral(form.sueldo_ordinario)} onChange={v => handleChange('igss_laboral', v)} />
                    <Box mt={4}><Field label="ISR" type="number" val={form.isr ?? 0} onChange={v => handleChange('isr', v)} /></Box>
                    <Box mt={4}><Field label="Anticipo Quincenal" type="number" val={form.anticipo_quincenal ?? 0} onChange={v => handleChange('anticipo_quincenal', v)} /></Box>
                    <Box mt={4}><Field label="Bantrab" type="number" val={form.bantrab ?? 0} onChange={v => handleChange('bantrab', v)} /></Box>
                    <Box mt={4}><Field label="Boleto de ornato" type="number" val={form.boleto_de_ornato ?? 0} onChange={v => handleChange('boleto_de_ornato', v)} /></Box>
                    <Box mt={4}><Field label="Préstamo Empresa" type="number" val={form.prestamo_empresa ?? 0} onChange={v => handleChange('prestamo_empresa', v)} /></Box>
                    <Box mt={4}><Field label="Judiciales" type="number" val={form.judiciales ?? 0} onChange={v => handleChange('judiciales', v)} /></Box>
                    <Box mt={4}><Field label="Seguro" type="number" val={form.seguro ?? 0} onChange={v => handleChange('seguro', v)} /></Box>
                    <Box mt={4}><Field label="Parqueo" type="number" val={form.parqueo ?? 0} onChange={v => handleChange('parqueo', v)} /></Box>
                    <Box mt={4}><Field label="Bancos" type="number" val={form.bancos ?? 0} onChange={v => handleChange('bancos', v)} /></Box>
                    <Box mt={4}><Field label="Otros Descuentos" type="number" val={form.otro_descuentos ?? 0} onChange={v => handleChange('otro_descuentos', v)} /></Box>
                    <Box mt={4}><Field label="Otros Egresos" type="number" val={form.otros_egresos ?? 0} onChange={v => handleChange('otros_egresos', v)} /></Box>
                  </Box>
                </SimpleGrid>

                {/* DETALLE IGSS PATRONAL */}
                <Box mt={8}>
                  <SectionTitle title="Detalle IGSS Patronal" />
                  <Box p={5} borderRadius="xl" bg={distBoxBg} border="1px solid" borderColor={distBoxBorder}>
                    <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={6}>
                      <Field label="IGSS Patronal (10.67% auto)" type="number" val={form.igss_patronal || calcIgssPatronal(form.sueldo_ordinario)} onChange={v => handleChange('igss_patronal', v)} />
                      <Field label="Irtra (Q 20.00 fijo por ley)" type="number" val={form.irtra || '20.00'} onChange={v => handleChange('irtra', v)} />
                      <Field label="Intecap (Q 20.00 fijo por ley)" type="number" val={form.intecap || '20.00'} onChange={v => handleChange('intecap', v)} />
                      <Box>
                        <Text fontSize="11px" mb={1} fontWeight="600" textTransform="uppercase" color={subtitleColor} letterSpacing="wide">
                          Total IGSS Patronal
                        </Text>
                        <Input size="sm" isReadOnly value={totalIgssPatronal} bg={distBoxBg} borderRadius="md" fontWeight={700} color="brand.400" />
                      </Box>
                    </SimpleGrid>
                  </Box>
                </Box>
              </Box>
            )}

            {/* ═══ ORIGINARIO E IGSS ═══ */}
            {tab === 'origen' && (
              <Box>
                <SectionTitle title="Ubicación y Origen" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <Field label="Región Originario" val={form.region_originario} onChange={v => handleChange('region_originario', v)} />
                  <Field label="Departamento Originario (Obligatorio)" val={form.departamento_originario} onChange={v => handleChange('departamento_originario', v)} required />
                  <Field label="Municipio Originario (Obligatorio)" val={form.municipio_originario} onChange={v => handleChange('municipio_originario', v)} required />
                  <Field label="Municipio Donde Labora" val={form.municipio_laboral} onChange={v => handleChange('municipio_laboral', v)} />
                  <Field label="Departamento Laboral" val={form.departamento_laboral} onChange={v => handleChange('departamento_laboral', v)} />
                </SimpleGrid>

                <SectionTitle title="Datos Planilla Electrónica IGSS" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5} mb={8}>
                  <Field label="Apellido Casada" val={form.apellido_casada_originario} onChange={v => handleChange('apellido_casada_originario', v)} />
                  <Field label="Tipo Planilla" type="text" val={form.tipo_planilla} onChange={v => handleChange('tipo_planilla', v)} />
                  <Field label="Código Ocupación" val={form.codigo_ocupacion} onChange={v => handleChange('codigo_ocupacion', v)} />
                </SimpleGrid>

                <HStack spacing={3} flexWrap="wrap">
                  <Button size="xs" colorScheme="blue" variant="outline">Abandono de labores</Button>
                  <Button size="xs" colorScheme="blue" variant="outline">Apertura de cuenta</Button>
                  <Button size="xs" colorScheme="blue" variant="outline">Constancia laboral</Button>
                  <Button size="xs" colorScheme="blue" variant="outline">Contrato confidencialidad</Button>
                  <Button size="xs" colorScheme="blue" variant="outline">Cancelación de contrato</Button>
                  <Button size="xs" colorScheme="blue" variant="outline">Disciplinaria</Button>
                </HStack>
              </Box>
            )}

            {/* ═══ FORMACIÓN ACADÉMICA ═══ */}
            {tab === 'formacion' && (
              <Box>
                <SectionTitle title="Educación Base" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5} mb={5}>
                  <FormControl display="flex" alignItems="center"><Checkbox isChecked={form.primaria} onChange={e => handleChange('primaria', e.target.checked)}><Text fontSize="sm" fontWeight={600} ml={2}>Primaria</Text></Checkbox></FormControl>
                  <Field label="Grado Primaria" val={form.grado_primaria} onChange={v => handleChange('grado_primaria', v)} />
                  <FormControl display="flex" alignItems="center"><Checkbox isChecked={form.secundaria} onChange={e => handleChange('secundaria', e.target.checked)}><Text fontSize="sm" fontWeight={600} ml={2}>Secundaria</Text></Checkbox></FormControl>
                  <Field label="Grado Secundaria" val={form.grado_secundaria} onChange={v => handleChange('grado_secundaria', v)} />
                  <FormControl display="flex" alignItems="center"><Checkbox isChecked={form.diversificado} onChange={e => handleChange('diversificado', e.target.checked)}><Text fontSize="sm" fontWeight={600} ml={2}>Diversificado</Text></Checkbox></FormControl>
                  <FormControl display="flex" alignItems="center"><Checkbox isChecked={form.universidad} onChange={e => handleChange('universidad', e.target.checked)}><Text fontSize="sm" fontWeight={600} ml={2}>Universidad</Text></Checkbox></FormControl>
                  <GridItem colSpan={{ base: 1, sm: 2 }}>
                    <Field label="Título / Diploma" val={form.titulo_diploma} onChange={v => handleChange('titulo_diploma', v)} />
                  </GridItem>
                </SimpleGrid>

                {/* Estudios Adicionales */}
                <SectionTitle title="Estudios Adicionales" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('estudio').length} registro(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('estudio'); setEditingRecord(null); }}>Agregar Estudio</Button>
                </Flex>
                {showRecordForm === 'estudio' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'carrera', label: 'Carrera' },
                      { key: 'descripcion', label: 'Descripción' },
                      { key: 'universidad', label: 'Universidad', type: 'checkbox' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('estudio', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('estudio')}
                  columns={[
                    { key: 'carrera', label: 'Carrera' },
                    { key: 'descripcion', label: 'Descripción' },
                    { key: 'universidad', label: 'Universidad', render: d => d?.universidad ? 'Sí' : 'No' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('estudio'); }}
                  emptyText="Sin estudios adicionales registrados"
                />

                {/* Cursos / Capacitaciones */}
                <SectionTitle title="Cursos y Capacitaciones" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('curso').length} registro(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('curso'); setEditingRecord(null); }}>Agregar Curso</Button>
                </Flex>
                {showRecordForm === 'curso' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'nombre_curso', label: 'Nombre del Curso' },
                      { key: 'codigo_curso', label: 'Código' },
                      { key: 'nombre', label: 'Capacitador' },
                      { key: 'lugar', label: 'Lugar' },
                      { key: 'fecha_capacitacion', label: 'Fecha', type: 'date' },
                      { key: 'nota', label: 'Nota' },
                      { key: 'diploma', label: 'Diploma', type: 'checkbox' },
                      { key: 'induccion', label: 'Inducción', type: 'checkbox' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('curso', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('curso')}
                  columns={[
                    { key: 'nombre_curso', label: 'Curso' },
                    { key: 'lugar', label: 'Lugar' },
                    { key: 'fecha_capacitacion', label: 'Fecha' },
                    { key: 'nota', label: 'Nota' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('curso'); }}
                  emptyText="Sin cursos registrados"
                />
              </Box>
            )}

            {/* ═══ HISTORIAL LABORAL ═══ */}
            {tab === 'historial' && (
              <Box>
                {/* Historial de Puestos */}
                <SectionTitle title="Historial de Puestos" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('puesto').length} registro(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('puesto'); setEditingRecord(null); }}>Agregar Puesto</Button>
                </Flex>
                {showRecordForm === 'puesto' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'fecha', label: 'Fecha', type: 'date' },
                      { key: 'departamento', label: 'Departamento' },
                      { key: 'cod_depto', label: 'Código Depto' },
                      { key: 'puesto', label: 'Puesto' },
                      { key: 'cod_puesto', label: 'Código Puesto' },
                      { key: 'motivo', label: 'Motivo' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('puesto', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('puesto')}
                  columns={[
                    { key: 'fecha', label: 'Fecha' },
                    { key: 'departamento', label: 'Departamento' },
                    { key: 'puesto', label: 'Puesto' },
                    { key: 'motivo', label: 'Motivo' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('puesto'); }}
                  emptyText="Sin historial de puestos"
                />

                {/* Eventos */}
                <SectionTitle title="Eventos Laborales" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('evento').length} registro(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('evento'); setEditingRecord(null); }}>Agregar Evento</Button>
                </Flex>
                {showRecordForm === 'evento' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'tipo', label: 'Tipo', type: 'select', options: ['Asueto', 'Permiso', 'Suspensión', 'Vacaciones', 'Otro'] },
                      { key: 'numero', label: 'Número' },
                      { key: 'fecha_inicio', label: 'Fecha Inicio', type: 'date' },
                      { key: 'fecha_final', label: 'Fecha Final', type: 'date' },
                      { key: 'estado', label: 'Estado', type: 'select', options: ['Activo', 'Inactivo', 'Pendiente'] },
                      { key: 'observaciones', label: 'Observaciones' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('evento', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('evento')}
                  columns={[
                    { key: 'tipo', label: 'Tipo' },
                    { key: 'fecha_inicio', label: 'Inicio' },
                    { key: 'fecha_final', label: 'Final' },
                    { key: 'estado', label: 'Estado' },
                    { key: 'observaciones', label: 'Obs.' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('evento'); }}
                  emptyText="Sin eventos registrados"
                />
              </Box>
            )}

            {/* ═══ EXPEDIENTE / RECORD ═══ */}
            {tab === 'expediente' && (
              <Box>
                <SectionTitle title="Llamadas de Atención / Records" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('record').length} registro(s)</Text>
                  <Button size="xs" colorScheme="red" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('record'); setEditingRecord(null); }}>Agregar Record</Button>
                </Flex>
                {showRecordForm === 'record' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'fecha', label: 'Fecha', type: 'date' },
                      { key: 'tipo', label: 'Tipo', type: 'select', options: ['Llamada de atención verbal', 'Llamada de atención escrita', 'Suspensión', 'Despido', 'Observación'] },
                      { key: 'descripcion', label: 'Descripción' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('record', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('record')}
                  columns={[
                    { key: 'fecha', label: 'Fecha' },
                    { key: 'tipo', label: 'Tipo' },
                    { key: 'descripcion', label: 'Descripción' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('record'); }}
                  emptyText="Sin records registrados"
                />
              </Box>
            )}

            {/* ═══ FAMILIA E HIJOS ═══ */}
            {tab === 'familia' && (
              <Box>
                <SectionTitle title="Cónyuge" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5} mb={5}>
                  <Field label="Nombre Cónyuge" val={form.conyugue} onChange={v => handleChange('conyugue', v)} />
                  <Field label="Edad Cónyuge" val={form.edad_conyuge} onChange={v => handleChange('edad_conyuge', v)} />
                  <Field label="Ocupación Cónyuge" val={form.ocupacion_conyuge} onChange={v => handleChange('ocupacion_conyuge', v)} />
                </SimpleGrid>

                <SectionTitle title="Padre" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5} mb={5}>
                  <Field label="Nombre del Padre" val={form.nombre_padre} onChange={v => handleChange('nombre_padre', v)} />
                  <Field label="Edad del Padre" val={form.edad_padre} onChange={v => handleChange('edad_padre', v)} />
                  <Field label="Ocupación del Padre" val={form.ocupacion_padre} onChange={v => handleChange('ocupacion_padre', v)} />
                </SimpleGrid>

                <SectionTitle title="Madre" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5} mb={5}>
                  <Field label="Nombre de la Madre" val={form.nombre_madre} onChange={v => handleChange('nombre_madre', v)} />
                  <Field label="Edad de la Madre" val={form.edad_madre} onChange={v => handleChange('edad_madre', v)} />
                  <Field label="Ocupación de la Madre" val={form.ocupacion_madre} onChange={v => handleChange('ocupacion_madre', v)} />
                </SimpleGrid>

                {/* Hijos */}
                <SectionTitle title="Hijos" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('hijo').length} hijo(s) registrado(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('hijo'); setEditingRecord(null); }}>Agregar Hijo</Button>
                </Flex>
                {showRecordForm === 'hijo' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'nombre', label: 'Nombre del Hijo/a' },
                      { key: 'edad', label: 'Edad' },
                      { key: 'fecha_nacimiento', label: 'Fecha Nacimiento', type: 'date' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('hijo', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('hijo')}
                  columns={[
                    { key: 'nombre', label: 'Nombre' },
                    { key: 'edad', label: 'Edad' },
                    { key: 'fecha_nacimiento', label: 'Fecha Nac.' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('hijo'); }}
                  emptyText="Sin hijos registrados"
                />
              </Box>
            )}

            {/* ═══ EXPERIENCIA Y VEHÍCULOS ═══ */}
            {tab === 'experiencia' && (
              <Box>
                {/* Empresa Anterior */}
                <SectionTitle title="Experiencia Laboral Previa" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('empresa_anterior').length} registro(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('empresa_anterior'); setEditingRecord(null); }}>Agregar Empresa</Button>
                </Flex>
                {showRecordForm === 'empresa_anterior' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'nombre', label: 'Nombre de la Empresa' },
                      { key: 'cargo', label: 'Cargo Ocupado' },
                      { key: 'direccion', label: 'Dirección' },
                      { key: 'motivo_salida', label: 'Motivo de Salida' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('empresa_anterior', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('empresa_anterior')}
                  columns={[
                    { key: 'nombre', label: 'Empresa' },
                    { key: 'cargo', label: 'Cargo' },
                    { key: 'motivo_salida', label: 'Motivo Salida' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('empresa_anterior'); }}
                  emptyText="Sin experiencia previa registrada"
                />

                {/* Vehículos */}
                <SectionTitle title="Vehículos Registrados" />
                <Flex justify="space-between" align="center" mb={3}>
                  <Text fontSize="sm" color="gray.500">{getRecords('vehiculo').length} vehículo(s)</Text>
                  <Button size="xs" colorScheme="brand" leftIcon={<Plus size={12} />} onClick={() => { setShowRecordForm('vehiculo'); setEditingRecord(null); }}>Agregar Vehículo</Button>
                </Flex>
                {showRecordForm === 'vehiculo' && (
                  <InlineRecordForm
                    fields={[
                      { key: 'marca', label: 'Marca' },
                      { key: 'modelo', label: 'Modelo' },
                      { key: 'placa', label: 'Placas' },
                      { key: 'color', label: 'Color' },
                    ]}
                    initialData={editingRecord?.data}
                    onSave={(data) => handleRecordSave('vehiculo', data)}
                    onCancel={() => { setShowRecordForm(null); setEditingRecord(null); }}
                  />
                )}
                <RecordTable
                  records={getRecords('vehiculo')}
                  columns={[
                    { key: 'marca', label: 'Marca' },
                    { key: 'modelo', label: 'Modelo' },
                    { key: 'placa', label: 'Placas' },
                    { key: 'color', label: 'Color' },
                  ]}
                  onDelete={handleRecordDelete}
                  onEdit={r => { setEditingRecord(r); setShowRecordForm('vehiculo'); }}
                  emptyText="Sin vehículos registrados"
                />
              </Box>
            )}

          </Box>

          {/* FOOTER */}
          <Flex p={4} borderTop="1px solid" borderColor={borderColor} bg={footerBg} justify="flex-end" align="center" gap={3}>
            <Button variant="ghost" onClick={onClose} color={subtitleColor} _hover={{ bg: 'whiteAlpha.100' }}>Cancelar</Button>
            <Button 
              colorScheme="blue" 
              onClick={handleSave} 
              leftIcon={<Check size={18} />} 
              px={6}
              isDisabled={distTotal !== 100 || !!duplicateDpi || !!duplicateIgss}
            >
              Guardar Cambios
            </Button>
          </Flex>
        </Flex>
      </ModalContent>
    </Modal>
  );
}
