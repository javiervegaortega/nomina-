import React, { useMemo, useState, useContext, useEffect } from 'react';
import {
  Box, Flex, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  Badge, Select, Input, InputGroup, InputLeftElement, Button, HStack, useColorModeValue
} from '@chakra-ui/react';
import { Search, Ban } from 'lucide-react';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const SUSPENSION_TYPES = ['Suspensión laboral', 'Suspensión IGSS'];

/**
 * Módulo de Suspensiones: listado de incidencias de tipo suspensión
 * desde borradores activos + historial + API de incidencias si existe.
 */
export default function Suspensions() {
  const { activePayrolls, payrollHistory, employees } = useContext(DataContext);
  const { user } = useContext(AuthContext);
  const [apiIncidences, setApiIncidences] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const bg = useColorModeValue('white', 'gray.800');

  useEffect(() => {
    const token = localStorage.getItem('nomina-token');
    apiFetch('/api/incidences', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => (r.ok ? r.json() : []))
      .then(data => setApiIncidences(Array.isArray(data) ? data : []))
      .catch(() => setApiIncidences([]));
  }, []);

  const rows = useMemo(() => {
    const list = [];

    const pushFromEmp = (emp, source, periodLabel) => {
      (emp.incidences || []).forEach(inc => {
        if (!SUSPENSION_TYPES.includes(inc.type)) return;
        const name = [emp.primer_nombre, emp.segundo_nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ');
        list.push({
          id: `${source}-${emp.id}-${inc.id}`,
          employeeId: emp.id,
          employeeName: name || emp.name || `Empleado ${emp.id}`,
          type: inc.type,
          startDate: inc.startDate,
          endDate: inc.endDate,
          daysQuincena: inc.daysQuincena,
          daysTotal: inc.daysTotal,
          amountDeducted: inc.amountDeducted,
          observations: inc.observations,
          source,
          periodLabel
        });
      });
    };

    (activePayrolls || []).forEach(d => {
      (d.employees || []).forEach(emp => pushFromEmp(emp, 'borrador', d.title));
    });

    (payrollHistory || []).forEach(h => {
      let emps = h.data || h.employees || [];
      if (typeof emps === 'string') {
        try { emps = JSON.parse(emps); } catch { emps = []; }
      }
      (emps || []).forEach(emp => pushFromEmp(emp, 'historial', h.title));
    });

    // API incidences
    (apiIncidences || []).forEach(inc => {
      const t = inc.type || inc.tipo;
      if (!SUSPENSION_TYPES.includes(t)) return;
      const emp = (employees || []).find(e => String(e.id) === String(inc.employeeId || inc.employee_id));
      const name = emp
        ? [emp.primer_nombre, emp.segundo_nombre, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(' ')
        : `Empleado ${inc.employeeId || inc.employee_id}`;
      list.push({
        id: `api-${inc.id}`,
        employeeId: inc.employeeId || inc.employee_id,
        employeeName: name,
        type: t,
        startDate: inc.startDate || inc.start_date,
        endDate: inc.endDate || inc.end_date,
        daysQuincena: inc.daysQuincena || inc.days_quincena,
        daysTotal: inc.daysTotal || inc.days_total,
        amountDeducted: inc.amountDeducted,
        observations: inc.observations || inc.observaciones,
        source: 'maestro',
        periodLabel: '—'
      });
    });

    // Deduplicate by id
    const seen = new Set();
    return list.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [activePayrolls, payrollHistory, apiIncidences, employees]);

  const filtered = rows.filter(r => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!String(r.employeeName).toLowerCase().includes(q) && !String(r.employeeId).includes(q)) return false;
    }
    return true;
  });

  return (
    <Box p={{ base: 4, md: 8 }}>
      <Flex justify="space-between" align="center" mb={6} wrap="wrap" gap={3}>
        <Box>
          <Heading size="md" fontWeight={800} display="flex" alignItems="center" gap={2}>
            <Ban size={22} /> Suspensiones
          </Heading>
          <Text fontSize="sm" color="gray.500">Incidencias de suspensión laboral e IGSS</Text>
        </Box>
        <HStack>
          <InputGroup maxW="260px" size="sm">
            <InputLeftElement pointerEvents="none"><Search size={14} /></InputLeftElement>
            <Input placeholder="Buscar empleado..." value={search} onChange={e => setSearch(e.target.value)} borderRadius="md" />
          </InputGroup>
          <Select size="sm" maxW="200px" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} borderRadius="md">
            <option value="">Todos los tipos</option>
            {SUSPENSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </HStack>
      </Flex>

      <Box bg={bg} borderWidth="1px" borderColor={borderColor} borderRadius="xl" overflow="hidden">
        <TableContainer maxH="70vh" overflowY="auto">
          <Table size="sm" variant="simple">
            <Thead position="sticky" top={0} bg={bg} zIndex={1}>
              <Tr>
                <Th>Empleado</Th>
                <Th>Tipo</Th>
                <Th>Inicio</Th>
                <Th>Fin</Th>
                <Th isNumeric>Días Q</Th>
                <Th isNumeric>Días Tot</Th>
                <Th isNumeric>Monto est.</Th>
                <Th>Origen</Th>
                <Th>Nómina</Th>
                <Th>Observaciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td colSpan={10}>
                    <Text textAlign="center" py={8} color="gray.500">No hay suspensiones registradas.</Text>
                  </Td>
                </Tr>
              ) : filtered.map(r => (
                <Tr key={r.id}>
                  <Td fontWeight="600" fontSize="xs">{r.employeeName}</Td>
                  <Td><Badge colorScheme={r.type.includes('IGSS') ? 'purple' : 'orange'}>{r.type}</Badge></Td>
                  <Td fontSize="xs">{r.startDate || '—'}</Td>
                  <Td fontSize="xs">{r.endDate || '—'}</Td>
                  <Td isNumeric fontSize="xs">{r.daysQuincena ?? '—'}</Td>
                  <Td isNumeric fontSize="xs">{r.daysTotal ?? '—'}</Td>
                  <Td isNumeric fontSize="xs">{r.amountDeducted != null ? `Q${Number(r.amountDeducted).toFixed(2)}` : '—'}</Td>
                  <Td><Badge variant="subtle">{r.source}</Badge></Td>
                  <Td fontSize="xs" maxW="140px" isTruncated title={r.periodLabel}>{r.periodLabel}</Td>
                  <Td fontSize="xs" maxW="180px" isTruncated title={r.observations}>{r.observations || '—'}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>
      {user && (
        <Text fontSize="xs" color="gray.400" mt={3}>
          Tip: registre suspensiones desde el drawer de incidencias en Nómina para descontar días automáticamente.
        </Text>
      )}
    </Box>
  );
}
