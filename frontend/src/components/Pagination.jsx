import React from 'react';
import { Flex, Button, Text, Select, useColorModeValue } from '@chakra-ui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  limit,
  goToNextPage,
  goToPreviousPage,
  changeLimit
}) {
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const bgSelect = useColorModeValue('white', 'gray.800');

  return (
    <Flex 
      justify="space-between" 
      align={{ base: 'flex-start', md: 'center' }} 
      direction={{ base: 'column', md: 'row' }}
      wrap="wrap" 
      gap={4} 
      p={4} 
      borderTop="1px solid" 
      borderColor={borderColor}
    >
      <Flex align="center" gap={3} flexWrap="wrap">
        <Text fontSize="sm" color={textColor}>
          Mostrando {totalItems === 0 ? 0 : (currentPage - 1) * limit + 1} a {Math.min(currentPage * limit, totalItems)} de {totalItems} registros
        </Text>
        <Select 
          size="sm" 
          width="auto" 
          value={limit} 
          onChange={(e) => changeLimit(Number(e.target.value))}
          borderRadius="md"
          bg={bgSelect}
        >
          <option value={5}>5 por página</option>
          <option value={10}>10 por página</option>
          <option value={25}>25 por página</option>
          <option value={50}>50 por página</option>
        </Select>
      </Flex>

      <Flex align="center" gap={2}>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={goToPreviousPage} 
          isDisabled={currentPage === 1 || totalItems === 0}
          leftIcon={<ChevronLeft size={16} />}
        >
          Anterior
        </Button>
        <Text fontSize="sm" fontWeight="medium" px={2} color={textColor}>
          Página {currentPage} de {totalPages}
        </Text>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={goToNextPage} 
          isDisabled={currentPage === totalPages || totalItems === 0}
          rightIcon={<ChevronRight size={16} />}
        >
          Siguiente
        </Button>
      </Flex>
    </Flex>
  );
}
