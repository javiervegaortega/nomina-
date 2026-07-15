import React, { useState, useEffect, useContext } from 'react';
import { Box, Button, Flex, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, Badge, IconButton, useColorModeValue, useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input, FormControl, FormLabel, useDisclosure } from '@chakra-ui/react';
import { Plus, Eye, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function OperationBatches() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();
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
      toast({ title: 'Ingrese un título', status: 'warning', duration: 3000 });
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
        toast({ title: 'Lote creado', status: 'success', duration: 3000 });
        navigate(`/operations/${batch.id}`);
      } else {
        toast({ title: 'Error al crear lote', status: 'error', duration: 3000 });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error de red', status: 'error', duration: 3000 });
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

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg" fontWeight={800}>Lotes de Operaciones</Heading>
          <Text color="gray.500">Agrupación de bonos y horas extras</Text>
        </Box>
        {canCreateBatch && (
          <Button leftIcon={<Plus size={20} />} colorScheme="blue" onClick={onOpen}>
            Nuevo Lote
          </Button>
        )}
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
                    <Td>{new Date(batch.createdAt).toLocaleDateString()}</Td>
                    <Td fontWeight="bold">{batch.title}</Td>
                    <Td>{batch.user?.name || 'Desconocido'}</Td>
                    <Td>{batch.logs?.length || 0}</Td>
                    <Td>{getStatusBadge(batch.status)}</Td>
                    <Td textAlign="center">
                      <IconButton
                        aria-label="Ver Lote"
                        icon={<Eye size={18} />}
                        size="sm"
                        variant="ghost"
                        colorScheme="blue"
                        onClick={() => navigate(`/operations/${batch.id}`)}
                      />
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
