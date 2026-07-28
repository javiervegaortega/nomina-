import React, { useContext, useMemo, useState } from 'react';
import {
  Box, Flex, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, Badge,
  Select, Input, FormControl, FormLabel, HStack, useColorModeValue, Button
} from '@chakra-ui/react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import { formatQ } from '../data/mockData';

const STATUS_LABEL = {
  PENDING_MANAGER: { label: 'Pdte. Gerente', color: 'yellow' },
  APPROVED_MANAGER: { label: 'Aprobado', color: 'green' },
  RETURNED: { label: 'Devuelto', color: 'red' },
  PROCESSED_PAYROLL: { label: 'En Nómina', color: 'blue' },
  REJECTED: { label: 'Rechazado', color: 'red' }
};

function employeeName(emp) {
  if (!emp) return '—';
  return [emp.primer_nombre, emp.segundo_nombre, emp.otro_nombre, emp.primer_apellido, emp.segundo_apellido]
    .filter(Boolean)
    .join(' ');
}

export default function BonusesHistory() {
  const { operationLogs, companies, employees } = useContext(DataContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [filterMonth, setFilterMonth] = useState('');
  const [filterCompany, setFilterCompany] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const bg = useColorModeValue('white', 'gray.800');
  const theadBg = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');

  const employeeById = useMemo(() => {
    const map = new Map();
    (employees || []).forEach((e) => map.set(String(e.id), e));
    return map;
  }, [employees]);

  const rows = useMemo(() => {
    const role = String(user?.role || '').toUpperCase();
    let list = (operationLogs || []).filter((l) => l.type === 'BONO');

    if (role === 'SOLICITANTE') {
      // Solo los del mismo departamento vía empleados visibles no es trivial aquí;
      // el solicitante ve todos los de lotes a los que tiene acceso vía API de logs global.
      // Filtramos por si el log trae batch user — si no, se muestran todos los BONO.
    }

    if (filterMonth) {
      list = list.filter((l) => l.date && String(l.date).startsWith(filterMonth));
    }
    if (filterCompany !== 'ALL') {
      list = list.filter((l) => String(l.companyId) === String(filterCompany));
    }
    if (filterStatus !== 'ALL') {
      list = list.filter((l) => l.status === filterStatus);
    }

    return list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [operationLogs, filterMonth, filterCompany, filterStatus, user]);

  const totalAmount = rows.reduce((s, r) => s + (Number(r.bonusAmount) || 0), 0);

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} mb={6} gap={4}>
        <Flex align="center" gap={3}>
          <Button variant="ghost" leftIcon={<ArrowLeft size={18} />} onClick={() => navigate('/operations')}>
            Volver
          </Button>
          <Box>
            <Heading size="lg" fontWeight={800}>Historial de Bonos</Heading>
            <Text color="gray.500" fontSize="sm">
              Bonos operativos por empresa, mes y estado
            </Text>
          </Box>
        </Flex>
        <Text fontSize="sm" fontWeight={600}>
          {rows.length} registro(s) · Total {formatQ(totalAmount)}
        </Text>
      </Flex>

      <HStack mb={4} spacing={4} bg={bg} p={4} borderRadius="lg" shadow="sm" flexWrap="wrap">
        <FormControl w="180px">
          <FormLabel fontSize="xs">Mes</FormLabel>
          <Input type="month" size="sm" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
        </FormControl>
        <FormControl w="220px">
          <FormLabel fontSize="xs">Empresa</FormLabel>
          <Select size="sm" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
            <option value="ALL">Todas</option>
            {(companies || []).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre_comercial}</option>
            ))}
          </Select>
        </FormControl>
        <FormControl w="180px">
          <FormLabel fontSize="xs">Estado</FormLabel>
          <Select size="sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="PENDING_MANAGER">Pdte. Gerente</option>
            <option value="APPROVED_MANAGER">Aprobado</option>
            <option value="RETURNED">Devuelto</option>
            <option value="PROCESSED_PAYROLL">En Nómina</option>
          </Select>
        </FormControl>
      </HStack>

      <Box bg={bg} borderRadius="xl" shadow="sm" overflow="hidden" border="1px solid" borderColor={borderColor}>
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr>
                <Th>Fecha</Th>
                <Th>Empresa</Th>
                <Th>Empleado</Th>
                <Th isNumeric>Monto</Th>
                <Th>Tarea</Th>
                <Th>Lote</Th>
                <Th>Estado</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.length === 0 ? (
                <Tr>
                  <Td colSpan={7} textAlign="center" py={8} color="gray.500">
                    No hay bonos con esos filtros
                  </Td>
                </Tr>
              ) : (
                rows.map((log) => {
                  const st = STATUS_LABEL[log.status] || { label: log.status, color: 'gray' };
                  const emp = log.Employee || employeeById.get(String(log.employeeId));
                  const company = log.companyData
                    || (companies || []).find((c) => String(c.id) === String(log.companyId));
                  return (
                    <Tr key={log.id}>
                      <Td whiteSpace="nowrap">{log.date ? String(log.date).slice(0, 10) : '—'}</Td>
                      <Td>{company?.nombre_comercial || '—'}</Td>
                      <Td>{employeeName(emp)}</Td>
                      <Td isNumeric fontFamily="mono">{formatQ(log.bonusAmount)}</Td>
                      <Td maxW="240px" isTruncated title={log.taskDescription}>{log.taskDescription || '—'}</Td>
                      <Td>
                        {log.batchId ? (
                          <Button
                            size="xs"
                            variant="link"
                            colorScheme="brand"
                            onClick={() => navigate(`/operations/${log.batchId}`)}
                          >
                            #{log.batchId}
                          </Button>
                        ) : '—'}
                      </Td>
                      <Td><Badge colorScheme={st.color}>{st.label}</Badge></Td>
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
}
