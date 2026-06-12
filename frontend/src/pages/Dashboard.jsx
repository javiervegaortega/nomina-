import React, { useContext, useMemo, useState } from 'react';
import {
  Box, Flex, SimpleGrid, Heading, Text, Button, Card, CardBody,
  HStack, VStack, Center, useColorModeValue, Badge,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, FormControl, FormLabel, Select, Radio, RadioGroup, Stack,
  Divider, Skeleton, SkeletonText, SkeletonCircle,
} from '@chakra-ui/react';
import {
  DollarSign, Users, TrendingUp, ArrowUpRight, ArrowDownRight,
  Building2, Clock, CheckCircle, AlertTriangle, BarChart3,
  Briefcase, PieChart, FileSpreadsheet, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataContext } from '../context/DataContext';
import { formatQ } from '../data/mockData';
import {
  PERIOD_MODES,
  buildDashboardMetrics,
  computeHistoryTotals,
  getAvailableMonths,
  getPayrollDate,
  exportDashboardExcel,
  exportDashboardPdf,
} from '../utils/dashboardReports';

const DEFAULT_PERIOD = { mode: PERIOD_MODES.LATEST, month: '', payrollId: '' };

export default function Dashboard() {
  const { employees, companies, payrollHistory, departments, activePayrolls, isLoading } = useContext(DataContext);

  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [draftPeriod, setDraftPeriod] = useState(DEFAULT_PERIOD);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [exporting, setExporting] = useState(null);

  const EMPLOYEES = employees || [];
  const COMPANIES = companies || [];

  const metrics = useMemo(() => buildDashboardMetrics({
    period,
    payrollHistory,
    employees: EMPLOYEES,
    companies: COMPANIES,
    departments,
  }), [period, payrollHistory, EMPLOYEES, COMPANIES, departments]);

  const availableMonths = useMemo(() => getAvailableMonths(payrollHistory), [payrollHistory]);

  const payrollOptions = useMemo(() => {
    return [...(payrollHistory || [])]
      .sort((a, b) => getPayrollDate(b) - getPayrollDate(a))
      .map(r => ({
        id: r.id,
        label: `${r.title || 'Nómina'} — ${getPayrollDate(r).toLocaleDateString('es-GT')}`,
      }));
  }, [payrollHistory]);

  const historyTrend = useMemo(() => {
    const records = metrics.filteredRecords || [];
    if (records.length < 2) return null;
    const current = computeHistoryTotals(records[0]);
    const previous = computeHistoryTotals(records[1]);
    const grossPct = previous.grossTotal > 0 ? ((current.grossTotal - previous.grossTotal) / previous.grossTotal) * 100 : null;
    const netPct = previous.netTotal > 0 ? ((current.netTotal - previous.netTotal) / previous.netTotal) * 100 : null;
    const dedPct = previous.dedTotal > 0 ? ((current.dedTotal - previous.dedTotal) / previous.dedTotal) * 100 : null;
    return { grossPct, netPct, dedPct };
  }, [metrics.filteredRecords]);

  const formatTrend = (value, fallback) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return { text: fallback, dir: 'up' };
    }
    return { text: `${Math.abs(value).toFixed(1)}%`, dir: value >= 0 ? 'up' : 'down' };
  };

  const grossTrend = formatTrend(historyTrend?.grossPct, metrics.hasPayrollData ? `${metrics.payrollCount} nómina(s)` : `Basado en ${metrics.activeCount} empleados`);
  const netTrend = formatTrend(historyTrend?.netPct, metrics.hasPayrollData ? `${metrics.payrollCount} nómina(s)` : `Basado en ${metrics.activeCount} empleados`);
  const dedTrend = formatTrend(historyTrend?.dedPct, metrics.hasPayrollData ? `${metrics.payrollCount} nómina(s)` : `Basado en ${metrics.activeCount} empleados`);
  const employeesTrend = { text: `${metrics.activeCount} activos`, dir: metrics.activeCount > 0 ? 'up' : 'down' };

  const maxCompanyTotal = Math.max(
    ...metrics.companyDistribution.map(c => c.total),
    1
  );
  const maxDeptCost = metrics.deptList.length ? metrics.deptList[0][1].cost : 1;

  const getEmployeeName = (e) => {
    const first = e.primer_nombre || e.nombres || '';
    const last = e.primer_apellido || e.apellidos || '';
    return `${first} ${last}`.trim() || e.name || 'Empleado';
  };

  const formatRelative = (value) => {
    if (!value) return 'Fecha no disponible';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    return `Hace ${diffD} dias`;
  };

  const activityItems = useMemo(() => {
    const items = [];

    const historySorted = [...(payrollHistory || [])].sort((a, b) => {
      return getPayrollDate(b) - getPayrollDate(a);
    }).slice(0, 2);

    historySorted.forEach(h => {
      const title = h.title || (h.periodType === '2da' ? '2da Quincena' : '1ra Quincena') || 'Nómina';
      items.push({
        icon: <CheckCircle size={16} />,
        color: '#10B981',
        text: `Nómina "${title}" cerrada`,
        time: formatRelative(h.closedAt || h.createdAt),
        sortDate: getPayrollDate(h).getTime(),
      });
    });

    (activePayrolls || []).slice(0, 2).forEach(p => {
      items.push({
        icon: <Clock size={16} />,
        color: '#F59E0B',
        text: `Borrador activo: ${p.title || 'Nómina en proceso'}`,
        time: formatRelative(p.createdAt),
        sortDate: new Date(p.createdAt || 0).getTime(),
      });
    });

    [...EMPLOYEES]
      .filter(e => e.fecha_inicio)
      .sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime())
      .slice(0, 2)
      .forEach(e => {
        items.push({
          icon: <Users size={16} />,
          color: '#3B82F6',
          text: `Alta de ${getEmployeeName(e)}`,
          time: formatRelative(e.fecha_inicio),
          sortDate: new Date(e.fecha_inicio).getTime(),
        });
      });

    [...EMPLOYEES]
      .filter(e => e.fecha_baja)
      .sort((a, b) => new Date(b.fecha_baja).getTime() - new Date(a.fecha_baja).getTime())
      .slice(0, 1)
      .forEach(e => {
        items.push({
          icon: <AlertTriangle size={16} />,
          color: '#EF4444',
          text: `Baja de ${getEmployeeName(e)}`,
          time: formatRelative(e.fecha_baja),
          sortDate: new Date(e.fecha_baja).getTime(),
        });
      });

    if (!items.length) {
      return [{ icon: <Clock size={16} />, color: '#94A3B8', text: 'Sin actividad reciente', time: '—' }];
    }

    return items
      .sort((a, b) => (b.sortDate || 0) - (a.sortDate || 0))
      .slice(0, 4)
      .map(({ icon, color, text, time }) => ({ icon, color, text, time }));
  }, [payrollHistory, activePayrolls, EMPLOYEES]);

  const openPeriodModal = () => {
    const initial = { ...period };
    if (initial.mode === PERIOD_MODES.MONTH && !initial.month && availableMonths.length) {
      initial.month = availableMonths[0];
    }
    if (initial.mode === PERIOD_MODES.PAYROLL && !initial.payrollId && payrollOptions.length) {
      initial.payrollId = payrollOptions[0].id;
    }
    setDraftPeriod(initial);
    setShowPeriodModal(true);
  };

  const applyPeriod = () => {
    setPeriod({ ...draftPeriod });
    setShowPeriodModal(false);
    toast.success('Período actualizado', { description: 'El dashboard refleja el nuevo filtro.' });
  };

  const handleExportExcel = () => {
    setExporting('excel');
    try {
      exportDashboardExcel(metrics, metrics.periodLabel);
      toast.success('Reporte Excel generado');
      setShowReportModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el Excel');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      await exportDashboardPdf(metrics, metrics.periodLabel);
      toast.success('Reporte PDF generado');
      setShowReportModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el PDF');
    } finally {
      setExporting(null);
    }
  };

  const cardBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const subtitleColor = useColorModeValue('gray.500', 'gray.400');
  const barTrackBg = useColorModeValue('gray.100', 'whiteAlpha.100');
  const barLightBg = useColorModeValue('brand.200', 'brand.400');
  const accentTextColor = useColorModeValue('accent.600', 'accent.300');
  const summaryItemBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const activityBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const deptCountBg = useColorModeValue('gray.100', 'whiteAlpha.100');
  const deptCountColor = useColorModeValue('gray.600', 'gray.300');
  const modalBg = useColorModeValue('white', 'gray.800');

  if (isLoading) {
    return (
      <Box px={{ base: 3, md: 6, lg: 8 }} py={{ base: 3, md: 6, lg: 8 }}>
        <Flex justify="space-between" align="center" mb={8}>
          <Box>
            <Skeleton h="28px" w="200px" mb={2} borderRadius="md" />
            <Skeleton h="16px" w="350px" borderRadius="md" />
          </Box>
          <HStack spacing={3}>
            <Skeleton h="40px" w="100px" borderRadius="lg" />
            <Skeleton h="40px" w="100px" borderRadius="lg" />
          </HStack>
        </Flex>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={5} mb={8}>
          {[1,2,3,4].map(i => (
            <Box key={i} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" p={5}>
              <Flex justify="space-between" align="flex-start">
                <Box flex={1}>
                  <Skeleton h="12px" w="120px" mb={3} />
                  <Skeleton h="24px" w="150px" mb={2} />
                  <Skeleton h="12px" w="80px" />
                </Box>
                <SkeletonCircle size="48px" />
              </Flex>
            </Box>
          ))}
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} mb={8}>
          {[1,2].map(i => (
            <Box key={i} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" p={6}>
              <Skeleton h="18px" w="200px" mb={5} />
              <VStack spacing={4} align="stretch">
                {[1,2,3].map(j => (
                  <Box key={j}>
                    <Flex justify="space-between" mb={1}>
                      <Skeleton h="14px" w="120px" />
                      <Skeleton h="14px" w="80px" />
                    </Flex>
                    <Skeleton h="6px" borderRadius="full" />
                  </Box>
                ))}
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
          {[1,2].map(i => (
            <Box key={i} bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" p={6}>
              <Skeleton h="18px" w="180px" mb={4} />
              <VStack spacing={3} align="stretch">
                {[1,2,3,4].map(j => (
                  <Skeleton key={j} h="44px" borderRadius="lg" />
                ))}
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    );
  }

  return (
    <Box px={{ base: 3, md: 6, lg: 8 }} py={{ base: 3, md: 6, lg: 8 }}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} mb={8} flexWrap="wrap" gap={4}>
        <Box>
          <HStack spacing={3} mb={1}>
            <Heading size="lg" fontWeight={800}>Dashboard</Heading>
            <Badge colorScheme="brand" variant="subtle" fontSize="xs" px={2} py={1} borderRadius="md">
              {metrics.periodLabel}
            </Badge>
          </HStack>
          <Text color={subtitleColor} mt={1}>
            {metrics.hasPayrollData
              ? `Mostrando ${metrics.payrollCount} nómina(s) del período seleccionado`
              : 'Mostrando datos actuales de empleados activos'}
          </Text>
        </Box>
        <HStack spacing={3}>
          <Button variant="glass" leftIcon={<Clock size={16} />} size="md" onClick={openPeriodModal}>
            Período
          </Button>
          <Button colorScheme="brand" leftIcon={<BarChart3 size={16} />} size="md" onClick={() => setShowReportModal(true)}>
            Reporte
          </Button>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={5} mb={8}>
        <KpiCard icon={<DollarSign size={24} />} iconBg="rgba(255, 184, 0, 0.15)" iconColor="#FFB800" glowColor="rgba(255, 184, 0, 0.3)" label="Costo Bruto Nómina" value={formatQ(metrics.totalGrossPayroll)} trend={grossTrend.text} trendDir={grossTrend.dir} />
        <KpiCard icon={<TrendingUp size={24} />} iconBg="rgba(16, 185, 129, 0.15)" iconColor="#10B981" glowColor="rgba(16, 185, 129, 0.3)" label="Neto a Pagar" value={formatQ(metrics.totalNetPay)} trend={netTrend.text} trendDir={netTrend.dir} />
        <KpiCard icon={<Users size={24} />} iconBg="rgba(59, 130, 246, 0.15)" iconColor="#3B82F6" glowColor="rgba(59, 130, 246, 0.3)" label="Total Empleados" value={metrics.totalEmployees} trend={employeesTrend.text} trendDir={employeesTrend.dir} />
        <KpiCard icon={<AlertTriangle size={24} />} iconBg="rgba(239, 68, 68, 0.15)" iconColor="#EF4444" glowColor="rgba(239, 68, 68, 0.3)" label="Total Deducciones" value={formatQ(metrics.totalDeductions)} trend={dedTrend.text} trendDir={dedTrend.dir} />
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} mb={8}>
        <Card bg={cardBg} borderColor={borderColor} borderRadius="xl">
          <CardBody p={{ base: 4, md: 6 }}>
            <Flex align="center" justify="space-between" mb={5}>
              <HStack spacing={2}>
                <Box color="brand.400"><Building2 size={18} /></Box>
                <Heading size="sm" fontWeight={700}>Distribución por Empresa</Heading>
              </HStack>
              <Text fontSize="xs" color={subtitleColor}>{COMPANIES.length} empresas</Text>
            </Flex>
            <VStack spacing={4} align="stretch">
              {metrics.companyDistribution.length ? metrics.companyDistribution.map((c) => (
                <Box key={c.id}>
                  <Flex justify="space-between" align="center" mb={1}>
                    <HStack spacing={2}>
                      <Box w="10px" h="10px" borderRadius="full" bg={c.color || 'brand.500'} boxShadow={`0 0 8px ${c.color || '#3B82F6'}60`} />
                      <Text fontSize="sm" fontWeight={600}>{c.nombre_comercial || c.nit}</Text>
                    </HStack>
                    <Text fontSize="sm" fontFamily="mono" fontWeight={700} color={accentTextColor}>{formatQ(c.total)}</Text>
                  </Flex>
                  <Box h="6px" borderRadius="full" bg={barTrackBg} overflow="hidden">
                    <Box h="100%" bg={c.color || 'brand.500'} w={`${maxCompanyTotal > 0 ? (c.total / maxCompanyTotal) * 100 : 0}%`} transition="width 1s ease-out" borderRadius="full" />
                  </Box>
                </Box>
              )) : (
                <Text fontSize="sm" color={subtitleColor} textAlign="center" py={4}>Sin datos para el período</Text>
              )}
            </VStack>
          </CardBody>
        </Card>

        <Card bg={cardBg} borderColor={borderColor} borderRadius="xl">
          <CardBody p={{ base: 4, md: 6 }}>
            <Flex align="center" justify="space-between" mb={5}>
              <HStack spacing={2}>
                <Box color="brand.400"><Briefcase size={18} /></Box>
                <Heading size="sm" fontWeight={700}>Costo por Departamento</Heading>
              </HStack>
            </Flex>
            <VStack spacing={3} align="stretch">
              {metrics.deptList.length ? metrics.deptList.map(([dept, data]) => (
                <Flex key={dept} align="center" gap={3}>
                  <Center w="32px" h="32px" borderRadius="lg" bg={deptCountBg} color={deptCountColor} border="1px solid" borderColor={borderColor} fontSize="0.8rem" fontWeight={700} flexShrink={0}>
                    {data.count}
                  </Center>
                  <Box flex={1} minW={0}>
                    <Flex justify="space-between" mb={1}>
                      <Text fontSize="sm" fontWeight={600} isTruncated>{dept}</Text>
                      <Text fontSize="xs" fontFamily="mono" fontWeight={700} color={accentTextColor} flexShrink={0} ml={2}>{formatQ(data.cost)}</Text>
                    </Flex>
                    <Box h="4px" borderRadius="full" bg={barTrackBg} overflow="hidden">
                      <Box h="100%" bg={barLightBg} w={`${maxDeptCost > 0 ? (data.cost / maxDeptCost) * 100 : 0}%`} transition="width 1s ease-out" borderRadius="full" />
                    </Box>
                  </Box>
                </Flex>
              )) : (
                <Text fontSize="sm" color={subtitleColor} textAlign="center" py={4}>Sin datos para el período</Text>
              )}
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
        <Card bg={cardBg} borderColor={borderColor} borderRadius="xl">
          <CardBody p={{ base: 4, md: 6 }}>
            <Heading size="sm" fontWeight={700} mb={4}>Actividad Reciente</Heading>
            <VStack spacing={0} align="stretch">
              {activityItems.map((item, i) => (
                <Flex key={i} align="center" gap={3} py={3} borderBottom={i < activityItems.length - 1 ? '1px solid' : 'none'} borderColor={activityBorder} transition="all 0.2s" _hover={{ bg: summaryItemBg, borderRadius: 'lg', px: 2, mx: -2 }}>
                  <Center w="32px" h="32px" borderRadius="full" bg={`${item.color}15`} color={item.color} flexShrink={0}>{item.icon}</Center>
                  <Box flex={1} minW={0}>
                    <Text fontSize="sm" fontWeight={600}>{item.text}</Text>
                    <Text fontSize="xs" color={subtitleColor}>{item.time}</Text>
                  </Box>
                </Flex>
              ))}
            </VStack>
          </CardBody>
        </Card>

        <Card bg={cardBg} borderColor={borderColor} borderRadius="xl">
          <CardBody p={{ base: 4, md: 6 }}>
            <HStack spacing={2} mb={4}>
              <Box color="brand.400"><PieChart size={18} /></Box>
              <Heading size="sm" fontWeight={700}>Resumen Rápido</Heading>
            </HStack>
            <VStack spacing={3} align="stretch">
              {[
                { label: 'Salario promedio', value: formatQ(metrics.avgSalary) },
                { label: 'Costo patronal estimado', value: formatQ(metrics.patronalCost) },
                { label: 'Nóminas en período', value: metrics.payrollCount || (metrics.hasPayrollData ? metrics.filteredRecords?.length : 0) },
                { label: 'Empleados inactivos', value: metrics.inactiveCount },
                { label: 'Empresas registradas', value: COMPANIES.length },
              ].map((item, i) => (
                <Flex key={i} justify="space-between" align="center" p={3} bg={summaryItemBg} borderRadius="lg" border="1px solid" borderColor={borderColor} transition="all 0.2s" _hover={{ borderColor: 'brand.500', boxShadow: 'sm' }}>
                  <Text fontSize="sm" color={subtitleColor}>{item.label}</Text>
                  <Text fontSize="sm" fontFamily="mono" fontWeight={700} color={typeof item.value === 'string' && item.value.includes('Q') ? accentTextColor : undefined}>{item.value}</Text>
                </Flex>
              ))}
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Modal Período */}
      <Modal isOpen={showPeriodModal} onClose={() => setShowPeriodModal(false)} size={{ base: 'full', md: 'md' }} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent bg={modalBg} borderRadius="xl">
          <ModalHeader fontWeight={700}>Seleccionar Período</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color={subtitleColor} mb={4}>
              Filtra los indicadores del dashboard según el rango de nóminas que necesites analizar.
            </Text>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight={600}>Tipo de período</FormLabel>
              <RadioGroup
                value={draftPeriod.mode}
                onChange={(val) => setDraftPeriod(p => ({ ...p, mode: val }))}
              >
                <Stack spacing={3}>
                  <Radio value={PERIOD_MODES.LATEST} colorScheme="brand">Última nómina cerrada</Radio>
                  <Radio value={PERIOD_MODES.MONTH} colorScheme="brand" isDisabled={!availableMonths.length}>Por mes calendario</Radio>
                  <Radio value={PERIOD_MODES.PAYROLL} colorScheme="brand" isDisabled={!payrollOptions.length}>Nómina específica</Radio>
                  <Radio value={PERIOD_MODES.ALL} colorScheme="brand" isDisabled={!payrollHistory?.length}>Todo el historial</Radio>
                  <Radio value={PERIOD_MODES.SNAPSHOT} colorScheme="brand">Datos actuales (empleados activos)</Radio>
                </Stack>
              </RadioGroup>
            </FormControl>

            {draftPeriod.mode === PERIOD_MODES.MONTH && (
              <FormControl mt={4}>
                <FormLabel fontSize="sm" fontWeight={600}>Mes</FormLabel>
                <Select
                  value={draftPeriod.month || availableMonths[0] || ''}
                  onChange={e => setDraftPeriod(p => ({ ...p, month: e.target.value }))}
                  borderRadius="lg"
                >
                  {availableMonths.map(m => {
                    const [y, mo] = m.split('-');
                    const d = new Date(Number(y), Number(mo) - 1, 1);
                    const label = d.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' });
                    return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>;
                  })}
                </Select>
              </FormControl>
            )}

            {draftPeriod.mode === PERIOD_MODES.PAYROLL && (
              <FormControl mt={4}>
                <FormLabel fontSize="sm" fontWeight={600}>Nómina</FormLabel>
                <Select
                  value={draftPeriod.payrollId || payrollOptions[0]?.id || ''}
                  onChange={e => setDraftPeriod(p => ({ ...p, payrollId: e.target.value }))}
                  borderRadius="lg"
                >
                  {payrollOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </Select>
              </FormControl>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setShowPeriodModal(false)}>Cancelar</Button>
            <Button colorScheme="brand" onClick={applyPeriod}>Aplicar período</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal Reporte */}
      <Modal isOpen={showReportModal} onClose={() => setShowReportModal(false)} size={{ base: 'full', md: 'md' }} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent bg={modalBg} borderRadius="xl">
          <ModalHeader fontWeight={700}>Generar Reporte</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Badge colorScheme="brand" mb={4}>{metrics.periodLabel}</Badge>
            <Text fontSize="sm" color={subtitleColor} mb={4}>
              Exporta un resumen ejecutivo con los KPIs, distribución por empresa y departamento
              {metrics.hasPayrollData ? ', incluyendo detalle de empleados de nómina' : ''}.
            </Text>
            <Divider mb={4} />
            <VStack spacing={3} align="stretch">
              <ReportPreviewRow label="Costo bruto" value={formatQ(metrics.totalGrossPayroll)} />
              <ReportPreviewRow label="Neto a pagar" value={formatQ(metrics.totalNetPay)} />
              <ReportPreviewRow label="Deducciones" value={formatQ(metrics.totalDeductions)} />
              <ReportPreviewRow label="Empresas en reporte" value={metrics.companyDistribution.length} />
              <ReportPreviewRow label="Departamentos" value={metrics.deptList.length} />
            </VStack>
          </ModalBody>
          <ModalFooter flexWrap="wrap" gap={2}>
            <Button
              variant="outline"
              leftIcon={<FileSpreadsheet size={16} />}
              onClick={handleExportExcel}
              isLoading={exporting === 'excel'}
              loadingText="Generando..."
            >
              Excel
            </Button>
            <Button
              colorScheme="brand"
              leftIcon={<FileText size={16} />}
              onClick={handleExportPdf}
              isLoading={exporting === 'pdf'}
              loadingText="Generando..."
            >
              PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

function ReportPreviewRow({ label, value }) {
  const subtitleColor = useColorModeValue('gray.500', 'gray.400');
  return (
    <Flex justify="space-between" align="center">
      <Text fontSize="sm" color={subtitleColor}>{label}</Text>
      <Text fontSize="sm" fontWeight={700} fontFamily="mono">{value}</Text>
    </Flex>
  );
}

function KpiCard({ icon, iconBg, iconColor, glowColor, label, value, trend, trendDir }) {
  const cardBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const labelColor = useColorModeValue('gray.500', 'gray.400');
  const valueColor = useColorModeValue('accent.700', 'accent.300');
  const hoverShadow = useColorModeValue('0 20px 40px rgba(0,0,0,0.08)', '0 20px 40px rgba(0,0,0,0.4)');
  const isMonetary = typeof value === 'string' && value.includes('Q');

  return (
    <Box position="relative" bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="xl" p={{ base: 4, md: 5 }} overflow="hidden" transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" _hover={{ boxShadow: hoverShadow, borderColor: iconColor }} _before={{ content: '""', position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', bgGradient: `linear(to-r, ${iconColor}, transparent)` }}>
      <Flex justify="space-between" align="flex-start">
        <Box>
          <Text fontSize="xs" color={labelColor} fontWeight={600} textTransform="uppercase" letterSpacing="0.05em">{label}</Text>
          <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight={800} mt={2} mb={2} fontFamily={isMonetary ? 'mono' : undefined} color={isMonetary ? valueColor : undefined}>{value}</Text>
          <HStack spacing={1} color={trendDir === 'up' ? 'green.400' : 'red.400'}>
            {trendDir === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <Text fontSize="xs" fontWeight={600}>{trend}</Text>
          </HStack>
        </Box>
        <Center w={{ base: '40px', md: '48px' }} h={{ base: '40px', md: '48px' }} borderRadius="xl" bg={iconBg} color={iconColor} boxShadow={`0 0 20px ${glowColor}`}>{icon}</Center>
      </Flex>
    </Box>
  );
}
