import React, { useState, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { AppContext } from '../App';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import CompanyFormModal from '../components/CompanyFormModal';
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
} from '@chakra-ui/react';

export default function Companies() {
  const { companies, addCompany, updateCompany, deleteCompany, isLoading } = useContext(DataContext);
  const { confirmAction } = useContext(AppContext);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);

  const pagination = usePagination(companies, 10);

  // Color mode values
  const tableBorderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const tableContainerBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const subtitleColor = useColorModeValue('gray.600', 'gray.400');
  const nitColor = useColorModeValue('gray.500', 'gray.400');
  const nameColor = useColorModeValue('gray.800', 'white');
  const razonColor = useColorModeValue('gray.500', 'gray.400');
  const emptyTextColor = useColorModeValue('gray.500', 'gray.500');
  const badgeBg = useColorModeValue('brand.50', 'brand.900');
  const badgeColor = useColorModeValue('brand.700', 'brand.200');
  const viewHoverBg = useColorModeValue('brand.50', 'whiteAlpha.100');
  const editHoverBg = useColorModeValue('accent.50', 'whiteAlpha.100');
  const deleteHoverBg = useColorModeValue('red.50', 'whiteAlpha.100');
  const viewIconColor = useColorModeValue('brand.500', 'brand.300');
  const editIconColor = useColorModeValue('accent.600', 'accent.300');
  const deleteIconColor = useColorModeValue('red.500', 'red.300');
  const rowHoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  const openAdd = () => {
    setEditingId(null);
    setEditingData(null);
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setEditingData(c);
    setShowModal(true);
  };

  const handleSave = (formData) => {
    if (editingId) {
      updateCompany(editingId, formData);
    } else {
      addCompany(formData);
    }
    setShowModal(false);
  };

  if (isLoading) {
    return (
      <Box p={{ base: 4, md: 6, lg: 8 }}>
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Skeleton h="28px" w="220px" mb={2} />
            <Skeleton h="14px" w="300px" />
          </Box>
          <Skeleton h="40px" w="160px" borderRadius="lg" />
        </Flex>
        <Box border="1px solid" borderColor={tableBorderColor} borderRadius="xl" overflow="hidden">
          <Table variant="modern" minW="650px">
            <Thead>
              <Tr>
                <Th>NIT</Th>
                <Th>Nombre Comercial</Th>
                <Th>Razón Social</Th>
                <Th textAlign="right">Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {[1,2,3,4,5,6].map(i => (
                <Tr key={i}>
                  <Td><Skeleton h="14px" w="80px" /></Td>
                  <Td><Skeleton h="14px" w="140px" /></Td>
                  <Td><Skeleton h="14px" w="120px" /></Td>
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
          <Heading
            as="h1"
            size={{ base: 'md', lg: 'lg' }}
            fontWeight={800}
            mb={1}
            letterSpacing="-0.02em"
          >
            Directorio de Empresas
          </Heading>
          <Flex align="center" gap={2}>
            <Text fontSize="sm" color={subtitleColor}>
              Gestión de empresas y centros de costo
            </Text>
            <Badge
              bg={badgeBg}
              color={badgeColor}
              fontSize="xs"
              fontWeight={600}
              px={2}
              py={0.5}
              borderRadius="full"
            >
              {companies.length} registros
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
          _hover={{
            boxShadow: 'lg',
          }}
        >
          Nueva Empresa
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
        _hover={{
          boxShadow: 'md',
        }}
      >
        <Box overflowX="auto">
          <Table variant="modern" minW="650px">
            <Thead>
              <Tr>
                <Th>NIT</Th>
                <Th>Nombre Comercial</Th>
                <Th>Razón Social</Th>
                <Th textAlign="right">Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {companies.length === 0 ? (
                <Tr>
                  <Td colSpan={5} textAlign="center" py={10} color={useColorModeValue('gray.500', 'gray.400')}>
                    No hay empresas registradas.
                  </Td>
                </Tr>
              ) : (
                pagination.paginatedData.map((c, i) => (
                  <Tr key={c.id || i} _hover={{ bg: rowHoverBg }} transition="all 0.2s">
                    <Td>
                      <Text
                        fontSize="sm"
                        fontFamily="mono"
                        color={nitColor}
                      >
                        {c.nit || 'S/N'}
                      </Text>
                    </Td>
                    <Td>
                      <Text
                        fontSize="sm"
                        fontWeight={500}
                        color={nameColor}
                      >
                        {c.nombre_comercial || 'Sin Nombre'}
                      </Text>
                    </Td>
                    <Td>
                      <Text
                        fontSize="sm"
                        color={razonColor}
                      >
                        {c.razon_social || '-'}
                      </Text>
                    </Td>
                    <Td textAlign="right">
                      <Flex justify="flex-end" gap={1}>
                        <Tooltip label="Ver detalles" hasArrow>
                          <IconButton
                            aria-label="Ver empresa"
                            icon={<Eye size={16} />}
                            size="sm"
                            variant="ghost"
                            color={viewIconColor}
                            borderRadius="lg"
                            transition="all 0.3s"
                            _hover={{
                              bg: viewHoverBg,
                            }}
                            onClick={() => openEdit(c)}
                          />
                        </Tooltip>
                        <Tooltip label="Editar" hasArrow>
                          <IconButton
                            aria-label="Editar empresa"
                            icon={<Edit2 size={16} />}
                            size="sm"
                            variant="ghost"
                            color={editIconColor}
                            borderRadius="lg"
                            transition="all 0.3s"
                            _hover={{
                              bg: editHoverBg,
                            }}
                            onClick={() => openEdit(c)}
                          />
                        </Tooltip>
                        <Tooltip label="Eliminar" hasArrow>
                          <IconButton
                            aria-label="Eliminar empresa"
                            icon={<Trash2 size={16} />}
                            size="sm"
                            variant="ghost"
                            color={deleteIconColor}
                            borderRadius="lg"
                            transition="all 0.3s"
                            _hover={{
                              bg: deleteHoverBg,
                            }}
                            onClick={() => {
                              confirmAction(`¿Seguro que desea eliminar la empresa ${c.nombre_comercial || c.nit}?`, () => {
                                deleteCompany(c.id);
                              });
                            }}
                          />
                        </Tooltip>
                      </Flex>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
        {companies.length > 0 && (
          <Box p={4} borderTop="1px solid" borderColor={tableBorderColor}>
            <Pagination {...pagination} />
          </Box>
        )}
      </Box>

      {/* Company Form Modal */}
      <CompanyFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        initialData={editingData}
      />
    </Box>
  );
}
