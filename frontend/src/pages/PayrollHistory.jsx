import React, { useContext, useMemo, useState } from 'react';
import { DataContext } from '../context/DataContext';
import { AppContext } from '../App';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { History, Calendar, Trash2, Eye, Download, FileText, CheckCircle2, ArrowLeft, Building2, X, Search } from 'lucide-react';
import { formatQ, CUOTA_LABORAL_RATE, CUOTA_PATRONAL_RATE } from '../data/mockData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import {
  Box, Flex, Heading, Text, Button, Input, Select,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  IconButton, Badge, Avatar, HStack, VStack,
  InputGroup, InputLeftElement, useColorModeValue,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, ModalCloseButton, Divider, SimpleGrid, Center
} from '@chakra-ui/react';

export default function PayrollHistory() {
  const { payrollHistory, deletePayroll, bonuses, companies } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Group by title
  const groupedHistory = useMemo(() => {
    const groups = {};
    payrollHistory.forEach(p => {
      const t = p.title || 'Nómina sin título';
      if (!groups[t]) {
        groups[t] = {
          title: t,
          date: p.closedAt || new Date().toISOString(), // use most recent date
          periodType: p.periodType || '1ra',
          records: [],
          employeesCount: 0,
          grossTotal: 0,
          netTotal: 0,
          companies: new Set()
        };
      }
      
      groups[t].records.push(p);
      
      // Calculate gross total
      let emps = p.data || p.employees || [];
      if (typeof emps === 'string') {
        try { emps = JSON.parse(emps); } catch(e) { emps = []; }
      }
      if (!Array.isArray(emps)) emps = [];

      groups[t].employeesCount += emps.length;

      let grossSum = 0;
      let dedSum = 0;
      emps.forEach(e => {
        const baseFactor = (e.days || 30) / 30;
        const sueldoOrd = Number(e.sueldo_ordinario) || 0;
        const bonInc = Number(e.bon_incentivo) || 0;
        const bonDec = Number(e.bon_dec_37_2001) || 0;

        const baseSalary = sueldoOrd * baseFactor;
        const bonusLey = bonInc * baseFactor;
        const bonusDec = bonDec * baseFactor;
        
        const bonos = Number(e.extras?.bonos) || 0;
        const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
        const extrasTotal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);

        const eGross = baseSalary + bonusLey + bonusDec + bonos + extrasTotal + bonusesSum;
        grossSum += eGross;

        const ded = Object.values(e.deductions || {}).reduce((a, b) => a + Number(b), 0);
        dedSum += ded;
      });
      
      groups[t].grossTotal += grossSum;
      groups[t].netTotal += (grossSum - dedSum);
      
      if (emps.length > 0 && emps[0].empresa_principal) {
        const comp = companies.find(c => c.id === emps[0].empresa_principal);
        if (comp && comp.nombre_comercial) {
          groups[t].companies.add(comp.nombre_comercial);
        }
      }
      
      if (new Date(p.closedAt || new Date()) > new Date(groups[t].date)) {
        groups[t].date = p.closedAt || new Date().toISOString();
      }
    });
    
    return Object.values(groups).sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [payrollHistory]);

  const filteredHistory = groupedHistory.filter(g => 
    g.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pagination = usePagination(filteredHistory, 10);

  const handleDeleteGroup = (title, records) => {
    confirmAction(`¿Seguro que desea eliminar el registro consolidado "${title}"? Se borrarán ${records.length} nómina(s) de las empresas involucradas.`, () => {
      records.forEach(r => deletePayroll(r.id));
      showToast('Registro eliminado exitosamente', 'info');
      if (selectedGroup && selectedGroup.title === title) setSelectedGroup(null);
    });
  };

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');

  if (selectedGroup) {
    return <PayrollHistoryDetail group={selectedGroup} onBack={() => setSelectedGroup(null)} />;
  }

  return (
    <Box p={{ base: 4, md: 6 }}>
      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4}>
        <Box>
          <Heading size="lg" fontWeight={800} mb={1}>
            Historial de Nóminas
          </Heading>
          <Text color="gray.500">
            Registro inmutable de procesos de nómina cerrados y agrupados por periodo
          </Text>
        </Box>
        <InputGroup maxW="300px" size="sm">
          <InputLeftElement pointerEvents="none">
            <Search size={16} color="gray.400" />
          </InputLeftElement>
          <Input 
            placeholder="Buscar por título..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            borderRadius="md"
          />
        </InputGroup>
      </Flex>

      <Box maxW="800px" mx="auto" position="relative">
        {pagination.paginatedData.length > 0 && (
          <Box 
            position="absolute" 
            top="20px" 
            bottom="20px" 
            left="23px" 
            w="2px" 
            bg="linear-gradient(to bottom, var(--chakra-colors-brand-500) 0%, var(--chakra-colors-gray-200) 100%)"
            zIndex={0} 
          />
        )}

        <VStack spacing={8} align="stretch">
          {pagination.paginatedData.map((group, i) => (
            <Flex key={group.title} gap={6} position="relative" zIndex={1} align="start">
              <Center 
                w="48px" 
                h="48px" 
                borderRadius="full" 
                bg={cardBg} 
                border="2px solid" 
                borderColor="brand.500" 
                color="brand.500" 
                flexShrink={0} 
                boxShadow="lg"
              >
                <CheckCircle2 size={24} />
              </Center>
              
              <Box 
                flex="1" 
                p={6} 
                bg={cardBg} 
                borderRadius="xl" 
                border="1px solid" 
                borderColor={borderColor}
                boxShadow="md"
              >
                <Flex justify="space-between" align="start" mb={4} wrap="wrap" gap={2}>
                  <Box>
                    <Heading size="sm" fontWeight={800} mb={1}>{group.title}</Heading>
                    <Badge colorScheme={group.periodType === '2da' ? 'purple' : 'teal'} mb={2}>
                      {group.periodType === '2da' ? '2da Quincena' : '1ra Quincena'}
                    </Badge>
                    <HStack spacing={4} color="gray.500" fontSize="xs">
                      <Flex align="center" gap={1}>
                        <Calendar size={14} /> 
                        Cerrada: {new Date(group.date).toLocaleDateString()}
                      </Flex>
                      <Flex align="center" gap={1}>
                        <Building2 size={14} /> 
                        {group.companies.size === 0 ? 'Sin empresa' : Array.from(group.companies).join(', ')}
                      </Flex>
                    </HStack>
                  </Box>
                  <HStack spacing={1}>
                    <IconButton aria-label="Ver Detalle" icon={<Eye size={18} />} onClick={() => setSelectedGroup(group)} variant="ghost" />
                    <IconButton aria-label="Eliminar Registro" icon={<Trash2 size={18} />} colorScheme="red" variant="ghost" onClick={() => handleDeleteGroup(group.title, group.records)} />
                  </HStack>
                </Flex>

                <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} p={4} bg={useColorModeValue('gray.50', 'whiteAlpha.50')} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                  <Box>
                    <Text fontSize="xxs" color="gray.500" textTransform="uppercase" fontWeight={700}>Total Empleados</Text>
                    <Text fontSize="md" fontWeight={700}>{group.employeesCount} liquidaciones</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xxs" color="gray.500" textTransform="uppercase" fontWeight={700}>Total Bruto</Text>
                    <Text fontSize="md" fontWeight={700} fontFamily="mono">{formatQ(group.grossTotal)}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="xxs" color="gray.500" textTransform="uppercase" fontWeight={700}>Desembolso Neto</Text>
                    <Text fontSize="md" fontWeight={800} fontFamily="mono" color="gold.500">{formatQ(group.netTotal)}</Text>
                  </Box>
                </SimpleGrid>
              </Box>
            </Flex>
          ))}

          {filteredHistory.length === 0 && (
            <VStack spacing={4} py={12} align="center" color="gray.500">
              <History size={48} opacity={0.3} />
              <Heading size="sm">Historial Vacío</Heading>
              <Text fontSize="sm">Aún no hay nóminas procesadas en el sistema.</Text>
            </VStack>
          )}
        </VStack>
      </Box>

      {pagination.paginatedData.length > 0 && (
        <Box mt={8} maxW="800px" mx="auto">
          <Pagination {...pagination} />
        </Box>
      )}
    </Box>
  );
}

