import React, { useState, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { AppContext } from '../context/AppContext';
import { AuthContext } from '../context/AuthContext';
import { Plus, Edit2, Trash2, Eye, Search } from 'lucide-react';
import SubdivisionFormModal from '../components/SubdivisionFormModal';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
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
  useColorModeValue,
  Skeleton,
  SkeletonText,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';

export function SubdivisionsPanel() {
  const { subdivisions, isSapConnected, addSubdivision, updateSubdivision, deleteSubdivision, isLoading } = useContext(DataContext);
  const { confirmAction } = useContext(AppContext);
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'AUDITOR';
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSubdivisions = subdivisions.filter(sd => 
    sd.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(sd.id).includes(searchQuery)
  );

  const pagination = usePagination(filteredSubdivisions, 10);

  // Color mode values
  const tableBorderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const tableContainerBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const subtitleColor = useColorModeValue('gray.600', 'gray.400');
  const idColor = useColorModeValue('gray.500', 'gray.400');
  const nameColor = useColorModeValue('gray.800', 'white');
  const estadoColor = useColorModeValue('gray.500', 'gray.400');
  const emptyTextColor = useColorModeValue('gray.500', 'gray.500');
  const badgeBg = useColorModeValue('brand.50', 'brand.900');
  const badgeColor = useColorModeValue('brand.700', 'brand.200');
  const viewHoverBg = useColorModeValue('brand.50', 'whiteAlpha.100');
  const editHoverBg = useColorModeValue('accent.50', 'whiteAlpha.100');
  const deleteHoverBg = useColorModeValue('red.50', 'whiteAlpha.100');
  const viewIconColor = useColorModeValue('brand.500', 'brand.300');
  const editIconColor = useColorModeValue('accent.600', 'accent.300');
  const deleteIconColor = useColorModeValue('red.500', 'red.300');
  const inputBgColor = useColorModeValue('white', 'gray.800');

  const openAdd = () => {
    setEditingId(null);
    setEditingData(null);
    setShowModal(true);
  };

  const openEdit = (sd) => {
    setEditingId(sd.id);
    setEditingData(sd);
    setShowModal(true);
  };

  const handleSave = (formData) => {
    if (editingId) {
      updateSubdivision(editingId, formData);
    } else {
      addSubdivision(formData);
    }
    setShowModal(false);
  };

  if (isLoading) {
    return (
      <Box>
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Skeleton h="28px" w="240px" mb={2} />
            <Skeleton h="14px" w="260px" />
          </Box>
          <Skeleton h="40px" w="170px" borderRadius="lg" />
        </Flex>
        <Box border="1px solid" borderColor={tableBorderColor} borderRadius="xl" overflow="hidden">
          <Table variant="modern" minW="650px">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Nombre Subdivisión</Th>
                <Th>ID Estado</Th>
                <Th textAlign="right">Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {[1,2,3,4,5,6].map(i => (
                <Tr key={i}>
                  <Td><Skeleton h="14px" w="40px" /></Td>
                  <Td><Skeleton h="14px" w="140px" /></Td>
                  <Td><Skeleton h="14px" w="60px" /></Td>
                  <Td textAlign="right"><Skeleton h="14px" w="80px" ml="auto" /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={3}>
        <Flex align="center" gap={2} flexWrap="wrap">
          <Text fontSize="sm" color={subtitleColor}>Dimensión 4 · subdivisiones</Text>
          <Badge bg={badgeBg} color={badgeColor} fontSize="xs" fontWeight={600} px={2} py={0.5} borderRadius="full">
            {subdivisions.length} registros
          </Badge>
        </Flex>
        <InputGroup size="sm" w={{ base: '100%', sm: '250px' }}>
          <InputLeftElement pointerEvents="none">
            <Search size={14} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Buscar subdivisión..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            bg={inputBgColor}
            borderRadius="lg"
          />
        </InputGroup>
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
        _hover={{
          boxShadow: 'md',
        }}
      >
        <Box overflowX="auto">
          <Table variant="modern" minW="650px">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Nombre Subdivisión</Th>
                <Th>ID Estado</Th>
                <Th textAlign="right">Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pagination.paginatedData.map((sd, i) => (
                <Tr key={sd.id || i} transition="all 0.2s">
                  <Td>
                    <Text
                      fontSize="sm"
                      fontFamily="mono"
                      color={idColor}
                    >
                      {sd.id || 'S/N'}
                    </Text>
                  </Td>
                  <Td>
                    <Flex align="center" gap={2}>
                      <Text
                        fontSize="sm"
                        fontWeight={500}
                        color={nameColor}
                      >
                        {sd.nombre || 'Sin Nombre'}
                      </Text>
                    </Flex>
                  </Td>
                  <Td>
                    <Text
                      fontSize="sm"
                      color={estadoColor}
                    >
                      {sd.id_estado}
                    </Text>
                  </Td>
                  <Td textAlign="right">
                    <Flex justify="flex-end" gap={1}>
                      <Tooltip label="Ver detalles" hasArrow>
                        <IconButton
                          aria-label="Ver subdivisión"
                          icon={<Eye size={16} />}
                          size="sm"
                          variant="ghost"
                          color={viewIconColor}
                          borderRadius="lg"
                          transition="all 0.3s"
                          _hover={{
                            bg: viewHoverBg,
                          }}
                          onClick={() => openEdit(sd)}
                        />
                      </Tooltip>
                    </Flex>
                  </Td>
                </Tr>
              ))}
              {subdivisions.length === 0 && (
                <Tr>
                  <Td colSpan={4} textAlign="center" py={12}>
                    <Text fontSize="sm" color={emptyTextColor}>
                      No hay subdivisiones registradas en el sistema.
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Box>
        <Pagination {...pagination} />
      </Box>

      {/* Form Modal */}
      <SubdivisionFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        initialData={editingData}
      />
    </>
  );
}

export default SubdivisionsPanel;
