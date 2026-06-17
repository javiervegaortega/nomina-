import React, { useState, useRef, useMemo } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton,
  Button, Select, Flex, Box, Text, Table, Thead, Tbody, Tr, Th, Td, Badge, Icon, HStack, VStack, Avatar, useColorModeValue
} from '@chakra-ui/react';
import { Printer, Cake, CalendarDays, Gift } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const MESES = [
  { val: 1, label: 'Enero' }, { val: 2, label: 'Febrero' }, { val: 3, label: 'Marzo' },
  { val: 4, label: 'Abril' }, { val: 5, label: 'Mayo' }, { val: 6, label: 'Junio' },
  { val: 7, label: 'Julio' }, { val: 8, label: 'Agosto' }, { val: 9, label: 'Septiembre' },
  { val: 10, label: 'Octubre' }, { val: 11, label: 'Noviembre' }, { val: 12, label: 'Diciembre' }
];

const CumpleanerosModal = ({ isOpen, onClose, employees = [], areas = [] }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef(null);

  // Colores adaptables para el modo claro/oscuro
  const bgModal = useColorModeValue('white', 'gray.800');
  const bgBody = useColorModeValue('gray.50', 'gray.900');
  const bgCard = useColorModeValue('white', 'gray.800');
  const bgHeader = useColorModeValue('purple.50', 'gray.800');
  const bgThead = useColorModeValue('gray.100', 'gray.700');
  const rowHoverBg = useColorModeValue('purple.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const borderTableColor = useColorModeValue('gray.300', 'gray.600');
  
  const textTitle = useColorModeValue('gray.800', 'white');
  const textPrimary = useColorModeValue('gray.700', 'gray.200');
  const textSecondary = useColorModeValue('gray.600', 'gray.400');
  const textMuted = useColorModeValue('gray.500', 'gray.500');

  // Calcular cumpleañeros
  const birthdays = useMemo(() => {
    return employees
      .filter(emp => emp.estado === 'Activo' && emp.fecha_nacimiento)
      .map(emp => {
        const dateParts = emp.fecha_nacimiento.split('-');
        if (dateParts.length !== 3) return null;
        
        const bMonth = parseInt(dateParts[1], 10);
        const bDay = parseInt(dateParts[2].split('T')[0], 10);

        if (bMonth !== selectedMonth) return null;

        const bDateThisYear = new Date(selectedYear, selectedMonth - 1, bDay);
        const dayOfWeek = bDateThisYear.getDay();

        let restDay = bDay;
        if (dayOfWeek === 6) restDay = bDay - 1;
        else if (dayOfWeek === 0) restDay = bDay + 1;

        const area = areas.find(a => String(a.id) === String(emp.areaId)) || { nombre: 'Sin Área', codigo: '000' };

        return {
          id: emp.id,
          nombre: `${emp.primer_nombre} ${emp.primer_apellido}`,
          nombreCompleto: `${emp.primer_nombre || ''} ${emp.segundo_nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim(),
          area: `${area.codigo || ''} - ${area.nombre || ''}`,
          bDay,
          restDay,
          dayOfWeek,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.bDay - b.bDay);
  }, [employees, selectedMonth, selectedYear, areas]);

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      // Configuramos el color de fondo en la captura para que el PDF siempre salga en blanco independientemente del modo oscuro
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'letter');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pdfW) / canvas.width;

      if (imgH <= pdfH) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, imgH);
      } else {
        let position = 0;
        let leftHeight = imgH;
        while (leftHeight > 0) {
          pdf.addImage(imgData, 'PNG', 0, position, pdfW, imgH);
          leftHeight -= pdfH;
          position -= pdfH;
          if (leftHeight > 0) pdf.addPage();
        }
      }
      const monthName = MESES.find(m => m.val === selectedMonth)?.label;
      pdf.save(`Cumpleaneros_${monthName}_${selectedYear}.pdf`);
    } catch (error) {
    } finally {
      setIsExporting(false);
    }
  };

  const monthLabel = MESES.find(m => m.val === selectedMonth)?.label;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent bg={bgModal} borderColor={borderColor} borderWidth={useColorModeValue(0, '1px')}>
        <ModalHeader borderBottomWidth="1px" borderColor={borderColor} bg={bgHeader} borderTopRadius="md">
          <HStack spacing={3}>
            <Box p={2} bg="purple.500" borderRadius="md" color="white">
              <Icon as={Cake} boxSize={5} />
            </Box>
            <VStack align="start" spacing={0}>
              <Text fontSize="xl" fontWeight="bold" color={useColorModeValue('purple.800', 'purple.300')}>Cumpleañeros del Mes</Text>
              <Text fontSize="sm" color={useColorModeValue('purple.600', 'purple.400')} fontWeight="normal">Descubre y celebra a tu equipo</Text>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton mt={3} />
        
        <ModalBody p={6} bg={bgBody}>
          <Flex gap={4} mb={6} bg={bgCard} p={4} borderRadius="lg" shadow="sm" align="center" borderWidth="1px" borderColor={borderColor}>
            <Icon as={CalendarDays} color={textMuted} />
            <Box>
              <Text fontSize="xs" fontWeight="bold" color={textMuted} mb={1} textTransform="uppercase">Mes</Text>
              <Select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} size="sm" w="150px" borderRadius="md" bg={bgCard}>
                {MESES.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </Select>
            </Box>
            <Box>
              <Text fontSize="xs" fontWeight="bold" color={textMuted} mb={1} textTransform="uppercase">Año</Text>
              <Select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} size="sm" w="100px" borderRadius="md" bg={bgCard}>
                {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </Select>
            </Box>
          </Flex>

          <Box bg={bgCard} p={6} borderRadius="xl" shadow="sm" overflowX="auto" minH="400px" borderWidth="1px" borderColor={borderColor}>
            <Box ref={printRef} p={8} bg={bgCard}>
              <Flex justify="space-between" align="center" mb={8} borderBottom="2px solid" borderColor="purple.500" pb={4}>
                <HStack>
                  <Icon as={Gift} color="purple.500" boxSize={8} />
                  <Text fontSize="2xl" fontWeight="black" color={textTitle} fontFamily="serif">
                    Cumpleañeros del mes de {monthLabel} de {selectedYear}
                  </Text>
                </HStack>
                <Badge colorScheme="purple" fontSize="md" px={3} py={1} borderRadius="full">
                  {birthdays.length} Activos
                </Badge>
              </Flex>

              {birthdays.length > 0 ? (
                <Table size="sm" variant="simple" sx={{ borderCollapse: 'collapse', '& th, & td': { borderColor: borderTableColor, borderWidth: '1px' } }}>
                  <Thead>
                    <Tr bg={bgThead}>
                      <Th textAlign="center" py={3} color={textPrimary} fontSize="sm" w="40%">Nombre</Th>
                      <Th textAlign="center" py={3} color={textPrimary} fontSize="sm" w="30%">Area</Th>
                      <Th textAlign="center" py={3} color={textPrimary} fontSize="sm">Día de cumpleaños</Th>
                      <Th textAlign="center" py={3} color={textPrimary} fontSize="sm">Día de Descanso</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {birthdays.map((b, i) => {
                      const isWeekend = b.dayOfWeek === 0 || b.dayOfWeek === 6;
                      return (
                        <Tr key={`${b.id}-${i}`} _hover={{ bg: rowHoverBg }} transition="background 0.2s">
                          <Td py={3}>
                            <HStack>
                              <Avatar size="sm" name={b.nombreCompleto} bg="purple.500" color="white" />
                              <Text fontWeight="medium" color={textPrimary}>{b.nombreCompleto}</Text>
                            </HStack>
                          </Td>
                          <Td py={3}>
                            <Text fontSize="sm" color={textSecondary}>{b.area}</Text>
                          </Td>
                          <Td py={3} textAlign="center">
                            <Badge colorScheme="purple" variant="subtle" fontSize="sm" px={2} borderRadius="full">
                              {b.bDay}
                            </Badge>
                          </Td>
                          <Td py={3} textAlign="center">
                            <Badge colorScheme={isWeekend ? "red" : "green"} variant="solid" fontSize="sm" px={2} borderRadius="full">
                              {b.restDay}
                            </Badge>
                            {isWeekend && (
                              <Text fontSize="xs" color={textMuted} mt={1}>
                                {b.dayOfWeek === 6 ? '(Viernes)' : '(Lunes)'}
                              </Text>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              ) : (
                <Flex direction="column" align="center" justify="center" py={20} color={textMuted}>
                  <Icon as={Cake} boxSize={16} mb={4} opacity={0.5} />
                  <Text fontSize="lg">No hay cumpleañeros activos en este mes.</Text>
                </Flex>
              )}
            </Box>
          </Box>
        </ModalBody>

        <ModalFooter bg={bgBody} borderTopWidth="1px" borderColor={borderColor} borderBottomRadius="md">
          <Button variant="ghost" mr={3} onClick={onClose} color={textPrimary}>Cerrar</Button>
          <Button 
            leftIcon={<Printer size={18} />} 
            colorScheme="purple" 
            onClick={handleExportPDF} 
            isLoading={isExporting}
            loadingText="Generando..."
          >
            Exportar a PDF
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CumpleanerosModal;
