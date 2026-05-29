import React, { useState, useMemo, useContext } from 'react';
import {
  Search, Plus, Edit2, Trash2, X, Eye, ChevronDown,
  UserPlus, Filter, Download, Check, FileText
} from 'lucide-react';
import { DataContext } from '../context/DataContext';
import ImportData from '../components/ImportData';
import EmployeeFormModal from '../components/EmployeeFormModal';
import { formatQ, calculateMonthlyISR } from '../data/mockData';
import {
  Box, Flex, Heading, Text, Button, Input, Select,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  IconButton, Badge, Avatar, Tooltip, HStack, VStack,
  InputGroup, InputLeftElement, useColorModeValue,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, ModalCloseButton, FormControl, FormLabel,
  Textarea, Collapse
} from '@chakra-ui/react';

export default function Employees() {
  const { employees, addEmployee, updateEmployee, deleteEmployee, companies, departments } = useContext(DataContext);
  
  const INITIAL_FORM = {
    estado: 'Activo',
    moneda: 'GTQ',
    dist: companies.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {})
  };

  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add | edit | view
  const [currentEmp, setCurrentEmp] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Offboarding modal state
  const [offboardState, setOffboardState] = useState({ show: false, empId: null, reason: '', date: new Date().toISOString().split('T')[0] });
  
  // Finiquito modal state
  const [finiquitoState, setFiniquitoState] = useState({ show: false, emp: null, calculation: null });

  // Theme-aware colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtleBg = useColorModeValue('gray.50', 'gray.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const textSecondary = useColorModeValue('gray.500', 'gray.400');
  const textPrimary = useColorModeValue('gray.800', 'white');
  const brandColor = useColorModeValue('brand.600', 'brand.300');
  const accentColor = useColorModeValue('accent.600', 'accent.300');
  const theadBg = useColorModeValue('gray.50', 'gray.900');
  const distBarBg = useColorModeValue('gray.100', 'gray.600');
  const modalBg = useColorModeValue('white', 'gray.800');
  const finiquitoRowBg = useColorModeValue('gray.50', 'gray.700');

  const getFullName = (e) => `${e.primer_nombre || ''} ${e.primer_apellido || ''}`.trim() || 'Sin Nombre';

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const fullName = getFullName(e);
      const matchSearch = fullName.toLowerCase().includes(search.toLowerCase()) ||
                          (e.puesto || '').toLowerCase().includes(search.toLowerCase());
      const matchDept = filterDept === 'ALL' || e.departamento_laboral === filterDept;
      const matchStatus = filterStatus === 'ALL' || e.estado === filterStatus || (filterStatus === 'active' && e.estado === 'Activo');
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, search, filterDept, filterStatus]);

  const openAdd = () => {
    setModalMode('add');
    setCurrentEmp(null);
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setModalMode('edit');
    setCurrentEmp(emp);
    setShowModal(true);
  };

  const openView = (emp) => {
    setModalMode('view');
    setCurrentEmp(emp);
    setShowModal(true);
  };

  const handleSave = (formData) => {
    if (modalMode === 'add') {
      addEmployee(formData);
    } else if (modalMode === 'edit' && currentEmp) {
      updateEmployee(currentEmp.id, formData);
    }
    setShowModal(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("¿Está seguro de eliminar este empleado completamente de la base de datos? (Para historial, use 'Dar de Baja')")) {
      deleteEmployee(id);
    }
  };

  const handleOffboard = () => {
    updateEmployee(offboardState.empId, { 
      estado: 'Inactivo', 
      motivo_baja: offboardState.reason,
      fecha_baja: offboardState.date
    });
    setOffboardState({ show: false, empId: null, reason: '', date: '' });
  };

  const handleGenerateFiniquito = (emp) => {
    const baseTotal = Number(emp.sueldo_ordinario || 0) + Number(emp.bon_incentivo || 0);
    const calc = {
      indemnizacion: baseTotal * 1.5,
      aguinaldoProp: (baseTotal / 12) * 4,
      bono14Prop: (baseTotal / 12) * 2,
      vacaciones: (baseTotal / 30) * 15 * 0.5,
    };
    calc.total = calc.indemnizacion + calc.aguinaldoProp + calc.bono14Prop + calc.vacaciones;
    setFiniquitoState({ show: true, emp, calculation: calc });
  };

  return (
    <Box p={{ base: 4, md: 6 }}>
      {/* HEADER */}
      <Flex
        justify="space-between"
        align="center"
        mb={6}
        flexWrap="wrap"
        gap={4}
      >
        <Box>
          <Heading size="lg" fontWeight={800} mb={1}>
            Directorio de Empleados
          </Heading>
          <Text color={textSecondary} fontSize="md">
            Gestión de personal y distribución de costos · {employees.length} registros
          </Text>
        </Box>
        <HStack spacing={3}>
          <Button
            variant="outline"
            leftIcon={<Download size={16} style={{ transform: 'rotate(180deg)' }} />}
            onClick={() => setShowImport(true)}
            borderRadius="lg"
            transition="all 0.3s"
            _hover={{ transform: 'translateY(-1px)', shadow: 'md' }}
          >
            Importar CSV
          </Button>
          <Button
            colorScheme="brand"
            leftIcon={<UserPlus size={16} />}
            onClick={openAdd}
            borderRadius="lg"
            transition="all 0.3s"
            _hover={{ transform: 'translateY(-1px)', shadow: 'lg' }}
          >
            Nuevo Empleado
          </Button>
        </HStack>
      </Flex>

      {/* SEARCH / FILTER BAR */}
      <Box
        bg={cardBg}
        p={4}
        mb={5}
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        boxShadow="sm"
      >
        <Flex gap={3} align="center" flexWrap="wrap">
          <InputGroup flex={1} minW="250px">
            <InputLeftElement pointerEvents="none">
              <Search size={18} color="gray" />
            </InputLeftElement>
            <Input
              placeholder="Buscar por nombre o puesto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              borderRadius="lg"
            />
          </InputGroup>
          <Button
            variant={showFilters ? 'solid' : 'outline'}
            leftIcon={<Filter size={16} />}
            onClick={() => setShowFilters(!showFilters)}
            borderRadius="lg"
            transition="all 0.3s"
          >
            Filtros {showFilters ? '▲' : '▼'}
          </Button>
          {(filterDept !== 'ALL' || filterStatus !== 'ALL') && (
            <Button
              variant="ghost"
              leftIcon={<X size={16} />}
              onClick={() => { setFilterDept('ALL'); setFilterStatus('ALL'); }}
            >
              Limpiar
            </Button>
          )}
        </Flex>

        {/* Expandable filters */}
        <Collapse in={showFilters} animateOpacity>
          <Flex
            gap={3}
            mt={4}
            pt={4}
            borderTop="1px solid"
            borderColor={borderColor}
            flexWrap="wrap"
          >
            <FormControl minW="200px" maxW="280px">
              <FormLabel fontSize="sm" color={textSecondary}>Departamento</FormLabel>
              <Select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todos los departamentos</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </FormControl>
            <FormControl minW="150px" maxW="220px">
              <FormLabel fontSize="sm" color={textSecondary}>Estado</FormLabel>
              <Select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todos los estados</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </Select>
            </FormControl>
          </Flex>
        </Collapse>
      </Box>

      {/* EMPLOYEE TABLE */}
      <Box
        bg={cardBg}
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        boxShadow="sm"
        overflow="hidden"
      >
        <TableContainer>
          <Table variant="simple" size="md">
            <Thead bg={theadBg}>
              <Tr>
                <Th fontWeight={600} color={textSecondary} w="50px">#</Th>
                <Th fontWeight={600} color={textSecondary}>Empleado</Th>
                <Th fontWeight={600} color={textSecondary}>Departamento / Empresa</Th>
                <Th fontWeight={600} color={textSecondary}>Salario Base</Th>
                <Th fontWeight={600} color={textSecondary}>Distribución</Th>
                <Th fontWeight={600} color={textSecondary}>Estado</Th>
                <Th fontWeight={600} color={textSecondary} textAlign="right">Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((emp) => {
                const fullName = getFullName(emp);
                const companyName = companies.find(c => c.id === emp.companyId)?.nombre_comercial || 'Sin Asignar';
                
                return (
                  <Tr
                    key={emp.id}
                    transition="all 0.2s"
                    _hover={{ bg: hoverBg }}
                  >
                    <Td>
                      <Text fontSize="xs" fontWeight={600} color={textSecondary}>{emp.id}</Text>
                    </Td>
                    <Td>
                      <HStack spacing={3}>
                        <Avatar
                          size="sm"
                          name={fullName}
                          bg="brand.500"
                          color="white"
                          fontSize="0.75rem"
                          fontWeight={700}
                        />
                        <Box>
                          <Text
                            fontSize="sm"
                            fontWeight={600}
                            color={brandColor}
                            cursor="pointer"
                            onClick={() => openView(emp)}
                            _hover={{ textDecoration: 'underline' }}
                            transition="all 0.2s"
                          >
                            {fullName}
                          </Text>
                          <Text fontSize="xs" color={textSecondary}>
                            {emp.puesto || 'Sin Puesto'}
                          </Text>
                        </Box>
                      </HStack>
                    </Td>
                    <Td>
                      <VStack spacing={1} align="flex-start">
                        <Badge
                          variant="outline"
                          colorScheme="brand"
                          fontSize="xs"
                          borderRadius="md"
                          px={2}
                        >
                          {emp.departamento_laboral || 'N/A'}
                        </Badge>
                        <Badge
                          variant="subtle"
                          colorScheme="gray"
                          fontSize="xs"
                          borderRadius="md"
                          px={2}
                        >
                          {companyName}
                        </Badge>
                      </VStack>
                    </Td>
                    <Td>
                      <Text fontSize="sm" fontFamily="mono" fontWeight={600} color={accentColor}>
                        {formatQ(emp.sueldo_ordinario || 0)}
                      </Text>
                    </Td>
                    <Td>
                      <Tooltip
                        label={companies.filter(c => (emp.dist?.[c.id] || 0) > 0).map(c => `${c.nombre_comercial || c.nit}: ${emp.dist?.[c.id]}%`).join(' · ')}
                        placement="top"
                        hasArrow
                        borderRadius="md"
                      >
                        <Flex
                          w="120px"
                          h="8px"
                          borderRadius="full"
                          overflow="hidden"
                          bg={distBarBg}
                        >
                          {companies.map(c => {
                            const pct = emp.dist?.[c.id] || 0;
                            return pct > 0 ? (
                              <Box
                                key={c.id}
                                w={`${pct}%`}
                                bg={c.color || 'brand.500'}
                                transition="width 0.3s"
                              />
                            ) : null;
                          })}
                        </Flex>
                      </Tooltip>
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={emp.estado === 'Activo' ? 'green' : 'orange'}
                        fontWeight={600}
                        borderRadius="full"
                        px={3}
                        py={1}
                        fontSize="xs"
                      >
                        {emp.estado}
                      </Badge>
                    </Td>
                    <Td textAlign="right">
                      <HStack spacing={1} justify="flex-end">
                        <Tooltip label="Ver detalle" hasArrow>
                          <IconButton
                            aria-label="Ver detalle"
                            icon={<Eye size={18} />}
                            size="sm"
                            variant="ghost"
                            colorScheme="brand"
                            onClick={() => openView(emp)}
                            transition="all 0.3s"
                          />
                        </Tooltip>
                        <Tooltip label="Editar" hasArrow>
                          <IconButton
                            aria-label="Editar"
                            icon={<Edit2 size={18} />}
                            size="sm"
                            variant="ghost"
                            colorScheme="accent"
                            onClick={() => openEdit(emp)}
                            transition="all 0.3s"
                          />
                        </Tooltip>
                        {emp.estado === 'Activo' && (
                          <Tooltip label="Dar de Baja" hasArrow>
                            <IconButton
                              aria-label="Dar de Baja"
                              icon={<X size={18} />}
                              size="sm"
                              variant="ghost"
                              colorScheme="orange"
                              onClick={() => setOffboardState({ show: true, empId: emp.id, reason: '', date: new Date().toISOString().split('T')[0] })}
                              transition="all 0.3s"
                            />
                          </Tooltip>
                        )}
                        {emp.estado === 'Inactivo' && (
                          <Tooltip label="Generar Finiquito" hasArrow>
                            <IconButton
                              aria-label="Generar Finiquito"
                              icon={<FileText size={18} />}
                              size="sm"
                              variant="ghost"
                              colorScheme="blue"
                              onClick={() => handleGenerateFiniquito(emp)}
                              transition="all 0.3s"
                            />
                          </Tooltip>
                        )}
                        <Tooltip label="Eliminar (Permanente)" hasArrow>
                          <IconButton
                            aria-label="Eliminar"
                            icon={<Trash2 size={18} />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDelete(emp.id)}
                            transition="all 0.3s"
                          />
                        </Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                );
              })}
              {filtered.length === 0 && (
                <Tr>
                  <Td colSpan={7} textAlign="center" py={16}>
                    <Text color={textSecondary} fontSize="md">
                      No se encontraron empleados con los criterios de búsqueda.
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>

      {/* EMPLOYEE FORM MODAL (add/edit) */}
      {showModal && (modalMode === 'add' || modalMode === 'edit') && (
        <EmployeeFormModal 
          mode={modalMode} 
          initialData={currentEmp || INITIAL_FORM} 
          onClose={() => setShowModal(false)} 
          onSave={handleSave} 
          companies={companies} 
          departments={departments} 
        />
      )}

      {/* VIEW MODAL */}
      <Modal isOpen={showModal && modalMode === 'view' && !!currentEmp} onClose={() => setShowModal(false)} size="md" isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" bg={modalBg} boxShadow="2xl">
          <ModalHeader fontWeight={700} pb={2}>
            Expediente del Empleado
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {currentEmp && (
              <>
                <Heading size="md" fontWeight={700} mb={3}>{getFullName(currentEmp)}</Heading>
                <Text mb={1}><Text as="span" fontWeight={700}>Puesto:</Text> {currentEmp.puesto}</Text>
                <Text mb={1}><Text as="span" fontWeight={700}>Empresa:</Text> {companies.find(c => c.id === currentEmp.companyId)?.nombre_comercial}</Text>
                <Text mb={4}><Text as="span" fontWeight={700}>Sueldo:</Text> {formatQ(currentEmp.sueldo_ordinario)}</Text>
                <Text fontSize="sm" color={textSecondary}>
                  Haz clic en editar para ver y modificar todos los detalles.
                </Text>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* IMPORT DATA */}
      {showImport && <ImportData onClose={() => setShowImport(false)} />}

      {/* OFFBOARDING MODAL */}
      <Modal
        isOpen={offboardState.show}
        onClose={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })}
        size="md"
        isCentered
      >
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" bg={modalBg} boxShadow="2xl">
          <ModalHeader fontWeight={700} pb={2}>
            Dar de Baja
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color={textSecondary} mb={5}>
              El empleado pasará a estado Inactivo y ya no aparecerá en nóminas futuras, pero su historial se mantendrá intacto.
            </Text>
            <FormControl mb={5}>
              <FormLabel fontSize="sm" fontWeight={600}>Fecha de Baja</FormLabel>
              <Input
                type="date"
                value={offboardState.date}
                onChange={e => setOffboardState({ ...offboardState, date: e.target.value })}
                borderRadius="lg"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight={600}>Motivo / Observaciones</FormLabel>
              <Textarea
                value={offboardState.reason}
                onChange={e => setOffboardState({ ...offboardState, reason: e.target.value })}
                placeholder="Ej: Renuncia voluntaria, fin de contrato, despido justificado..."
                rows={3}
                borderRadius="lg"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter pt={4}>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })}
            >
              Cancelar
            </Button>
            <Button
              colorScheme="orange"
              onClick={handleOffboard}
              isDisabled={!offboardState.reason}
              transition="all 0.3s"
            >
              Confirmar Baja
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* FINIQUITO MODAL */}
      <Modal
        isOpen={finiquitoState.show && Boolean(finiquitoState.calculation)}
        onClose={() => setFiniquitoState({ show: false, emp: null, calculation: null })}
        size="lg"
        isCentered
      >
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" bg={modalBg} boxShadow="2xl">
          {finiquitoState.calculation && (
            <>
              <ModalHeader fontWeight={700} pb={2}>
                Cálculo de Finiquito (Liquidación)
              </ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                {/* Employee info header */}
                <Flex mb={5} align="center" gap={4}>
                  <Box flex={1}>
                    <Text fontSize="md" fontWeight={700} color={brandColor}>
                      {getFullName(finiquitoState.emp)}
                    </Text>
                    <Text fontSize="sm" color={textSecondary}>
                      {finiquitoState.emp?.puesto}
                    </Text>
                  </Box>
                  <Box textAlign="right">
                    <Text fontSize="xs" color={textSecondary}>Salario Base Computable</Text>
                    <Text fontFamily="mono" fontWeight={700} color={brandColor}>
                      {formatQ(Number(finiquitoState.emp?.sueldo_ordinario || 0) + Number(finiquitoState.emp?.bon_incentivo || 0))}
                    </Text>
                  </Box>
                </Flex>

                {/* Finiquito calculation table */}
                <Box
                  borderRadius="xl"
                  border="1px solid"
                  borderColor={borderColor}
                  overflow="hidden"
                >
                  <Table size="sm" variant="simple">
                    <Tbody>
                      <Tr>
                        <Td fontSize="sm">Indemnización por Tiempo Servido</Td>
                        <Td textAlign="right">
                          <Text fontFamily="mono" color={brandColor} fontWeight={600}>
                            {formatQ(finiquitoState.calculation.indemnizacion)}
                          </Text>
                        </Td>
                      </Tr>
                      <Tr>
                        <Td fontSize="sm">Aguinaldo Proporcional</Td>
                        <Td textAlign="right">
                          <Text fontFamily="mono" color={brandColor} fontWeight={600}>
                            {formatQ(finiquitoState.calculation.aguinaldoProp)}
                          </Text>
                        </Td>
                      </Tr>
                      <Tr>
                        <Td fontSize="sm">Bono 14 Proporcional</Td>
                        <Td textAlign="right">
                          <Text fontFamily="mono" color={brandColor} fontWeight={600}>
                            {formatQ(finiquitoState.calculation.bono14Prop)}
                          </Text>
                        </Td>
                      </Tr>
                      <Tr>
                        <Td fontSize="sm">Vacaciones Pendientes de Goce</Td>
                        <Td textAlign="right">
                          <Text fontFamily="mono" color={brandColor} fontWeight={600}>
                            {formatQ(finiquitoState.calculation.vacaciones)}
                          </Text>
                        </Td>
                      </Tr>
                      <Tr bg={finiquitoRowBg}>
                        <Td>
                          <Text fontWeight={700} color={brandColor}>GRAN TOTAL A RECIBIR</Text>
                        </Td>
                        <Td textAlign="right">
                          <Text fontFamily="mono" fontWeight={700} color={accentColor} fontSize="lg">
                            {formatQ(finiquitoState.calculation.total)}
                          </Text>
                        </Td>
                      </Tr>
                    </Tbody>
                  </Table>
                </Box>
              </ModalBody>
              <ModalFooter pt={4}>
                <Button
                  variant="ghost"
                  mr={3}
                  onClick={() => setFiniquitoState({ show: false, emp: null, calculation: null })}
                >
                  Cerrar
                </Button>
                <Button
                  colorScheme="brand"
                  leftIcon={<FileText size={16} />}
                  onClick={() => {
                    alert('Generando PDF del Finiquito...');
                    setFiniquitoState({ show: false, emp: null, calculation: null });
                  }}
                  transition="all 0.3s"
                  _hover={{ transform: 'translateY(-1px)', shadow: 'lg' }}
                >
                  Imprimir Constancia
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Box>
  );
}
