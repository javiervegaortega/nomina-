import React, { useContext } from 'react';
import {
  Box, Flex, SimpleGrid, Heading, Text, Button, Card, CardBody,
  HStack, VStack, Center, useColorModeValue, Icon,
} from '@chakra-ui/react';
import {
  DollarSign, Users, TrendingUp, ArrowUpRight, ArrowDownRight,
  Building2, Clock, CheckCircle, AlertTriangle, BarChart3,
  Briefcase, PieChart,
} from 'lucide-react';
import { DataContext } from '../context/DataContext';
import { formatQ } from '../data/mockData';

export default function Dashboard() {
  const { employees, companies, payrollHistory } = useContext(DataContext);

  const EMPLOYEES = employees;
  const COMPANIES = companies;

  // Computed stats
  const totalEmployees = EMPLOYEES.length;
  const activeEmployees = EMPLOYEES.filter(e => e.status === 'active' || e.status === 'ACTIVO' || e.estado === 'Activo').length;
  const totalGrossPayroll = EMPLOYEES.reduce((s, e) => s + (Number(e.sueldo_ordinario) || 0) + (Number(e.bon_incentivo) || 0), 0);
  const totalDeductions = EMPLOYEES.reduce((s, e) => s + (Number(e.total_igss) || 0) + (Number(e.isr) || 0), 0);
  const totalNetPay = totalGrossPayroll - totalDeductions;

  const companyDistribution = COMPANIES.map(c => {
    const total = EMPLOYEES.reduce((s, e) => {
      const pct = (e.dist?.[c.id] || 0) / 100;
      const base = (Number(e.sueldo_ordinario) || 0) + (Number(e.bon_incentivo) || 0);
      return s + (base * pct);
    }, 0);
    return { ...c, total };
  }).sort((a, b) => b.total - a.total);
  const maxCompanyTotal = companyDistribution.length ? companyDistribution[0].total : 1;

  const deptGroups = {};
  EMPLOYEES.forEach(e => {
    const dept = e.departamento_laboral || 'Sin Depto';
    if (!deptGroups[dept]) deptGroups[dept] = { count: 0, cost: 0 };
    deptGroups[dept].count++;
    deptGroups[dept].cost += (Number(e.sueldo_ordinario) || 0) + (Number(e.bon_incentivo) || 0);
  });
  const deptList = Object.entries(deptGroups).sort((a, b) => b[1].cost - a[1].cost).slice(0, 6);
  const maxDeptCost = deptList.length ? deptList[0][1].cost : 1;

  // Theme-aware colors
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

  return (
    <Box px={{ base: 4, md: 8 }} py={{ base: 4, md: 6 }}>
      {/* Header */}
      <Flex
        justify="space-between"
        align="center"
        mb={8}
        flexWrap="wrap"
        gap={4}
      >
        <Box>
          <Heading size="lg" fontWeight={800}>
            Dashboard
          </Heading>
          <Text color={subtitleColor} mt={1}>
            Resumen general de nómina y costos operativos
          </Text>
        </Box>
        <HStack spacing={3}>
          <Button
            variant="glass"
            leftIcon={<Clock size={16} />}
            size="md"
          >
            Período
          </Button>
          <Button
            colorScheme="brand"
            leftIcon={<BarChart3 size={16} />}
            size="md"
          >
            Reporte
          </Button>
        </HStack>
      </Flex>

      {/* KPI Cards */}
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={5} mb={8}>
        <KpiCard
          icon={<DollarSign size={24} />}
          iconBg="rgba(255, 184, 0, 0.15)"
          iconColor="#FFB800"
          glowColor="rgba(255, 184, 0, 0.3)"
          label="Costo Bruto Nómina"
          value={formatQ(totalGrossPayroll)}
          trend="+2.4%" trendDir="up"
        />
        <KpiCard
          icon={<TrendingUp size={24} />}
          iconBg="rgba(16, 185, 129, 0.15)"
          iconColor="#10B981"
          glowColor="rgba(16, 185, 129, 0.3)"
          label="Neto a Pagar"
          value={formatQ(totalNetPay)}
          trend="+1.8%" trendDir="up"
        />
        <KpiCard
          icon={<Users size={24} />}
          iconBg="rgba(59, 130, 246, 0.15)"
          iconColor="#3B82F6"
          glowColor="rgba(59, 130, 246, 0.3)"
          label="Total Empleados"
          value={totalEmployees}
          trend={`${activeEmployees} activos`} trendDir="up"
        />
        <KpiCard
          icon={<AlertTriangle size={24} />}
          iconBg="rgba(239, 68, 68, 0.15)"
          iconColor="#EF4444"
          glowColor="rgba(239, 68, 68, 0.3)"
          label="Total Deducciones"
          value={formatQ(totalDeductions)}
          trend="−0.5%" trendDir="down"
        />
      </SimpleGrid>

      {/* Charts Row */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5} mb={8}>
        {/* Company Distribution */}
        <Card bg={cardBg} borderColor={borderColor} borderRadius="xl">
          <CardBody p={6}>
            <Flex align="center" justify="space-between" mb={5}>
              <HStack spacing={2}>
                <Box color="brand.400">
                  <Building2 size={18} />
                </Box>
                <Heading size="sm" fontWeight={700}>
                  Distribución por Empresa
                </Heading>
              </HStack>
              <Text fontSize="xs" color={subtitleColor}>
                {COMPANIES.length} empresas
              </Text>
            </Flex>

            <VStack spacing={4} align="stretch">
              {companyDistribution.map((c) => (
                <Box key={c.id}>
                  <Flex justify="space-between" align="center" mb={1}>
                    <HStack spacing={2}>
                      <Box
                        w="10px"
                        h="10px"
                        borderRadius="full"
                        bg={c.color || 'brand.500'}
                        boxShadow={`0 0 8px ${c.color || '#3B82F6'}60`}
                      />
                      <Text fontSize="sm" fontWeight={600}>
                        {c.nombre_comercial || c.nit}
                      </Text>
                    </HStack>
                    <Text fontSize="sm" fontFamily="mono" fontWeight={700} color={accentTextColor}>
                      {formatQ(c.total)}
                    </Text>
                  </Flex>
                  <Box h="6px" borderRadius="full" bg={barTrackBg} overflow="hidden">
                    <Box
                      h="100%"
                      bg={c.color || 'brand.500'}
                      w={`${maxCompanyTotal > 0 ? (c.total / maxCompanyTotal) * 100 : 0}%`}
                      transition="width 1s ease-out"
                      borderRadius="full"
                    />
                  </Box>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Department Cost */}
        <Card bg={cardBg} borderColor={borderColor} borderRadius="xl">
          <CardBody p={6}>
            <Flex align="center" justify="space-between" mb={5}>
              <HStack spacing={2}>
                <Box color="brand.400">
                  <Briefcase size={18} />
                </Box>
                <Heading size="sm" fontWeight={700}>
                  Costo por Departamento
                </Heading>
              </HStack>
            </Flex>

            <VStack spacing={3} align="stretch">
              {deptList.map(([dept, data]) => (
                <Flex key={dept} align="center" gap={3}>
                  <Center
                    w="32px"
                    h="32px"
                    borderRadius="lg"
                    bg={deptCountBg}
                    color={deptCountColor}
                    border="1px solid"
                    borderColor={borderColor}
                    fontSize="0.8rem"
                    fontWeight={700}
                    flexShrink={0}
                  >
                    {data.count}
                  </Center>
                  <Box flex={1} minW={0}>
                    <Flex justify="space-between" mb={1}>
                      <Text fontSize="sm" fontWeight={600} isTruncated>
                        {dept}
                      </Text>
                      <Text fontSize="xs" fontFamily="mono" fontWeight={700} color={accentTextColor} flexShrink={0} ml={2}>
                        {formatQ(data.cost)}
                      </Text>
                    </Flex>
                    <Box h="4px" borderRadius="full" bg={barTrackBg} overflow="hidden">
                      <Box
                        h="100%"
                        bg={barLightBg}
                        w={`${(data.cost / maxDeptCost) * 100}%`}
                        transition="width 1s ease-out"
                        borderRadius="full"
                      />
                    </Box>
                  </Box>
                </Flex>
              ))}
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Recent Activity + Quick Stats */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
        {/* Recent Activity */}
        <Card bg={cardBg} borderColor={borderColor} borderRadius="xl">
          <CardBody p={6}>
            <Heading size="sm" fontWeight={700} mb={4}>
              Actividad Reciente
            </Heading>
            <VStack spacing={0} align="stretch">
              {[
                { icon: <CheckCircle size={16} />, color: '#10B981', text: 'Nómina 2da Quincena cerrada y aprobada', time: 'Hace 2 horas' },
                { icon: <Users size={16} />, color: '#3B82F6', text: 'Ajuste de distribución — Presidencia', time: 'Hace 5 horas' },
                { icon: <AlertTriangle size={16} />, color: '#F59E0B', text: 'Horas extras pendientes — Control de Calidad', time: 'Ayer' },
                { icon: <DollarSign size={16} />, color: '#8B5CF6', text: 'Nuevo empleado registrado en el sistema', time: 'Hace 3 días' },
              ].map((item, i) => (
                <Flex
                  key={i}
                  align="center"
                  gap={3}
                  py={3}
                  borderBottom={i < 3 ? '1px solid' : 'none'}
                  borderColor={activityBorder}
                  transition="all 0.2s"
                  _hover={{ bg: summaryItemBg, borderRadius: 'lg', px: 2, mx: -2 }}
                >
                  <Center
                    w="32px"
                    h="32px"
                    borderRadius="full"
                    bg={`${item.color}15`}
                    color={item.color}
                    flexShrink={0}
                  >
                    {item.icon}
                  </Center>
                  <Box flex={1} minW={0}>
                    <Text fontSize="sm" fontWeight={600}>
                      {item.text}
                    </Text>
                    <Text fontSize="xs" color={subtitleColor}>
                      {item.time}
                    </Text>
                  </Box>
                </Flex>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Quick Summary */}
        <Card bg={cardBg} borderColor={borderColor} borderRadius="xl">
          <CardBody p={6}>
            <HStack spacing={2} mb={4}>
              <Box color="brand.400">
                <PieChart size={18} />
              </Box>
              <Heading size="sm" fontWeight={700}>
                Resumen Rápido
              </Heading>
            </HStack>
            <VStack spacing={3} align="stretch">
              {[
                { label: 'Salario promedio', value: formatQ(totalEmployees > 0 ? totalGrossPayroll / totalEmployees : 0) },
                { label: 'Costo patronal estimado', value: formatQ(totalGrossPayroll * 0.1267) },
                { label: 'Nóminas procesadas', value: payrollHistory?.length || 0 },
                { label: 'Empresas activas', value: COMPANIES.length },
              ].map((item, i) => (
                <Flex
                  key={i}
                  justify="space-between"
                  align="center"
                  p={3}
                  bg={summaryItemBg}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor={borderColor}
                  transition="all 0.2s"
                  _hover={{ borderColor: 'brand.500', boxShadow: 'sm' }}
                >
                  <Text fontSize="sm" color={subtitleColor}>
                    {item.label}
                  </Text>
                  <Text
                    fontSize="sm"
                    fontFamily="mono"
                    fontWeight={700}
                    color={typeof item.value === 'string' && item.value.includes('Q') ? accentTextColor : undefined}
                  >
                    {item.value}
                  </Text>
                </Flex>
              ))}
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  );
}

function KpiCard({ icon, iconBg, iconColor, glowColor, label, value, trend, trendDir }) {
  const cardBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const labelColor = useColorModeValue('gray.500', 'gray.400');
  const valueColor = useColorModeValue('accent.700', 'accent.300');
  const hoverShadow = useColorModeValue(
    '0 20px 40px rgba(0,0,0,0.08)',
    '0 20px 40px rgba(0,0,0,0.4)'
  );

  const isMonetary = typeof value === 'string' && value.includes('Q');

  return (
    <Box
      position="relative"
      bg={cardBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      p={5}
      overflow="hidden"
      transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      _hover={{
        transform: 'translateY(-3px)',
        boxShadow: hoverShadow,
        borderColor: iconColor,
      }}
      _before={{
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '3px',
        bgGradient: `linear(to-r, ${iconColor}, transparent)`,
      }}
    >
      <Flex justify="space-between" align="flex-start">
        <Box>
          <Text
            fontSize="xs"
            color={labelColor}
            fontWeight={600}
            textTransform="uppercase"
            letterSpacing="0.05em"
          >
            {label}
          </Text>
          <Text
            fontSize="xl"
            fontWeight={800}
            mt={2}
            mb={2}
            fontFamily={isMonetary ? 'mono' : undefined}
            color={isMonetary ? valueColor : undefined}
          >
            {value}
          </Text>
          <HStack
            spacing={1}
            color={trendDir === 'up' ? 'green.400' : 'red.400'}
          >
            {trendDir === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <Text fontSize="xs" fontWeight={600}>
              {trend}
            </Text>
          </HStack>
        </Box>
        <Center
          w="48px"
          h="48px"
          borderRadius="xl"
          bg={iconBg}
          color={iconColor}
          boxShadow={`0 0 20px ${glowColor}`}
          transition="all 0.3s"
          _groupHover={{ boxShadow: `0 0 30px ${glowColor}` }}
        >
          {icon}
        </Center>
      </Flex>
    </Box>
  );
}
