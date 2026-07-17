import React, { useState, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import { Search } from 'lucide-react';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import {
  Box,
  Flex,
  Heading,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  useColorModeValue,
  Skeleton,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';

export function Dimension5Panel() {
  const { dimension5s, isLoading } = useContext(DataContext);
  const { user } = useContext(AuthContext);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDimension5s = (dimension5s || []).filter(d => 
    d.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(d.id).includes(searchQuery)
  );

  const pagination = usePagination(filteredDimension5s, 10);

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
  const inputBgColor = useColorModeValue('white', 'gray.800');

  if (isLoading) {
    return (
      <Box>
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Skeleton h="28px" w="240px" mb={2} />
            <Skeleton h="14px" w="260px" />
          </Box>
        </Flex>
        <Box border="1px solid" borderColor={tableBorderColor} borderRadius="xl" overflow="hidden">
          <Table variant="modern" minW="650px">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Nombre Dimensión 5</Th>
                <Th>ID Estado</Th>
              </Tr>
            </Thead>
            <Tbody>
              {[1,2,3,4,5,6].map(i => (
                <Tr key={i}>
                  <Td><Skeleton h="14px" w="40px" /></Td>
                  <Td><Skeleton h="14px" w="140px" /></Td>
                  <Td><Skeleton h="14px" w="60px" /></Td>
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
          <Text fontSize="sm" color={subtitleColor}>Dimensión 5 · catálogo SAP</Text>
          <Badge bg={badgeBg} color={badgeColor} fontSize="xs" fontWeight={600} px={2} py={0.5} borderRadius="full">
            {(dimension5s || []).length} registros
          </Badge>
        </Flex>
        <InputGroup size="sm" w={{ base: '100%', sm: '250px' }}>
          <InputLeftElement pointerEvents="none">
            <Search size={14} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Buscar dimensión..."
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
                <Th>Nombre Dimensión 5</Th>
                <Th>ID Estado</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pagination.paginatedData.map((d, i) => (
                <Tr key={d.id || i} transition="all 0.2s">
                  <Td>
                    <Text
                      fontSize="sm"
                      fontFamily="mono"
                      color={idColor}
                    >
                      {d.id || 'S/N'}
                    </Text>
                  </Td>
                  <Td>
                    <Flex align="center" gap={2}>
                      <Text
                        fontSize="sm"
                        fontWeight={500}
                        color={nameColor}
                      >
                        {d.nombre || 'Sin Nombre'}
                      </Text>
                      
                    </Flex>
                  </Td>
                  <Td>
                    <Text
                      fontSize="sm"
                      color={estadoColor}
                    >
                      {d.id_estado}
                    </Text>
                  </Td>
                </Tr>
              ))}
              {(!dimension5s || dimension5s.length === 0) && (
                <Tr>
                  <Td colSpan={3} textAlign="center" py={12}>
                    <Text fontSize="sm" color={emptyTextColor}>
                      No hay registros de Dimensión 5 en el sistema.
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </Box>
        <Pagination {...pagination} />
      </Box>
    </>
  );
}

export default Dimension5Panel;
