import React, { useState, useContext, useMemo } from 'react';
import {
  Box, Flex, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  Select, VStack, HStack, Divider, Badge, Alert, AlertIcon, useColorModeValue
} from '@chakra-ui/react';
import { Calculator, CheckCircle, Download, ArrowRight } from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import { DataContext } from '../context/DataContext';
import { formatCurrency, exportBillingExcel } from '../utils/billingExport';

const API = 'http://localhost:3000/api/billing';

export default function BillingDistribution() {
  const { showToast, confirmAction } = useContext(AppContext);
  const { token } = useContext(AuthContext);
  const { payrollHistory: payrolls } = useContext(DataContext);

  const [selectedPayroll, setSelectedPayroll] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const closedPayrolls = useMemo(
    () => payrolls.filter((p) => p.status === 'cerrada'),
    [payrolls]
  );

  const bgCard = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const bgHeader = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const selectBg = useColorModeValue('white', 'gray.800');

  const handlePreview = async () => {
    if (!selectedPayroll) {
      showToast('Por favor selecciona una nómina cerrada', 'warning');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ payrollId: selectedPayroll })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el cálculo');
      setPreviewData(data);
      if (data.warnings?.length) {
        showToast(`Cálculo completado con ${data.warnings.length} advertencia(s)`, 'warning');
      } else {
        showToast('Vista previa generada');
      }
    } catch (err) {
      showToast(err.message || 'Error al calcular distribución', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!previewData?.lines?.length) {
      showToast('No hay facturas para confirmar', 'warning');
      return;
    }
    confirmAction('¿Confirmar esta ejecución de facturación? Se guardará en el historial.', async () => {
      try {
        setConfirming(true);
        const res = await fetch(`${API}/runs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ payrollId: selectedPayroll })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        showToast(`Facturación confirmada (v${data.version})`);
      } catch (err) {
        showToast(err.message || 'Error al confirmar', 'error');
      } finally {
        setConfirming(false);
      }
    });
  };

  const handleExport = async () => {
    if (!previewData) return;
    try {
      await exportBillingExcel(
        previewData,
        `Facturacion_${previewData.payrollTitle || selectedPayroll}.xlsx`.replace(/[\\/:*?"<>|]/g, '_')
      );
      showToast('Excel exportado correctamente');
    } catch (err) {
      showToast(err.message || 'Error al exportar Excel', 'error');
    }
  };

  const matrixRows = useMemo(() => {
    if (!previewData?.matrix) return { fromIds: [], toIds: [] };
    const fromIds = Object.keys(previewData.matrix);
    const toSet = new Set();
    fromIds.forEach((fid) => Object.keys(previewData.matrix[fid] || {}).forEach((tid) => toSet.add(tid)));
    return { fromIds, toIds: [...toSet] };
  }, [previewData]);

  const companyLabel = (id) => previewData?.companyNames?.[id] || id;

  return (
    <Box p={6}>
      <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={4}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold">Distribución y Facturación</Text>
          <Text color="gray.500">Calcula la facturación intercompañías basándote en nóminas cerradas.</Text>
        </Box>
        <HStack>
          <Select
            placeholder="Seleccionar nómina cerrada"
            w="300px"
            bg={selectBg}
            value={selectedPayroll}
            onChange={(e) => { setSelectedPayroll(e.target.value); setPreviewData(null); }}
          >
            {closedPayrolls.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
          <Button leftIcon={<Calculator size={18} />} colorScheme="brand" onClick={handlePreview} isLoading={loading}>
            Vista Previa
          </Button>
        </HStack>
      </Flex>

      {closedPayrolls.length === 0 && (
        <Alert status="info" borderRadius="lg" mb={4}>
          <AlertIcon />
          No hay nóminas cerradas disponibles para facturar.
        </Alert>
      )}

      {previewData && (
        <VStack spacing={6} align="stretch">
          {previewData.warnings?.length > 0 && (
            <Alert status="warning" borderRadius="lg">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold" mb={1}>Advertencias</Text>
                {previewData.warnings.map((w, i) => <Text key={i} fontSize="sm">{w}</Text>)}
              </Box>
            </Alert>
          )}

          <Box bg={bgCard} p={5} borderRadius="xl" shadow="sm" borderWidth="1px" borderColor={borderColor}>
            <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={3}>
              <Box>
                <Text fontSize="lg" fontWeight="bold">Facturas — {previewData.payrollTitle}</Text>
                <Text fontSize="sm" color="gray.500">
                  {(previewData.lines || []).length} factura(s) · {(previewData.details || []).length} fila(s) de detalle
                </Text>
              </Box>
              <HStack>
                <Button leftIcon={<Download size={18} />} variant="outline" onClick={handleExport}>Exportar Excel</Button>
                <Button leftIcon={<CheckCircle size={18} />} colorScheme="green" onClick={handleConfirm} isLoading={confirming}>
                  Confirmar
                </Button>
              </HStack>
            </Flex>
            <Divider mb={4} />
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead bg={bgHeader}>
                  <Tr>
                    <Th>Emisora</Th>
                    <Th />
                    <Th>Receptora</Th>
                    <Th>Concepto</Th>
                    <Th isNumeric>Base</Th>
                    <Th isNumeric>Margen</Th>
                    <Th isNumeric>IVA</Th>
                    <Th isNumeric>Total</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {(previewData.lines || []).map((d, i) => (
                    <Tr key={i}>
                      <Td fontWeight="bold" color="blue.700">{d.fromCompany}</Td>
                      <Td><ArrowRight size={14} color="gray" /></Td>
                      <Td fontWeight="bold">{d.toCompany}</Td>
                      <Td fontSize="xs" color="gray.600">{d.concept}</Td>
                      <Td isNumeric>{formatCurrency(d.baseAmount)}</Td>
                      <Td isNumeric>
                        <VStack spacing={0} align="flex-end">
                          <Text>{formatCurrency(d.marginAmount)}</Text>
                          <Badge colorScheme="purple" fontSize="0.6rem">{d.marginPercentage}%</Badge>
                        </VStack>
                      </Td>
                      <Td isNumeric>{formatCurrency(d.ivaAmount)}</Td>
                      <Td isNumeric fontWeight="bold" color="green.600">{formatCurrency(d.totalAmount)}</Td>
                    </Tr>
                  ))}
                  {(!previewData.lines || previewData.lines.length === 0) && (
                    <Tr>
                      <Td colSpan={8} textAlign="center" py={8} color="gray.500">
                        No se generaron facturas. Revise las reglas de facturación y la distribución de empleados.
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </Box>

          {matrixRows.fromIds.length > 0 && (
            <Box bg={bgCard} p={5} borderRadius="xl" shadow="sm" borderWidth="1px" borderColor={borderColor}>
              <Text fontSize="lg" fontWeight="bold" mb={4}>Matriz de Costos</Text>
              <Box overflowX="auto">
                <Table variant="simple" size="sm">
                  <Thead bg={bgHeader}>
                    <Tr>
                      <Th>De \ A</Th>
                      {matrixRows.toIds.map((tid) => <Th key={tid} isNumeric>{companyLabel(tid)}</Th>)}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {matrixRows.fromIds.map((fid) => (
                      <Tr key={fid}>
                        <Td fontWeight="bold">{companyLabel(fid)}</Td>
                        {matrixRows.toIds.map((tid) => (
                          <Td key={tid} isNumeric>
                            {formatCurrency(previewData.matrix[fid]?.[tid] || 0)}
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </Box>
          )}

          {(previewData.details || []).length > 0 && (
            <Box bg={bgCard} p={5} borderRadius="xl" shadow="sm" borderWidth="1px" borderColor={borderColor}>
              <Text fontSize="lg" fontWeight="bold" mb={1}>Detalle por Empleado</Text>
              <Text fontSize="sm" color="gray.500" mb={4}>
                {(previewData.details || []).length} asignación(es) de costo
              </Text>
              <Box overflowX="auto" maxH="420px" overflowY="auto">
                <Table variant="simple" size="sm">
                  <Thead bg={bgHeader} position="sticky" top={0} zIndex={1}>
                    <Tr>
                      <Th>Empleado</Th>
                      <Th>Pagadora</Th>
                      <Th>Destino</Th>
                      <Th isNumeric>%</Th>
                      <Th isNumeric>Monto</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {(previewData.details || []).map((d, i) => (
                      <Tr key={`${d.employeeId}-${d.toCompanyId}-${i}`}>
                        <Td fontWeight="medium">{d.employeeName}</Td>
                        <Td fontSize="xs">{d.fromCompany}</Td>
                        <Td fontSize="xs">{d.toCompany}</Td>
                        <Td isNumeric>{d.percentage}%</Td>
                        <Td isNumeric>{formatCurrency(d.baseAmount)}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </Box>
          )}
        </VStack>
      )}
    </Box>
  );
}
