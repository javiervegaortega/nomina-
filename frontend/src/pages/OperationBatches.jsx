import { useMemo, useState, useEffect, useContext } from 'react';
import {
  Badge, Box, Button, Flex, FormControl, FormLabel, Heading, HStack,
  IconButton, Input, InputGroup, InputLeftElement, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  Select, SimpleGrid, Table, Tbody, Td, Text, Th, Thead, Tooltip, Tr,
  useColorModeValue, useDisclosure, VStack
} from '@chakra-ui/react';
import { ClipboardList, Eye, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'sonner';
import { apiFetch } from '../utils/api';

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-GT', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
};

export default function OperationBatches() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [batches, setBatches] = useState([]);
  const [newBatchTitle, setNewBatchTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const bg = useColorModeValue('white', 'gray.800');
  const softBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const mutedText = useColorModeValue('gray.600', 'gray.400');
  const titleText = useColorModeValue('gray.800', 'white');
  const cardAccentBg = useColorModeValue('brand.50', 'rgba(2, 132, 199, 0.14)');

  const fetchBatches = async () => {
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await apiFetch('/api/operation-batches?summary=1&page=1&pageSize=50', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBatches(Array.isArray(data) ? data : (data.items || []));
      }
    } catch (err) {
      console.error(err);
      toast.error('No se pudieron cargar los lotes');
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchBatches, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateBatch = async () => {
    if (!newBatchTitle.trim()) {
      toast.warning('Ingresa un título para el lote');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await apiFetch('/api/operation-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: newBatchTitle.trim() })
      });
      if (res.ok) {
        const batch = await res.json();
        toast.success('Lote creado');
        navigate(`/operations/${batch.id}`);
      } else {
        toast.error('No fue posible crear el lote');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error de red');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const labels = {
      DRAFT: ['gray', 'Borrador'],
      PENDING_MANAGER: ['yellow', 'Pendiente de gerencia'],
      APPROVED_MANAGER: ['green', 'Aprobado por gerencia'],
      RETURNED: ['orange', 'En corrección'],
      PROCESSED_PAYROLL: ['blue', 'En nómina']
    };
    const [colorScheme, label] = labels[status] || ['gray', status || 'Sin estado'];
    return <Badge colorScheme={colorScheme} borderRadius="full" px={2.5} py={0.5}>{label}</Badge>;
  };

  const sortedBatches = useMemo(() => (
    [...batches].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  ), [batches]);

  const filteredBatches = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es');
    return sortedBatches.filter((batch) => {
      const matchesStatus = statusFilter === 'ALL' || batch.status === statusFilter;
      if (!matchesStatus) return false;
      if (!normalizedSearch) return true;
      const searchable = [batch.title, batch.user?.name, batch.status, batch.purpose]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es');
      return searchable.includes(normalizedSearch);
    });
  }, [searchTerm, sortedBatches, statusFilter]);

  const metrics = useMemo(() => ({
    total: batches.length,
    pending: batches.filter((batch) => batch.status === 'PENDING_MANAGER').length,
    inProgress: batches.filter((batch) => ['DRAFT', 'RETURNED'].includes(batch.status)).length,
    approved: batches.filter((batch) => ['APPROVED_MANAGER', 'PROCESSED_PAYROLL'].includes(batch.status)).length
  }), [batches]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
  };

  const canCreateBatch = ['ADMIN', 'SOLICITANTE'].includes(user?.role);
  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'ALL');

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        mb={6}
        gap={4}
      >
        <Box>
          <HStack color="brand.500" spacing={2} mb={1}>
            <ClipboardList size={20} />
            <Text fontSize="xs" fontWeight={800} letterSpacing="widest" textTransform="uppercase">Operaciones</Text>
          </HStack>
          <Heading size="lg" fontWeight={800} color={titleText}>Reporte operativo</Heading>
          <Text color={mutedText} mt={1}>Administra y da seguimiento a los lotes de bonos y horas extra.</Text>
        </Box>
        <HStack alignSelf={{ base: 'stretch', md: 'auto' }} spacing={2} flexWrap="wrap">
          <Button variant="outline" onClick={() => navigate('/operations/bonuses-history')} flex={{ base: 1, md: 'initial' }}>
            Ver historial
          </Button>
          {canCreateBatch && (
            <Button colorScheme="brand" leftIcon={<Plus size={17} />} onClick={onOpen} flex={{ base: 1, md: 'initial' }}>
              Nuevo lote
            </Button>
          )}
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={3} mb={5}>
        {[
          ['Lotes totales', metrics.total, 'gray'],
          ['Pendientes de revisión', metrics.pending, 'yellow'],
          ['En gestión', metrics.inProgress, 'orange'],
          ['Aprobados / en nómina', metrics.approved, 'green']
        ].map(([label, value, scheme]) => (
          <Box key={label} bg={scheme === 'gray' ? bg : cardAccentBg} borderWidth="1px" borderColor={borderColor} borderRadius="xl" p={4}>
            <Text color={mutedText} fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="wide">{label}</Text>
            <Text fontSize="2xl" fontWeight={800} mt={1} color={scheme === 'yellow' ? 'yellow.500' : scheme === 'orange' ? 'orange.400' : scheme === 'green' ? 'green.400' : titleText}>{value}</Text>
          </Box>
        ))}
      </SimpleGrid>

      <Box bg={bg} borderWidth="1px" borderColor={borderColor} borderRadius="xl" shadow="sm" overflow="hidden">
        <Flex
          p={{ base: 4, md: 5 }}
          gap={3}
          justify="space-between"
          align={{ base: 'stretch', lg: 'end' }}
          direction={{ base: 'column', lg: 'row' }}
          bg={softBg}
          borderBottomWidth="1px"
          borderColor={borderColor}
        >
          <Box>
            <Heading size="sm" fontWeight={800}>Lotes disponibles</Heading>
            <Text fontSize="sm" color={mutedText} mt={1}>{filteredBatches.length} de {batches.length} lotes visibles</Text>
          </Box>
          <HStack spacing={2} align="end" flexWrap="wrap">
            <FormControl minW={{ base: '100%', sm: '260px' }}>
              <FormLabel fontSize="xs" mb={1} color={mutedText}>Buscar</FormLabel>
              <InputGroup size="sm">
                <InputLeftElement pointerEvents="none"><Search size={15} /></InputLeftElement>
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Lote o responsable" bg={bg} />
              </InputGroup>
            </FormControl>
            <FormControl w={{ base: '100%', sm: '215px' }}>
              <FormLabel fontSize="xs" mb={1} color={mutedText}>Estado</FormLabel>
              <Select size="sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} bg={bg}>
                <option value="ALL">Todos los estados</option>
                <option value="DRAFT">Borrador</option>
                <option value="PENDING_MANAGER">Pendiente de gerencia</option>
                <option value="APPROVED_MANAGER">Aprobado por gerencia</option>
                <option value="RETURNED">En corrección</option>
                <option value="PROCESSED_PAYROLL">En nómina</option>
              </Select>
            </FormControl>
            {hasActiveFilters && (
              <Tooltip label="Quitar filtros">
                <IconButton aria-label="Quitar filtros" size="sm" variant="ghost" icon={<X size={17} />} onClick={clearFilters} />
              </Tooltip>
            )}
          </HStack>
        </Flex>

        <Box display={{ base: 'none', md: 'block' }} overflowX="auto">
          <Table variant="modern" minW="760px">
            <Thead>
              <Tr>
                <Th>Lote</Th>
                <Th>Creado por</Th>
                <Th>Registros</Th>
                <Th>Estado</Th>
                <Th>Creación</Th>
                <Th textAlign="right">Acción</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredBatches.map((batch) => (
                <Tr key={batch.id}>
                  <Td>
                    <HStack spacing={2} align="start">
                      <Box w="9px" h="9px" mt={1.5} borderRadius="full" bg={batch.status === 'PENDING_MANAGER' ? 'yellow.400' : batch.status === 'RETURNED' ? 'orange.400' : batch.status === 'DRAFT' ? 'gray.400' : 'green.400'} />
                      <Box>
                        <Text fontWeight={750}>{batch.title || 'Lote sin título'}</Text>
                        {batch.purpose === 'BONOS_2DA' && <Badge mt={1} colorScheme="purple" fontSize="0.65rem">Operaciones 2ª quincena</Badge>}
                      </Box>
                    </HStack>
                  </Td>
                  <Td>{batch.user?.name || 'Sin asignar'}</Td>
                  <Td><Badge colorScheme="blue" variant="subtle" borderRadius="full">{batch.logsCount ?? batch.logs?.length ?? 0} registros</Badge></Td>
                  <Td>{getStatusBadge(batch.status)}</Td>
                  <Td whiteSpace="nowrap" color={mutedText}>{formatDateTime(batch.createdAt)}</Td>
                  <Td textAlign="right">
                    <Button size="sm" variant="outline" rightIcon={<Eye size={15} />} onClick={() => navigate(`/operations/${batch.id}`)}>Abrir</Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        <VStack display={{ base: 'flex', md: 'none' }} align="stretch" spacing={0} divider={<Box borderBottomWidth="1px" borderColor={borderColor} />}>
          {filteredBatches.map((batch) => (
            <Box key={batch.id} p={4}>
              <Flex justify="space-between" gap={3} align="start">
                <Box minW={0}>
                  <Text fontWeight={800} noOfLines={2}>{batch.title || 'Lote sin título'}</Text>
                  <Text fontSize="xs" color={mutedText} mt={1}>{batch.user?.name || 'Sin asignar'} · {formatDateTime(batch.createdAt)}</Text>
                </Box>
                {getStatusBadge(batch.status)}
              </Flex>
              <Flex justify="space-between" align="center" mt={3}>
                <Badge colorScheme="blue" variant="subtle">{batch.logsCount ?? batch.logs?.length ?? 0} registros</Badge>
                <Button size="sm" variant="outline" rightIcon={<Eye size={15} />} onClick={() => navigate(`/operations/${batch.id}`)}>Abrir</Button>
              </Flex>
            </Box>
          ))}
        </VStack>

        {filteredBatches.length === 0 && (
          <VStack py={12} px={4} spacing={3} color={mutedText}>
            <ClipboardList size={38} opacity={0.35} />
            <Text fontWeight={700}>{batches.length ? 'No hay lotes con estos filtros' : 'Aún no hay lotes creados'}</Text>
            {hasActiveFilters && <Button size="sm" variant="ghost" onClick={clearFilters}>Limpiar filtros</Button>}
          </VStack>
        )}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Crear nuevo lote</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color={mutedText} mb={4}>Usa una referencia clara para que el lote sea fácil de localizar después.</Text>
            <FormControl isRequired>
              <FormLabel>Título o referencia</FormLabel>
              <Input
                placeholder="Ej. Bonos Producción · Semana 1"
                value={newBatchTitle}
                onChange={(event) => setNewBatchTitle(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleCreateBatch()}
                autoFocus
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={loading}>Cancelar</Button>
            <Button colorScheme="brand" onClick={handleCreateBatch} isLoading={loading}>Crear lote</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
