import { useCallback, useContext, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Collapse, Flex, FormControl, FormLabel, HStack, Heading,
  Input, InputGroup, InputLeftElement, Select, SimpleGrid, Table, Tbody, Td,
  Text, Th, Thead, Tr, useColorModeValue, VStack
} from '@chakra-ui/react';
import { ArrowLeft, Building2, CalendarDays, ChevronDown, Clock3, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataContext } from '../context/DataContext';
import { formatQ } from '../data/mockData';
import { formatQuincenaLabel } from '../utils/payrollPeriod';

function employeeName(employee) {
  if (!employee) return '—';
  return [
    employee.primer_nombre, employee.segundo_nombre, employee.otro_nombre,
    employee.primer_apellido, employee.segundo_apellido
  ].filter(Boolean).join(' ') || 'Empleado sin nombre';
}

const getLogDetail = (log) => (
  log.type === 'BONO'
    ? formatQ(log.bonusAmount)
    : `${Number(log.hoursQty) || 0} hora${Number(log.hoursQty) === 1 ? '' : 's'} ${String(log.hourType || '').toLowerCase()}`
);

export default function BonusesHistory() {
  const { operationLogs, companies, employees, payrollHistory } = useContext(DataContext);
  const navigate = useNavigate();
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCompany, setFilterCompany] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState([]);

  const bg = useColorModeValue('white', 'gray.800');
  const softBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
  const mutedText = useColorModeValue('gray.600', 'gray.400');
  const titleText = useColorModeValue('gray.800', 'white');
  const summaryBg = useColorModeValue('brand.50', 'rgba(2, 132, 199, 0.14)');

  const employeeById = useMemo(() => {
    const map = new Map();
    (employees || []).forEach((employee) => map.set(String(employee.id), employee));
    return map;
  }, [employees]);

  const closedPayrollIds = useMemo(() => (
    new Set(
      (payrollHistory || [])
        .filter((payroll) => payroll.status === 'cerrada')
        .map((payroll) => String(payroll.id))
    )
  ), [payrollHistory]);

  const rows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es');
    return (operationLogs || [])
      .filter((log) => log.status === 'PROCESSED_PAYROLL' && closedPayrollIds.has(String(log.periodAssigned || '')))
      .filter((log) => !filterMonth || String(log.date || '').startsWith(filterMonth))
      .filter((log) => filterCompany === 'ALL' || String(log.companyId) === String(filterCompany))
      .filter((log) => filterType === 'ALL' || log.type === filterType)
      .filter((log) => {
        if (!normalizedSearch) return true;
        const employee = log.Employee || employeeById.get(String(log.employeeId));
        return [employeeName(employee), log.taskDescription, log.date, log.type]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(normalizedSearch);
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [operationLogs, filterMonth, filterCompany, filterType, searchTerm, closedPayrollIds, employeeById]);

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((log) => {
      const company = log.companyData || (companies || []).find((item) => String(item.id) === String(log.companyId));
      const period = formatQuincenaLabel(log.date) || String(log.date || '').slice(0, 7);
      const key = `${period}|${log.companyId}`;
      if (!map.has(key)) {
        map.set(key, { key, period, company, latestDate: log.date, logs: [], bonusTotal: 0, hoursTotal: 0 });
      }
      const group = map.get(key);
      group.logs.push(log);
      group.bonusTotal += log.type === 'BONO' ? Number(log.bonusAmount) || 0 : 0;
      group.hoursTotal += log.type === 'HORA_EXTRA' ? Number(log.hoursQty) || 0 : 0;
      if (String(log.date) > String(group.latestDate)) group.latestDate = log.date;
    });
    return [...map.values()].sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate)));
  }, [rows, companies]);

  const totals = useMemo(() => ({
    operations: rows.length,
    bonuses: rows.filter((row) => row.type === 'BONO').reduce((sum, row) => sum + (Number(row.bonusAmount) || 0), 0),
    hours: rows.filter((row) => row.type === 'HORA_EXTRA').reduce((sum, row) => sum + (Number(row.hoursQty) || 0), 0)
  }), [rows]);

  const toggleGroup = useCallback((key) => {
    setExpandedGroups((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }, []);

  const clearFilters = () => {
    setFilterMonth('');
    setFilterCompany('ALL');
    setFilterType('ALL');
    setSearchTerm('');
  };

  const hasActiveFilters = Boolean(filterMonth || filterCompany !== 'ALL' || filterType !== 'ALL' || searchTerm);

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        mb={6}
        gap={4}
      >
        <HStack align="start" spacing={3}>
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={17} />} onClick={() => navigate('/operations')}>Volver</Button>
          <Box>
            <HStack color="brand.500" spacing={2} mb={1}>
              <CalendarDays size={18} />
              <Text fontSize="xs" fontWeight={800} letterSpacing="widest" textTransform="uppercase">Operaciones cerradas</Text>
            </HStack>
            <Heading size="lg" fontWeight={800} color={titleText}>Historial de operaciones</Heading>
            <Text color={mutedText} fontSize="sm" mt={1}>Consulta los movimientos ya aplicados a una nómina cerrada.</Text>
          </Box>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3} mb={5}>
        <Box bg={bg} borderWidth="1px" borderColor={borderColor} borderRadius="xl" p={4}>
          <Text color={mutedText} fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="wide">Operaciones</Text>
          <Text fontSize="2xl" fontWeight={800} mt={1}>{totals.operations}</Text>
        </Box>
        <Box bg={summaryBg} borderWidth="1px" borderColor={borderColor} borderRadius="xl" p={4}>
          <Text color={mutedText} fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="wide">Bonos aplicados</Text>
          <Text fontSize="2xl" fontWeight={800} mt={1} color="green.400">{formatQ(totals.bonuses)}</Text>
        </Box>
        <Box bg={bg} borderWidth="1px" borderColor={borderColor} borderRadius="xl" p={4}>
          <Text color={mutedText} fontSize="xs" fontWeight={700} textTransform="uppercase" letterSpacing="wide">Horas extra</Text>
          <Text fontSize="2xl" fontWeight={800} mt={1} color="yellow.500">{totals.hours}</Text>
        </Box>
      </SimpleGrid>

      <Box bg={bg} borderWidth="1px" borderColor={borderColor} borderRadius="xl" shadow="sm" overflow="hidden">
        <Box p={{ base: 4, md: 5 }} bg={softBg} borderBottomWidth="1px" borderColor={borderColor}>
          <Flex justify="space-between" align={{ base: 'stretch', lg: 'end' }} direction={{ base: 'column', lg: 'row' }} gap={3}>
            <Box>
              <Heading size="sm" fontWeight={800}>Busca una operación</Heading>
              <Text fontSize="sm" color={mutedText} mt={1}>{groups.length} grupo{groups.length === 1 ? '' : 's'} por empresa y quincena</Text>
            </Box>
            <HStack spacing={2} align="end" flexWrap="wrap">
              <FormControl minW={{ base: '100%', sm: '230px' }}>
                <FormLabel fontSize="xs" mb={1} color={mutedText}>Buscar</FormLabel>
                <InputGroup size="sm">
                  <InputLeftElement pointerEvents="none"><Search size={15} /></InputLeftElement>
                  <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Empleado o tarea" bg={bg} />
                </InputGroup>
              </FormControl>
              <FormControl w={{ base: 'calc(50% - 4px)', sm: '155px' }}>
                <FormLabel fontSize="xs" mb={1} color={mutedText}>Mes</FormLabel>
                <Input type="month" size="sm" value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} bg={bg} />
              </FormControl>
              <FormControl w={{ base: 'calc(50% - 4px)', sm: '165px' }}>
                <FormLabel fontSize="xs" mb={1} color={mutedText}>Tipo</FormLabel>
                <Select size="sm" value={filterType} onChange={(event) => setFilterType(event.target.value)} bg={bg}>
                  <option value="ALL">Todos</option>
                  <option value="BONO">Bonos</option>
                  <option value="HORA_EXTRA">Horas extra</option>
                </Select>
              </FormControl>
              <FormControl w={{ base: '100%', sm: '210px' }}>
                <FormLabel fontSize="xs" mb={1} color={mutedText}>Empresa</FormLabel>
                <Select size="sm" value={filterCompany} onChange={(event) => setFilterCompany(event.target.value)} bg={bg}>
                  <option value="ALL">Todas las empresas</option>
                  {(companies || []).map((company) => (
                    <option key={company.id} value={company.id}>{company.nombre_comercial}</option>
                  ))}
                </Select>
              </FormControl>
              {hasActiveFilters && <Button size="sm" variant="ghost" leftIcon={<X size={15} />} onClick={clearFilters}>Limpiar</Button>}
            </HStack>
          </Flex>
        </Box>

        {groups.length === 0 ? (
          <VStack py={14} px={4} spacing={3} color={mutedText}>
            <CalendarDays size={40} opacity={0.35} />
            <Text fontWeight={700}>{hasActiveFilters ? 'No hay operaciones con estos filtros' : 'Aún no hay operaciones en nóminas cerradas'}</Text>
            {hasActiveFilters && <Button size="sm" variant="ghost" onClick={clearFilters}>Limpiar filtros</Button>}
          </VStack>
        ) : (
          <VStack spacing={0} align="stretch" divider={<Box borderBottomWidth="1px" borderColor={borderColor} />}>
            {groups.map((group) => {
              const isExpanded = expandedGroups.includes(group.key);
              return (
                <Box key={group.key}>
                  <Box
                    as="button"
                    type="button"
                    w="100%"
                    textAlign="left"
                    p={{ base: 4, md: 5 }}
                    cursor="pointer"
                    onClick={() => toggleGroup(group.key)}
                    _hover={{ bg: softBg }}
                    transition="background 0.2s"
                    aria-expanded={isExpanded}
                  >
                    <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
                      <HStack spacing={3} align="start">
                        <Flex w="36px" h="36px" borderRadius="lg" bg={summaryBg} color="brand.400" align="center" justify="center" flexShrink={0}><Building2 size={18} /></Flex>
                        <Box>
                          <HStack spacing={2} mb={1} flexWrap="wrap">
                            <Text fontWeight={800}>{group.company?.nombre_comercial || 'Empresa sin identificar'}</Text>
                            <Badge colorScheme="blue" borderRadius="full">Nómina cerrada</Badge>
                          </HStack>
                          <Text fontSize="sm" color={mutedText}>{group.period} · {group.logs.length} operación{group.logs.length === 1 ? '' : 'es'}</Text>
                        </Box>
                      </HStack>
                      <HStack spacing={{ base: 3, md: 5 }} align="center" w={{ base: '100%', md: 'auto' }} justify={{ base: 'space-between', md: 'flex-end' }}>
                        <Box>
                          <Text fontSize="xx-small" color={mutedText} textTransform="uppercase" fontWeight={700}>Bonos</Text>
                          <Text fontFamily="mono" fontSize="sm" fontWeight={700} color="green.400">{formatQ(group.bonusTotal)}</Text>
                        </Box>
                        <Box>
                          <Text fontSize="xx-small" color={mutedText} textTransform="uppercase" fontWeight={700}>Horas extra</Text>
                          <Text fontSize="sm" fontWeight={700}>{group.hoursTotal} h</Text>
                        </Box>
                        <Flex color="brand.400" transform={isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'} transition="transform 0.2s"><ChevronDown size={20} /></Flex>
                      </HStack>
                    </Flex>
                  </Box>

                  <Collapse in={isExpanded} animateOpacity>
                    <Box px={{ base: 3, md: 5 }} pb={{ base: 3, md: 5 }} bg={softBg}>
                      <Box display={{ base: 'none', md: 'block' }} borderWidth="1px" borderColor={borderColor} borderRadius="lg" overflow="hidden" bg={bg}>
                        <Table variant="modern" size="sm">
                          <Thead>
                            <Tr><Th>Fecha</Th><Th>Empleado</Th><Th>Tipo</Th><Th>Detalle</Th><Th>Tarea registrada</Th></Tr>
                          </Thead>
                          <Tbody>
                            {group.logs.map((log) => {
                              const employee = log.Employee || employeeById.get(String(log.employeeId));
                              const isBonus = log.type === 'BONO';
                              return (
                                <Tr key={log.id}>
                                  <Td whiteSpace="nowrap">{log.date ? String(log.date).slice(0, 10) : '—'}</Td>
                                  <Td fontWeight={650}>{employeeName(employee)}</Td>
                                  <Td><Badge colorScheme={isBonus ? 'green' : 'yellow'} borderRadius="full">{isBonus ? 'Bono' : 'Hora extra'}</Badge></Td>
                                  <Td fontFamily={isBonus ? 'mono' : undefined} fontWeight={isBonus ? 700 : 500}>{getLogDetail(log)}</Td>
                                  <Td maxW="360px"><Text noOfLines={2}>{log.taskDescription || '—'}</Text></Td>
                                </Tr>
                              );
                            })}
                          </Tbody>
                        </Table>
                      </Box>

                      <VStack display={{ base: 'flex', md: 'none' }} spacing={2} align="stretch">
                        {group.logs.map((log) => {
                          const employee = log.Employee || employeeById.get(String(log.employeeId));
                          const isBonus = log.type === 'BONO';
                          return (
                            <Box key={log.id} bg={bg} borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={3}>
                              <Flex justify="space-between" gap={3}>
                                <Box minW={0}>
                                  <Text fontWeight={750} noOfLines={1}>{employeeName(employee)}</Text>
                                  <Text fontSize="xs" color={mutedText} mt={1}>{log.date ? String(log.date).slice(0, 10) : '—'}</Text>
                                </Box>
                                <Badge alignSelf="start" colorScheme={isBonus ? 'green' : 'yellow'} borderRadius="full">{isBonus ? 'Bono' : 'Hora extra'}</Badge>
                              </Flex>
                              <HStack mt={3} spacing={2} color={isBonus ? 'green.400' : 'yellow.500'}>
                                <Clock3 size={15} />
                                <Text fontWeight={700} fontFamily={isBonus ? 'mono' : undefined}>{getLogDetail(log)}</Text>
                              </HStack>
                              {log.taskDescription && <Text fontSize="sm" mt={2} color={mutedText}>{log.taskDescription}</Text>}
                            </Box>
                          );
                        })}
                      </VStack>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </VStack>
        )}
      </Box>
    </Box>
  );
}
