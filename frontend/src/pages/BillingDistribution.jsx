import React, { useState, useContext, useMemo, useEffect } from 'react';
import {
  Box, Flex, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  Select, VStack, HStack, Divider, Badge, Alert, AlertIcon,
  useColorModeValue, SimpleGrid, Collapse, useDisclosure
} from '@chakra-ui/react';
import { Calculator, CheckCircle, Download, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import { DataContext } from '../context/DataContext';
import { formatCurrency, exportBillingExcel } from '../utils/billingExport';

const API = 'http://localhost:3000/api/billing';

function KpiCard({ label, value, accent }) {
  const bg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const border = useColorModeValue('gray.200', 'whiteAlpha.100');
  return (
    <Box bg={bg} borderWidth="1px" borderColor={border} borderRadius="lg" p={4}>
      <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
        {label}
      </Text>
      <Text fontSize="xl" fontWeight="bold" color={accent || 'inherit'} fontFamily="mono">
        {value}
      </Text>
    </Box>
  );
}

export function BillingExecutePanel({
  onConfirmed,
  onGoToRules,
  prefillPayrollId = '',
  onPrefillConsumed
}) {
  const { showToast, confirmAction } = useContext(AppContext);
  const { token } = useContext(AuthContext);
  const { payrollHistory: payrolls } = useContext(DataContext);

  const [selectedPayroll, setSelectedPayroll] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { isOpen: matrixOpen, onToggle: toggleMatrix } = useDisclosure({ defaultIsOpen: true });
  const { isOpen: detailOpen, onToggle: toggleDetail } = useDisclosure({ defaultIsOpen: false });

  const closedPayrolls = useMemo(
    () => payrolls.filter((p) => p.status === 'cerrada'),
    [payrolls]
  );

  useEffect(() => {
    if (prefillPayrollId) {
      setSelectedPayroll(prefillPayrollId);
      setPreviewData(null);
      onPrefillConsumed?.();
    }
  }, [prefillPayrollId, onPrefillConsumed]);

  const bgCard = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const bgHeader = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const selectBg = useColorModeValue('white', 'gray.800');
  const toolbarBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  const payrollEmpCount = (p) => {
    if (p.summary?.employeesCount) return p.summary.employeesCount;
    const raw = p.data || p.employees;
    if (Array.isArray(raw)) return raw.length;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw).length; } catch { return 0; }
    }
    return 0;
  };

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
        onConfirmed?.(data);
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

  const previewTotals = useMemo(() => {
    if (!previewData?.lines?.length) return { invoices: 0, total: 0, employees: 0 };
    const total = previewData.lines.reduce((s, l) => s + Number(l.totalAmount || 0), 0);
    const employees = previewData.employeeCount
      ?? new Set((previewData.details || []).map((d) => d.employeeId)).size;
    return {
      invoices: previewData.lines.length,
      total,
      employees
    };
  }, [previewData]);

  return (
    <VStack spacing={5} align="stretch">
      <Box
        bg={bgCard}
        p={5}
        borderRadius="xl"
        shadow="sm"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <Text fontSize="md" fontWeight="bold" mb={1}>Nueva ejecución</Text>
        <Text fontSize="sm" color="gray.500" mb={4}>
          Selecciona una nómina cerrada y genera la vista previa antes de confirmar.
        </Text>
        <Flex
          gap={3}
          flexWrap="wrap"
          align="center"
          bg={toolbarBg}
          p={4}
          borderRadius="lg"
        >
          <Select
            placeholder="Seleccionar nómina cerrada"
            flex="1"
            minW="260px"
            bg={selectBg}
            value={selectedPayroll}
            onChange={(e) => { setSelectedPayroll(e.target.value); setPreviewData(null); }}
          >
            {closedPayrolls.map((p) => {
              const empCount = payrollEmpCount(p);
              return (
                <option key={p.id} value={p.id}>
                  {p.title} ({empCount} empleado{empCount !== 1 ? 's' : ''})
                </option>
              );
            })}
          </Select>
          <Button leftIcon={<Calculator size={18} />} colorScheme="brand" onClick={handlePreview} isLoading={loading}>
            Vista previa
          </Button>
        </Flex>
      </Box>

      {closedPayrolls.length === 0 && (
        <Alert status="info" borderRadius="lg">
          <AlertIcon />
          No hay nóminas cerradas disponibles para facturar.
        </Alert>
      )}

      {previewData && (
        <>
          {previewData.warnings?.length > 0 && (
            <Alert status="warning" borderRadius="lg">
              <AlertIcon />
              <Box>
                <Text fontWeight="bold" mb={1}>Advertencias</Text>
                {previewData.warnings.map((w, i) => <Text key={i} fontSize="sm">{w}</Text>)}
              </Box>
            </Alert>
          )}

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <KpiCard label="Facturas" value={previewTotals.invoices} />
            <KpiCard label="Total facturado" value={formatCurrency(previewTotals.total)} accent="green.400" />
            <KpiCard label="Empleados en nómina" value={previewTotals.employees} />
          </SimpleGrid>

          <Box bg={bgCard} p={5} borderRadius="xl" shadow="sm" borderWidth="1px" borderColor={borderColor}>
            <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={3}>
              <Box>
                <Text fontSize="lg" fontWeight="bold">Facturas intercompañía</Text>
                <Text fontSize="sm" color="gray.500">{previewData.payrollTitle}</Text>
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
                        <VStack spacing={2}>
                          <Text>No se generaron facturas para esta nómina.</Text>
                          <Text fontSize="xs">
                            Revise las{' '}
                            <Text as="button" color="brand.400" fontWeight="600" onClick={onGoToRules}>
                              reglas de facturación
                            </Text>
                            {' '}y que la distribución por empresa de cada empleado genere cargos a otras compañías.
                          </Text>
                        </VStack>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </Box>

          {matrixRows.fromIds.length > 0 && (
            <Box bg={bgCard} borderRadius="xl" shadow="sm" borderWidth="1px" borderColor={borderColor} overflow="hidden">
              <Flex
                px={5}
                py={4}
                justify="space-between"
                align="center"
                cursor="pointer"
                onClick={toggleMatrix}
                _hover={{ bg: bgHeader }}
              >
                <Text fontSize="lg" fontWeight="bold">Matriz de costos</Text>
                {matrixOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </Flex>
              <Collapse in={matrixOpen}>
                <Box px={5} pb={5} overflowX="auto">
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
              </Collapse>
            </Box>
          )}

          {(previewData.details || []).length > 0 && (
            <Box bg={bgCard} borderRadius="xl" shadow="sm" borderWidth="1px" borderColor={borderColor} overflow="hidden">
              <Flex
                px={5}
                py={4}
                justify="space-between"
                align="center"
                cursor="pointer"
                onClick={toggleDetail}
                _hover={{ bg: bgHeader }}
              >
                <Box>
                  <Text fontSize="lg" fontWeight="bold">Detalle por empleado</Text>
                  <Text fontSize="sm" color="gray.500">
                    {(previewData.details || []).length} asignación(es)
                  </Text>
                </Box>
                {detailOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </Flex>
              <Collapse in={detailOpen}>
                <Box px={5} pb={5} overflowX="auto" maxH="520px" overflowY="auto">
                  <Table variant="simple" size="sm">
                    <Thead bg={bgHeader} position="sticky" top={0} zIndex={1}>
                      <Tr>
                        <Th whiteSpace="nowrap">Empleado</Th>
                        <Th whiteSpace="nowrap">Pagadora</Th>
                        <Th whiteSpace="nowrap">Destino</Th>
                        <Th isNumeric whiteSpace="nowrap">%</Th>
                        <Th isNumeric whiteSpace="nowrap">Días</Th>
                        <Th isNumeric whiteSpace="nowrap">Sueldo</Th>
                        <Th isNumeric whiteSpace="nowrap">Bono Dec.</Th>
                        <Th isNumeric whiteSpace="nowrap">Bono Inc.</Th>
                        <Th isNumeric whiteSpace="nowrap">Bonos Ext.</Th>
                        <Th isNumeric whiteSpace="nowrap">Bonos Cat.</Th>
                        <Th isNumeric whiteSpace="nowrap">H. Extra</Th>
                        <Th isNumeric whiteSpace="nowrap">Bruto</Th>
                        <Th isNumeric whiteSpace="nowrap">IGSS Lab.</Th>
                        <Th isNumeric whiteSpace="nowrap">ISR</Th>
                        <Th isNumeric whiteSpace="nowrap">Líquido</Th>
                        <Th isNumeric whiteSpace="nowrap">IGSS Pat.</Th>
                        <Th isNumeric whiteSpace="nowrap">Costo Total</Th>
                        <Th isNumeric whiteSpace="nowrap">Asg. Bruto</Th>
                        <Th isNumeric whiteSpace="nowrap">Asg. Bonos Cat.</Th>
                        <Th isNumeric whiteSpace="nowrap">Asg. IGSS</Th>
                        <Th isNumeric whiteSpace="nowrap">Asg. ISR</Th>
                        <Th isNumeric whiteSpace="nowrap">Asg. Costo</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {(previewData.details || []).map((d, i) => (
                        <Tr key={`${d.employeeId}-${d.toCompanyId}-${i}`}>
                          <Td fontWeight="medium" whiteSpace="nowrap">{d.employeeName}</Td>
                          <Td fontSize="xs" whiteSpace="nowrap">{d.fromCompany}</Td>
                          <Td fontSize="xs" whiteSpace="nowrap">{d.toCompany}</Td>
                          <Td isNumeric>{d.percentage}%</Td>
                          <Td isNumeric>{d.days ?? '—'}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.sueldoOrdinario)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.bonoDecreto)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.bonoIncentivo)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.bonosExtras)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.bonosAplicados)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.horasExtrasOtros)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.bruto)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.igssLaboral)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.isr)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.liquido)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.igssPatronal)}</Td>
                          <Td isNumeric fontSize="xs" fontWeight="600">{formatCurrency(d.employeeCost)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.asgBruto)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.asgBonosAplicados)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.asgIgssLaboral)}</Td>
                          <Td isNumeric fontSize="xs">{formatCurrency(d.asgIsr)}</Td>
                          <Td isNumeric fontWeight="700" color="brand.500">{formatCurrency(d.baseAmount)}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </Collapse>
            </Box>
          )}
        </>
      )}
    </VStack>
  );
}

export default BillingExecutePanel;
