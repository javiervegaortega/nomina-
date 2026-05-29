import React, { useState } from 'react';
import { X, Check, User, Users, FileSignature, Landmark, GraduationCap } from 'lucide-react';
import {
  Modal, ModalOverlay, ModalContent,
  Box, Flex, VStack, HStack,
  Heading, Text,
  Button, IconButton,
  FormControl, FormLabel, Input, Select, Textarea, Checkbox,
  SimpleGrid,
  Slider, SliderTrack, SliderFilledTrack, SliderThumb,
  Badge,
  useColorModeValue,
} from '@chakra-ui/react';

/* ─── Subcomponents ─────────────────────────────────────────────── */

function SectionTitle({ title }) {
  const color = useColorModeValue('gray.500', 'gray.400');
  return (
    <Text
      fontSize="xs"
      fontWeight={700}
      color={color}
      textTransform="uppercase"
      letterSpacing="0.05em"
      mt={5}
      mb={3}
    >
      {title}
    </Text>
  );
}

function Field({ label, val, onChange, type = 'text', half }) {
  return (
    <FormControl>
      <FormLabel fontSize="sm" mb={1}>{label}</FormLabel>
      <Input
        size="sm"
        type={type}
        value={val || (type === 'number' ? '0' : '')}
        onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        fontFamily={type === 'number' ? 'mono' : undefined}
      />
    </FormControl>
  );
}

function SelectField({ label, val, onChange, options, half }) {
  return (
    <FormControl>
      <FormLabel fontSize="sm" mb={1}>{label}</FormLabel>
      <Select
        size="sm"
        value={val || ''}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Seleccione...</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </Select>
    </FormControl>
  );
}

