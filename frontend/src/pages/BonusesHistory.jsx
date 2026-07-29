import React, { useContext, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Flex, FormControl, FormLabel, HStack, Heading,
  Input, Select, Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue
} from '@chakra-ui/react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataContext } from '../context/DataContext';
import { formatQ } from '../data/mockData';
import { formatQuincenaLabel } from '../utils/payrollPeriod';

function employeeName(employee) {
  if (!employee) return '—';
  return [
    employee.primer_nombre, employee.segundo_nombre, employee.otro_nombre,
    employee.primer_apellido, employee.segundo_apellido
  ].filter(Boolean).join(' ');
}

export default function BonusesHistory() {
  const { operationLogs, companies, employees, payrollHistory } = useContext(DataContext);
  const navigate = useNavigate();
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCompany, setFilterCompany] = useState('ALL');

  const bg = useColorModeValue('white', 'gray.800');
  const theadBg = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');

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
    let list = (operationLogs || []).filter((log) => (
      log.status === 'PROCESSED_PAYROLL'
      && closedPayrollIds.has(String(log.periodAssigned || ''))
    ));
    if (filterMonth) {
      list = list.filter((log) => log.date && String(log.date).startsWith(filterMonth));
    }
    if (filterCompany !== 'ALL') {
      list = list.filter((log) => String(log.companyId) === String(filterCompany));
    }
    return list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [operationLogs, filterMonth, filterCompany, closedPayrollIds]);

  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((log) => {
      const company = log.companyData
        || (companies || []).find((item) => String(item.id) === String(log.companyId));
      const period = formatQuincenaLabel(log.date) || String(log.date || '').slice(0, 7);
      const key = `${period}|${log.companyId}`;
      if (!map.has(key)) {
        map.set(key, { key, period, company, latestDate: log.date, logs: [] });
      }
      const group = map.get(key);
      group.logs.push(log);
      if (String(log.date) > String(group.latestDate)) group.latestDate = log.date;
    });
    return [...map.values()].sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate)));
  }, [rows, companies]);

  const totalBonuses = rows
    .filter((row) => row.type === 'BONO')
    .reduce((sum, row) => sum + (Number(row.bonusAmount) || 0), 0);

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        mb={6}
        gap={4}
      >
        <Flex align="center" gap={3}>
          <Button variant="ghost" leftIcon={<ArrowLeft size={18} />} onClick={() => navigate('/operations')}>
            Volver
          </Button>
          <Box>
            <Heading size="lg" fontWeight={800}>Historial de Operaciones</Heading>
            <Text color="gray.500" fontSize="sm">
              Operaciones incluidas en nóminas ya cerradas, por empresa y quincena
            </Text>
          </Box>
        </Flex>
        <Text fontSize="sm" fontWeight={600}>
          {rows.length} operación(es) cerrada(s) · Bonos {formatQ(totalBonuses)}
        </Text>
      </Flex>

      <HStack mb={4} spacing={4} bg={bg} p={4} borderRadius="lg" shadow="sm" flexWrap="wrap">
        <FormControl w="180px">
          <FormLabel fontSize="xs">Mes</FormLabel>
          <Input type="month" size="sm" value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} />
        </FormControl>
        <FormControl w="240px">
          <FormLabel fontSize="xs">Empresa</FormLabel>
          <Select size="sm" value={filterCompany} onChange={(event) => setFilterCompany(event.target.value)}>
            <option value="ALL">Todas</option>
            {(companies || []).map((company) => (
              <option key={company.id} value={company.id}>{company.nombre_comercial}</option>
            ))}
          </Select>
        </FormControl>
      </HStack>

      {groups.length === 0 ? (
        <Box bg={bg} borderRadius="xl" shadow="sm" border="1px solid" borderColor={borderColor} p={8} textAlign="center" color="gray.500">
          No hay operaciones incluidas en nóminas cerradas con esos filtros
        </Box>
      ) : groups.map((group) => (
        <Box key={group.key} bg={bg} borderRadius="xl" shadow="sm" overflow="hidden" border="1px solid" borderColor={borderColor} mb={5}>
          <Flex px={5} py={3} justify="space-between" align="center" bg={theadBg} gap={3} wrap="wrap">
            <Box>
              <Text fontWeight={800}>{group.company?.nombre_comercial || 'Empresa sin identificar'}</Text>
              <Text fontSize="sm" color="gray.500">{group.period}</Text>
            </Box>
            <Badge colorScheme="blue">Nómina cerrada · {group.logs.length} operación(es)</Badge>
          </Flex>
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead bg={theadBg}>
                <Tr>
                  <Th>Fecha</Th>
                  <Th>Empleado</Th>
                  <Th>Tipo</Th>
                  <Th>Detalle</Th>
                  <Th>Tarea</Th>
                  <Th>Estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {group.logs.map((log) => {
                  const employee = log.Employee || employeeById.get(String(log.employeeId));
                  const isBonus = log.type === 'BONO';
                  const detail = isBonus
                    ? formatQ(log.bonusAmount)
                    : `${log.hoursQty} hora(s) ${String(log.hourType || '').toLowerCase()}`;
                  return (
                    <Tr key={log.id}>
                      <Td whiteSpace="nowrap">{log.date ? String(log.date).slice(0, 10) : '—'}</Td>
                      <Td>{employeeName(employee)}</Td>
                      <Td><Badge colorScheme={isBonus ? 'green' : 'yellow'}>{isBonus ? 'Bono' : 'Hora extra'}</Badge></Td>
                      <Td fontFamily={isBonus ? 'mono' : undefined}>{detail}</Td>
                      <Td maxW="280px" isTruncated title={log.taskDescription}>{log.taskDescription || '—'}</Td>
                      <Td><Badge colorScheme="blue">En nómina</Badge></Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
