import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import {
  Box, Flex, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  Badge, HStack, IconButton, Tooltip, useColorModeValue, VStack,
  SimpleGrid, Input, InputGroup, InputLeftElement, Select, Switch,
  Collapse, FormControl, FormLabel
} from '@chakra-ui/react';
import {
  Download, RefreshCw, Eye, Search, Building2, ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { AuthContext } from '../context/AuthContext';
import { exportBillingExcel, buildExportFromRun, formatCurrency } from '../utils/billingExport';
import { apiFetch } from '../utils/api';

const API = '/api/billing';

const statusBadge = (status, size = 'sm') => {
  if (status === 'confirmed') return <Badge colorScheme="green" fontSize={size}>Confirmada</Badge>;
  if (status === 'stale') return (
    <Tooltip label="La nómina fue reactivada; genera una nueva versión en Ejecutar" hasArrow>
      <Badge colorScheme="orange" cursor="help" fontSize={size}>Obsoleta</Badge>
    </Tooltip>
  );
  return <Badge colorScheme="gray" fontSize={size}>Borrador</Badge>;
};

const parsePayrollMeta = (title) => {
  const t = String(title || '');
  let company = '';
  const patterns = [
    /Nómina E2E\s+(.+?)\s+\d/i,
    /Nómina E2E\s+(.+?)(?:\s+Re-auditoría|\s+Auditoría|\s+cerrada|$)/i
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) { company = m[1].trim(); break; }
  }
  const periodType = /\b2da\b/i.test(t) ? '2da' : '1ra';
  return { company, periodType };
};

const lineTotal = (run) =>
  Number(run.totalAmount ?? (run.lines || []).reduce((s, l) => s + Number(l.totalAmount || 0), 0));

const lineCount = (run) =>
  Number(run.linesCount ?? (run.lines || []).length);

function StatPill({ label, value, accent }) {
  const bg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const border = useColorModeValue('gray.200', 'whiteAlpha.100');
  return (
    <Box bg={bg} borderWidth="1px" borderColor={border} borderRadius="lg" p={3}>
      <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">{label}</Text>
      <Text fontSize="lg" fontWeight="bold" color={accent}>{value}</Text>
    </Box>
  );
}

function RunRow({ run, highlightRunId, onViewPayroll, onExport, muted = false }) {
  const highlightBg = useColorModeValue('brand.50', 'rgba(14, 165, 233, 0.12)');
  const mutedBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <Tr
      bg={run.id === highlightRunId ? highlightBg : muted ? mutedBg : undefined}
      opacity={muted ? 0.85 : 1}
      transition="background 0.3s"
    >
      <Td fontWeight="semibold">v{run.version}</Td>
      <Td>{statusBadge(run.status)}</Td>
      <Td isNumeric>{lineCount(run)}</Td>
      <Td isNumeric fontWeight="semibold" fontFamily="mono">{formatCurrency(lineTotal(run))}</Td>
      <Td fontSize="sm" color="gray.500">{formatDate(run.createdAt)}</Td>
      <Td textAlign="right">
        <HStack justify="flex-end">
          <Tooltip label="Ver nómina en Ejecutar">
            <IconButton
              icon={<Eye size={16} />}
              size="sm"
              variant="ghost"
              colorScheme="gray"
              aria-label="Ver nómina"
              onClick={() => onViewPayroll?.(run.payrollId)}
            />
          </Tooltip>
          <Tooltip label="Exportar Excel">
            <IconButton
              icon={<Download size={16} />}
              size="sm"
              variant="ghost"
              colorScheme="blue"
              aria-label="Exportar Excel"
              onClick={() => onExport(run.id)}
            />
          </Tooltip>
        </HStack>
      </Td>
    </Tr>
  );
}