function PayrollHistoryDetail({ group, onBack }) {
  const { bonuses } = useContext(DataContext);
  const { showToast } = useContext(AppContext);
  const [selectedVoucherEmp, setSelectedVoucherEmp] = useState(null);

  // Combine and calculate
  const { data, totals } = useMemo(() => {
    const emps = [];
    let grossTotal = 0, dedTotal = 0, patronalTotal = 0;
    
    group.records.forEach(r => {
      let list = r.data || r.employees || [];
      if (typeof list === 'string') {
        try { list = JSON.parse(list); } catch(e) { list = []; }
      }
      if (!Array.isArray(list)) list = [];
      
      const companyName = group.companies.size > 0 ? Array.from(group.companies)[0] : 'Sin empresa';
      
      list.forEach(e => {
        const baseFactor = (e.days || 30) / 30;
        const sueldoOrd = Number(e.sueldo_ordinario) || 0;
        const bonInc = Number(e.bon_incentivo) || 0;
        const bonDec = Number(e.bon_dec_37_2001) || 0;

        const baseSalary = sueldoOrd * baseFactor;
        const bonusLey = bonInc * baseFactor;
        const bonusDec = bonDec * baseFactor;
        const bonos = Number(e.extras?.bonos) || 0;
        
        const extrasTotal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
        const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
        const gross = baseSalary + bonusLey + bonusDec + bonos + extrasTotal + bonusesSum;
        
        const ded = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);
        const patronal = baseSalary * CUOTA_PATRONAL_RATE;
        
        grossTotal += gross;
        dedTotal += ded;
        patronalTotal += patronal;
        
        emps.push({
          ...e,
          company,
          calculated: { baseSalary, bonusLey, bonusDec, bonos, extrasTotal, bonusesSum, gross, ded, net: gross - ded }
        });
      });
    });
    
    return { data: emps, totals: { grossTotal, dedTotal, patronalTotal, netTotal: grossTotal - dedTotal } };
  }, [group]);

  const exportExcel = () => {
    showToast('Generando Excel...', 'success');
    
    const rows = data.map((e, idx) => {
      const row = {
        'No.': idx + 1,
        'Nombre': `${e.primer_nombre || e.nombres || ''} ${e.primer_apellido || e.apellidos || ''}`,
        'Empresa': e.company,
        'Puesto': e.puesto || 'N/A',
        'Días Laborados': e.days || 30,
        'Salario Ordinario': e.calculated.baseSalary,
        'Bono Incentivo': e.calculated.bonusLey,
        'Bono Decreto 37-2001': e.calculated.bonusDec,
        'Bonos': e.calculated.bonos,
        'Total Devengado': e.calculated.gross,
        'Horas Simples': e.extras?.simplesQty || 0,
        'Valor Horas Simples': e.extras?.simplesVal || 0,
        'Horas Dobles': e.extras?.doblesQty || 0,
        'Valor Horas Dobles': e.extras?.doblesVal || 0,
        'Otros Ingresos': e.extras?.otrosIngresos || 0,
        'Salario Total': e.calculated.gross + (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.otrosIngresos || 0),
        'IGSS': e.deductions?.igss || 0,
        'ISR': e.deductions?.isr || 0,
        'Cafetería': e.deductions?.cafe || 0,
        'Celular': e.deductions?.cell || 0,
        'Uniforme': e.deductions?.uniform || 0,
        'Calzado': e.deductions?.shoes || 0,
        'Equipo': e.deductions?.equipo || 0,
        'Producto': e.deductions?.product || 0,
        'Bancos': e.deductions?.bancos || 0,
        'Otros Deducción': e.deductions?.otros || 0,
        'Judiciales': e.deductions?.judiciales || 0,
        'Seguro': e.deductions?.seguro || 0,
        'Parqueo': e.deductions?.parqueo || 0,
        'Boleta de Ornato': e.deductions?.boleto_de_ornato || 0,
        'Otros Egresos': e.deductions?.otros_egresos || 0,
        'Total Egresos': e.calculated.ded,
        'Líquido a Recibir': e.calculated.net,
        '1ra Quincena': e.calculated.net > 0 ? e.calculated.net / 2 : 0,
        '2da Quincena': e.calculated.net > 0 ? e.calculated.net - (e.calculated.net / 2) : 0,
        'Banco Deposito': e.banco || 'N/A',
        'Cuenta Bancaria': e.no_cuenta || 'N/A',
      };
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial Nómina");
    XLSX.writeFile(wb, `Nomina_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  };

  const exportPDF = async () => {
    showToast('Generando PDF...', 'success');
    const element = document.getElementById('voucher-content');
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Boleta_${selectedVoucherEmp.primer_nombre || selectedVoucherEmp.nombres || 'Empleado'}.pdf`);
    } catch (err) {
      console.error(err);
      showToast('Error al generar PDF', 'error');
    }
  };

  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const theadBg = useColorModeValue('gray.100', 'gray.900');
  const tdBg = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  // Compute footer totals for history detail
  const columnTotals = useMemo(() => {
    let totSalarioOrd = 0, totBonInc = 0, totBonDec = 0, totBonos = 0, totDevengado = 0;
    let totHorasSimples = 0, totValSimple = 0, totHorasDobles = 0, totValDouble = 0, totOtrosIngresos = 0, totSalarioTotal = 0;
    let totIgss = 0, totIsr = 0, totCafe = 0, totCell = 0, totUniform = 0, totShoes = 0, totEquipo = 0, totProduct = 0, totBancos = 0, totOtros = 0, totJudiciales = 0, totSeguro = 0, totParqueo = 0, totBoleta = 0, totOtrosEgresos = 0, totTotalEgresos = 0;
    let totLiquido = 0, totQuincena1 = 0, totQuincena2 = 0;

    data.forEach(e => {
      const baseFactor = (e.days || 30) / 30;
      const sueldoOrd = Number(e.sueldo_ordinario) || 0;
      const bonInc = Number(e.bon_incentivo) || 0;
      const bonDec = Number(e.bon_dec_37_2001) || 0;

      const baseSalary = sueldoOrd * baseFactor;
      const bonusLey = bonInc * baseFactor;
      const bonusDec = bonDec * baseFactor;
      const bonos = Number(e.extras?.bonos) || 0;
      const devengado = baseSalary + bonusLey + bonusDec + bonos;

      const simplesQty = Number(e.extras?.simplesQty) || 0;
      const simplesVal = Number(e.extras?.simplesVal) || 0;
      const doblesQty = Number(e.extras?.doblesQty) || 0;
      const doblesVal = Number(e.extras?.doblesVal) || 0;
      const otrosIngresos = Number(e.extras?.otrosIngresos) || 0;
      const salarioTotal = devengado + simplesVal + doblesVal + otrosIngresos;

      const igss = Number(e.deductions?.igss) || 0;
      const isr = Number(e.deductions?.isr) || 0;
      const cafe = Number(e.deductions?.cafe) || 0;
      const cell = Number(e.deductions?.cell) || 0;
      const uniform = Number(e.deductions?.uniform) || 0;
      const shoes = Number(e.deductions?.shoes) || 0;
      const equipo = Number(e.deductions?.equipo) || 0;
      const product = Number(e.deductions?.product) || 0;
      const bancos = Number(e.deductions?.bancos) || 0;
      const otros = Number(e.deductions?.otros) || 0;
      const judiciales = Number(e.deductions?.judiciales) || 0;
      const seguro = Number(e.deductions?.seguro) || 0;
      const parqueo = Number(e.deductions?.parqueo) || 0;
      const boleto_de_ornato = Number(e.deductions?.boleto_de_ornato) || 0;
      const otros_egresos = Number(e.deductions?.otros_egresos) || 0;
      const anticipo = Number(e.anticipo1ra) || 0;
      const is2da = group.periodType === '2da';
      
      const totalEgresos = igss + isr + cafe + cell + uniform + shoes + equipo + product + bancos + otros + judiciales + seguro + parqueo + boleto_de_ornato + otros_egresos;
      const liquido = salarioTotal - totalEgresos;
      const q1 = is2da ? anticipo : liquido;
      const q2 = is2da ? liquido - anticipo : 0;

      totSalarioOrd += baseSalary;
      totBonInc += bonusLey;
      totBonDec += bonusDec;
      totBonos += bonos;
      totDevengado += devengado;
      totHorasSimples += simplesQty;
      totValSimple += simplesVal;
      totHorasDobles += doblesQty;
      totValDouble += doblesVal;
      totOtrosIngresos += otrosIngresos;
      totSalarioTotal += salarioTotal;

      totIgss += igss;
      totIsr += isr;
      totCafe += cafe;
      totCell += cell;
      totUniform += uniform;
      totShoes += shoes;
      totEquipo += equipo;
      totProduct += product;
      totBancos += bancos;
      totOtros += otros;
      totJudiciales += judiciales;
      totSeguro += seguro;
      totParqueo += parqueo;
      totBoleta += boleto_de_ornato;
      totOtrosEgresos += otros_egresos;
      totTotalEgresos += totalEgresos;
      totLiquido += liquido;
      totQuincena1 += q1;
      totQuincena2 += q2;
    });

    return {
      totSalarioOrd, totBonInc, totBonDec, totBonos, totDevengado,
      totHorasSimples, totValSimple, totHorasDobles, totValDouble, totOtrosIngresos, totSalarioTotal,
      totIgss, totIsr, totCafe, totCell, totUniform, totShoes, totEquipo, totProduct, totBancos, totOtros, totJudiciales, totSeguro, totParqueo, totBoleta, totOtrosEgresos, totTotalEgresos,
      totLiquido, totQuincena1, totQuincena2
    };
  }, [data, group.periodType]);

  return (
    <Box p={{ base: 4, md: 6 }}>
      {/* Header */}
      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={4}>
        <Flex align="center" gap={4}>
          <IconButton aria-label="Back" icon={<ArrowLeft size={20} />} onClick={onBack} variant="ghost" />
          <Box>
            <Flex align="center" gap={3}>
              <Heading size="md" fontWeight={800}>{group.title}</Heading>
              <Badge colorScheme="green" variant="subtle" fontWeight={700}>Cerrada</Badge>
            </Flex>
            <Text fontSize="sm" color="gray.500">
              {data.length} empleados procesados en este periodo
            </Text>
          </Box>
        </Flex>
        <Button colorScheme="brand" leftIcon={<Download size={16} />} onClick={exportExcel}>
          Exportar Reporte Total (Excel)
        </Button>
      </Flex>

      {/* Summary strip */}
      <Flex 
        p={6} 
        mb={6} 
        borderRadius="xl" 
        border="1px solid" 
        borderColor={borderColor} 
        gap={8} 
        wrap="wrap" 
        align="center"
        bg={tdBg}
      >
        <SummaryStat label="Costo Bruto Total" value={formatQ(totals.grossTotal)} />
        <Divider orientation="vertical" h="40px" />
        <SummaryStat label="Deducciones Totales" value={formatQ(totals.dedTotal)} color="red.500" />
        <Divider orientation="vertical" h="40px" />
        <SummaryStat label="Cuota Patronal Estimada" value={formatQ(totals.patronalTotal)} color="orange.400" />
        <Divider orientation="vertical" h="40px" />
        <SummaryStat label="Desembolso Neto" value={formatQ(totals.netTotal)} color="brand.500" large />
      </Flex>

      {/* Spreadsheet Table (Read-Only) */}
      <Heading size="xs" color="gray.500" textTransform="uppercase" mb={3} letterSpacing="wider">
        Desglose Completo de Pagos
      </Heading>

      <TableContainer border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" bg={tdBg} maxH="500px">
        <Table variant="simple" size="sm" layout="fixed" style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content' }}>
          <Thead position="sticky" top={0} zIndex={15}>
            <Tr bg={theadBg}>
              <Th w="60px" position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">No.</Th>
              <Th w="200px" position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Nombre Empleado</Th>
              <Th w="120px" position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Empresa</Th>
              <Th w="120px" position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="10px">Puesto</Th>
              
              <Th w="75px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Días Lab.</Th>
              <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">S. Ordinario</Th>
              <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bon. Incentivo</Th>
              <Th w="140px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bono Dec. 37-2001</Th>
              <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bonos</Th>
              <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">T. Devengado</Th>
              <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Simples</Th>
              <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Simp</Th>
              <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Dobles</Th>
              <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Dobl</Th>
              <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Otros Ingr.</Th>
              <Th w="130px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="gold.500">Salario Total</Th>
              
              <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">IGSS</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">ISR</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Cafetería</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Celular</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Uniforme</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Calzado</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Equipo</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Producto</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Bancos</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Otros</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Judiciales</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Seguro</Th>
              <Th w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Parqueo</Th>
              <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Bol. Ornato</Th>
              <Th w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Otros Egr.</Th>
              <Th w="130px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.500">Total Egresos</Th>
              
              <Th w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">Liquido a Recibir</Th>
              {group.periodType === '2da' && (
                <>
                  <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">1ra Quincena</Th>
                  <Th w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">2da Quincena</Th>
                </>
              )}
              <Th w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" textAlign="center">Boleta</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.map((e, idx) => {
              const { baseSalary, bonusLey, bonusDec, bonos, extrasTotal, gross, ded, net } = e.calculated;
              const anticipo = e.anticipo1ra || 0;
              const is2da = group.periodType === '2da';
              const q1 = is2da ? anticipo : net;
              const q2 = is2da ? net - anticipo : 0;

              return (
                <Tr key={e.id + '-' + idx} _hover={{ bg: hoverBg }}>
                  <Td position="sticky" left={0} zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontWeight="bold" fontSize="xs">
                    {idx + 1}
                  </Td>
                  <Td position="sticky" left="60px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontWeight="600" color="brand.500" fontSize="xs" isTruncated maxW="200px">
                    {`${e.primer_nombre || e.nombres || ''} ${e.primer_apellido || e.apellidos || ''}`}
                  </Td>
                  <Td position="sticky" left="260px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontSize="xs" isTruncated maxW="120px">
                    {companyName}
                  </Td>
                  <Td position="sticky" left="380px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="xs" isTruncated maxW="120px">
                    {e.puesto || 'Sin Puesto'}
                  </Td>

                  <Td fontSize="xs">{e.days || 30}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(baseSalary)}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(bonusLey)}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(bonusDec)}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(bonos)}</Td>
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(gross)}</Td>
                  
                  <Td fontSize="xs">{e.extras?.simplesQty || 0}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(e.extras?.simplesVal || 0)}</Td>
                  <Td fontSize="xs">{e.extras?.doblesQty || 0}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(e.extras?.doblesVal || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(e.extras?.otrosIngresos || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(gross + (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.otrosIngresos || 0) - (baseSalary + bonusLey + bonusDec + bonos))}</Td>

                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.igss || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.isr || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.cafe || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.cell || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.uniform || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.shoes || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.equipo || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.product || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.bancos || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.otros || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.judiciales || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.seguro || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.parqueo || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.boleto_de_ornato || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" color="red.400">{formatQ(e.deductions?.otros_egresos || 0)}</Td>
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(ded)}</Td>
                  
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(net)}</Td>
                  {is2da && (
                    <>
                      <Td fontFamily="mono" fontSize="xs" color="gray.500">{formatQ(q1)}</Td>
                      <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="green.500">{formatQ(q2)}</Td>
                    </>
                  )}
                  
                  <Td textAlign="center">
                    <IconButton 
                      aria-label="Ver Boleta" 
                      icon={<FileText size={16} />} 
                      size="xs" 
                      colorScheme="brand" 
                      variant="ghost" 
                      onClick={() => setSelectedVoucherEmp(e)} 
                    />
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
          {/* Footer totals */}
          <Thead position="sticky" bottom={0} zIndex={15} bg={theadBg}>
            <Tr borderTop="2px solid" borderColor="brand.500">
              <Th position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}>TOTAL</Th>
              <Th position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}>CONSOLIDADO</Th>
              <Th position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor}></Th>
              <Th position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)"></Th>
              
              <Th>{data.length} Emps</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totSalarioOrd)}</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totBonInc)}</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totBonDec)}</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totBonos)}</Th>
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(columnTotals.totDevengado)}</Th>
              
              <Th>{columnTotals.totHorasSimples}</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totValSimple)}</Th>
              <Th>{columnTotals.totHorasDobles}</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totValDouble)}</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totOtrosIngresos)}</Th>
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(columnTotals.totSalarioTotal)}</Th>
              
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totIgss)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totIsr)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totCafe)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totCell)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totUniform)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totShoes)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totEquipo)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totProduct)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totBancos)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totOtros)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totJudiciales)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totSeguro)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totParqueo)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totBoleta)}</Th>
              <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(columnTotals.totOtrosEgresos)}</Th>
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(columnTotals.totTotalEgresos)}</Th>
              
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(columnTotals.totLiquido)}</Th>
              {group.periodType === '2da' && (
                <>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totQuincena1)}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(columnTotals.totQuincena2)}</Th>
                </>
              )}
              <Th></Th>
            </Tr>
          </Thead>
        </Table>
      </TableContainer>

      {/* Voucher slip display Modal */}
      {selectedVoucherEmp && (
        <Modal isOpen={!!selectedVoucherEmp} onClose={() => setSelectedVoucherEmp(null)} size="xl">
          <ModalOverlay />
          <ModalContent borderRadius="xl">
            <ModalHeader fontWeight={800} borderBottom="1px solid" borderColor={borderColor}>
              Boleta de Pago
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody p={0} bg="white">
              {/* Captured printable voucher container */}
              <Box id="voucher-content" p={8} bg="white" color="gray.800" fontFamily="sans-serif">
                <Flex justify="space-between" borderBottom="2px solid" borderColor="gray.200" pb={4} mb={6}>
                  <Box>
                    <Heading size="md" fontWeight={800} color="gray.900">
                      {selectedVoucherEmp.company}
                    </Heading>
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Recibo de Pago de Planilla
                    </Text>
                  </Box>
                  <VStack align="end" spacing={1}>
                    <Text fontSize="sm" fontWeight={700} color="gray.700">
                      Periodo: {group.title}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Fecha de Pago: {new Date(group.date).toLocaleDateString()}
                    </Text>
                  </VStack>
                </Flex>

                <Flex justify="space-between" mb={8} wrap="wrap" gap={4}>
                  <Box>
                    <Text fontSize="9px" color="gray.400" textTransform="uppercase" letterSpacing="wider">Empleado</Text>
                    <Text fontSize="md" fontWeight={800} color="gray.900">
                      {`${selectedVoucherEmp.primer_nombre || selectedVoucherEmp.nombres || ''} ${selectedVoucherEmp.primer_apellido || selectedVoucherEmp.apellidos || ''}`}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      Puesto: {selectedVoucherEmp.puesto || 'N/A'}
                    </Text>
                  </Box>
                  <VStack align="end" spacing={1}>
                    <Text fontSize="9px" color="gray.400" textTransform="uppercase" letterSpacing="wider">Depósito Bancario</Text>
                    <Text fontSize="xs" fontWeight={700} color="gray.900">
                      {selectedVoucherEmp.banco || 'N/A'} - {selectedVoucherEmp.no_cuenta || 'N/A'}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      Afiliación IGSS: {selectedVoucherEmp.no_igss || 'N/A'}
                    </Text>
                  </VStack>
                </Flex>

                <SimpleGrid columns={2} spacing={10} mb={8}>
                  {/* Income column */}
                  <Box>
                    <Heading size="xs" borderBottom="1px solid" borderColor="gray.200" pb={2} mb={3} color="gray.900">
                      Ingresos
                    </Heading>
                    <VStack align="stretch" spacing={2} fontSize="xs">
                      <Flex justify="space-between">
                        <Text>Salario Ordinario</Text>
                        <Text fontFamily="mono" fontWeight={600}>{formatQ(selectedVoucherEmp.calculated.baseSalary)}</Text>
                      </Flex>
                      <Flex justify="space-between">
                        <Text>Bono Incentivo (Ley)</Text>
                        <Text fontFamily="mono" fontWeight={600}>{formatQ(selectedVoucherEmp.calculated.bonusLey)}</Text>
                      </Flex>
                      <Flex justify="space-between">
                        <Text>Bono Decreto 37-2001</Text>
                        <Text fontFamily="mono" fontWeight={600}>{formatQ(selectedVoucherEmp.calculated.bonusDec)}</Text>
                      </Flex>
                      {selectedVoucherEmp.calculated.bonos > 0 && (
                        <Flex justify="space-between">
                          <Text>Otros Bonos</Text>
                          <Text fontFamily="mono" fontWeight={600}>{formatQ(selectedVoucherEmp.calculated.bonos)}</Text>
                        </Flex>
                      )}
                      {selectedVoucherEmp.calculated.extrasTotal > 0 && (
                        <Flex justify="space-between">
                          <Text>Horas Extras y Otros</Text>
                          <Text fontFamily="mono" fontWeight={600}>{formatQ(selectedVoucherEmp.calculated.extrasTotal)}</Text>
                        </Flex>
                      )}
                      <Flex justify="space-between" borderTop="1px dashed" borderColor="gray.300" pt={2} fontWeight={700} color="gray.900">
                        <Text>Total Ingresos Brutos</Text>
                        <Text fontFamily="mono">{formatQ(selectedVoucherEmp.calculated.gross)}</Text>
                      </Flex>
                    </VStack>
                  </Box>

                  {/* Deductions column */}
                  <Box>
                    <Heading size="xs" borderBottom="1px solid" borderColor="gray.200" pb={2} mb={3} color="gray.900">
                      Deducciones
                    </Heading>
                    <VStack align="stretch" spacing={2} fontSize="xs">
                      {Object.entries(selectedVoucherEmp.deductions || {}).map(([key, val]) => {
                        const numVal = Number(val) || 0;
                        if (numVal <= 0) return null;
                        
                        // Map technical names to readable labels
                        const labelMap = {
                          igss: 'IGSS Laboral (4.83%)',
                          isr: 'ISR Retención',
                          cafe: 'Cafetería',
                          cell: 'Consumo Celular',
                          uniform: 'Descuento Uniforme',
                          shoes: 'Descuento Calzado',
                          equipo: 'Descuento Equipo',
                          product: 'Compra Producto',
                          bancos: 'Retención Bancos',
                          otros: 'Otros Descuentos',
                          judiciales: 'Retención Judicial',
                          seguro: 'Seguro Médico/Vida',
                          parqueo: 'Servicio Parqueo',
                          boleto_de_ornato: 'Boleta de Ornato',
                          otros_egresos: 'Otros Egresos'
                        };

                        return (
                          <Flex justify="space-between" key={key} color="red.600">
                            <Text>{labelMap[key] || key}</Text>
                            <Text fontFamily="mono" fontWeight={600}>{formatQ(numVal)}</Text>
                          </Flex>
                        );
                      })}
                      <Flex justify="space-between" borderTop="1px dashed" borderColor="gray.300" pt={2} fontWeight={700} color="red.600">
                        <Text>Total Egresos</Text>
                        <Text fontFamily="mono">{formatQ(selectedVoucherEmp.calculated.ded)}</Text>
                      </Flex>
                    </VStack>
                  </Box>
                </SimpleGrid>

                {/* Net Pay Box */}
                <Flex bg="gray.100" p={4} borderRadius="lg" justify="space-between" align="center" mb={8}>
                  <Text fontSize="sm" fontWeight={800} color="gray.900">LÍQUIDO A RECIBIR</Text>
                  <Text fontFamily="mono" fontSize="xl" fontWeight={900} color="green.500">
                    {formatQ(selectedVoucherEmp.calculated.net)}
                  </Text>
                </Flex>

                {/* Signature Lines */}
                <Flex justify="space-between" align="end" mt={12} pt={6} borderTop="1px solid" borderColor="gray.100">
                  <Box w="200px" textAlign="center">
                    <Box borderBottom="1px solid" borderColor="gray.400" h="40px" />
                    <Text fontSize="10px" color="gray.400" mt={2}>Firma del Empleado</Text>
                  </Box>
                  <Text fontSize="9px" color="gray.400">
                    Generado el {new Date(group.date).toLocaleDateString()}
                  </Text>
                </Flex>
              </Box>
            </ModalBody>
            <ModalFooter bg={tdBg} borderTop="1px solid" borderColor={borderColor}>
              <Button variant="ghost" mr={3} onClick={() => setSelectedVoucherEmp(null)}>Cerrar</Button>
              <Button colorScheme="brand" leftIcon={<FileText size={16} />} onClick={exportPDF}>
                Descargar PDF boleta
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Box>
  );
}

function SummaryStat({ label, value, color, large }) {
  return (
    <Box>
      <Text fontSize="xs" fontWeight={600} color="gray.500" textTransform="uppercase" letterSpacing="0.05em" mb={1}>
        {label}
      </Text>
      <Text fontFamily="mono" fontWeight={800} fontSize={large ? '2xl' : 'xl'} color={color || 'gold.500'} letterSpacing="-0.02em">
        {value}
      </Text>
    </Box>
  );
}
