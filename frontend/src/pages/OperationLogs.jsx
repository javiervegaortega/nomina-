import React, { useState, useContext, useMemo } from 'react';
import {
  Box, Heading, Table, Thead, Tbody, Tr, Th, Td, IconButton, Button,
  HStack, Select, Input, Badge, useDisclosure, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel,
  VStack, Text, Checkbox
} from '@chakra-ui/react';
import { Plus, Check, X, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';

export default function OperationLogs() {
  const { employees, operationLogs, addOperationLog, updateOperationLogStatus, deleteOperationLog } = useContext(DataContext);
  const { user } = useContext(AuthContext);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const availableEmployees = useMemo(() => {
    let filtered = employees;
    
    if (user && user.idDepartamento) {
      const normalize = (str) => (str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() : "");
      const userDept = normalize(user.idDepartamento);
      
      filtered = employees.filter(emp => {
        const depLab = normalize(emp.departamento_laboral);
        const depOrig = normalize(emp.departamento_originario);
        const centro = normalize(emp.centro_de_costo);
        
        return depLab.includes(userDept) || depOrig.includes(userDept) || centro.includes(userDept);
      });
    }

    return filtered
      .filter(emp => emp.estado && emp.estado.toUpperCase() === 'ACTIVO')
      .sort((a, b) => {
        const nameA = [a.primer_nombre, a.segundo_nombre, a.otro_nombre, a.primer_apellido, a.segundo_apellido].filter(Boolean).join(' ').trim();
        const nameB = [b.primer_nombre, b.segundo_nombre, b.otro_nombre, b.primer_apellido, b.segundo_apellido].filter(Boolean).join(' ').trim();
        return nameA.localeCompare(nameB);
      });
  }, [employees, user]);

  const [formData, setFormData] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    type: 'HORA_EXTRA',
    hoursQty: 0,
    hourType: 'SIMPLE',
    bonusQty: 1,
    bonusAmount: 0,
    taskDescription: ''
  });

  const filteredLogs = useMemo(() => {
    return operationLogs.filter(log => {
      if (filterMonth && !log.date.startsWith(filterMonth)) return false;
      if (filterType !== 'ALL' && log.type !== filterType) return false;
      if (filterStatus !== 'ALL' && log.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [operationLogs, filterMonth, filterType, filterStatus]);

  const handleSave = () => {
    if (!formData.employeeId || !formData.date || !formData.taskDescription) {
      toast.warning('Completa los campos requeridos');
      return;
    }
    
    const payload = {
      ...formData,
      employeeId: Number(formData.employeeId),
      hoursQty: formData.type === 'HORA_EXTRA' ? Number(formData.hoursQty) : 0,
      bonusQty: formData.type === 'BONO' ? Number(formData.bonusQty) : 0,
      bonusAmount: formData.type === 'BONO' ? Number(formData.bonusAmount) : 0,
    };

    addOperationLog(payload);
    onClose();
    toast.success('Registro agregado exitosamente');
  };

  const handleApprove = async (id) => {
    await updateOperationLogStatus(id, 'APPROVED_MANAGER');
    toast.success('Solicitud aprobada');
  };

  const handleReject = async (id) => {
    await updateOperationLogStatus(id, 'REJECTED');
    toast.error('Solicitud rechazada');
  };

  const handleDelete = async (id) => {
    await deleteOperationLog(id);
    toast.success('Registro eliminado');
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'PENDING_MANAGER': return <Badge px={2} py={1} borderRadius="md" bg="yellow.500" color="yellow.900" textTransform="uppercase" fontWeight="bold" fontSize="xs" boxShadow="sm">Pdte. Gerente</Badge>;
      case 'APPROVED_MANAGER': return <Badge px={2} py={1} borderRadius="md" bg="blue.500" color="white" textTransform="uppercase" fontWeight="bold" fontSize="xs" boxShadow="sm">Aprobado</Badge>;
      case 'REJECTED': return <Badge px={2} py={1} borderRadius="md" bg="red.500" color="white" textTransform="uppercase" fontWeight="bold" fontSize="xs" boxShadow="sm">Rechazado</Badge>;
      case 'PROCESSED_PAYROLL': return <Badge px={2} py={1} borderRadius="md" bg="green.500" color="white" textTransform="uppercase" fontWeight="bold" fontSize="xs" boxShadow="sm">En Nómina</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <Box p={6}>
      <HStack justify="space-between" mb={6}>
        <Heading size="md" color="white">Reporte de Operaciones (Bonos y Horas)</Heading>
        <Button leftIcon={<Plus size={16} />} colorScheme="brand" onClick={() => {
          setFormData({
            employeeId: '', date: new Date().toISOString().slice(0, 10), type: 'HORA_EXTRA',
            hoursQty: 0, hourType: 'SIMPLE', bonusQty: 1, bonusAmount: 0, taskDescription: ''
          });
          onOpen();
        }}>
          Nuevo Registro
        </Button>
      </HStack>

      <HStack mb={4} spacing={4} bg="gray.800" p={4} borderRadius="lg">
        <FormControl w="200px">
          <FormLabel fontSize="xs" color="gray.400">Mes</FormLabel>
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} size="sm" />
        </FormControl>
        <FormControl w="150px">
          <FormLabel fontSize="xs" color="gray.400">Tipo</FormLabel>
          <Select size="sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="HORA_EXTRA">Horas Extras</option>
            <option value="BONO">Bonos</option>
          </Select>
        </FormControl>
        <FormControl w="150px">
          <FormLabel fontSize="xs" color="gray.400">Estado</FormLabel>
          <Select size="sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="PENDING_MANAGER">Pendientes</option>
            <option value="APPROVED_MANAGER">Aprobados</option>
            <option value="PROCESSED_PAYROLL">Procesados</option>
          </Select>
        </FormControl>
      </HStack>

      <Box bg="gray.800" borderRadius="lg" overflow="hidden" overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead bg="gray.900">
            <Tr>
              <Th color="gray.400">Fecha</Th>
              <Th color="gray.400">Empleado</Th>
              <Th color="gray.400">Tipo</Th>
              <Th color="gray.400">Detalle (Horas/Monto)</Th>
              <Th color="gray.400">Tarea</Th>
              <Th color="gray.400">Estado</Th>
              <Th color="gray.400">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredLogs.map(log => (
              <Tr key={log.id}>
                <Td>{log.date}</Td>
                <Td>{log.Employee ? `${log.Employee.primer_nombre} ${log.Employee.primer_apellido}` : 'Desconocido'}</Td>
                <Td>{log.type === 'HORA_EXTRA' ? 'Hrs Extras' : 'Bono'}</Td>
                <Td>
                  {log.type === 'HORA_EXTRA' 
                    ? `${log.hoursQty} hrs (${log.hourType})`
                    : `Q${log.bonusAmount}`
                  }
                </Td>
                <Td maxW="200px" isTruncated>{log.taskDescription}</Td>
                <Td>{getStatusBadge(log.status)}</Td>
                <Td>
                  <HStack spacing={3}>
                    {log.status === 'PENDING_MANAGER' && (
                      <>
                        <IconButton size="sm" icon={<Check size={16} />} colorScheme="blue" variant="solid" borderRadius="full" boxShadow="md" _hover={{ transform: 'scale(1.1)' }} title="Aprobar" onClick={() => handleApprove(log.id)} />
                        <IconButton size="sm" icon={<X size={16} />} colorScheme="red" variant="solid" borderRadius="full" boxShadow="md" _hover={{ transform: 'scale(1.1)' }} title="Rechazar" onClick={() => handleReject(log.id)} />
                      </>
                    )}
                    {log.status !== 'PROCESSED_PAYROLL' && (
                      <IconButton size="sm" icon={<Trash2 size={16} />} variant="ghost" colorScheme="red" borderRadius="full" _hover={{ bg: 'red.500', color: 'white', transform: 'scale(1.1)' }} title="Eliminar" onClick={() => handleDelete(log.id)} />
                    )}
                  </HStack>
                </Td>
              </Tr>
            ))}
            {filteredLogs.length === 0 && (
              <Tr><Td colSpan={7} textAlign="center" color="gray.500" py={4}>No hay registros para este periodo</Td></Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Modal Agregar Registro */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg="gray.800" color="white">
          <ModalHeader>Nuevo Registro de Operación</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Empleado</FormLabel>
                <Select value={formData.employeeId} onChange={(e) => setFormData({...formData, employeeId: e.target.value})}>
                  <option value="">Seleccione...</option>
                  {availableEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {[emp.primer_nombre, emp.segundo_nombre, emp.otro_nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </Select>
              </FormControl>
              
              <HStack w="100%">
                <FormControl isRequired flex={1}>
                  <FormLabel fontSize="sm">Fecha</FormLabel>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </FormControl>
                <FormControl flex={1}>
                  <FormLabel fontSize="sm">Tipo de Registro</FormLabel>
                  <Select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                    <option value="HORA_EXTRA">Horas Extras</option>
                    <option value="BONO">Bono</option>
                  </Select>
                </FormControl>
              </HStack>

              {formData.type === 'HORA_EXTRA' && (
                <HStack w="100%">
                  <FormControl flex={1}>
                    <FormLabel fontSize="sm">Cantidad de Horas</FormLabel>
                    <Input type="number" step="0.5" value={formData.hoursQty} onChange={(e) => setFormData({...formData, hoursQty: e.target.value})} />
                  </FormControl>
                  <FormControl flex={1}>
                    <FormLabel fontSize="sm">Tipo de Hora</FormLabel>
                    <Select value={formData.hourType} onChange={(e) => setFormData({...formData, hourType: e.target.value})}>
                      <option value="SIMPLE">Simples</option>
                      <option value="DOBLE">Dobles</option>
                      <option value="NOCTURNA">Nocturnas</option>
                    </Select>
                  </FormControl>
                </HStack>
              )}

              {formData.type === 'BONO' && (
                <HStack w="100%">
                  <FormControl flex={1}>
                    <FormLabel fontSize="sm">Monto del Bono (Q)</FormLabel>
                    <Input type="number" value={formData.bonusAmount} onChange={(e) => setFormData({...formData, bonusAmount: e.target.value})} />
                  </FormControl>
                </HStack>
              )}

              <FormControl isRequired>
                <FormLabel fontSize="sm">Tarea Realizada (Descripción)</FormLabel>
                <Input value={formData.taskDescription} onChange={(e) => setFormData({...formData, taskDescription: e.target.value})} placeholder="Ej. Empaque de 4 fardos..." />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
            <Button colorScheme="brand" onClick={handleSave}>Guardar Registro</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Box>
  );
}