function PayrollGroupCard({ group, highlightRunId, onViewPayroll, onExport, hideObsolete }) {
  const [obsoleteOpen, setObsoleteOpen] = useState(false);

  const bgCard = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const bgHeader = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const statsBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  const activeRuns = group.runs.filter((r) => r.status === 'confirmed');
  const obsoleteRuns = group.runs.filter((r) => r.status !== 'confirmed');
  const latestActive = activeRuns[0] || group.runs[0];
  const onlyObsolete = activeRuns.length === 0 && obsoleteRuns.length > 0;
  const visibleObsolete = hideObsolete && !onlyObsolete ? [] : obsoleteRuns;

  const periodLabel = group.periodType === '2da' ? '2da Quincena' : '1ra Quincena';
  const periodColor = group.periodType === '2da' ? 'purple' : 'teal';

  return (
    <Box
      bg={bgCard}
      borderRadius="xl"
      borderWidth="1px"
      borderColor={borderColor}
      shadow="sm"
      overflow="hidden"
    >
      <Box p={{ base: 4, md: 5 }} borderBottomWidth="1px" borderColor={borderColor}>
        <Flex justify="space-between" align="start" gap={3} flexWrap="wrap">
          <Box flex="1" minW="240px">
            <HStack spacing={2} mb={2} flexWrap="wrap">
              <Flex align="center" gap={1.5} color="brand.400">
                <Building2 size={16} />
                <Text fontSize="sm" fontWeight="700">{group.company || 'Sin empresa'}</Text>
              </Flex>
              <Badge colorScheme={periodColor}>{periodLabel}</Badge>
              {latestActive && statusBadge(latestActive.status)}
            </HStack>
            <Text fontWeight="800" fontSize="md" mb={1}>{group.payrollTitle}</Text>
            <Text fontSize="xs" color="gray.500">
              {group.runs.length} versión{group.runs.length !== 1 ? 'es' : ''}
              {obsoleteRuns.length > 0 && ` · ${obsoleteRuns.length} obsoleta${obsoleteRuns.length !== 1 ? 's' : ''}`}
            </Text>
          </Box>

          {latestActive && (
            <SimpleGrid columns={2} spacing={3} minW={{ base: '100%', sm: '220px' }}>
              <Box bg={statsBg} p={3} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                <Text fontSize="xxs" color="gray.500" textTransform="uppercase" fontWeight={700}>Facturas</Text>
                <Text fontWeight="bold">{lineCount(latestActive)}</Text>
              </Box>
              <Box bg={statsBg} p={3} borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
                <Text fontSize="xxs" color="gray.500" textTransform="uppercase" fontWeight={700}>Total vigente</Text>
                <Text fontWeight="bold" fontFamily="mono" color="green.400">{formatCurrency(lineTotal(latestActive))}</Text>
              </Box>
            </SimpleGrid>
          )}
        </Flex>
      </Box>

      <Box overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead bg={bgHeader}>
            <Tr>
              <Th>Versión</Th>
              <Th>Estado</Th>
              <Th isNumeric>Facturas</Th>
              <Th isNumeric>Total</Th>
              <Th>Fecha</Th>
              <Th textAlign="right">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {activeRuns.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                highlightRunId={highlightRunId}
                onViewPayroll={onViewPayroll}
                onExport={onExport}
              />
            ))}
            {activeRuns.length === 0 && obsoleteRuns.length > 0 && hideObsolete && (
              <Tr>
                <Td colSpan={6} textAlign="center" py={5} color="gray.500" fontSize="sm">
                  Solo hay versiones obsoletas. Desactiva «Ocultar obsoletas» para verlas.
                </Td>
              </Tr>
            )}
            {activeRuns.length === 0 && obsoleteRuns.length > 0 && !hideObsolete && obsoleteRuns.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                highlightRunId={highlightRunId}
                onViewPayroll={onViewPayroll}
                onExport={onExport}
                muted
              />
            ))}
          </Tbody>
        </Table>
      </Box>

      {visibleObsolete.length > 0 && activeRuns.length > 0 && (
        <Box borderTopWidth="1px" borderColor={borderColor}>
          <Flex
            px={5}
            py={3}
            align="center"
            justify="space-between"
            cursor="pointer"
            onClick={() => setObsoleteOpen((o) => !o)}
            _hover={{ bg: bgHeader }}
          >
            <HStack spacing={2}>
              <FileText size={16} color="gray" />
              <Text fontSize="sm" fontWeight="600" color="gray.500">
                Versiones obsoletas ({visibleObsolete.length})
              </Text>
            </HStack>
            {obsoleteOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Flex>
          <Collapse in={obsoleteOpen}>
            <Box overflowX="auto" px={2} pb={3}>
              <Table variant="simple" size="sm">
                <Tbody>
                  {visibleObsolete.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      highlightRunId={highlightRunId}
                      onViewPayroll={onViewPayroll}
                      onExport={onExport}
                      muted
                    />
                  ))}
                </Tbody>
              </Table>
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}

