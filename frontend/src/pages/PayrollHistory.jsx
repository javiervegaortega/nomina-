import React, { useContext, useMemo, useState } from 'react';
import { DataContext } from '../context/DataContext';
import { AppContext } from '../App';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { History, Calendar, Trash2, Eye, Download, FileText, CheckCircle2, ArrowLeft, Building2, X, Search, ChevronDown } from 'lucide-react';
import { formatQ, CUOTA_LABORAL_RATE, CUOTA_PATRONAL_RATE } from '../data/mockData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import ReportPreviewModal from '../components/ReportPreviewModal';
import EmployeeSummaryModal from '../components/EmployeeSummaryModal';

export const getEmployeeFullName = (e) => {
  if (!e) return '';
  const parts = [
    e.primer_nombre, 
    e.segundo_nombre, 
    e.otro_nombre, 
    e.primer_apellido, 
    e.segundo_apellido, 
    e.apellido_casada
  ].filter(Boolean);
  
  if (parts.length > 0) return parts.join(' ');
  return `${e.nombres || ''} ${e.apellidos || ''}`.trim() || 'Empleado';
};

import {
  Box, Flex, Heading, Text, Button, Input, Select,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  IconButton, Badge, Avatar, HStack, VStack,
  InputGroup, InputLeftElement, useColorModeValue,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, ModalCloseButton, Divider, SimpleGrid, Center,
  Menu, MenuButton, MenuList, MenuItem, MenuItemOption, MenuOptionGroup,
  Skeleton, SkeletonText, ButtonGroup
} from '@chakra-ui/react';