function SidebarTab({ icon: Icon, label, active, onClick }) {
  const activeBg = useColorModeValue('brand.50', 'whiteAlpha.100');
  const hoverBg = useColorModeValue('gray.100', 'whiteAlpha.50');
  const activeColor = useColorModeValue('brand.600', 'brand.300');
  const inactiveColor = useColorModeValue('gray.600', 'gray.400');
  const activeTextColor = useColorModeValue('gray.900', 'white');
  const inactiveTextColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Button
      w="full"
      variant="ghost"
      justifyContent="flex-start"
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
      leftIcon={<Icon size={18} color={active ? undefined : 'currentColor'} />}
      iconSpacing={3}
    >
      {label}
    </Button>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */

export default function EmployeeFormModal({ mode, initialData, onClose, onSave, companies, departments }) {
  const [tab, setTab] = useState('personal');
  const [form, setForm] = useState(initialData || {});

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    // Validations could go here
    onSave(form);
  };

  const distTotal = form.dist ? Object.values(form.dist).reduce((a, b) => a + b, 0) : 0;

  // Color mode values
  const sidebarBg = useColorModeValue('gray.50', 'rgba(15, 23, 42, 0.6)');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const footerBg = useColorModeValue('gray.50', 'rgba(15, 23, 42, 0.6)');
  const subtitleColor = useColorModeValue('gray.500', 'gray.400');
  const distBoxBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const distBoxBorder = useColorModeValue('gray.200', 'whiteAlpha.100');

  const tabTitles = {
    personal: 'Datos Personales',
    family: 'Contacto y Familia',
    legal: 'Legal y Contrato',
    salary: 'Salario y Banco',
    education: 'Educación',
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="6xl" isCentered motionPreset="slideInBottom">
      <ModalOverlay />
      <ModalContent
        maxW="6xl"
        h="85vh"
        borderRadius="2xl"
        overflow="hidden"
        display="flex"
        flexDirection="row"
        mx={4}
      >
        {/* ─── Sidebar Navigation ─── */}
        <Box
          w="280px"
          minW="280px"
          borderRight="1px solid"
          borderColor={borderColor}
          bg={sidebarBg}
          display="flex"
          flexDirection="column"
        >
          <Box p={5} pb={3}>
            <Heading size="md" fontWeight={700}>
              {mode === 'add' ? 'Nuevo Empleado' : 'Editar Empleado'}
            </Heading>
            <Text fontSize="sm" color={subtitleColor} mt={1}>
              Formulario completo del expediente
            </Text>
          </Box>

          <VStack
            flex={1}
            overflowY="auto"
            px={3}
            pb={3}
            spacing={1}
            align="stretch"
          >
            <SidebarTab icon={User} label="Datos Personales" active={tab === 'personal'} onClick={() => setTab('personal')} />
            <SidebarTab icon={Users} label="Contacto y Familia" active={tab === 'family'} onClick={() => setTab('family')} />
            <SidebarTab icon={FileSignature} label="Legal y Contrato" active={tab === 'legal'} onClick={() => setTab('legal')} />
            <SidebarTab icon={Landmark} label="Salario y Banco" active={tab === 'salary'} onClick={() => setTab('salary')} />
            <SidebarTab icon={GraduationCap} label="Educación" active={tab === 'education'} onClick={() => setTab('education')} />
          </VStack>
        </Box>

        {/* ─── Form Content Area ─── */}
        <Flex flex={1} direction="column" minW={0}>
          {/* Header */}
          <Flex align="center" justify="space-between" px={6} pt={5} pb={2}>
            <Heading size="md" fontWeight={700}>
              {tabTitles[tab]}
            </Heading>
            <IconButton
              icon={<X size={20} />}
              aria-label="Cerrar"
              variant="ghost"
              size="sm"
              onClick={onClose}
              borderRadius="lg"
              transition="all 0.2s"
              _hover={{ bg: useColorModeValue('gray.100', 'whiteAlpha.100') }}
            />
          </Flex>

          {/* Scrollable Content */}
          <Box flex={1} overflowY="auto" px={6} py={4}>

            {/* ═══ PERSONAL TAB ═══ */}
            {tab === 'personal' && (
              <Box>
                <SectionTitle title="Nombres y Apellidos" />
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                  <Field label="Primer Nombre" val={form.primer_nombre} onChange={v => handleChange('primer_nombre', v)} />
                  <Field label="Segundo Nombre" val={form.segundo_nombre} onChange={v => handleChange('segundo_nombre', v)} />
                  <Field label="Otro Nombre" val={form.otro_nombre} onChange={v => handleChange('otro_nombre', v)} />
                  <Field label="Primer Apellido" val={form.primer_apellido} onChange={v => handleChange('primer_apellido', v)} />
                  <Field label="Segundo Apellido" val={form.segundo_apellido} onChange={v => handleChange('segundo_apellido', v)} />
                  <Field label="Apellido de Casada" val={form.apellido_casada} onChange={v => handleChange('apellido_casada', v)} />
                </SimpleGrid>

                <SectionTitle title="Información Demográfica" />
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Fecha de Nacimiento</FormLabel>
                    <Input
                      size="sm"
                      type="date"
                      value={form.fecha_nacimiento?.split('T')[0] || ''}
                      onChange={e => handleChange('fecha_nacimiento', e.target.value)}
                    />
                  </FormControl>
                  <Field label="Edad" val={form.edad} onChange={v => handleChange('edad', v)} />
                  <SelectField label="Género" val={form.genero} onChange={v => handleChange('genero', v)} options={['Masculino', 'Femenino', 'Otro']} />
                  <SelectField label="Estado Civil" val={form.estado_civil} onChange={v => handleChange('estado_civil', v)} options={['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unido']} />
                  <Field label="Nacionalidad" val={form.nacionalidad} onChange={v => handleChange('nacionalidad', v)} />
                </SimpleGrid>
              </Box>
            )}

            {/* ═══ FAMILY TAB ═══ */}
            {tab === 'family' && (
              <Box>
                <SectionTitle title="Datos de Contacto" />
                <SimpleGrid columns={1} spacing={4} mb={2}>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Dirección de Residencia</FormLabel>
                    <Input size="sm" value={form.direccion || ''} onChange={e => handleChange('direccion', e.target.value)} />
                  </FormControl>
                </SimpleGrid>
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                  <Field label="Teléfono Fijo" val={form.telefono} onChange={v => handleChange('telefono', v)} />
                  <Field label="Teléfono Celular" val={form.telefono_celular} onChange={v => handleChange('telefono_celular', v)} />
                </SimpleGrid>

                <SectionTitle title="Cónyuge" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} templateColumns={{ base: '1fr', sm: '5fr 2fr 5fr' }}>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Nombre Completo</FormLabel>
                    <Input size="sm" value={form.conyugue || ''} onChange={e => handleChange('conyugue', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Edad</FormLabel>
                    <Input size="sm" value={form.edad_conyuge || ''} onChange={e => handleChange('edad_conyuge', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Ocupación</FormLabel>
                    <Input size="sm" value={form.ocupacion_conyuge || ''} onChange={e => handleChange('ocupacion_conyuge', e.target.value)} />
                  </FormControl>
                </SimpleGrid>

                <SectionTitle title="Padres" />
                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} templateColumns={{ base: '1fr', sm: '5fr 2fr 5fr' }}>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Nombre del Padre</FormLabel>
                    <Input size="sm" value={form.nombre_padre || ''} onChange={e => handleChange('nombre_padre', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Edad</FormLabel>
                    <Input size="sm" value={form.edad_padre || ''} onChange={e => handleChange('edad_padre', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Ocupación</FormLabel>
                    <Input size="sm" value={form.ocupacion_padre || ''} onChange={e => handleChange('ocupacion_padre', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Nombre de la Madre</FormLabel>
                    <Input size="sm" value={form.nombre_madre || ''} onChange={e => handleChange('nombre_madre', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Edad</FormLabel>
                    <Input size="sm" value={form.edad_madre || ''} onChange={e => handleChange('edad_madre', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Ocupación</FormLabel>
                    <Input size="sm" value={form.ocupacion_madre || ''} onChange={e => handleChange('ocupacion_madre', e.target.value)} />
                  </FormControl>
                </SimpleGrid>

                <SectionTitle title="Contacto de Emergencia" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Nombre de Emergencia</FormLabel>
                    <Input size="sm" value={form.nombre_emergencia || ''} onChange={e => handleChange('nombre_emergencia', e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Teléfono de Emergencia</FormLabel>
                    <Input size="sm" value={form.telefono_emergencia || ''} onChange={e => handleChange('telefono_emergencia', e.target.value)} />
                  </FormControl>
                </SimpleGrid>
              </Box>
            )}

            {/* ═══ LEGAL TAB ═══ */}
            {tab === 'legal' && (
              <Box>
                <SectionTitle title="Identidad Legal" />
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                  <Field label="DPI" val={form.dpi} onChange={v => handleChange('dpi', v)} />
                  <Field label="Emisión de DPI (Lugar)" val={form.emision_dpi} onChange={v => handleChange('emision_dpi', v)} />
                  <Field label="NIT" val={form.nit} onChange={v => handleChange('nit', v)} />
                  <Field label="Número IGSS" val={form.no_igss} onChange={v => handleChange('no_igss', v)} />
                  <Field label="Cédula (Si aplica)" val={form.cedula} onChange={v => handleChange('cedula', v)} />
                </SimpleGrid>

                <SectionTitle title="Licencia de Conducir" />
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                  <Field label="Número de Licencia" val={form.licencia} onChange={v => handleChange('licencia', v)} />
                  <SelectField label="Tipo de Licencia" val={form.tipo_licencia} onChange={v => handleChange('tipo_licencia', v)} options={['A', 'B', 'C', 'M']} />
                  <SelectField label="Clase de Licencia" val={form.clase_licencia} onChange={v => handleChange('clase_licencia', v)} options={['Vehículo Liviano', 'Motocicleta', 'Pesado', 'Transporte']} />
                </SimpleGrid>

                <SectionTitle title="Contrato y Empresa" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Empresa Principal</FormLabel>
                    <Select size="sm" value={form.companyId || ''} onChange={e => handleChange('companyId', e.target.value)}>
                      <option value="">Seleccione empresa...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre_comercial || c.nit}</option>
                      ))}
                    </Select>
                  </FormControl>
                  <SelectField label="Estado de Empleado" val={form.estado} onChange={v => handleChange('estado', v)} options={['Activo', 'Inactivo', 'Suspendido']} half />
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Fecha de Inicio</FormLabel>
                    <Input
                      size="sm"
                      type="date"
                      value={form.fecha_inicio?.split('T')[0] || ''}
                      onChange={e => handleChange('fecha_inicio', e.target.value)}
                    />
                  </FormControl>
                  <SelectField label="Tipo de Plantilla" val={form.tipo_plantilla} onChange={v => handleChange('tipo_plantilla', v)} options={['Permanente', 'Temporal']} half />
                  <Field label="Puesto / Cargo" val={form.puesto} onChange={v => handleChange('puesto', v)} half />
                  <SelectField label="Departamento Laboral" val={form.departamento_laboral} onChange={v => handleChange('departamento_laboral', v)} options={departments} half />
                  <SelectField label="Rol de Sistema" val={form.rol_permisos} onChange={v => handleChange('rol_permisos', v)} options={['empleado', 'admin', 'rrhh']} half />
                </SimpleGrid>
              </Box>
            )}

            {/* ═══ SALARY TAB ═══ */}
            {tab === 'salary' && (
              <Box>
                <SectionTitle title="Compensación Fija" />
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                  <Field label="Sueldo Ordinario Base (Q)" type="number" val={form.sueldo_ordinario} onChange={v => handleChange('sueldo_ordinario', v)} />
                  <Field label="Bono Decreto 37-2001 (Q)" type="number" val={form.bon_dec_37_2001} onChange={v => handleChange('bon_dec_37_2001', v)} />
                  <Field label="Bonificación Incentivo (Q)" type="number" val={form.bon_incentivo} onChange={v => handleChange('bon_incentivo', v)} />
                  <Field label="Ventas / Comisiones Promedio" type="number" val={form.ventas_economicas} onChange={v => handleChange('ventas_economicas', v)} />
                  <Field label="Otros Ingresos (Q)" type="number" val={form.otro_ingresos} onChange={v => handleChange('otro_ingresos', v)} />
                </SimpleGrid>

                <SectionTitle title="Distribución de Costos por Empresa" />
                <Box
                  mb={6}
                  p={4}
                  borderRadius="xl"
                  bg={distBoxBg}
                  border="1px solid"
                  borderColor={distBoxBorder}
                >
                  <Flex justify="space-between" align="center" mb={3}>
                    <Text fontSize="sm" fontWeight={600}>Porcentaje de Costo</Text>
                    <Badge
                      colorScheme={distTotal === 100 ? 'green' : 'red'}
                      fontSize="0.75rem"
                      fontWeight={700}
                      fontFamily="mono"
                      px={2}
                      py={0.5}
                      borderRadius="md"
                    >
                      {distTotal}%
                    </Badge>
                  </Flex>

                  {companies.map(c => (
                    <HStack key={c.id} spacing={3} mb={2}>
                      <Box
                        w={3}
                        h={3}
                        borderRadius="full"
                        bg={c.color || 'brand.500'}
                        flexShrink={0}
                      />
                      <Text fontSize="sm" w="150px" flexShrink={0} noOfLines={1}>
                        {c.nombre_comercial || c.nit}
                      </Text>
                      <Slider
                        flex={1}
                        value={form.dist?.[c.id] || 0}
                        onChange={val => handleChange('dist', { ...form.dist, [c.id]: val })}
                        step={5}
                        min={0}
                        max={100}
                        colorScheme="brand"
                      >
                        <SliderTrack borderRadius="full">
                          <SliderFilledTrack bg={c.color || 'brand.500'} />
                        </SliderTrack>
                        <SliderThumb
                          boxSize={4}
                          boxShadow="md"
                          _focus={{ boxShadow: 'md' }}
                        />
                      </Slider>
                      <Text
                        fontFamily="mono"
                        fontWeight={600}
                        fontSize="sm"
                        w="50px"
                        textAlign="right"
                      >
                        {form.dist?.[c.id] || 0}%
                      </Text>
                    </HStack>
                  ))}
                </Box>

                <SectionTitle title="Bancos e Ingresos" />
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                  <SelectField label="Método de Pago" val={form.tipo_de_pago} onChange={v => handleChange('tipo_de_pago', v)} options={['Transferencia', 'Efectivo', 'Cheque']} />
                  <SelectField label="Banco" val={form.banco} onChange={v => handleChange('banco', v)} options={['Banrural', 'Industrial', 'Promerica', 'Bantrab', 'G&T Continental', 'BAM']} />
                  <Field label="Número de Cuenta" val={form.no_cuenta} onChange={v => handleChange('no_cuenta', v)} />
                  <SelectField label="Tipo de Cuenta" val={form.tipo_cuenta} onChange={v => handleChange('tipo_cuenta', v)} options={['Monetaria', 'Ahorro']} />
                  <SelectField label="Moneda" val={form.moneda} onChange={v => handleChange('moneda', v)} options={['GTQ', 'USD']} />
                </SimpleGrid>

                <SectionTitle title="Deducciones Constantes (Q)" />
                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
                  <Field label="Total IGSS" type="number" val={form.total_igss} onChange={v => handleChange('total_igss', v)} />
                  <Field label="ISR (Mensual)" type="number" val={form.isr} onChange={v => handleChange('isr', v)} />
                  <Field label="Préstamo Empresa" type="number" val={form.prestamo_empresa} onChange={v => handleChange('prestamo_empresa', v)} />
                  <Field label="Bancos (Deducción directa)" type="number" val={form.bancos} onChange={v => handleChange('bancos', v)} />
                  <Field label="Seguro" type="number" val={form.seguro} onChange={v => handleChange('seguro', v)} />
                  <Field label="Parqueo" type="number" val={form.parqueo} onChange={v => handleChange('parqueo', v)} />
                  <Field label="Otras Deducciones" type="number" val={form.otro_descuentos} onChange={v => handleChange('otro_descuentos', v)} />
                </SimpleGrid>
              </Box>
            )}

            {/* ═══ EDUCATION TAB ═══ */}
            {tab === 'education' && (
              <Box>
                <SectionTitle title="Nivel Académico" />
                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4} alignItems="end" templateColumns={{ base: '1fr', sm: '1fr 2fr' }}>
                  <Checkbox
                    isChecked={!!form.primaria}
                    onChange={e => handleChange('primaria', e.target.checked)}
                    colorScheme="brand"
                    size="md"
                  >
                    <Text fontSize="sm">Primaria Completada</Text>
                  </Checkbox>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Grado Primaria Alcanzado</FormLabel>
                    <Input size="sm" value={form.grado_primaria || ''} onChange={e => handleChange('grado_primaria', e.target.value)} />
                  </FormControl>

                  <Checkbox
                    isChecked={!!form.secundaria}
                    onChange={e => handleChange('secundaria', e.target.checked)}
                    colorScheme="brand"
                    size="md"
                  >
                    <Text fontSize="sm">Secundaria Completada</Text>
                  </Checkbox>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Grado Secundaria Alcanzado</FormLabel>
                    <Input size="sm" value={form.grado_secundaria || ''} onChange={e => handleChange('grado_secundaria', e.target.value)} />
                  </FormControl>

                  <Checkbox
                    isChecked={!!form.diversificado}
                    onChange={e => handleChange('diversificado', e.target.checked)}
                    colorScheme="brand"
                    size="md"
                  >
                    <Text fontSize="sm">Diversificado</Text>
                  </Checkbox>
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Título Diversificado</FormLabel>
                    <Input size="sm" value={form.titulo_diploma || ''} onChange={e => handleChange('titulo_diploma', e.target.value)} />
                  </FormControl>

                  <Checkbox
                    isChecked={!!form.universidad}
                    onChange={e => handleChange('universidad', e.target.checked)}
                    colorScheme="brand"
                    size="md"
                  >
                    <Text fontSize="sm">Universidad</Text>
                  </Checkbox>
                  <Box />
                </SimpleGrid>

                <SectionTitle title="Información Adicional" />
                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Discapacidad (Detallar si existe)</FormLabel>
                  <Textarea
                    size="sm"
                    rows={3}
                    value={form.discapacidad || ''}
                    onChange={e => handleChange('discapacidad', e.target.value)}
                  />
                </FormControl>
              </Box>
            )}
          </Box>

          {/* ─── Footer ─── */}
          <Flex
            px={6}
            py={4}
            bg={footerBg}
            borderTop="1px solid"
            borderColor={borderColor}
            justify="flex-end"
            gap={3}
          >
            <Button
              variant="ghost"
              onClick={onClose}
              transition="all 0.2s"
            >
              Cancelar
            </Button>
            <Button
              colorScheme="brand"
              onClick={handleSave}
              leftIcon={<Check size={16} />}
              transition="all 0.2s"
              _hover={{ transform: 'translateY(-1px)', boxShadow: 'lg' }}
            >
              {mode === 'add' ? 'Crear Empleado' : 'Guardar Cambios'}
            </Button>
          </Flex>
        </Flex>
      </ModalContent>
    </Modal>
  );
}
