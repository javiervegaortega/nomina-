import React, { useState, useEffect, useContext } from 'react';
import {
  Box, Flex, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  Badge, HStack, IconButton, useColorModeValue
} from '@chakra-ui/react';
import { Download, RefreshCw } from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import { exportBillingExcel, buildExportFromRun, formatCurrency } from '../utils/billingExport';

const API = 'http://localhost:3000/api/billing';

const statusBadge = (status) => {
  if (status === 'confirmed') return <Badge colorScheme="green">Confirmada</Badge>;
  if (status === 'stale') return <Badge colorScheme="orange">Obsoleta</Badge>;
  return <Badge colorScheme="gray">Borrador</Badge>;
};

export default function BillingHistory() {
  const { showToast } = useContext(AppContext);
  const { token } = useContext(AuthContext);

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const bgCard = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const bgHeader = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/runs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar historial');
      setRuns(await res.json());
    } catch {
      showToast('Error al cargar historial de facturación', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRuns(); }, []);

  const handleExport = async (runId) => {
    try {
      const res = await fetch(`${API}/runs/${runId}`, {
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
        `Facturacion_${run.payrollTitle || run.payrollId}_v${run.version}.xlsx`.replace(/[\\/:*?"<>|]/g, '_')
      );
      showToast('Excel exportado correctamente');
    } catch (err) {
      showToast(err.message || 'Error al exportar', 'error');
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
  };

  const lineTotal = (run) =>
    (run.lines || []).reduce((s, l) => s + Number(l.totalAmount || 0), 0);

  return (
    <Box p={6}>
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold">Historial de Facturación</Text>
          <Text color="gray.500">Ejecuciones confirmadas y re-exportación de reportes.</Text>
        </Box>
        <Button leftIcon={<RefreshCw size={18} />} variant="outline" onClick={fetchRuns} isLoading={loading}>
          Actualizar
        </Button>
      </Flex>

      <Box bg={bgCard} borderRadius="xl" shadow="sm" overflowX="auto" borderWidth="1px" borderColor={borderColor}>
        <Table variant="simple">
          <Thead bg={bgHeader}>
            <Tr>
              <Th>Nómina</Th>
              <Th>Versión</Th>
              <Th>Estado</Th>
              <Th isNumeric>Facturas</Th>
              <Th isNumeric>Total</Th>
              <Th>Fecha</Th>
              <Th textAlign="right">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {runs.map((run) => (
              <Tr key={run.id}>
                <Td fontWeight="bold">{run.payrollTitle}</Td>
                <Td>v{run.version}</Td>
                <Td>{statusBadge(run.status)}</Td>
                <Td isNumeric>{(run.lines || []).length}</Td>
                <Td isNumeric fontWeight="semibold">{formatCurrency(lineTotal(run))}</Td>
                <Td fontSize="sm" color="gray.500">{formatDate(run.createdAt)}</Td>
                <Td textAlign="right">
                  <HStack justify="flex-end">
                    <IconButton
                      icon={<Download size={16} />}
                      size="sm"
                      variant="ghost"
                      colorScheme="blue"
                      aria-label="Exportar Excel"
                      onClick={() => handleExport(run.id)}
                    />
                  </HStack>
                </Td>
              </Tr>
            ))}
            {runs.length === 0 && !loading && (
              <Tr>
                <Td colSpan={7} textAlign="center" py={8} color="gray.500">
                  No hay ejecuciones de facturación registradas
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
