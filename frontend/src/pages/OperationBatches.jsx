import React, { useState, useEffect, useContext } from 'react';
import { Box, Button, Flex, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, Badge, IconButton, useColorModeValue, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input, FormControl, FormLabel, useDisclosure, HStack } from '@chakra-ui/react';
import { Plus, Eye, Trash2, CheckCircle2, XCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { DataContext } from '../context/DataContext';
import { toast } from 'sonner';

export default function OperationBatches() {
  const { user } = useContext(AuthContext);
  const {
    operationLogs,
    revertLogFromActiveDrafts,
    flushPendingDraftSaves
  } = useContext(DataContext);
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [batches, setBatches] = useState([]);
  const [newBatchTitle, setNewBatchTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const bg = useColorModeValue('white', 'gray.800');
  const theadBg = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  const fetchBatches = async () => {
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await fetch('http://localhost:3000/api/operation-batches', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBatches(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreateBatch = async () => {
    if (!newBatchTitle.trim()) {
      toast.warning('Ingrese un título');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('nomina-token');
      const res = await fetch('http://localhost:3000/api/operation-batches', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ title: newBatchTitle })
      });
      if (res.ok) {
        const batch = await res.json();
        toast.success('Lote creado');
        navigate(`/operations/${batch.id}`);
      } else {
        toast.error('Error al crear lote');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error de red');
    }
    setLoading(false);
    onClose();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT': return <Badge colorScheme="gray">Borrador</Badge>;
      case 'PENDING_MANAGER': return <Badge colorScheme="yellow">Pdte. Gerente</Badge>;
      case 'APPROVED_MANAGER': return <Badge colorScheme="green">Aprobado</Badge>;
      case 'RETURNED': return <Badge colorScheme="red">Devuelto</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const canCreateBatch = ['ADMIN', 'GERENTE GENERAL', 'SOLICITANTE', 'NOMINA', 'GERENTE'].includes(user?.role);
  const isNominaRole = ['ADMIN', 'NOMINA', 'AUDITOR'].includes(user?.role);

  const handleRejectToManager = async (batchId) => {
    const note = prompt('Justificación del rechazo al gerente:');
    if (!note) return;
    try {
      await flushPendingDraftSaves();
      const token = localStorage.getItem('nomina-token');
      const res = await fetch(`http://localhost:3000/api/operation-batches/${batchId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'PENDING_MANAGER', justification: note, rejectionFromNomina: true })
      });
      if (res.ok) {
        const detailRes = await fetch(`http://localhost:3000/api/operation-batches/${batchId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          (detail.logs || []).forEach((log) => revertLogFromActiveDrafts(log));
        } else {
          (operationLogs || [])
            .filter((l) => String(l.batchId) === String(batchId))
            .forEach((log) => revertLogFromActiveDrafts(log));
        }
        toast.success('Lote devuelto al gerente');
        fetchBatches();
      } else {
        toast.error('Error al rechazar');
      }
    } catch (err) {
      toast.error('Error de red');
    }
  };

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={3}>
        <Box>
          <Heading size="lg" fontWeight={800}>Lotes de Operaciones</Heading>
          <Text color="gray.500">Agrupación de bonos y horas extras</Text>
        </Box>
        <HStack>
          <Button
            variant="outline"
            onClick={() => navigate('/operations/bonuses-history')}
            borderRadius="lg"
          >
            Historial de Bonos
          </Button>
          {canCreateBatch && (
            <Button 
              colorScheme="brand" 
              leftIcon={<Plus size={16} />} 
              onClick={onOpen}
              borderRadius="lg" 
              transition="all 0.3s"
              _hover={{ shadow: 'lg' }}
            >
              Nuevo Lote
            </Button>
          )}
        </HStack>
      </Flex>

      <Box bg={bg} borderRadius="xl" shadow="sm" overflow="hidden" border="1px solid" borderColor={borderColor}>
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>FECHA CREACIÓN</Th>
                <Th>TÍTULO DEL LOTE</Th>
                <Th>CREADO POR</Th>
                <Th>REGISTROS</Th>
                <Th>ESTADO</Th>
                <Th textAlign="center">ACCIONES</Th>
              </Tr>
            </Thead>
            <Tbody>
              {batches.length === 0 ? (
                <Tr>
                  <Td colSpan={6} textAlign="center" py={8} color="gray.500">No hay lotes creados</Td>
                </Tr>
              ) : (
                batches.map(batch => (
                  <Tr key={batch.id} _hover={{ bg: hoverBg }}>
                    <Td>{new Date(batch.createdAt).toLocaleString('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</Td>
                    <Td fontWeight="bold">
                      <HStack spacing={2}>
                        <Text as="span">{batch.title}</Text>
                        {batch.purpose === 'BONOS_2DA' && (
                          <Badge colorScheme="purple" fontSize="0.65rem">Bonos 2ª</Badge>
                        )}
                      </HStack>
                    </Td>
                    <Td>{batch.user?.name || 'Desconocido'}</Td>
                    <Td>{batch.logs?.length || 0}</Td>
                    <Td>{getStatusBadge(batch.status)}</Td>
                    <Td textAlign="center">
                      <HStack justify="center" spacing={1}>
                        <IconButton
                          aria-label="Ver Lote"
                          icon={<Eye size={18} />}
                          size="sm"
                          variant="ghost"
                          colorScheme="blue"
                          onClick={() => navigate(`/operations/${batch.id}`)}
                        />
                        {isNominaRole && batch.status === 'APPROVED_MANAGER' && (
                          <IconButton
                            aria-label="Rechazar a Gerente"
                            icon={<X size={18} />}
                            size="sm"
                            variant="ghost"
                            colorScheme="orange"
                            onClick={() => handleRejectToManager(batch.id)}
                          />
                        )}
                      </HStack>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Crear Nuevo Lote</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired>
              <FormLabel>Título o Referencia</FormLabel>
              <Input 
                placeholder="Ej. Bonos Producción - Semana 1" 
                value={newBatchTitle}
                onChange={(e) => setNewBatchTitle(e.target.value)}
                autoFocus
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
            <Button colorScheme="blue" onClick={handleCreateBatch} isLoading={loading}>Crear Lote</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