export default function PayrollHistory() {
  const { payrollHistory, deletePayroll, bonuses, companies, isLoading } = useContext(DataContext);
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

  if (isLoading) {
    return (
      <Box p={{ base: 3, md: 6, lg: 8 }}>
        <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} mb={6} wrap="wrap" gap={4}>
          <Box>
            <Skeleton height="28px" width="240px" mb={2} borderRadius="md" />
            <Skeleton height="16px" width="420px" borderRadius="md" />
          </Box>
          <Skeleton height="32px" width="300px" borderRadius="md" />
        </Flex>
        <Box maxW="800px" mx="auto">
          <VStack spacing={8} align="stretch">
            {[1, 2, 3, 4, 5].map(i => (
              <Flex key={i} gap={{ base: 3, md: 6 }} align="start">
                <Skeleton boxSize={{ base: '36px', md: '48px' }} borderRadius="full" flexShrink={0} display={{ base: 'none', sm: 'block' }} />
                <Box flex="1" p={{ base: 4, md: 6 }} bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor}>
                  <Flex justify="space-between" align="start" mb={4} wrap="wrap" gap={2}>
                    <Box flex="1">
                      <Skeleton height="16px" width="200px" mb={2} borderRadius="md" />
                      <Skeleton height="12px" width="100px" mb={2} borderRadius="md" />
                      <Skeleton height="10px" width="260px" borderRadius="md" />
                    </Box>
                    <HStack spacing={1}>
                      <Skeleton boxSize="32px" borderRadius="md" />
                      <Skeleton boxSize="32px" borderRadius="md" />
                    </HStack>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} p={4} bg={useColorModeValue('gray.50', 'whiteAlpha.50')} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                    {[1, 2, 3].map(j => (
                      <Box key={j}>
                        <Skeleton height="10px" width="90px" mb={2} borderRadius="md" />
                        <Skeleton height="16px" width="120px" borderRadius="md" />
                      </Box>
                    ))}
                  </SimpleGrid>
                </Box>
              </Flex>
            ))}
          </VStack>
        </Box>
      </Box>
    );
  }

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} mb={6} wrap="wrap" gap={4}>
        <Box>
          <Heading size="lg" fontWeight={800} mb={1}>
            Historial de Nóminas
          </Heading>
          <Text color="gray.500">
            Registro inmutable de procesos de nómina cerrados y agrupados por periodo
          </Text>
        </Box>
        <InputGroup maxW={{ base: '100%', md: '300px' }} size="sm">
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

      <Box maxW="800px" mx="auto" position="relative" px={{ base: 0, md: 0 }}>
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
            <Flex key={group.title} gap={{ base: 3, md: 6 }} position="relative" zIndex={1} align="start">
              <Center 
                w={{ base: '36px', md: '48px' }} 
                h={{ base: '36px', md: '48px' }} 
                borderRadius="full" 
                bg={cardBg} 
                border="2px solid" 
                borderColor="brand.500" 
                color="brand.500" 
                flexShrink={0} 
                boxShadow="lg"
                display={{ base: 'none', sm: 'flex' }}
              >
                <CheckCircle2 size={24} />
              </Center>
              
              <Box 
                flex="1" 
                p={{ base: 4, md: 6 }} 
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
                    <HStack spacing={{ base: 2, md: 4 }} color="gray.500" fontSize="xs" flexWrap="wrap">
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
function calculateGroupTotals(groupData, periodType) {
  let totSalarioOrd = 0, totBonInc = 0, totBonDec = 0, totBonos = 0, totDevengado = 0;
  let totHorasSimples = 0, totValSimple = 0, totHorasDobles = 0, totValDouble = 0, totOtrosIngresos = 0, totSalarioTotal = 0;
  let totIgss = 0, totIsr = 0, totCafe = 0, totCell = 0, totUniform = 0, totShoes = 0, totEquipo = 0, totProduct = 0, totBancos = 0, totOtros = 0, totJudiciales = 0, totSeguro = 0, totParqueo = 0, totBoleta = 0, totOtrosEgresos = 0, totTotalEgresos = 0;
  let totLiquido = 0, totQuincena1 = 0, totQuincena2 = 0;

  groupData.forEach(e => {
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
    
    const totalEgresos = igss + isr + cafe + cell + uniform + shoes + equipo + product + bancos + otros + judiciales + seguro + parqueo + boleto_de_ornato + otros_egresos;
    const liquido = salarioTotal - totalEgresos;
    const q1 = periodType === '2da' ? anticipo : liquido;
    const q2 = periodType === '2da' ? liquido - anticipo : 0;

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
}

function PayrollHistoryDetail({ group, onBack }) {
  const { bonuses, areas, departments, divisions, subdivisions, companies } = useContext(DataContext);
  const { showToast } = useContext(AppContext);
  const [selectedVoucherEmp, setSelectedVoucherEmp] = useState(null);

  // Filter states
  const [filterArea, setFilterArea] = useState([]);
  const [filterDept, setFilterDept] = useState([]);
  const [filterDiv, setFilterDiv] = useState([]);
  const [filterSubdiv, setFilterSubdiv] = useState([]);
  const [filterStatus, setFilterStatus] = useState('Activo');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('detailed');
  const [previewReportType, setPreviewReportType] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedSummaryEmp, setSelectedSummaryEmp] = useState(null);

  const handleOpenPreview = (type) => {
    setPreviewReportType(type);
    setIsPreviewModalOpen(true);
  };

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
          company: companyName,
          calculated: { baseSalary, bonusLey, bonusDec, bonos, extrasTotal, bonusesSum, gross, ded, net: gross - ded }
        });
      });
    });
    
    // Apply filters
    const filteredEmps = emps.filter(e => {
      if (filterStatus === 'Activo' && String(e.estado).toLowerCase() !== 'activo') return false;
      if (filterStatus === 'De Baja' && String(e.estado).toLowerCase() !== 'de baja') return false;
      
      if (filterDept.length > 0 && !filterDept.includes(e.departamento_laboral)) return false;
      if (filterArea.length > 0 && !filterArea.includes(String(e.areaId))) return false;
      if (filterDiv.length > 0 && !filterDiv.includes(String(e.divisionId))) return false;
      if (filterSubdiv.length > 0 && !filterSubdiv.includes(String(e.subdivisionId))) return false;
      
      if (searchQuery) {
        const term = searchQuery.toLowerCase();
        const fullName = getEmployeeFullName(e).toLowerCase();
        const job = (e.puesto || '').toLowerCase();
        if (!fullName.includes(term) && !job.includes(term)) return false;
      }
      return true;
    });

    // Recalculate totals for filtered emps
    let fGrossTotal = 0, fDedTotal = 0, fPatronalTotal = 0;
    filteredEmps.forEach(e => {
      fGrossTotal += e.calculated.gross;
      fDedTotal += e.calculated.ded;
      fPatronalTotal += e.calculated.baseSalary * CUOTA_PATRONAL_RATE;
    });
    
    return { data: filteredEmps, totals: { grossTotal: fGrossTotal, dedTotal: fDedTotal, patronalTotal: fPatronalTotal, netTotal: fGrossTotal - fDedTotal } };
  }, [group, filterStatus, filterDept, filterArea, filterDiv, filterSubdiv, searchQuery]);

  const groupedData = useMemo(() => {
    if (filterDept.length === 0 && filterArea.length === 0 && filterDiv.length === 0 && filterSubdiv.length === 0) {
      return [{ title: '', data }];
    }

    const groups = {};
    data.forEach(e => {
      const keyParts = [];
      if (filterDept.length > 0) {
        keyParts.push(`Depto: ${e.departamento_laboral || 'Sin Departamento'}`);
      }
      if (filterDiv.length > 0) {
        const divName = divisions?.find(d => String(d.id) === String(e.divisionId))?.nombre || 'Sin División';
        keyParts.push(`División: ${divName}`);
      }
      if (filterArea.length > 0) {
        const areaName = areas?.find(a => String(a.id) === String(e.areaId))?.nombre || 'Sin Área';
        keyParts.push(`Área: ${areaName}`);
      }
      if (filterSubdiv.length > 0) {
        const subdivName = subdivisions?.find(s => String(s.id) === String(e.subdivisionId))?.nombre || 'Sin Subdivisión';
        keyParts.push(`Subdivisión: ${subdivName}`);
      }
      
      const key = keyParts.length > 0 ? keyParts.join(' | ') : 'Otros';
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    
    return Object.keys(groups).sort().map(key => ({
      title: key,
      data: groups[key]
    }));
  }, [data, filterDept, filterArea, filterDiv, filterSubdiv, divisions, areas, subdivisions]);

  const exportExcel = () => {
    showToast('Generando Excel...', 'success');
    
    const rows = data.map((e, idx) => {
      const row = {
        'No.': idx + 1,
        'Nombre': getEmployeeFullName(e),
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
        '1ra Quincena': group.periodType === '2da' ? (e.anticipo1ra || 0) : e.calculated.net,
        '2da Quincena': group.periodType === '2da' ? (e.calculated.net - (e.anticipo1ra || 0)) : 0,
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

  const exportExcelCheques = () => {
    showToast('Generando Solicitud de Cheques...', 'success');
    const chequesData = data.filter(e => String(e.tipo_de_pago).toLowerCase() === 'cheque');
    if (chequesData.length === 0) {
      showToast('No hay empleados configurados para pago en Cheque.', 'warning');
      return;
    }

    // Group by company
    const comps = {};
    chequesData.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = [];
      comps[compName].push(e);
    });

    const fechaPago = group.closedAt ? new Date(group.closedAt).toLocaleDateString('es-GT') : new Date().toLocaleDateString('es-GT');

    // 9 columns: A=Nombre(wide), B=spacer, C=Empresa, D=Tipo Personal, E=Soporte, F=Banco Pago, G=Medio Pago, H=Monto, I=Monto Total
    const E = ['', '', '', '', '', '', '', '', ''];
    const aoa = [];

    // Row 1: GRUPO ECONSA
    aoa.push(['GRUPO ECONSA', ...E.slice(1)]);
    // Row 2: SOLICITUD DE CHEQUES
    aoa.push(['SOLICITUD DE CHEQUES', ...E.slice(1)]);
    // Row 3: FECHA DE PAGO: ... date offset to col E
    aoa.push(['FECHA DE PAGO:', '', '', '', fechaPago, '', '', '', '']);
    // Row 4: empty
    aoa.push([...E]);
    // Row 5: Column headers
    aoa.push(['Nombre de\nColaborador', '', 'Empresa', 'Tipo de\nPersonal', 'Soporte', 'Banco\nde Pago', 'Medio de\nPago', 'Monto', 'Monto\nTotal']);
    // Row 6: empty separator
    aoa.push([...E]);

    let grandTotal = 0;

    Object.keys(comps).forEach(compName => {
      // Company header
      aoa.push([`Empresa:   ${compName.toUpperCase()}`, ...E.slice(1)]);

      let companyTotal = 0;
      comps[compName].forEach(e => {
        aoa.push([
          getEmployeeFullName(e),
          '',
          compName.toLowerCase(),
          e.puesto || 'fijo',
          '',
          '',
          'cheque',
          e.calculated.net,
          ''
        ]);
        companyTotal += e.calculated.net;
      });

      // Subtotal row — value in "Monto Total" column (I)
      aoa.push(['', '', '', '', '', '', '', '', companyTotal]);
      grandTotal += companyTotal;
    });

    // Empty row
    aoa.push([...E]);
    // TOTAL GENERAL label row (in cols G-H area)
    aoa.push(['', '', '', '', '', '', 'TOTAL GENERAL', '', '']);
    // Empty row
    aoa.push([...E]);
    // Elaborado + Grand total row: Q in col H, total in col I
    aoa.push(['Elaborado por: Alejandra Pérez', '', '', '', '', '', '', 'Q', grandTotal]);
    // Empty rows for spacing
    aoa.push([...E]);
    aoa.push([...E]);
    aoa.push([...E]);
    // Signature row
    aoa.push(['Autorizado por: Walter Mendez (Auditoria Interna)', '', '', '', '', 'Autorizado por: Iris de Lemus (Recursos Humanos)', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths matching image proportions
    ws['!cols'] = [
      { wch: 38 }, // A: Nombre de Colaborador
      { wch: 3 },  // B: spacer
      { wch: 16 }, // C: Empresa
      { wch: 14 }, // D: Tipo de Personal
      { wch: 12 }, // E: Soporte
      { wch: 14 }, // F: Banco de Pago
      { wch: 14 }, // G: Medio de Pago
      { wch: 14 }, // H: Monto
      { wch: 14 }, // I: Monto Total
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sol.Cheques");
    XLSX.writeFile(wb, `Sol_Cheques_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  };

  const exportExcelVerificador = () => {
    showToast('Generando Verificador de Pago...', 'success');
    
    // Group ALL employees by company, separating cheques vs transfers
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = { cheques: [], transfers: [] };
      if (String(e.tipo_de_pago).toLowerCase() === 'cheque') {
        comps[compName].cheques.push(e);
      } else {
        comps[compName].transfers.push(e);
      }
    });

    const fechaPago = group.closedAt ? new Date(group.closedAt).toLocaleDateString('es-GT') : new Date().toLocaleDateString('es-GT');

    // 10 columns: A=Nombre, B=Empresa, C=Tipo Personal, D=LOTE A ELIMINAR, E=LOTE CORRECTO, F=Soporte, G=Banco Pago, H=Medio Pago, I=Monto, J=Monto Total
    const E = ['', '', '', '', '', '', '', '', '', ''];
    const aoa = [];

    // Row 1: GRUPO ECONSA
    aoa.push(['GRUPO ECONSA', ...E.slice(1)]);
    // Row 2: VERIFICADOR DE PAGO DE NOMINA
    aoa.push(['VERIFICADOR DE PAGO DE NOMINA', ...E.slice(1)]);
    // Row 3: FECHA DE PAGO: ... date offset to col D
    aoa.push(['FECHA DE PAGO:', '', '', fechaPago, '', '', '', '', '', '']);
    // Row 4: Column headers
    aoa.push(['Nombre de\nColaborador', 'Empresa', 'Tipo de\nPersonal', 'LOTE A\nELIMINAR', 'LOTE\nCORRECTO', 'Soporte', 'Banco\nde Pago', 'Medio de\nPago', 'Monto', 'Monto\nTotal']);

    let grandTotal = 0;

    Object.keys(comps).forEach(compName => {
      const compData = comps[compName];
      if (compData.cheques.length === 0 && compData.transfers.length === 0) return;

      // Company header
      aoa.push([`Empresa:   ${compName.toUpperCase()}`, ...E.slice(1)]);

      // Consolidated transfer row: "Varios Plantilla"
      if (compData.transfers.length > 0) {
        const sumTransfers = compData.transfers.reduce((acc, e) => acc + e.calculated.net, 0);
        aoa.push([
          'Varios Plantilla',
          '',
          '',
          '',
          '',
          'Nomina',
          '',
          'Transferencia',
          `Q ${sumTransfers.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          ''
        ]);
        grandTotal += sumTransfers;
      }

      // Individual cheque rows
      let chequeSubtotal = 0;
      compData.cheques.forEach(e => {
        aoa.push([
          getEmployeeFullName(e),
          compName.toUpperCase(),
          e.puesto || 'FIJO',
          '',
          '',
          '',
          '',
          'CHEQUE',
          `Q ${e.calculated.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          ''
        ]);
        chequeSubtotal += e.calculated.net;
        grandTotal += e.calculated.net;
      });

      // Cheque subtotal in "Monto Total" column (J) if there are cheques
      if (compData.cheques.length > 0) {
        aoa.push(['', '', '', '', '', '', '', '', '', `Q${chequeSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      }
    });

    // Empty rows before TOTAL GENERAL
    aoa.push([...E]);
    aoa.push([...E]);
    // TOTAL GENERAL row
    aoa.push(['', '', '', '', '', '', 'TOTAL GENERAL', '', '', '']);
    // Grand total value row
    aoa.push(['', '', '', '', '', '', '', '', 'Q', grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })]);
    // Empty rows
    aoa.push([...E]);
    aoa.push([...E]);
    // Signature row 1
    aoa.push(['Hecho por:   Alejandra Pérez', '', '', '', '', '', 'Revisado por: Iris de Lemus (Recursos Humanos)', '', '', '']);
    // Empty rows
    aoa.push([...E]);
    aoa.push([...E]);
    // Signature row 2
    aoa.push(['Revisado por: Walter Mendez (Auditoria)', '', '', '', '', '', 'Autorizado por: Gerardo Estrada (Presidencia)', '', '', '']);
    // Empty row
    aoa.push([...E]);
    // Note row
    aoa.push(['', '', 'Nota: Transferencia programada para', '', `${fechaPago} INMEDIATO`, '', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths matching image proportions
    ws['!cols'] = [
      { wch: 36 }, // A: Nombre de Colaborador
      { wch: 16 }, // B: Empresa
      { wch: 14 }, // C: Tipo de Personal
      { wch: 14 }, // D: LOTE A ELIMINAR
      { wch: 14 }, // E: LOTE CORRECTO
      { wch: 12 }, // F: Soporte
      { wch: 14 }, // G: Banco de Pago
      { wch: 16 }, // H: Medio de Pago
      { wch: 14 }, // I: Monto
      { wch: 14 }, // J: Monto Total
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Verificador de pago");
    XLSX.writeFile(wb, `Verificador_Pagos_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  };

  const exportExcelIgss = () => {
    showToast('Generando Recibo e IGSS...', 'success');
    
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = [];
      comps[compName].push(e);
    });

    const wb = XLSX.utils.book_new();
    
    Object.keys(comps).forEach(compName => {
      const rows = comps[compName].map((e, idx) => {
        const anticipo = e.anticipo1ra || 0;
        const net = e.calculated.net;
        const q1 = group.periodType === '2da' ? anticipo : net;
        const q2 = group.periodType === '2da' ? net - anticipo : 0;
        const totalIngresos = e.calculated.gross + (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.otrosIngresos || 0);

        return {
          'No.': idx + 1,
          'NOMBRE EN NOMINA': getEmployeeFullName(e),
          'NUMERO DE CUENTA': e.no_cuenta || '',
          'NOMBRE EN BANCO': getEmployeeFullName(e),
          'PUESTO': e.puesto || 'N/A',
          'Dias laborados': e.days || 30,
          'Salario ordinario': e.calculated.baseSalary,
          'bono': e.calculated.bonusLey + e.calculated.bonusDec + e.calculated.bonos,
          'horas simples': e.extras?.simplesQty || 0,
          'total  horas simples': e.extras?.simplesVal || 0,
          'horas dobles': e.extras?.doblesQty || 0,
          'total horas dobles': e.extras?.doblesVal || 0,
          'otros ingresos': e.extras?.otrosIngresos || 0,
          'total ingresos': totalIngresos,
          'igss': e.deductions?.igss || 0,
          'isr': e.deductions?.isr || 0,
          'bantrab': e.deductions?.bancos || 0,
          'celular': e.deductions?.cell || 0,
          'UNIFORME': e.deductions?.uniform || 0,
          'CALZADO': e.deductions?.shoes || 0,
          'CAFETERIA': e.deductions?.cafe || 0,
          'otros egresos': (e.deductions?.otros || 0) + (e.deductions?.judiciales || 0) + (e.deductions?.seguro || 0) + (e.deductions?.parqueo || 0) + (e.deductions?.boleto_de_ornato || 0) + (e.deductions?.otros_egresos || 0),
          'total egresos': e.calculated.ded,
          'LIQUIDO A RECIBIR': net,
          'PRIMERA QUINCENA': q1,
          'SEGUNDA QUINCENA': q2,
          'NUMERO DE AFILIACION': e.no_igss || '',
          'SALARIO AFECTO A IGSS': e.calculated.baseSalary
        };
      });
      
      const ws = XLSX.utils.json_to_sheet(rows);
      let sheetName = compName.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      if (!sheetName) sheetName = "Empresa";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `Recibo_IGSS_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  };

  const exportExcelLibroSalarios = () => {
    showToast('Generando Libro de Salarios...', 'success');
    
    // Agrupar por empresa para hojas separadas (opcional, o todo junto)
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = [];
      comps[compName].push(e);
    });

    const wb = XLSX.utils.book_new();

    Object.keys(comps).forEach(compName => {
      let counter = 1;
      const rows = comps[compName].map(e => {
        const net = e.calculated?.net || 0;
        const base = e.salario_base || 0;
        const devengado = e.calculated?.proportionalSalary || 0;
        const isr = e.calculated?.isr || 0;
        const igss = e.calculated?.igss || 0;
        const bono = e.calculated?.bono || e.bono_incentivo || 0;
        const anticipo = e.calculated?.deduction_anticipo || 0;
        const otherDed = e.calculated?.deduction_other || 0;
        const totalDed = e.calculated?.totalDeductions || 0;
        const totalDev = e.calculated?.gross || 0;
        const horasExtra = e.calculated?.extraHoursAmt || 0;
        const days = e.calculated?.workedDays || 15;

        return {
          'No.': counter++,
          'Nombre Completo': getEmployeeFullName(e),
          'Puesto / Ocupación': e.puesto || '',
          'Sueldo Ordinario Base': base,
          'Días Trabajados': days,
          'Sueldo Devengado': devengado,
          'Horas Extras': horasExtra,
          'Bonificación Incentivo': bono,
          'Total Devengado': totalDev,
          'Descuento IGSS': igss,
          'Descuento ISR': isr,
          'Otros Descuentos': anticipo + otherDed,
          'Total Descuentos': totalDed,
          'Sueldo Líquido a Recibir': net,
          'Firma del Empleado': '_______________________'
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      // Widths
      ws['!cols'] = [
        { wch: 5 },  // No.
        { wch: 35 }, // Nombre
        { wch: 20 }, // Puesto
        { wch: 15 }, // Base
        { wch: 12 }, // Dias
        { wch: 15 }, // Sueldo dev.
        { wch: 15 }, // Horas
        { wch: 15 }, // Bono
        { wch: 15 }, // Total dev
        { wch: 15 }, // IGSS
        { wch: 15 }, // ISR
        { wch: 15 }, // Otros Desc
        { wch: 15 }, // Total Desc
        { wch: 18 }, // Liquido
        { wch: 30 }, // Firma
      ];

      let sheetName = compName.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      if (!sheetName) sheetName = "Empresa";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `Libro_Salarios_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  };

  const cleanName = (name) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, "").toUpperCase();
  const getConcept = () => `pago salario de ${group.periodType === '2da' ? '2DA' : '1RA'} quincena ${group.title.replace(/[^a-zA-Z0-9 ]/g, '')}`;

  const exportPlantillaPromerica = () => {
    showToast('Generando Plantilla Promerica...', 'success');
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = [];
      comps[compName].push(e);
    });

    const wb = XLSX.utils.book_new();

    Object.keys(comps).forEach(compName => {
      const aoa = [];
      const concepto = getConcept();
      let totalPlantilla = 0;
      let totalCheques = 0;
      
      const transfers = comps[compName].filter(e => String(e.tipo_de_pago).toLowerCase() !== 'cheque');
      const cheques = comps[compName].filter(e => String(e.tipo_de_pago).toLowerCase() === 'cheque');

      transfers.forEach(e => {
        const net = e.calculated?.net || 0;
        totalPlantilla += net;
        aoa.push([
          e.numero_cuenta || '',
          cleanName(getEmployeeFullName(e)),
          net.toFixed(2),
          concepto
        ]);
      });

      aoa.push(['', '', '']); // empty row
      aoa.push(['', 'Total Plantilla de ' + compName.toUpperCase(), totalPlantilla.toFixed(2), '']);
      aoa.push(['', '', '']); // empty row

      if (cheques.length > 0) {
        cheques.forEach(e => {
          const net = e.calculated?.net || 0;
          totalCheques += net;
          aoa.push([
            'CHEQUE',
            cleanName(getEmployeeFullName(e)),
            net.toFixed(2),
            concepto
          ]);
        });
        aoa.push(['', '', '']);
        aoa.push(['', 'Total Cheques', totalCheques.toFixed(2), '']);
      }
      
      aoa.push(['', '', '']);
      aoa.push(['', 'Total Nómina', (totalPlantilla + totalCheques).toFixed(2), '']);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 50 }];
      
      let sheetName = compName.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      if (!sheetName) sheetName = "Empresa";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `Plantilla_Promerica_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  };

  const exportPlantillaIndustrial = () => {
    showToast('Generando Plantilla Industrial...', 'success');
    const comps = {};
    data.forEach(e => {
      const compName = companies?.find(c => c.id == e.empresa_principal)?.nombre_comercial || e.company || 'Sin Empresa';
      if (!comps[compName]) comps[compName] = [];
      comps[compName].push(e);
    });

    const wb = XLSX.utils.book_new();

    Object.keys(comps).forEach(compName => {
      const aoa = [];
      const concepto = getConcept();
      let totalPlantilla = 0;
      let totalCheques = 0;
      let correlativo = 1;
      
      const transfers = comps[compName].filter(e => String(e.tipo_de_pago).toLowerCase() !== 'cheque');
      const cheques = comps[compName].filter(e => String(e.tipo_de_pago).toLowerCase() === 'cheque');

      transfers.forEach(e => {
        const net = e.calculated?.net || 0;
        totalPlantilla += net;
        const ind = e.tipo_cuenta?.toLowerCase() === 'ahorro' ? 2 : 1;
        aoa.push([
          ind,
          e.numero_cuenta || '',
          correlativo++,
          cleanName(getEmployeeFullName(e)),
          net.toFixed(2),
          concepto
        ]);
      });

      aoa.push(['', '', '', '', '']); // empty row
      aoa.push(['', '', 'TOTAL PLANTILLA', totalPlantilla.toFixed(2), '']);
      aoa.push(['', '', '', '', '']); // empty row

      if (cheques.length > 0) {
        cheques.forEach(e => {
          const net = e.calculated?.net || 0;
          totalCheques += net;
          aoa.push([
            1, // Assuming 1 for checks
            'CHEQUE',
            correlativo++,
            cleanName(getEmployeeFullName(e)),
            net.toFixed(2),
            concepto
          ]);
        });
        aoa.push(['', '', '', '', '']);
        aoa.push(['', '', 'TOTAL CHEQUES', totalCheques.toFixed(2), '']);
      }
      
      aoa.push(['', '', '', '', '']);
      aoa.push(['', '', 'Total Nómina', (totalPlantilla + totalCheques).toFixed(2), '']);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 50 }];
      
      let sheetName = compName.substring(0, 31).replace(/[\\/*?:[\]]/g, '');
      if (!sheetName) sheetName = "Empresa";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `Plantilla_Industrial_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
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
      pdf.save(`Boleta_${getEmployeeFullName(selectedVoucherEmp).replace(/[^a-z0-9]/gi, '_')}.pdf`);
    } catch (err) {
      showToast('Error al generar PDF', 'error');
    }
  };

  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const theadBg = useColorModeValue('gray.100', 'gray.900');
  const tdBg = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');



  return (
    <Box p={{ base: 3, md: 6, lg: 8 }} sx={{ '@media print': { p: 0 } }}>
      {/* Screen-only content */}
      <Box sx={{ '@media print': { display: 'none' } }}>
      {/* Header */}
      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} mb={6} wrap="wrap" gap={4}>
        <Flex align="center" gap={4}>
          <IconButton aria-label="Back" icon={<ArrowLeft size={20} />} onClick={onBack} variant="ghost" />
          <Box>
            <Flex align="center" gap={{ base: 2, md: 3 }} flexWrap="wrap">
              <Heading size={{ base: 'sm', md: 'md' }} fontWeight={800}>{group.title}</Heading>
              <Badge colorScheme="green" variant="subtle" fontWeight={700}>Cerrada</Badge>
              <Badge colorScheme={group.periodType === '2da' ? 'purple' : 'teal'} variant="subtle" fontWeight={700}>
                {group.periodType === '2da' ? '2da Quincena' : '1ra Quincena'}
              </Badge>
            </Flex>
            <Text fontSize="sm" color="gray.500">
              {data.length} empleados procesados en este periodo
            </Text>
          </Box>
        </Flex>
        <Flex gap={2} wrap="wrap">
          <Menu>
            <MenuButton as={Button} colorScheme="green" leftIcon={<Download size={16} />} rightIcon={<ChevronDown size={16} />} size={{ base: 'sm', md: 'md' }}>
              <Text display={{ base: 'none', sm: 'inline' }}>Exportar Excel</Text>
              <Text display={{ base: 'inline', sm: 'none' }}>Excel</Text>
            </MenuButton>
            <MenuList zIndex={50} shadow="lg">
              <MenuItem onClick={exportExcel}>Nómina General</MenuItem>
              <MenuItem onClick={exportExcelCheques}>Sol. Cheques</MenuItem>
              <MenuItem onClick={exportExcelVerificador}>Verificador de Pagos</MenuItem>
              <MenuItem onClick={exportExcelIgss}>Recibo e IGSS</MenuItem>
              <MenuItem onClick={exportExcelLibroSalarios} fontWeight="bold" color="purple.500">Libro de Salarios</MenuItem>
              <Divider my={1} />
              <MenuItem onClick={exportPlantillaPromerica} color="green.600" fontWeight="bold">Plantilla Banco Promerica</MenuItem>
              <MenuItem onClick={exportPlantillaIndustrial} color="blue.600" fontWeight="bold">Plantilla Banco Industrial</MenuItem>
            </MenuList>
          </Menu>
          <Menu>
            <MenuButton as={Button} colorScheme="red" leftIcon={<FileText size={16} />} rightIcon={<ChevronDown size={16} />} size={{ base: 'sm', md: 'md' }}>
              <Text display={{ base: 'none', sm: 'inline' }}>Reportería PDF</Text>
              <Text display={{ base: 'inline', sm: 'none' }}>PDF</Text>
            </MenuButton>
            <MenuList zIndex={50} shadow="lg">
              <MenuItem onClick={() => handleOpenPreview('verificador')} fontWeight="bold">Verificador de Pago</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('cheques')}>Solicitud de Cheques</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('nomina')}>Nómina General</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('igss')}>Recibo e IGSS</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('libro')} color="purple.500" fontWeight="bold">Libro de Salarios</MenuItem>
              <Divider my={1} />
              <MenuItem onClick={() => handleOpenPreview('promerica')} color="green.600" fontWeight="bold">Plantilla Banco Promerica</MenuItem>
              <MenuItem onClick={() => handleOpenPreview('industrial')} color="blue.600" fontWeight="bold">Plantilla Banco Industrial</MenuItem>
            </MenuList>
          </Menu>
          <Button colorScheme="purple" leftIcon={<FileText size={16} />} onClick={() => window.print()} size={{ base: 'sm', md: 'md' }}>
            Imprimir Boletas (PDF)
          </Button>
        </Flex>
      </Flex>

      {/* Filters bar */}
      <Flex gap={{ base: 2, md: 4 }} wrap="wrap" mb={4} align={{ base: 'stretch', md: 'center' }} justify="space-between" direction={{ base: 'column', md: 'row' }}>
        <HStack spacing={{ base: 2, md: 3 }} wrap="wrap" flex="1">
          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterDept.length > 0 ? `${filterDept.length} Deptos...` : 'Departamento...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterDept} onChange={setFilterDept}>
                {(departments || []).map(d => (
                  <MenuItemOption key={d.id} value={d.nombre_dimension} fontSize="sm">{d.nombre_dimension}</MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>

          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterArea.length > 0 ? `${filterArea.length} Áreas...` : 'Área...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterArea} onChange={setFilterArea}>
                {(areas || []).map(a => (
                  <MenuItemOption key={a.id} value={String(a.id)} fontSize="sm">{a.nombre}</MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>

          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterDiv.length > 0 ? `${filterDiv.length} Divisiones...` : 'División...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterDiv} onChange={setFilterDiv}>
                {(divisions || []).map(d => (
                  <MenuItemOption key={d.id} value={String(d.id)} fontSize="sm">{d.nombre}</MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>

          <Menu closeOnSelect={false}>
            <MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDown size={14}/>} w={{ base: '100%', sm: '180px' }} textAlign="left" fontWeight="normal" bg={tdBg} borderRadius="md" px={3}>
              {filterSubdiv.length > 0 ? `${filterSubdiv.length} Subdiv...` : 'Subdivisión...'}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" zIndex={100} boxShadow="lg">
              <MenuOptionGroup type="checkbox" value={filterSubdiv} onChange={setFilterSubdiv}>
                {(subdivisions || []).map(s => (
                  <MenuItemOption key={s.id} value={String(s.id)} fontSize="sm">{s.nombre}</MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>
          
          <Select 
            placeholder="Estado..." 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            w={{ base: '100%', sm: '120px' }}
            size="sm"
            borderRadius="md"
          >
            <option value="ALL">Todos</option>
            <option value="Activo">Activo</option>
            <option value="De Baja">De Baja</option>
          </Select>
        </HStack>

        <HStack maxW={{ base: '100%', lg: '600px' }} spacing={{ base: 2, md: 3 }} w={{ base: '100%', md: 'auto' }} flexWrap={{ base: 'wrap', lg: 'nowrap' }}>
          <InputGroup size="sm" w={{ base: '100%', lg: '300px' }}>
            <InputLeftElement pointerEvents="none">
              <Search size={14} color="gray.400" />
            </InputLeftElement>
            <Input 
              placeholder="Buscar por nombre o puesto..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              bg={tdBg}
              borderRadius="md"
            />
          </InputGroup>
          <ButtonGroup size="sm" isAttached variant="outline">
            <Button 
              isActive={viewMode === 'summary'} 
              onClick={() => setViewMode('summary')}
              bg={viewMode === 'summary' ? 'brand.500' : tdBg}
              color={viewMode === 'summary' ? 'white' : 'inherit'}
              _hover={{ bg: viewMode === 'summary' ? 'brand.600' : hoverBg }}
            >
              Vista Resumen
            </Button>
            <Button 
              isActive={viewMode === 'detailed'} 
              onClick={() => setViewMode('detailed')}
              bg={viewMode === 'detailed' ? 'brand.500' : tdBg}
              color={viewMode === 'detailed' ? 'white' : 'inherit'}
              _hover={{ bg: viewMode === 'detailed' ? 'brand.600' : hoverBg }}
            >
              Vista Detallada
            </Button>
          </ButtonGroup>
        </HStack>
      </Flex>

      {/* Summary strip */}
      <Flex 
        p={{ base: 4, md: 6 }} 
        mb={6} 
        borderRadius="xl" 
        border="1px solid" 
        borderColor={borderColor} 
        gap={{ base: 4, md: 8 }} 
        direction={{ base: 'column', sm: 'row' }}
        wrap="wrap" 
        align={{ base: 'stretch', sm: 'center' }}
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

      {groupedData.map((groupData, gIdx) => {
        const groupTotals = calculateGroupTotals(groupData.data, group.periodType);
        return (
          <Box key={gIdx} mb={8}>
            {groupData.title && (
              <Flex align="center" justify="space-between" mb={3} p={3} bg="blue.50" _dark={{ bg: 'blue.900' }} borderRadius="md" borderLeft="4px solid" borderColor="brand.500">
                <Heading size="sm" color="brand.700" _dark={{ color: 'brand.200' }}>{groupData.title}</Heading>
                <Badge colorScheme="blue" variant="solid">{groupData.data.length} Empleados</Badge>
              </Flex>
            )}
            <Box border="1px solid" borderColor={borderColor} borderRadius="xl" overflowX="auto" overflowY="auto" bg={tdBg} maxH="550px">
        <Table variant="simple" size="sm" layout="fixed" style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content' }}>
          <Thead position="sticky" top={0} zIndex={15}>
            <Tr bg={theadBg}>
              <Th minW="60px" w="60px" position="sticky" left={0} zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">No.</Th>
              <Th minW="200px" w="200px" position="sticky" left="60px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Nombre Empleado</Th>
              <Th minW="120px" w="120px" position="sticky" left="260px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Empresa</Th>
              <Th minW="120px" w="120px" position="sticky" left="380px" zIndex={20} bg={theadBg} borderRight="1px solid" borderColor={borderColor} borderBottom="2px solid" borderBottomColor="brand.500" boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="10px">Puesto</Th>
              
              <Th minW="75px" w="75px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Días Lab.</Th>
              <Th minW="120px" w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">S. Ordinario</Th>
              {viewMode === 'detailed' && (
                <>
                  <Th minW="120px" w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bon. Incentivo</Th>
                  <Th minW="140px" w="140px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bono Dec. 37-2001</Th>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Bonos</Th>
                  <Th minW="120px" w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">T. Devengado</Th>
                  <Th minW="80px" w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Simples</Th>
                  <Th minW="110px" w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Simp</Th>
                  <Th minW="80px" w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Hrs Dobles</Th>
                  <Th minW="110px" w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Val Hrs Dobl</Th>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">Otros Ingr.</Th>
                </>
              )}
              <Th minW="130px" w="130px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="gold.500">Salario Total</Th>
              
              {viewMode === 'detailed' && (
                <>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">IGSS</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">ISR</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Cafetería</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Celular</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Uniforme</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Calzado</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Equipo</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Producto</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Bancos</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Otros</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Judiciales</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Seguro</Th>
                  <Th minW="95px" w="95px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Parqueo</Th>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Bol. Ornato</Th>
                  <Th minW="100px" w="100px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.400">Otros Egr.</Th>
                </>
              )}
              <Th minW="130px" w="130px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="red.500">Total Egresos</Th>
              
              <Th minW="120px" w="120px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" color="brand.500">Liquido a Recibir</Th>
              {group.periodType === '2da' && (
                <>
                  <Th minW="110px" w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">1ra Quincena</Th>
                  <Th minW="110px" w="110px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px">2da Quincena</Th>
                </>
              )}
              <Th minW="80px" w="80px" bg={theadBg} borderBottom="2px solid" borderBottomColor="brand.500" fontSize="10px" textAlign="center">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {groupData.data.map((e, idx) => {
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
                    {getEmployeeFullName(e)}
                  </Td>
                  <Td position="sticky" left="260px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} fontSize="xs" isTruncated maxW="120px">
                    {e.company || 'Sin empresa'}
                  </Td>
                  <Td position="sticky" left="380px" zIndex={5} bg={tdBg} borderRight="1px solid" borderColor={borderColor} boxShadow="4px 0 8px -4px rgba(0,0,0,0.15)" fontSize="xs" isTruncated maxW="120px">
                    {e.puesto || 'Sin Puesto'}
                  </Td>

                  <Td fontSize="xs">{e.days || 30}</Td>
                  <Td fontFamily="mono" fontSize="xs">{formatQ(baseSalary)}</Td>
                  {viewMode === 'detailed' && (
                    <>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(bonusLey)}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(bonusDec)}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(bonos)}</Td>
                      <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(gross)}</Td>
                      
                      <Td fontSize="xs">{e.extras?.simplesQty || 0}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(e.extras?.simplesVal || 0)}</Td>
                      <Td fontSize="xs">{e.extras?.doblesQty || 0}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(e.extras?.doblesVal || 0)}</Td>
                      <Td fontFamily="mono" fontSize="xs">{formatQ(e.extras?.otrosIngresos || 0)}</Td>
                    </>
                  )}
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(gross + (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.otrosIngresos || 0) - (baseSalary + bonusLey + bonusDec + bonos))}</Td>

                  {viewMode === 'detailed' && (
                    <>
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
                    </>
                  )}
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(ded)}</Td>
                  
                  <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(net)}</Td>
                  {is2da && (
                    <>
                      <Td fontFamily="mono" fontSize="xs" color="gray.500">{formatQ(q1)}</Td>
                      <Td fontFamily="mono" fontSize="xs" fontWeight="bold" color="green.500">{formatQ(q2)}</Td>
                    </>
                  )}
                  
                  <Td textAlign="center">
                    <HStack spacing={1} justify="center">
                      <IconButton 
                        aria-label="Ver Resumen" 
                        icon={<Eye size={15} />} 
                        size="xs" 
                        colorScheme="gray" 
                        variant="ghost"
                        title="Ver detalle de pago"
                        onClick={() => setSelectedSummaryEmp(e)} 
                      />
                      <IconButton 
                        aria-label="Ver Boleta" 
                        icon={<FileText size={15} />} 
                        size="xs" 
                        colorScheme="brand" 
                        variant="ghost"
                        title="Ver boleta de pago"
                        onClick={() => setSelectedVoucherEmp(e)} 
                      />
                    </HStack>
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
              
              <Th>{groupData.data.length} Empleados</Th>
              <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totSalarioOrd)}</Th>
              {viewMode === 'detailed' && (
                <>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totBonInc)}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totBonDec)}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totBonos)}</Th>
                  <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(groupTotals.totDevengado)}</Th>
                  
                  <Th>{groupTotals.totHorasSimples}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totValSimple)}</Th>
                  <Th>{groupTotals.totHorasDobles}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totValDouble)}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totOtrosIngresos)}</Th>
                </>
              )}
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="gold.500">{formatQ(groupTotals.totSalarioTotal)}</Th>
              
              {viewMode === 'detailed' && (
                <>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totIgss)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totIsr)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totCafe)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totCell)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totUniform)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totShoes)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totEquipo)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totProduct)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totBancos)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totOtros)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totJudiciales)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totSeguro)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totParqueo)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totBoleta)}</Th>
                  <Th fontFamily="mono" fontSize="xs" color="red.400">{formatQ(groupTotals.totOtrosEgresos)}</Th>
                </>
              )}
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="red.500">{formatQ(groupTotals.totTotalEgresos)}</Th>
              
              <Th fontFamily="mono" fontSize="xs" fontWeight="bold" color="brand.500">{formatQ(groupTotals.totLiquido)}</Th>
              {group.periodType === '2da' && (
                <>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totQuincena1)}</Th>
                  <Th fontFamily="mono" fontSize="xs">{formatQ(groupTotals.totQuincena2)}</Th>

                </>
              )}
              <Th></Th>
            </Tr>
          </Thead>
        </Table>
        </Box>
          </Box>
        );
      })}

      {/* Voucher slip display Modal */}
      {selectedVoucherEmp && (
        <Modal isOpen={!!selectedVoucherEmp} onClose={() => setSelectedVoucherEmp(null)} size={{ base: 'full', md: 'xl' }}>
          <ModalOverlay />
          <ModalContent borderRadius="xl">
            <ModalHeader fontWeight={800} borderBottom="1px solid" borderColor={borderColor}>
              Boleta de Pago
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody p={0} bg="white">
              {/* Captured printable voucher container */}
              <Box id="voucher-content" p={{ base: 4, md: 8 }}>
                <BoletaTemplate emp={selectedVoucherEmp} group={group} />
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

      {/* Hidden Print Container for Bulk Export */}
      <Box display="none" sx={{ '@media print': { display: 'block', bg: 'white', color: 'black' } }}>
        {(() => {
          const allPrintableEmployees = groupedData.flatMap(g => g.data);
          if (allPrintableEmployees.length === 0) return null;
          const chunks = [];
          for (let i = 0; i < allPrintableEmployees.length; i += 2) {
            chunks.push(allPrintableEmployees.slice(i, i + 2));
          }
          return chunks.map((chunk, idx) => (
            <Box 
              key={`page-${idx}`} 
              sx={{ 
                pageBreakAfter: idx === chunks.length - 1 ? 'auto' : 'always',
                pageBreakInside: 'avoid',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                p: 0,
                pt: 4
              }}
            >
              {/* Top Half: Employee 1 */}
              <Flex gap={8} w="100%" h="48%">
                <Box flex={1} border="1px solid #ddd" borderRadius="md" p={4}><BoletaTemplate emp={chunk[0]} group={group} isPrint /></Box>
                <Box flex={1} border="1px solid #ddd" borderRadius="md" p={4}><BoletaTemplate emp={chunk[0]} group={group} isPrint /></Box>
              </Flex>
              
              {/* Divider */}
              <Divider borderStyle="dashed" borderColor="gray.400" my={4} />
              
              {/* Bottom Half: Employee 2 (if exists) */}
              {chunk[1] ? (
                <Flex gap={8} w="100%" h="48%">
                  <Box flex={1} border="1px solid #ddd" borderRadius="md" p={4}><BoletaTemplate emp={chunk[1]} group={group} isPrint /></Box>
                  <Box flex={1} border="1px solid #ddd" borderRadius="md" p={4}><BoletaTemplate emp={chunk[1]} group={group} isPrint /></Box>
                </Flex>
              ) : (
                <Flex gap={8} w="100%" h="48%" opacity={0}></Flex>
              )}
            </Box>
          ));
        })()}
      </Box>

      <ReportPreviewModal 
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        reportType={previewReportType}
        group={group}
        data={data}
        companies={companies}
      />
      <EmployeeSummaryModal
        isOpen={!!selectedSummaryEmp}
        onClose={() => setSelectedSummaryEmp(null)}
        employee={selectedSummaryEmp}
        companies={companies}
        periodType={group?.periodType}
      />
    </Box>
  );
}

