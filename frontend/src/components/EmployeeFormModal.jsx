import React, { useState, useEffect } from 'react';
import { X, Check, User, Building2, FileSignature, Landmark, MapPin } from 'lucide-react';
import {
  Modal, ModalOverlay, ModalContent,
  Box, Flex, Text, Button, Input, Select,
  SimpleGrid, FormControl, FormLabel, Checkbox, GridItem,
  useColorModeValue, Icon, HStack, Badge
} from '@chakra-ui/react';

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

const Field = ({ label, val, onChange, type = 'text', required, error }) => {
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
        _hover={{ borderColor: error ? 'red.500' : useColorModeValue('brand.300', 'brand.600') }}
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
        _hover={{ borderColor: useColorModeValue('brand.300', 'brand.600') }}
        _focus={{ borderColor: 'brand.500', boxShadow: 'none' }}
      >
        <option value="">Seleccione...</option>
        {options.map((opt, i) => (
          <option key={i} value={opt.id || opt.value || opt}>{opt.label || opt.nombre_dimension || opt}</option>
        ))}
      </Select>
    </FormControl>
  );
};

export default function EmployeeFormModal({ mode, initialData, onClose, onSave, employees = [], companies, departments, areas, divisions, subdivisions }) {
  const [tab, setTab] = useState('personal');
  const [form, setForm] = useState(() => {
    const data = initialData ? { ...initialData } : {};
    if (typeof data.dist === 'string') {
      try { data.dist = JSON.parse(data.dist); } catch(e) { data.dist = {}; }
    }
    return data;
  });

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
    if (distTotal !== 100) return; // Validación extra de seguridad
    if (duplicateDpi || duplicateIgss) return; // Validación de duplicados
    onSave(form);
  };

  // Garantizar que si es un string (doble stringify de DB), se intente convertir a números
  let parsedDistValues = [];
  if (typeof form.dist === 'object' && form.dist !== null) {
    parsedDistValues = Object.values(form.dist);
  } else if (typeof form.dist === 'string') {
    try {
      const parsed = JSON.parse(form.dist);
      parsedDistValues = Object.values(parsed);
      form.dist = parsed; // mutamos localmente para arreglar el form
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

  // IGSS Auto calculations (10.67% patronal + 1% + 1% = 12.67%)
  const calcIgssPatronal = (sueldo) => (sueldo * 0.1067).toFixed(2);
  const calcIrtra = (sueldo) => (sueldo * 0.01).toFixed(2);
  const calcIntecap = (sueldo) => (sueldo * 0.01).toFixed(2);
  const calcTotalPatronal = (sueldo) => (sueldo * 0.1267).toFixed(2);

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

          <Flex direction="column" gap={2} flex={1}>
            <SidebarTab active={tab === 'personal'} label="Datos Personales" icon={User} onClick={() => setTab('personal')} />
            <SidebarTab active={tab === 'empresa'} label="Empresa y Jerarquía" icon={Building2} onClick={() => setTab('empresa')} />
            <SidebarTab active={tab === 'contrato'} label="Identidad y Banco" icon={FileSignature} onClick={() => setTab('contrato')} />
            <SidebarTab active={tab === 'planilla'} label="Planilla (Salarios)" icon={Landmark} onClick={() => setTab('planilla')} />
            <SidebarTab active={tab === 'origen'} label="Originario e IGSS" icon={MapPin} onClick={() => setTab('origen')} />
          </Flex>
        </Box>

        {/* MAIN CONTENT */}
        <Flex flex={1} direction="column" h="100%" position="relative">
          <Box p={6} pb={4} borderBottom="1px solid" borderColor={borderColor}>
            <Flex justify="space-between" align="center">
              <Text fontSize="lg" fontWeight={700}>
                {tab === 'personal' && 'Datos Personales'}
                {tab === 'empresa' && 'Empresa Del Empleado'}
                {tab === 'contrato' && 'DPI / IGSS / Banco'}
                {tab === 'planilla' && 'Planilla (Devengados y Descuentos)'}
                {tab === 'origen' && 'Originario e IGSS'}
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
                </SimpleGrid>

                <SectionTitle title="Distribución por Empresa" />
                <Box mb={6} p={5} borderRadius="xl" bg={distBoxBg} border="1px solid" borderColor={distTotal !== 100 ? 'red.400' : distBoxBorder}>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Box>
                      <Text fontSize="sm" fontWeight={700} color={distTotal !== 100 ? 'red.500' : 'inherit'}>Empresas Asignadas</Text>
                      {distTotal !== 100 && (
                        <Text fontSize="xs" color="red.500" fontWeight="bold">
                          Error: La suma de porcentajes debe ser exactamente 100%. (Actual: {distTotal}%)
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
                          value={form.dist?.[c.id] || 0}
                          onChange={e => handleChange('dist', { ...form.dist, [c.id]: parseFloat(e.target.value)||0 })}
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
                  <Field label="No. IGSS" val={form.no_igss} onChange={v => handleChange('no_igss', v)} error={duplicateIgss ? 'Este No. IGSS ya está registrado' : null} />
                  <Field label="NIT" val={form.nit} onChange={v => handleChange('nit', v)} />
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
                  <SelectField label="Condición laboral (Obligatorio)" val={form.condicion_laboral} onChange={v => handleChange('condicion_laboral', v)} options={['Quetzal', 'Dólar']} required />
                </SimpleGrid>
                
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={5} mt={5}>
                  <FormControl display="flex" alignItems="center" h="100%">
                    <Checkbox isChecked={form.jubilacion} onChange={e => handleChange('jubilacion', e.target.checked)}>
                      <Text fontSize="sm" fontWeight={600} ml={2}>Jubilación</Text>
                    </Checkbox>
                  </FormControl>
                  <Field label="Discapacidad" val={form.discapacidad} onChange={v => handleChange('discapacidad', v)} />
                  <SelectField label="Jornada (Obligatorio)" val={form.jornada} onChange={v => handleChange('jornada', v)} options={['Fija', 'Diurna', 'Nocturna', 'Mixta']} required />
                  <Field label="ID Permisos (Obligatorio)" val={form.rol_permisos} onChange={v => handleChange('rol_permisos', v)} required />
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
                  <Box>
                    <SectionTitle title="Devengados" />
                    <Field label="Bonificación Decreto 37-2001 (Obligatorio)" type="number" val={form.bon_dec_37_2001} onChange={v => handleChange('bon_dec_37_2001', v)} required />
                    <Box mt={4}><Field label="Bonificación Incentivo" type="number" val={form.bon_incentivo} onChange={v => handleChange('bon_incentivo', v)} /></Box>
                    <Box mt={4}><Field label="Sueldo Ordinario (Obligatorio)" type="number" val={form.sueldo_ordinario} onChange={v => handleChange('sueldo_ordinario', v)} required /></Box>
                    <Box mt={4}><Field label="Otros Ingresos" type="number" val={form.otro_ingresos} onChange={v => handleChange('otro_ingresos', v)} /></Box>
                    <Box mt={4}><Field label="Vacaciones" type="number" val={form.vacaciones} onChange={v => handleChange('vacaciones', v)} /></Box>
                  </Box>
                  
                  <Box>
                    <SectionTitle title="Descuentos" />
                    <Field label="Anticipo Quincenal" type="number" val={form.anticipo_quincenal} onChange={v => handleChange('anticipo_quincenal', v)} />
                    <Box mt={4}><Field label="Boleto de ornato" type="number" val={form.boleto_de_ornato} onChange={v => handleChange('boleto_de_ornato', v)} /></Box>
                    <Box mt={4}><Field label="IGSS laboral" type="number" val={form.igss_laboral} onChange={v => handleChange('igss_laboral', v)} /></Box>
                    <Box mt={4}><Field label="ISR" type="number" val={form.isr} onChange={v => handleChange('isr', v)} /></Box>
                    <Box mt={4}><Field label="Judiciales" type="number" val={form.judiciales} onChange={v => handleChange('judiciales', v)} /></Box>
                    <Box mt={4}><Field label="Seguro" type="number" val={form.seguro} onChange={v => handleChange('seguro', v)} /></Box>
                    <Box mt={4}><Field label="Parqueo" type="number" val={form.parqueo} onChange={v => handleChange('parqueo', v)} /></Box>
                    <Box mt={4}><Field label="Otros Egresos" type="number" val={form.otros_egresos} onChange={v => handleChange('otros_egresos', v)} /></Box>
                  </Box>
                </SimpleGrid>

                <Box mt={8}>
                  <SectionTitle title="Detalle IGSS Patronal" />
                  <Box p={5} borderRadius="xl" bg={distBoxBg} border="1px solid" borderColor={distBoxBorder}>
                    <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={6}>
                      <Field label="IGSS" type="number" val={form.igss_patronal || calcIgssPatronal(form.sueldo_ordinario)} onChange={v => handleChange('igss_patronal', v)} />
                      <Field label="Irtra" type="number" val={form.irtra || calcIrtra(form.sueldo_ordinario)} onChange={v => handleChange('irtra', v)} />
                      <Field label="Intecap" type="number" val={form.intecap || calcIntecap(form.sueldo_ordinario)} onChange={v => handleChange('intecap', v)} />
                      <Field label="Total IGSS Patronal" type="number" val={calcTotalPatronal(form.sueldo_ordinario)} onChange={() => {}} />
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
                  <Field label="Nacionalidad (Obligatorio)" val={form.nacionalidad} onChange={v => handleChange('nacionalidad', v)} required />
                  <Field label="Región Originario" val={form.region_originario} onChange={v => handleChange('region_originario', v)} />
                  <Field label="Departamento Originario (Obligatorio)" val={form.departamento_originario} onChange={v => handleChange('departamento_originario', v)} required />
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
                  <Field label="Municipio Donde Labora" val={form.municipio_laboral} onChange={v => handleChange('municipio_laboral', v)} />
                  <Field label="Municipio Originario (Obligatorio)" val={form.municipio_originario} onChange={v => handleChange('municipio_originario', v)} required />
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