export function BillingHistoryPanel({ refreshKey = 0, highlightRunId, onViewPayroll }) {
  const { showToast } = useContext(AppContext);
  const { token } = useContext(AuthContext);

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hideObsolete, setHideObsolete] = useState(true);

  const selectBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const toolbarBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API}/runs?summary=1&page=1&pageSize=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar historial');
      const payload = await res.json();
      setRuns(Array.isArray(payload) ? payload : payload.items || []);
    } catch {
      showToast('Error al cargar historial de facturación', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => {
    const timer = setTimeout(fetchRuns, 0);
    return () => clearTimeout(timer);
  }, [fetchRuns, refreshKey]);

  const handleExport = async (runId) => {
    try {
      const res = await apiFetch(`${API}/runs/${runId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const run = await res.json();
      if (!res.ok) throw new Error(run.error || 'Error');
      const exportData = buildExportFromRun(run);
      if (!exportData.details?.length && !exportData.lines?.length) {
        showToast('La ejecución no tiene datos para exportar', 'warning');
      }
      await exportBillingExcel(
        exportData,
        `Vista_Previa_2_${run.payrollTitle || run.payrollId}_v${run.version}.xlsx`.replace(/[\\/:*?"<>|]/g, '_')
      );
      showToast('Excel exportado correctamente');
    } catch (err) {
      showToast(err.message || 'Error al exportar', 'error');
    }
  };

  const stats = useMemo(() => ({
    total: runs.length,
    confirmed: runs.filter((r) => r.status === 'confirmed').length,
    stale: runs.filter((r) => r.status === 'stale').length
  }), [runs]);

  const groupedRuns = useMemo(() => {
    const map = new Map();
    runs.forEach((run) => {
      const key = run.payrollId || run.payrollTitle;
      const meta = parsePayrollMeta(run.payrollTitle);
      if (!map.has(key)) {
        map.set(key, {
          payrollId: run.payrollId,
          payrollTitle: run.payrollTitle,
          company: meta.company,
          periodType: meta.periodType,
          runs: []
        });
      }
      map.get(key).runs.push(run);
    });

    return Array.from(map.values())
      .map((g) => ({
        ...g,
        runs: [...g.runs].sort((a, b) => {
          if (b.version !== a.version) return b.version - a.version;
          return new Date(b.createdAt) - new Date(a.createdAt);
        })
      }))
      .sort((a, b) => {
        const dateA = a.runs[0]?.createdAt;
        const dateB = b.runs[0]?.createdAt;
        return new Date(dateB) - new Date(dateA);
      });
  }, [runs]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groupedRuns.filter((g) => {
      const matchesSearch = !q
        || g.payrollTitle.toLowerCase().includes(q)
        || g.company.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'confirmed') return g.runs.some((r) => r.status === 'confirmed');
      if (statusFilter === 'stale') return g.runs.some((r) => r.status === 'stale');
      return true;
    });
  }, [groupedRuns, search, statusFilter]);

  return (
    <VStack spacing={5} align="stretch">
      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3}>
        <StatPill label="Ejecuciones" value={stats.total} />
        <StatPill label="Confirmadas" value={stats.confirmed} accent="green.400" />
        <StatPill label="Obsoletas" value={stats.stale} accent="orange.400" />
      </SimpleGrid>

      <Flex
        gap={3}
        flexWrap="wrap"
        align="center"
        bg={toolbarBg}
        p={4}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <InputGroup flex="1" minW="200px" maxW="360px">
          <InputLeftElement pointerEvents="none">
            <Search size={16} color="gray" />
          </InputLeftElement>
          <Input
            placeholder="Buscar por empresa o nómina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            bg={selectBg}
          />
        </InputGroup>

        <Select
          w={{ base: '100%', sm: '180px' }}
          bg={selectBg}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="confirmed">Con vigentes</option>
          <option value="stale">Con obsoletas</option>
        </Select>

        <FormControl display="flex" alignItems="center" w="auto">
          <Switch
            id="hide-obsolete"
            colorScheme="brand"
            isChecked={hideObsolete}
            onChange={(e) => setHideObsolete(e.target.checked)}
            mr={2}
          />
          <FormLabel htmlFor="hide-obsolete" mb={0} fontSize="sm" whiteSpace="nowrap" cursor="pointer">
            Ocultar obsoletas
          </FormLabel>
        </FormControl>

        <Button
          ml="auto"
          leftIcon={<RefreshCw size={16} />}
          variant="outline"
          size="sm"
          onClick={fetchRuns}
          isLoading={loading}
        >
          Actualizar
        </Button>
      </Flex>

      <Text fontSize="sm" color="gray.500">
        {filteredGroups.length} nómina{filteredGroups.length !== 1 ? 's' : ''} · agrupadas por ejecución
      </Text>

      <VStack spacing={4} align="stretch">
        {filteredGroups.map((group) => (
          <PayrollGroupCard
            key={group.payrollId || group.payrollTitle}
            group={group}
            highlightRunId={highlightRunId}
            onViewPayroll={onViewPayroll}
            onExport={handleExport}
            hideObsolete={hideObsolete}
          />
        ))}

        {filteredGroups.length === 0 && !loading && (
          <Box py={12} textAlign="center" color="gray.500" borderWidth="1px" borderRadius="xl" borderColor={borderColor} borderStyle="dashed">
            {runs.length === 0
              ? 'No hay ejecuciones de facturación registradas'
              : 'No hay resultados con los filtros actuales'}
          </Box>
        )}
      </VStack>
    </VStack>
  );
}

export default BillingHistoryPanel;
