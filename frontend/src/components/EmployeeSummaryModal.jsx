import React from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  Button, SimpleGrid, Box, Text, Flex, Divider, Badge, VStack, HStack, useColorModeValue
} from '@chakra-ui/react';
import { formatQ } from '../data/mockData';
import { getNetPayable } from '../utils/payrollPeriod';

export default function EmployeeSummaryModal({ isOpen, onClose, employee, companies, periodType }) {
  const bgBox = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');

  if (!employee) return null;

  const baseSalary = employee.calculated?.baseSalary || 0;
  const bonusLey = employee.calculated?.bonusLey || 0;
  const bonusDec = employee.calculated?.bonusDec || 0;
  const bonos = (employee.calculated?.bonos || 0) + (employee.calculated?.bonusesSum || 0);

  const devengado = employee.calculated?.gross || 0;

  const totalExtras = employee.calculated?.extrasTotal || 0;
  
  const simplesVal = Number(employee.extras?.simplesVal) || 0;
  const doblesVal = Number(employee.extras?.doblesVal) || 0;
  const otrosIngresos = (Number(employee.extras?.otrosIngresos) || 0)
    + (Number(employee.extras?.comisiones) || 0)
    + (Number(employee.extras?.vacacionesVal) || 0)
    + (Number(employee.extras?.ventasEconomicas) || 0);
  
  const deductions = employee.calculated?.proratedDeductions || employee.deductions || {};

  const salarioTotal = devengado;
  const totalEgresos = employee.calculated?.ded || 0;

  const liquido = getNetPayable(employee, periodType || '1ra');

  const anticipo = Number(employee.anticipo1ra) || 0;
  const q1 = periodType === '2da' ? anticipo : liquido;
  const q2 = periodType === '2da' ? liquido : 0;

  const companyName = companies?.find(c => c.id == employee.empresa_principal)?.nombre_comercial || employee.company || 'Sin Empresa';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(3px)" />
      <ModalContent borderRadius="xl">
        <ModalHeader borderBottom="1px solid" borderColor={borderColor}>
          Resumen Completo de Empleado
          <Text fontSize="sm" color="gray.500" fontWeight="normal" mt={1}>Detalle de la quincena en curso</Text>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody py={6}>
          {/* General Information */}
          <Box bg={bgBox} p={4} borderRadius="md" mb={6} border="1px solid" borderColor={borderColor}>
            <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
              <Box>
                <Text fontSize="xs" color="gray.500" fontWeight="bold">Nombre Completo</Text>
                <Text fontSize="sm" fontWeight="bold">
                  {[employee.primer_nombre, employee.segundo_nombre, employee.otro_nombre, employee.primer_apellido, employee.segundo_apellido, employee.apellido_casada].filter(Boolean).join(' ')}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.500" fontWeight="bold">Empresa</Text>
                <Text fontSize="sm" fontWeight="semibold" color="brand.600">{companyName}</Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.500" fontWeight="bold">Puesto</Text>
                <Text fontSize="sm">{employee.puesto || 'Sin Puesto'}</Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="gray.500" fontWeight="bold">Días Laborados</Text>
                <Badge colorScheme={employee.days < 30 ? 'orange' : 'green'}>
                  {employee.days ?? 30} días
                </Badge>
              </Box>
            </SimpleGrid>
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
            {/* INCOMES COLUMN */}
            <VStack align="stretch" spacing={4}>
              <Flex align="center" gap={2}>
                <Box w="3" h="3" borderRadius="full" bg="green.400" />
                <Text fontWeight="bold" fontSize="lg">Ingresos</Text>
              </Flex>
              
              <Box border="1px solid" borderColor={borderColor} borderRadius="md" p={4}>
                <VStack align="stretch" spacing={2} divider={<Divider />}>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Salario Ordinario Base</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(baseSalary)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Bono Incentivo</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(bonusLey)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Bono Dec 37-2001</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(bonusDec)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Bonos operativos y de catálogo</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(bonos)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Horas Extras Simples ({employee.extras?.simplesQty || 0})</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(simplesVal)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Horas Extras Nocturnas ({employee.extras?.doblesQty || 0})</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(doblesVal)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Otros Ingresos</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(otrosIngresos)}</Text>
                  </Flex>
                </VStack>
              </Box>

              <Flex justify="space-between" bg="green.50" _dark={{ bg: 'rgba(72, 187, 120, 0.1)' }} p={3} borderRadius="md">
                <Text fontWeight="bold" color="green.600" _dark={{ color: 'green.300' }}>TOTAL INGRESOS</Text>
                <Text fontWeight="bold" fontFamily="mono" color="green.600" _dark={{ color: 'green.300' }}>{formatQ(salarioTotal)}</Text>
              </Flex>
            </VStack>

            {/* DEDUCTIONS COLUMN */}
            <VStack align="stretch" spacing={4}>
              <Flex align="center" gap={2}>
                <Box w="3" h="3" borderRadius="full" bg="red.400" />
                <Text fontWeight="bold" fontSize="lg">Egresos / Descuentos</Text>
              </Flex>

              <Box border="1px solid" borderColor={borderColor} borderRadius="md" p={4}>
                <VStack align="stretch" spacing={2} divider={<Divider />}>
                  <Flex justify="space-between">
                    <Text fontSize="sm">IGSS</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(Number(deductions.igss) || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">ISR</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(Number(deductions.isr) || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Cafetería</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(Number(deductions.cafe) || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Celular</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(Number(deductions.cell) || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Uniforme</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(Number(deductions.uniform) || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Calzado</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(Number(deductions.shoes) || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Préstamos / Bancos</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(Number(deductions.bancos) || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Boleto de Ornato</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(Number(deductions.boleto_de_ornato) || 0)}</Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Otros Egresos</Text>
                    <Text fontSize="sm" fontFamily="mono">{formatQ(Number(deductions.otros_egresos) || 0)}</Text>
                  </Flex>
                  {/* Aggregating other minor deductions to not crowd the UI too much */}
                  <Flex justify="space-between">
                    <Text fontSize="sm">Otras Deducciones (Judiciales, Parqueo, Seguro, etc.)</Text>
                    <Text fontSize="sm" fontFamily="mono">
                      {formatQ((Number(deductions.equipo) || 0) + (Number(deductions.product) || 0) + (Number(deductions.otros) || 0) + (Number(deductions.judiciales) || 0) + (Number(deductions.seguro) || 0) + (Number(deductions.parqueo) || 0))}
                    </Text>
                  </Flex>
                </VStack>
              </Box>

              <Flex justify="space-between" bg="red.50" _dark={{ bg: 'rgba(245, 101, 101, 0.1)' }} p={3} borderRadius="md">
                <Text fontWeight="bold" color="red.600" _dark={{ color: 'red.300' }}>TOTAL EGRESOS</Text>
                <Text fontWeight="bold" fontFamily="mono" color="red.600" _dark={{ color: 'red.300' }}>{formatQ(totalEgresos)}</Text>
              </Flex>
            </VStack>
          </SimpleGrid>

          {/* FINAL SUMMARY */}
          <Box mt={8} bg="brand.500" p={6} borderRadius="xl" color="white" boxShadow="md">
            <Flex justify="space-between" align="center" direction={{ base: 'column', md: 'row' }} gap={4}>
              <Box>
                <Text fontSize="sm" opacity={0.8} textTransform="uppercase" letterSpacing="wider">Líquido a Recibir</Text>
                <Text fontSize="3xl" fontWeight="black" fontFamily="mono">{formatQ(liquido)}</Text>
              </Box>
              
              {periodType === '2da' && (
                <HStack spacing={8}>
                  <Box textAlign={{ base: 'left', md: 'right' }}>
                    <Text fontSize="xs" opacity={0.8}>Anticipo 1ra Quincena</Text>
                    <Text fontSize="lg" fontWeight="bold" fontFamily="mono">{formatQ(q1)}</Text>
                  </Box>
                  <Box textAlign={{ base: 'left', md: 'right' }}>
                    <Text fontSize="xs" opacity={0.8}>Pago 2da Quincena</Text>
                    <Text fontSize="lg" fontWeight="bold" fontFamily="mono">{formatQ(q2)}</Text>
                  </Box>
                </HStack>
              )}
            </Flex>
          </Box>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="brand" onClick={onClose}>Cerrar Resumen</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
