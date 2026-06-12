import React, { useState, useContext, useMemo } from 'react';
import { DataContext } from '../context/DataContext';
import { AppContext } from '../App';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { Plus, Trash2, Eye, Search, Coffee, User, Clock } from 'lucide-react';
import { formatQ } from '../data/mockData';
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Badge,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Select,
  Checkbox,
  SimpleGrid,
  Textarea,
  InputGroup,
  InputLeftElement,
  Avatar,
  useColorModeValue,
  useDisclosure,
  useToast,
  Skeleton,
  SkeletonText,
} from '@chakra-ui/react';

export default function Commissions() {
  const { employees, companies, commissions, addCommission, deleteCommission, isLoading } = useContext(DataContext);
  const { confirmAction } = useContext(AppContext);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const pagination = usePagination(commissions, 10);

  // Form state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    mes: '',
    empresa_id: '',
    autorizado_cenas: false,
    horas: '',
    tipo_hora: '',
    jornada_trabajo: '',
    bono_unidades: '',
    monto_bono: '',
    tarea_realizada: '',
    solicitante: 'Operaciones',
  });

  // Color mode values
  const tableBorderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const tableContainerBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const subtitleColor = useColorModeValue('gray.600', 'gray.400');
  const idColor = useColorModeValue('gray.500', 'gray.400');
  const nameColor = useColorModeValue('gray.800', 'white');
  const secondaryColor = useColorModeValue('gray.500', 'gray.400');
  const emptyTextColor = useColorModeValue('gray.500', 'gray.500');
  const badgeBg = useColorModeValue('brand.50', 'brand.900');
  const badgeColor = useColorModeValue('brand.700', 'brand.200');
  const viewHoverBg = useColorModeValue('brand.50', 'whiteAlpha.100');
  const deleteHoverBg = useColorModeValue('red.50', 'whiteAlpha.100');
  const viewIconColor = useColorModeValue('brand.500', 'brand.300');
  const deleteIconColor = useColorModeValue('red.500', 'red.300');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.100');
  const readOnlyBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const modalBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Filtered employee search
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return employees.filter(e => {
      const fullName = `${e.primer_nombre || ''} ${e.primer_apellido || ''}`.toLowerCase();
      return fullName.includes(term);
    }).slice(0, 5);
  }, [searchTerm, employees]);

  const resetForm = () => {
    setSelectedEmp(null);
    setSearchTerm('');
    setForm({
      fecha: new Date().toISOString().split('T')[0],
      mes: '',
      empresa_id: '',
      autorizado_cenas: false,
      horas: '',
      tipo_hora: '',
      jornada_trabajo: '',
      bono_unidades: '',
      monto_bono: '',
      tarea_realizada: '',
      solicitante: 'Operaciones',
    });
  };

  const openAdd = () => {
    resetForm();
    // Auto-set month from today
    const now = new Date();
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    setForm(prev => ({ ...prev, mes: monthNames[now.getMonth()] }));
    onOpen();
  };

  const handleSelectEmployee = (emp) => {
    setSelectedEmp(emp);
    setSearchTerm('');
    setForm(prev => ({ ...prev, empresa_id: emp.companyId || emp.empresa_principal || '' }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleDateChange = (e) => {
    const dateStr = e.target.value;
    const dateObj = new Date(dateStr);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    setForm(prev => ({ ...prev, fecha: dateStr, mes: monthNames[dateObj.getMonth()] || prev.mes }));
  };

  const handleSave = () => {
    if (!selectedEmp) {
      toast({ title: 'Seleccione un empleado', status: 'warning', duration: 2500, isClosable: true });
      return;
    }
    const payload = {
      ...form,
      employee_id: selectedEmp.id,
      horas: Number(form.horas) || 0,
      bono_unidades: Number(form.bono_unidades) || 0,
      monto_bono: Number(form.monto_bono) || 0,
    };
    addCommission(payload);
    toast({ title: 'Solicitud guardada', status: 'success', duration: 2500, isClosable: true });
    onClose();
  };

  // Helper to get employee name from id
  const getEmpName = (id) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.primer_nombre || ''} ${emp.primer_apellido || ''}` : `ID ${id}`;
  };

  const getCompanyName = (id) => {
    const comp = companies.find(c => c.id === Number(id));
    return comp ? (comp.nombre_comercial || comp.name || 'S/N') : '-';
  };

  if (isLoading) {
    return (
      <Box p={{ base: 4, md: 6, lg: 8 }}>
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Skeleton h="28px" w="180px" mb={2} />
            <Skeleton h="14px" w="320px" />
          </Box>
          <Skeleton h="40px" w="170px" borderRadius="lg" />
        </Flex>
        <Box border="1px solid" borderColor={tableBorderColor} borderRadius="xl" overflow="hidden">
          <Table variant="modern" minW="850px">
            <Thead>
              <Tr>
                <Th>Empleado</Th>
                <Th>Empresa</Th>
                <Th>Fecha</Th>
                <Th>Mes</Th>
                <Th>Horas</Th>
                <Th>Tipo</Th>
                <Th>Bono</Th>
                <Th>Estado</Th>
                <Th textAlign="right">Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {[1,2,3,4,5,6].map(i => (
                <Tr key={i}>
                  <Td><Skeleton h="14px" w="120px" /></Td>
                  <Td><Skeleton h="14px" w="100px" /></Td>
                  <Td><Skeleton h="14px" w="80px" /></Td>
                  <Td><Skeleton h="14px" w="60px" /></Td>
                  <Td><Skeleton h="14px" w="40px" /></Td>
                  <Td><Skeleton h="14px" w="60px" /></Td>
                  <Td><Skeleton h="14px" w="70px" /></Td>
                  <Td><Skeleton h="14px" w="70px" /></Td>
                  <Td textAlign="right"><Skeleton h="14px" w="40px" ml="auto" /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>
    );
  }

  return (
    <Box p={{ base: 4, md: 6, lg: 8 }}>
      {/* Header */}
      <Flex
        justify="space-between"
        align={{ base: 'flex-start', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap={4}
        mb={6}
      >
        <Box>
          <Heading as="h1" size={{ base: 'md', lg: 'lg' }} fontWeight={800} mb={1} letterSpacing="-0.02em">
            Comisiones
          </Heading>
          <Flex align="center" gap={2}>
            <Text fontSize="sm" color={subtitleColor}>
              Sistema de solicitud de Horas Extra y Bonos
            </Text>
            <Badge bg={badgeBg} color={badgeColor} fontSize="xs" fontWeight={600} px={2} py={0.5} borderRadius="full">
              {commissions.length} registros
            </Badge>
          </Flex>
        </Box>
        <Button
          colorScheme="brand"
          leftIcon={<Plus size={18} />}
          onClick={openAdd}
          size={{ base: 'sm', md: 'md' }}
          borderRadius="lg"
          transition="all 0.3s"
          _hover={{ boxShadow: 'lg' }}
        >
          Nueva Solicitud
        </Button>
      </Flex>

      {/* Table Container */}
      <Box
        bg={tableContainerBg}
        border="1px solid"
        borderColor={tableBorderColor}
        borderRadius="xl"
        overflow="hidden"
        boxShadow="sm"
        transition="all 0.3s"
        _hover={{ boxShadow: 'md' }}
      >
        <Box overflowX="auto">
          <Table variant="modern" minW="850px">
            <Thead>
              <Tr>
                <Th>Empleado</Th>
                <Th>Empresa</Th>
                <Th>Fecha</Th>
                <Th>Mes</Th>
                <Th>Horas</Th>
                <Th>Tipo</Th>
                <Th>Bono</Th>
                <Th>Estado</Th>
                <Th textAlign="right">Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pagination.paginatedData.map((c, i) => (
                <Tr key={c.id || i} transition="all 0.2s">
                  <Td>
                    <Text fontSize="sm" fontWeight={500} color={nameColor}>
                      {getEmpName(c.employee_id)}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm" color={secondaryColor}>
                      {getCompanyName(c.empresa_id)}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm" fontFamily="mono" color={idColor}>
                      {c.fecha || '-'}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm" color={secondaryColor}>
                      {c.mes || '-'}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm" fontFamily="mono" color={nameColor}>
                      {c.horas || 0}
                    </Text>
                  </Td>
                  <Td>
                    <Badge
                      colorScheme={c.tipo_hora === 'D' ? 'blue' : c.tipo_hora === 'N' ? 'purple' : 'gray'}
                      fontSize="xs"
                      borderRadius="full"
                    >
                      {c.tipo_hora === 'D' ? 'Diurna' : c.tipo_hora === 'N' ? 'Nocturna' : '-'}
                    </Badge>
                  </Td>
                  <Td>
                    <Text fontSize="sm" fontFamily="mono" fontWeight={600} color="green.500">
                      {c.monto_bono ? formatQ(c.monto_bono) : '-'}
                    </Text>
                  </Td>
                  <Td>
                    <Badge
                      colorScheme={c.estado === 'Aplicado' ? 'green' : 'yellow'}
                      fontSize="xs"
                      borderRadius="full"
                    >
                      {c.estado || 'Pendiente'}
                    </Badge>
                  </Td>
                  <Td textAlign="right">
                    <Flex justify="flex-end" gap={1}>
                      <Tooltip label="Eliminar" hasArrow>
                        <IconButton
                          aria-label="Eliminar solicitud"
                          icon={<Trash2 size={16} />}
                          size="sm"
                          variant="ghost"
                          color={deleteIconColor}
                          borderRadius="lg"
                          transition="all 0.3s"
                          _hover={{ bg: deleteHoverBg }}
                          onClick={() => {
                            confirmAction(`¿Seguro que desea eliminar esta solicitud?`, () => {
                              deleteCommission(c.id);
                            });
                          }}
                        />
                      </Tooltip>
                    </Flex>
                  </Td>
                </Tr>
              ))}
              {commissions.length === 0 && (
                <Tr>
                  <Td colSpan={9} textAlign="center" py={12}>
                    <Clock size={40} style={{ margin: '0 auto 12px', opacity: 0.25 }} />
                    <Text fontSize="sm" color={emptyTextColor}>
                      No hay solicitudes de horas extra o bonos registradas.
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Box>
        {commissions.length > 0 && (
          <Box p={4} borderTop="1px solid" borderColor={tableBorderColor}>
            <Pagination {...pagination} />
          </Box>
        )}
      </Box>

      {/* Add Commission Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size={{ base: 'full', md: 'xl' }} isCentered scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent bg={modalBg} borderRadius="xl">
          <ModalHeader fontWeight={700} borderBottom="1px solid" borderColor={borderColor}>
            Nueva Solicitud de Horas Extra / Bono
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={6}>
            {/* Employee Search */}
            <FormControl mb={5} position="relative">
              <FormLabel fontSize="sm" fontWeight={600}>Empleado</FormLabel>
              {!selectedEmp ? (
                <InputGroup>
                  <InputLeftElement pointerEvents="none"><Search size={16} color="gray" /></InputLeftElement>
                  <Input placeholder="Buscar empleado..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </InputGroup>
              ) : (
                <Flex justify="space-between" align="center" p={3} border="1px solid" borderColor={borderColor} borderRadius="md">
                  <Flex align="center" gap={3}>
                    <Avatar size="sm" icon={<User size={16} />} bg="brand.500" />
                    <Box>
                      <Text fontWeight={600} fontSize="sm">{selectedEmp.primer_nombre} {selectedEmp.primer_apellido}</Text>
                      <Text fontSize="xs" color={subtitleColor}>{selectedEmp.puesto || 'Sin puesto'}</Text>
                    </Box>
                  </Flex>
                  <Button size="xs" variant="ghost" onClick={() => setSelectedEmp(null)}>Cambiar</Button>
                </Flex>
              )}
              {searchTerm && filteredEmployees.length > 0 && (
                <Box position="absolute" top="100%" left={0} right={0} bg={modalBg} border="1px solid" borderColor={borderColor} borderRadius="md" mt={1} zIndex={10} boxShadow="lg" maxH="200px" overflowY="auto">
                  {filteredEmployees.map(emp => {
                    const comp = companies.find(c2 => c2.id === emp.companyId);
                    return (
                      <Flex key={emp.id} p={3} cursor="pointer" borderBottom="1px solid" borderColor={borderColor} align="center" gap={3} _hover={{ bg: hoverBg }} onClick={() => handleSelectEmployee(emp)}>
                        <Avatar size="xs" icon={<User size={12} />} bg="brand.400" />
                        <Text fontSize="sm">
                          {emp.primer_nombre} {emp.primer_apellido}
                          <Text as="span" color={subtitleColor} ml={1} fontSize="xs">- {comp?.nombre_comercial || 'Sin empresa'}</Text>
                        </Text>
                      </Flex>
                    );
                  })}
                </Box>
              )}
            </FormControl>

            <Flex p={3} border="1px solid" borderColor={borderColor} borderRadius="md" mb={5} align="center">
              <Checkbox name="autorizado_cenas" isChecked={form.autorizado_cenas} onChange={handleChange} colorScheme="brand">
                <Flex align="center" gap={2} fontSize="sm"><Coffee size={15} /> Autorizado cenas</Flex>
              </Checkbox>
            </Flex>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={5}>
              <FormControl isRequired>
                <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Fecha</FormLabel>
                <Input type="date" name="fecha" value={form.fecha} onChange={handleDateChange} size="sm" />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Mes</FormLabel>
                <Input name="mes" value={form.mes} isReadOnly bg={readOnlyBg} size="sm" />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Empresa</FormLabel>
                <Select name="empresa_id" value={form.empresa_id} onChange={handleChange} size="sm">
                  <option value="">Seleccione una empresa</option>
                  {companies.map(c2 => <option key={c2.id} value={c2.id}>{c2.nombre_comercial || c2.name}</option>)}
                </Select>
              </FormControl>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={5}>
              <FormControl>
                <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Horas (opcional)</FormLabel>
                <Input type="number" name="horas" value={form.horas} onChange={handleChange} min="0" step="0.5" placeholder="0" size="sm" />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Tipo de Hora (D-N)</FormLabel>
                <Select name="tipo_hora" value={form.tipo_hora} onChange={handleChange} size="sm">
                  <option value="">Seleccione...</option>
                  <option value="D">D (Diurna - Simple)</option>
                  <option value="N">N (Nocturna - Doble)</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Jornada de Trabajo</FormLabel>
                <Select name="jornada_trabajo" value={form.jornada_trabajo} onChange={handleChange} size="sm">
                  <option value="">Seleccione...</option>
                  <option value="Diurna">Diurna</option>
                  <option value="Nocturna">Nocturna</option>
                  <option value="Mixta">Mixta</option>
                </Select>
              </FormControl>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={5}>
              <FormControl>
                <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Bono (unidades)</FormLabel>
                <Input type="number" name="bono_unidades" value={form.bono_unidades} onChange={handleChange} min="0" placeholder="0" size="sm" />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Monto de Bono</FormLabel>
                <InputGroup size="sm">
                  <InputLeftElement pointerEvents="none" color={subtitleColor} fontSize="sm">Q</InputLeftElement>
                  <Input type="number" name="monto_bono" value={form.monto_bono} onChange={handleChange} min="0" step="0.01" placeholder="Ingrese el monto" />
                </InputGroup>
              </FormControl>
            </SimpleGrid>

            <FormControl mb={5}>
              <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Puesto</FormLabel>
              <Input value={selectedEmp?.puesto || ''} isReadOnly bg={readOnlyBg} size="sm" />
              <Text fontSize="xs" color={subtitleColor} mt={1}>Tomado del expediente del empleado seleccionado.</Text>
            </FormControl>

            <FormControl mb={5}>
              <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Tarea Realizada</FormLabel>
              <Textarea name="tarea_realizada" value={form.tarea_realizada} onChange={handleChange} placeholder="Descripción de la tarea u observaciones..." rows={3} size="sm" />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="xs" textTransform="uppercase" color={subtitleColor}>Solicitante</FormLabel>
              <Input name="solicitante" value={form.solicitante} isReadOnly bg={readOnlyBg} size="sm" />
            </FormControl>
          </ModalBody>

          <ModalFooter borderTop="1px solid" borderColor={borderColor}>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
            <Button colorScheme="brand" onClick={handleSave}>
              Guardar Solicitud
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