function BoletaTemplate({ emp, group, isPrint }) {
  if (!emp) return null;

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
    <Box w="100%" fontFamily="sans-serif">
      <Flex justify="space-between" borderBottom="2px solid" borderColor="gray.200" pb={3} mb={4}>
        <Box>
          <Heading size="sm" fontWeight={800} color="gray.900">
            {emp.company}
          </Heading>
          <Text fontSize="2xs" color="gray.500" mt={1}>
            Recibo de Pago de Planilla
          </Text>
        </Box>
        <VStack align="end" spacing={0}>
          <Text fontSize="xs" fontWeight={700} color="gray.700">
            Periodo: {group.title}
          </Text>
          <Text fontSize="2xs" color="gray.500">
            Fecha de Pago: {new Date(group.date).toLocaleDateString()}
          </Text>
        </VStack>
      </Flex>

      <Flex justify="space-between" mb={4} wrap="wrap" gap={2}>
        <Box>
          <Text fontSize="8px" color="gray.400" textTransform="uppercase" letterSpacing="wider">Empleado</Text>
          <Text fontSize="sm" fontWeight={800} color="gray.900">
            {getEmployeeFullName(emp)}
          </Text>
          <Text fontSize="2xs" color="gray.600">
            Puesto: {emp.puesto || 'N/A'}
          </Text>
        </Box>
        <VStack align="end" spacing={0}>
          <Text fontSize="8px" color="gray.400" textTransform="uppercase" letterSpacing="wider">Depósito Bancario</Text>
          <Text fontSize="2xs" fontWeight={700} color="gray.900">
            {emp.banco || 'N/A'} - {emp.no_cuenta || 'N/A'}
          </Text>
          <Text fontSize="2xs" color="gray.600">
            Afiliación IGSS: {emp.no_igss || 'N/A'}
          </Text>
        </VStack>
      </Flex>

      <SimpleGrid columns={2} spacing={6} mb={4}>
        {/* Income column */}
        <Box>
          <Heading size="2xs" borderBottom="1px solid" borderColor="gray.200" pb={1} mb={2} color="gray.900">
            Ingresos
          </Heading>
          <VStack align="stretch" spacing={1} fontSize="2xs">
            <Flex justify="space-between">
              <Text>Salario Ordinario</Text>
              <Text fontFamily="mono" fontWeight={600}>{formatQ(emp.calculated.baseSalary)}</Text>
            </Flex>
            <Flex justify="space-between">
              <Text>Bono Incentivo (Ley)</Text>
              <Text fontFamily="mono" fontWeight={600}>{formatQ(emp.calculated.bonusLey)}</Text>
            </Flex>
            <Flex justify="space-between">
              <Text>Bono Decreto 37-2001</Text>
              <Text fontFamily="mono" fontWeight={600}>{formatQ(emp.calculated.bonusDec)}</Text>
            </Flex>
            {emp.calculated.bonos > 0 && (
              <Flex justify="space-between">
                <Text>Otros Bonos</Text>
                <Text fontFamily="mono" fontWeight={600}>{formatQ(emp.calculated.bonos)}</Text>
              </Flex>
            )}
            {emp.calculated.extrasTotal > 0 && (
              <Flex justify="space-between">
                <Text>Horas Extras y Otros</Text>
                <Text fontFamily="mono" fontWeight={600}>{formatQ(emp.calculated.extrasTotal)}</Text>
              </Flex>
            )}
            <Flex justify="space-between" borderTop="1px dashed" borderColor="gray.300" pt={1} fontWeight={700} color="gray.900">
              <Text>Total Ingresos</Text>
              <Text fontFamily="mono">{formatQ(emp.calculated.gross)}</Text>
            </Flex>
          </VStack>
        </Box>

        {/* Deductions column */}
        <Box>
          <Heading size="2xs" borderBottom="1px solid" borderColor="gray.200" pb={1} mb={2} color="gray.900">
            Deducciones
          </Heading>
          <VStack align="stretch" spacing={1} fontSize="2xs">
            {Object.entries(emp.deductions || {}).map(([key, val]) => {
              const numVal = Number(val) || 0;
              if (numVal <= 0) return null;
              
              return (
                <Flex justify="space-between" key={key} color="red.600">
                  <Text>{labelMap[key] || key}</Text>
                  <Text fontFamily="mono" fontWeight={600}>{formatQ(numVal)}</Text>
                </Flex>
              );
            })}
            <Flex justify="space-between" borderTop="1px dashed" borderColor="gray.300" pt={1} fontWeight={700} color="red.600">
              <Text>Total Egresos</Text>
              <Text fontFamily="mono">{formatQ(emp.calculated.ded)}</Text>
            </Flex>
          </VStack>
        </Box>
      </SimpleGrid>

      {/* Net Pay Box */}
      <Flex bg="gray.100" p={2} borderRadius="md" justify="space-between" align="center" mb={6}>
        <Text fontSize="xs" fontWeight={800} color="gray.900">LÍQUIDO A RECIBIR</Text>
        <Text fontFamily="mono" fontSize="md" fontWeight={900} color="green.500">
          {formatQ(emp.calculated.net)}
        </Text>
      </Flex>

      {/* Signature Lines */}
      <Flex justify="space-between" align="end" mt={isPrint ? 4 : 8} pt={4} borderTop="1px solid" borderColor="gray.100" direction="row" gap={4}>
        <Box w="150px" textAlign="center">
          <Box borderBottom="1px solid" borderColor="gray.400" h="20px" />
          <Text fontSize="8px" color="gray.400" mt={1}>Firma del Empleado</Text>
        </Box>
        <Text fontSize="7px" color="gray.400">
          Generado el {new Date().toLocaleDateString()}
        </Text>
      </Flex>
    </Box>
  );
}

function SummaryStat({ label, value, color, large }) {
  return (
    <Box>
      <Text fontSize={{ base: '2xs', md: 'xs' }} fontWeight={600} color="gray.500" textTransform="uppercase" letterSpacing="0.05em" mb={1}>
        {label}
      </Text>
      <Text fontFamily="mono" fontWeight={800} fontSize={large ? { base: 'xl', md: '2xl' } : { base: 'lg', md: 'xl' }} color={color || 'gold.500'} letterSpacing="-0.02em">
        {value}
      </Text>
    </Box>
  );
}
