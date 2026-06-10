import React, { useState, useMemo, useContext, useRef, useEffect, useCallback } from 'react';
import {
  Search, Plus, Edit2, Trash2, X, Eye, ChevronDown,
  UserPlus, Filter, Download, Check, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DataContext } from '../context/DataContext';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import ImportData from '../components/ImportData';
import EmployeeFormModal from '../components/EmployeeFormModal';
import EmployeeViewModal from '../components/EmployeeViewModal';
import FiniquitoDocument from '../components/FiniquitoDocument';
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
  const { employees, addEmployee, updateEmployee, deleteEmployee, companies, departments, areas, divisions, subdivisions } = useContext(DataContext);
  
  const INITIAL_FORM = useMemo(() => ({
    estado: 'Activo',
    moneda: 'GTQ',
    dist: companies.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {})
  }), [companies]);

  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Strip accents/tildes for search comparison
  const normalize = useCallback((str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), []);
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterArea, setFilterArea] = useState('ALL');
  const [filterDiv, setFilterDiv] = useState('ALL');
  const [filterSubdiv, setFilterSubdiv] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add | edit | view
  const [currentEmp, setCurrentEmp] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Offboarding modal state
  const [offboardState, setOffboardState] = useState({ show: false, empId: null, reason: '', date: new Date().toISOString().split('T')[0] });
  
  // Finiquito modal state
  const [finiquitoState, setFiniquitoState] = useState({ show: false, emp: null, calculation: null });
  const finiquitoRef = useRef(null);
  const finiquitoPrintRef = useRef(null);

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

  const getFullName = (e) => `${e.primer_nombre || ''} ${e.segundo_nombre || ''} ${e.otro_nombre || ''} ${e.primer_apellido || ''} ${e.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim() || 'Sin Nombre';

  const getDist = (emp) => {
    if (typeof emp.dist === 'string') {
      try { return JSON.parse(emp.dist); } catch(e) { return {}; }
    }
    return emp.dist || {};
  };

  const filteredEmployees = useMemo(() => {
    const searchNorm = normalize(debouncedSearch);
    return employees.filter(e => {
      if (filterDept !== 'ALL' && e.departamento_laboral !== filterDept) return false;
      if (filterArea !== 'ALL' && String(e.areaId) !== filterArea) return false;
      if (filterDiv !== 'ALL' && String(e.divisionId) !== filterDiv) return false;
      if (filterSubdiv !== 'ALL' && String(e.subdivisionId) !== filterSubdiv) return false;
      if (filterStatus !== 'ALL') {
        const empStatus = (e.estado || '').toUpperCase();
        const selStatus = filterStatus.toUpperCase();
        if (empStatus !== selStatus) return false;
      }
      if (!searchNorm) return true;
      const fullName = normalize(getFullName(e));
      return fullName.includes(searchNorm) ||
             normalize(e.puesto || '').includes(searchNorm) ||
             (e.dpi || '').includes(debouncedSearch) ||
             (e.no_igss || '').includes(debouncedSearch) ||
             (e.nit || '').includes(debouncedSearch);
    });
  }, [employees, debouncedSearch, filterDept, filterArea, filterDiv, filterSubdiv, filterStatus, normalize]);

  const pagination = usePagination(filteredEmployees, 10);

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
      toast.success('Empleado Creado', {
        description: 'Se ha agregado exitosamente.',
      });
    } else if (modalMode === 'edit' && currentEmp) {
      updateEmployee(currentEmp.id, formData);
      toast.success('Empleado Actualizado', {
        description: 'Los cambios se han guardado.',
      });
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
      estado: 'De Baja', 
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

  const getEmployeeCompany = (emp) => {
    const companyId = emp?.empresa_principal || emp?.companyId;
    return companies.find(c => String(c.id) === String(companyId)) || null;
  };

  const handlePrintFiniquito = async () => {
    if (!finiquitoState.emp || !finiquitoState.calculation) {
      toast.error('No hay datos para generar el finiquito.');
      return;
    }

    const element = finiquitoPrintRef.current;
    if (!element) {
      toast.error('No se pudo preparar el finiquito.');
      return;
    }

    const toastId = toast.loading('Generando PDF del finiquito...');
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      } else {
        let position = 0;
        let remaining = imgHeight;
        while (remaining > 0) {
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          remaining -= pdfHeight;
          position -= pdfHeight;
          if (remaining > 0) pdf.addPage();
        }
      }

      const fullName = getFullName(finiquitoState.emp);
      const safeName = (fullName || 'Empleado').replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Finiquito_${safeName}.pdf`);

      toast.success('PDF del finiquito generado', { id: toastId });
      setFiniquitoState({ show: false, emp: null, calculation: null });
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el PDF del finiquito', { id: toastId });
    }
  };

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      {/* HEADER */}
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
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
        <HStack spacing={3} flexWrap="wrap">
          <Button
            variant="outline"
            leftIcon={<Download size={16} style={{ transform: 'rotate(180deg)' }} />}
            onClick={() => setShowImport(true)}
            borderRadius="lg"
            transition="all 0.3s"
            _hover={{ shadow: 'md' }}
          >
            Importar CSV
          </Button>
          <Button
            colorScheme="brand"
            leftIcon={<UserPlus size={16} />}
            onClick={openAdd}
            borderRadius="lg"
            transition="all 0.3s"
            _hover={{ shadow: 'lg' }}
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
          <InputGroup flex={1} minW={{ base: '100%', md: '250px' }}>
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
          {(filterDept !== 'ALL' || filterArea !== 'ALL' || filterDiv !== 'ALL' || filterSubdiv !== 'ALL' || filterStatus !== 'ALL') && (
            <Button
              variant="ghost"
              leftIcon={<X size={16} />}
              onClick={() => { setFilterDept('ALL'); setFilterArea('ALL'); setFilterDiv('ALL'); setFilterSubdiv('ALL'); setFilterStatus('ALL'); }}
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
            <FormControl minW={{ base: '100%', sm: '180px' }} maxW={{ base: '100%', sm: '240px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">Departamento</FormLabel>
              <Select
                value={filterDept}
                onChange={e => { setFilterDept(e.target.value); setFilterArea('ALL'); setFilterDiv('ALL'); setFilterSubdiv('ALL'); }}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todos</option>
                {departments.map((d, i) => <option key={d.id || i} value={d.nombre_dimension}>{d.nombre_dimension}</option>)}
              </Select>
            </FormControl>
            <FormControl minW={{ base: '100%', sm: '180px' }} maxW={{ base: '100%', sm: '240px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">Área</FormLabel>
              <Select
                value={filterArea}
                onChange={e => { setFilterArea(e.target.value); setFilterDiv('ALL'); setFilterSubdiv('ALL'); }}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todas</option>
                {(areas || []).map(a => <option key={a.id} value={String(a.id)}>{a.nombre}</option>)}
              </Select>
            </FormControl>
            <FormControl minW={{ base: '100%', sm: '180px' }} maxW={{ base: '100%', sm: '240px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">División</FormLabel>
              <Select
                value={filterDiv}
                onChange={e => { setFilterDiv(e.target.value); setFilterSubdiv('ALL'); }}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todas</option>
                {(divisions || []).map(d => <option key={d.id} value={String(d.id)}>{d.nombre}</option>)}
              </Select>
            </FormControl>
            <FormControl minW={{ base: '100%', sm: '180px' }} maxW={{ base: '100%', sm: '240px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">Subdivisión</FormLabel>
              <Select
                value={filterSubdiv}
                onChange={e => setFilterSubdiv(e.target.value)}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todas</option>
                {(subdivisions || []).map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
              </Select>
            </FormControl>
            <FormControl minW={{ base: '100%', sm: '140px' }} maxW={{ base: '100%', sm: '180px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">Estado</FormLabel>
              <Select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todos</option>
                <option value="Activo">Activo</option>
                <option value="De Baja">De Baja</option>
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
        <TableContainer overflowX="auto">
          <Table variant="simple" size={{ base: 'sm', md: 'md' }} minW="900px">
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
              {filteredEmployees.length === 0 ? (
                <Tr>
                  <Td colSpan={7} textAlign="center" py={16}>
                    <Text color={textSecondary} fontSize="md">
                      No se encontraron empleados con los criterios de búsqueda.
                    </Text>
                  </Td>
                </Tr>
              ) : (
                pagination.paginatedData.map((emp) => {
                  const fullName = getFullName(emp);
                  const companyName = companies.find(c => c.id === emp.empresa_principal)?.nombre_comercial || 'SIN ASIGNAR';
                  
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
                        {(() => {
                          const distObj = getDist(emp);
                          const activeCompanies = companies.filter(c => (distObj[c.id] || 0) > 0);
                          const tooltipLabel = activeCompanies.map(c => `${c.nombre_comercial || c.nit}: ${distObj[c.id]}%`).join(' · ');
                          
                          return (
                            <Tooltip
                              label={tooltipLabel}
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
                                  const pct = distObj[c.id] || 0;
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
                          );
                        })()}
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
                        <HStack spacing={{ base: 0, md: 1 }} justify="flex-end">
                          <Tooltip label="Ver detalle" hasArrow>
                            <IconButton
                              aria-label="Ver detalle"
                              icon={<Eye size={16} />}
                              size={{ base: 'xs', md: 'sm' }}
                              variant="ghost"
                              colorScheme="brand"
                              onClick={() => openView(emp)}
                              transition="all 0.3s"
                            />
                          </Tooltip>
                          <Tooltip label="Editar" hasArrow>
                            <IconButton
                              aria-label="Editar"
                              icon={<Edit2 size={16} />}
                              size={{ base: 'xs', md: 'sm' }}
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
                                icon={<X size={16} />}
                                size={{ base: 'xs', md: 'sm' }}
                                variant="ghost"
                                colorScheme="orange"
                                onClick={() => setOffboardState({ show: true, empId: emp.id, reason: '', date: new Date().toISOString().split('T')[0] })}
                                transition="all 0.3s"
                              />
                            </Tooltip>
                          )}
                          {emp.estado === 'De Baja' && (
                            <Tooltip label="Generar Finiquito" hasArrow>
                              <IconButton
                                aria-label="Generar Finiquito"
                                icon={<FileText size={16} />}
                                size={{ base: 'xs', md: 'sm' }}
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
                              icon={<Trash2 size={16} />}
                              size={{ base: 'xs', md: 'sm' }}
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
                })
              )}
            </Tbody>
          </Table>
        </TableContainer>
        <Pagination {...pagination} />
      </Box>

      {/* EMPLOYEE FORM MODAL (add/edit) */}
      {showModal && (modalMode === 'add' || modalMode === 'edit') && (
        <EmployeeFormModal 
          mode={modalMode} 
          initialData={currentEmp || INITIAL_FORM} 
          onClose={() => setShowModal(false)} 
          onSave={handleSave} 
          employees={employees}
          companies={companies} 
          departments={departments}
          areas={areas}
          divisions={divisions}
          subdivisions={subdivisions}
        />
      )}

      {/* VIEW MODAL */}
      <EmployeeViewModal 
        isOpen={showModal && modalMode === 'view'} 
        onClose={() => setShowModal(false)} 
        employee={currentEmp} 
        companies={companies}
        areas={areas}
        divisions={divisions}
        subdivisions={subdivisions}
        onEdit={(emp) => {
          setCurrentEmp(emp);
          setModalMode('edit');
          setShowModal(true);
        }}
      />

      {/* IMPORT DATA */}
      {showImport && <ImportData onClose={() => setShowImport(false)} />}

      {/* OFFBOARDING MODAL */}
      <Modal
        isOpen={offboardState.show}
        onClose={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })}
        size={{ base: 'full', md: 'md' }}
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
              El empleado pasará a estado DE BAJA y ya no aparecerá en nóminas futuras, pero su historial se mantendrá intacto.
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

      {/* Documento oculto para generación del PDF */}
      {finiquitoState.calculation && finiquitoState.emp && (
        <Box
          position="fixed"
          left="-9999px"
          top={0}
          zIndex={-1}
          pointerEvents="none"
        >
          <Box ref={finiquitoPrintRef}>
            <FiniquitoDocument
              emp={finiquitoState.emp}
              calculation={finiquitoState.calculation}
              company={getEmployeeCompany(finiquitoState.emp)}
            />
          </Box>
        </Box>
      )}

      {/* FINIQUITO MODAL */}
      <Modal
        isOpen={finiquitoState.show && Boolean(finiquitoState.calculation)}
        onClose={() => setFiniquitoState({ show: false, emp: null, calculation: null })}
        size={{ base: 'full', md: 'lg' }}
        isCentered
      >
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent ref={finiquitoRef} borderRadius="xl" bg={modalBg} boxShadow="2xl">
          {finiquitoState.calculation && (
            <>
              <ModalHeader fontWeight={700} pb={2}>
                Cálculo de Finiquito (Liquidación)
              </ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <Text fontSize="xs" color={textSecondary} mb={4}>
                  {getEmployeeCompany(finiquitoState.emp)?.nombre_comercial || 'Empresa'} — Vista previa del documento
                </Text>
                <Flex mb={5} align="center" gap={4}>
                  <Box flex={1}>
                    <Text fontSize="md" fontWeight={700} color={brandColor}>
                      {getFullName(finiquitoState.emp)}
                    </Text>
                    <Text fontSize="sm" color={textSecondary}>
                      {finiquitoState.emp?.puesto}
                    </Text>
                    {finiquitoState.emp?.dpi && (
                      <Text fontSize="xs" color={textSecondary} mt={1}>
                        DPI: {finiquitoState.emp.dpi}
                      </Text>
                    )}
                  </Box>
                  <Box textAlign="right">
                    <Text fontSize="xs" color={textSecondary}>Salario base computable</Text>
                    <Text fontFamily="mono" fontWeight={700} color={brandColor}>
                      {formatQ(Number(finiquitoState.emp?.sueldo_ordinario || 0) + Number(finiquitoState.emp?.bon_incentivo || 0))}
                    </Text>
                  </Box>
                </Flex>

                <Box borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden">
                  <Table size="sm" variant="simple">
                    <Tbody>
                      {[
                        ['Indemnización por tiempo servido', finiquitoState.calculation.indemnizacion],
                        ['Aguinaldo proporcional', finiquitoState.calculation.aguinaldoProp],
                        ['Bono 14 proporcional', finiquitoState.calculation.bono14Prop],
                        ['Vacaciones pendientes de goce', finiquitoState.calculation.vacaciones],
                      ].map(([label, amount]) => (
                        <Tr key={label}>
                          <Td fontSize="sm">{label}</Td>
                          <Td textAlign="right">
                            <Text fontFamily="mono" color={brandColor} fontWeight={600}>
                              {formatQ(amount)}
                            </Text>
                          </Td>
                        </Tr>
                      ))}
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
                  onClick={handlePrintFiniquito}
                  transition="all 0.3s"
                  _hover={{ shadow: 'lg' }}
                >
                  Descargar PDF
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Box>
  );
}
