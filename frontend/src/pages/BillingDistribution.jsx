import React, { useState, useContext, useMemo, useEffect } from 'react';
import {
  Box, Flex, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  Select, VStack, HStack, Badge, Alert, AlertIcon, Tooltip,
  useColorModeValue, Collapse, useDisclosure, Tabs, TabList, Tab,
  TabPanels, TabPanel
} from '@chakra-ui/react';
import {
  Calculator, CheckCircle, Download, ArrowRight, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import { DataContext } from '../context/DataContext';
import { formatCurrency, exportBillingExcel } from '../utils/billingExport';

const API = 'http://localhost:3000/api/billing';
const BILLING_WRITE_ROLES = new Set(['ADMIN', 'NOMINA', 'GERENTE GENERAL']);

const isSecondPeriod = (p) => String(p?.periodType || '').toLowerCase() === '2da';

const GENERIC_WARNING_RE = /solo Proquima.*Unhesa.*Econacional|Facturaci[oó]n mensual por empresa/i;

const baseConcept = (concept) => {
  if (!concept) return '-';
  const parts = String(concept).split(/\s+[—–-]\s+/);
  return parts[0].trim() || concept;
};

function KpiStrip({ items }) {
  const bg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const border = useColorModeValue('gray.200', 'whiteAlpha.100');
  const divider = useColorModeValue('gray.200', 'whiteAlpha.200');

  return (
    <Flex
      bg={bg}
      borderWidth="1px"
      borderColor={border}
      borderRadius="lg"
      overflow="hidden"
      flexWrap="wrap"
    >
      {items.map((item, idx) => (
        <Box
          key={item.label}
          flex="1"
          minW={{ base: '50%', md: 'auto' }}
          px={4}
          py={3}
          borderRightWidth={{ base: idx % 2 === 0 ? '1px' : 0, md: idx < items.length - 1 ? '1px' : 0 }}
          borderBottomWidth={{ base: idx < 2 ? '1px' : 0, md: 0 }}
          borderColor={divider}
        >
          <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wider">
            {item.label}
          </Text>
          <Text
            fontSize="lg"
            fontWeight="bold"
            fontFamily="mono"
            color={item.accent || 'inherit'}
            noOfLines={1}
          >
            {item.value}
          </Text>
        </Box>
      ))}
    </Flex>
  );
}

export function BillingExecutePanel({
  onConfirmed,
  onGoToRules,
  prefillPayrollId = '',
  onPrefillConsumed
}) {
  const { showToast, confirmAction } = useContext(AppContext);
  const { token, user } = useContext(AuthContext);
  const { payrollHistory: payrolls } = useContext(DataContext);
  const canWriteBilling = BILLING_WRITE_ROLES.has(
    String(user?.role || '').trim().toUpperCase()
  );

  const [selectedPayroll, setSelectedPayroll] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resultTab, setResultTab] = useState(0);
  const { isOpen: warningsOpen, onToggle: toggleWarnings } = useDisclosure({ defaultIsOpen: false });

  const closedPayrolls = useMemo(
    () => payrolls.filter((p) => p.status === 'cerrada' && isSecondPeriod(p)),
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
  const muted = useColorModeValue('gray.600', 'gray.400');

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
      showToast('Por favor selecciona una nomina cerrada de 2da quincena', 'warning');
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
      if (!res.ok) throw new Error(data.error || 'Error en el calculo');
      setPreviewData(data);
      setResultTab(0);
      if (data.blockingErrors?.length) {
        showToast(
          `Hay ${data.blockingErrors.length} error(es) que debe corregir antes de facturar`,
          'error'
        );
      } else if (data.warnings?.length) {
        showToast(`Calculo completado con ${data.warnings.length} advertencia(s)`, 'warning');
      } else {
        showToast('Vista previa generada');
      }
    } catch (err) {
      showToast(err.message || 'Error al calcular distribucion', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!canWriteBilling) {
      showToast('No tienes permiso para confirmar ejecuciones de facturación', 'error');
      return;
    }
    if (previewData?.blockingErrors?.length) {
      showToast('Corrija los errores de distribución antes de confirmar', 'error');
      return;
    }
    if (!previewData?.lines?.length) {
      showToast('No hay facturas para confirmar', 'warning');
      return;
    }
    confirmAction('Confirmar esta ejecucion de facturacion? Se guardara en el historial.', async () => {
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
        showToast(`Facturacion confirmada (v${data.version})`);
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
        `Vista_Previa_2_${previewData.payrollTitle || selectedPayroll}.xlsx`.replace(/[\\/:*?"<>|]/g, '_')
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
    if (!previewData?.lines?.length) return { invoices: 0, total: 0, employees: 0, costCenters: 0 };
    const total = previewData.lines.reduce((s, l) => s + Number(l.totalAmount || 0), 0);
    const invoices = new Set(
      previewData.lines.map((l) => `${l.fromCompanyId}->${l.toCompanyId}`)
    ).size;
    const employees = previewData.employeeCount
      ?? new Set((previewData.details || []).map((d) => d.employeeId)).size;
    const costCenters = new Set(
      (previewData.operationalDetails || previewData.details || [])
        .map((d) => d.centroCosto)
        .filter(Boolean)
    ).size;
    return {
      invoices,
      total,
      employees,
      costCenters
    };
  }, [previewData]);

  const visibleWarnings = useMemo(() => {
    const all = previewData?.warnings || [];
    return all.filter((w) => !GENERIC_WARNING_RE.test(String(w)));
  }, [previewData]);

  const blockingErrors = previewData?.blockingErrors || [];

  const costCenterSummary = useMemo(() => {
    const byCc = {};
    const receivers = new Set();
    (previewData?.operationalDetails || previewData?.details || []).forEach((line) => {
      const cc = line.centroCosto || 'SIN CENTRO DE COSTO';
      const to = line.toCompany || 'Destino';
      receivers.add(to);
      if (!byCc[cc]) byCc[cc] = {};
      byCc[cc][to] = (byCc[cc][to] || 0) + (Number(line.baseAmount) || 0);
    });
    const receiverList = [...receivers].sort((a, b) => a.localeCompare(b, 'es'));
    const rows = Object.keys(byCc)
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((cc) => {
        const amounts = receiverList.map((r) => Number(byCc[cc][r]) || 0);
        const total = amounts.reduce((s, n) => s + n, 0);
        return { cc, amounts, total };
      });
    return { receiverList, rows };
  }, [previewData]);

  return (
    <VStack spacing={4} align="stretch">
      {/* Barra unica */}
      <Box
        bg={bgCard}
        px={4}
        py={3}
        borderRadius="xl"
        shadow="sm"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <Flex gap={3} flexWrap="wrap" align="center">
          <Select
            placeholder="Nomina 2da cerrada"
            flex="1"
            minW="240px"
            size="sm"
            bg={selectBg}
            value={selectedPayroll}
            onChange={(e) => { setSelectedPayroll(e.target.value); setPreviewData(null); }}
          >
            {closedPayrolls.map((p) => {
              const empCount = payrollEmpCount(p);
              return (
                <option key={p.id} value={p.id}>
                  {p.title} — 2da ({empCount} emp.)
                </option>
              );
            })}
          </Select>
          <Button
            leftIcon={<Calculator size={16} />}
            colorScheme="brand"
            size="sm"
            onClick={handlePreview}
            isLoading={loading}
          >
            Vista previa
          </Button>
          {previewData && (
            <HStack spacing={2} ml={{ base: 0, md: 'auto' }}>
              <Button
                leftIcon={<Download size={16} />}
                variant="outline"
                size="sm"
                onClick={handleExport}
              >
                Vista Previa 2
              </Button>
              {canWriteBilling ? (
                <Button
                  leftIcon={<CheckCircle size={16} />}
                  colorScheme="green"
                  size="sm"
                  onClick={handleConfirm}
                  isLoading={confirming}
                  isDisabled={!previewData.lines?.length || blockingErrors.length > 0}
                >
                  Confirmar
                </Button>
              ) : (
                <Badge colorScheme="gray" px={3} py={1} borderRadius="md">
                  Solo lectura
                </Badge>
              )}
            </HStack>
          )}
        </Flex>
      </Box>

      {closedPayrolls.length === 0 && (
        <Alert status="info" borderRadius="lg" py={3}>
          <AlertIcon />
          No hay nominas cerradas de 2da quincena disponibles para facturar.
        </Alert>
      )}

      {previewData && (
        <>
          {blockingErrors.length > 0 && (
            <Alert status="error" borderRadius="lg" alignItems="flex-start">
              <AlertIcon mt={0.5} />
              <Box>
                <Text fontWeight="700" fontSize="sm">
                  No se puede confirmar esta facturación
                </Text>
                {blockingErrors.map((message, index) => (
                  <Text key={index} fontSize="xs" mt={1}>
                    {message}
                  </Text>
                ))}
              </Box>
            </Alert>
          )}

          {/* KPIs + advertencias */}
          <Flex gap={3} align="stretch" direction={{ base: 'column', lg: 'row' }}>
            <Box flex="1">
              <KpiStrip
                items={[
                  { label: 'Facturas', value: previewTotals.invoices },
                  { label: 'Centros de costo', value: previewTotals.costCenters },
                  { label: 'Total', value: formatCurrency(previewTotals.total), accent: 'green.400' },
                  { label: 'Empleados', value: previewTotals.employees }
                ]}
              />
            </Box>
            {visibleWarnings.length > 0 && (
              <Box
                bg={bgCard}
                borderWidth="1px"
                borderColor="orange.300"
                borderRadius="lg"
                minW={{ lg: '220px' }}
                maxW={{ lg: '320px' }}
                overflow="hidden"
              >
                <Flex
                  px={3}
                  py={2}
                  align="center"
                  gap={2}
                  cursor="pointer"
                  onClick={toggleWarnings}
                  _hover={{ bg: toolbarBg }}
                >
                  <AlertTriangle size={16} color="#DD6B20" />
                  <Text fontSize="sm" fontWeight="600" flex="1">
                    Advertencias
                  </Text>
                  <Badge colorScheme="orange">{visibleWarnings.length}</Badge>
                  {warningsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Flex>
                <Collapse in={warningsOpen}>
                  <Box px={3} pb={3} maxH="160px" overflowY="auto">
                    {visibleWarnings.map((w, i) => (
                      <Text key={i} fontSize="xs" color={muted} mb={1}>
                        {w}
                      </Text>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )}
          </Flex>

          {/* Resultados en sub-tabs */}
          <Box
            bg={bgCard}
            borderRadius="xl"
            shadow="sm"
            borderWidth="1px"
            borderColor={borderColor}
            overflow="hidden"
          >
            <Flex
              px={4}
              pt={3}
              pb={1}
              justify="space-between"
              align="center"
              flexWrap="wrap"
              gap={2}
            >
              <Box>
                <Text fontSize="md" fontWeight="bold">Resultados</Text>
                <Text fontSize="xs" color="gray.500" noOfLines={1}>
                  {previewData.payrollTitle}
                </Text>
              </Box>
            </Flex>

            <Tabs
              index={resultTab}
              onChange={setResultTab}
              colorScheme="brand"
              size="sm"
              isLazy
            >
              <TabList px={4} borderColor={borderColor} gap={1} flexWrap="wrap">
                <Tab fontWeight={600}>Facturas</Tab>
                <Tab fontWeight={600}>Centros operativos (bruto)</Tab>
                <Tab fontWeight={600}>Matriz</Tab>
                <Tab fontWeight={600}>
                  Detalle
                  {(previewData.details || []).length > 0 && (
                    <Badge ml={2} colorScheme="gray" fontSize="0.65rem">
                      {(previewData.details || []).length}
                    </Badge>
                  )}
                </Tab>
              </TabList>

              <TabPanels>
                {/* Facturas */}
                <TabPanel px={4} pb={4} pt={3}>
                  <Box overflowX="auto">
                    <Table variant="simple" size="sm">
                      <Thead bg={bgHeader}>
                        <Tr>
                          <Th whiteSpace="nowrap">De / A</Th>
                          <Th whiteSpace="nowrap">Centro de costo</Th>
                          <Th whiteSpace="nowrap">Concepto</Th>
                          <Th isNumeric>Base</Th>
                          <Th isNumeric>Margen</Th>
                          <Th isNumeric>IVA</Th>
                          <Th isNumeric>Total</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {(previewData.lines || []).map((d, i) => (
                          <Tr key={i}>
                            <Td whiteSpace="nowrap">
                              <HStack spacing={1} align="center">
                                <Tooltip label={d.fromCompany} hasArrow>
                                  <Text fontWeight="bold" fontSize="xs" maxW="120px" noOfLines={1}>
                                    {d.fromCompany}
                                  </Text>
                                </Tooltip>
                                <ArrowRight size={12} color="gray" />
                                <Tooltip label={d.toCompany} hasArrow>
                                  <Text fontWeight="bold" fontSize="xs" maxW="120px" noOfLines={1}>
                                    {d.toCompany}
                                  </Text>
                                </Tooltip>
                              </HStack>
                            </Td>
                            <Td fontSize="xs" whiteSpace="nowrap" maxW="180px">
                              <Tooltip label={d.centroCosto || '-'} hasArrow>
                                <Text noOfLines={1}>{d.centroCosto || '-'}</Text>
                              </Tooltip>
                            </Td>
                            <Td fontSize="xs" color="gray.500" whiteSpace="nowrap">
                              {baseConcept(d.concept)}
                            </Td>
                            <Td isNumeric whiteSpace="nowrap">{formatCurrency(d.baseAmount)}</Td>
                            <Td isNumeric whiteSpace="nowrap">
                              <Text fontSize="xs">{formatCurrency(d.marginAmount)}</Text>
                              <Badge colorScheme="purple" fontSize="0.55rem">{d.marginPercentage}%</Badge>
                            </Td>
                            <Td isNumeric whiteSpace="nowrap">{formatCurrency(d.ivaAmount)}</Td>
                            <Td isNumeric fontWeight="bold" color="green.500" whiteSpace="nowrap">
                              {formatCurrency(d.totalAmount)}
                            </Td>
                          </Tr>
                        ))}
                        {(!previewData.lines || previewData.lines.length === 0) && (
                          <Tr>
                            <Td colSpan={7} textAlign="center" py={8} color="gray.500">
                              <VStack spacing={2}>
                                <Text>No se generaron facturas para esta nomina.</Text>
                                <Text fontSize="xs">
                                  Revise las{' '}
                                  <Text as="button" color="brand.400" fontWeight="600" onClick={onGoToRules}>
                                    reglas de facturacion
                                  </Text>
                                  {' '}y la distribucion por empresa.
                                </Text>
                              </VStack>
                            </Td>
                          </Tr>
                        )}
                      </Tbody>
                    </Table>
                  </Box>
                </TabPanel>

                {/* Por centro de costo */}
                <TabPanel px={4} pb={4} pt={3}>
                  <Text fontSize="xs" color="gray.500" mb={3}>
                    Distribución operativa antes del mapeo legal y del neteo global de facturas.
                  </Text>
                  <Box overflowX="auto">
                    <Table variant="simple" size="sm">
                      <Thead bg={bgHeader}>
                        <Tr>
                          <Th>Centro de costo</Th>
                          {costCenterSummary.receiverList.map((r) => (
                            <Th key={r} isNumeric whiteSpace="nowrap">{r}</Th>
                          ))}
                          <Th isNumeric>Total</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {costCenterSummary.rows.map((row) => (
                          <Tr key={row.cc}>
                            <Td fontWeight="600" fontSize="xs" whiteSpace="nowrap">{row.cc}</Td>
                            {row.amounts.map((amt, i) => (
                              <Td key={i} isNumeric fontSize="xs" whiteSpace="nowrap">
                                {formatCurrency(amt)}
                              </Td>
                            ))}
                            <Td isNumeric fontWeight="bold" whiteSpace="nowrap">
                              {formatCurrency(row.total)}
                            </Td>
                          </Tr>
                        ))}
                        {costCenterSummary.rows.length === 0 && (
                          <Tr>
                            <Td colSpan={Math.max(2, costCenterSummary.receiverList.length + 2)} textAlign="center" py={6} color="gray.500">
                              Sin datos por centro de costo.
                            </Td>
                          </Tr>
                        )}
                      </Tbody>
                    </Table>
                  </Box>
                </TabPanel>

                {/* Matriz */}
                <TabPanel px={4} pb={4} pt={3}>
                  {matrixRows.fromIds.length === 0 ? (
                    <Text color="gray.500" fontSize="sm" py={6} textAlign="center">
                      Sin datos en la matriz de costos.
                    </Text>
                  ) : (
                    <Box overflowX="auto">
                      <Table variant="simple" size="sm">
                        <Thead bg={bgHeader}>
                          <Tr>
                            <Th>De \ A</Th>
                            {matrixRows.toIds.map((tid) => (
                              <Th key={tid} isNumeric>{companyLabel(tid)}</Th>
                            ))}
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
                  )}
                </TabPanel>

                {/* Detalle */}
                <TabPanel px={4} pb={4} pt={3}>
                  {(previewData.details || []).length === 0 ? (
                    <Text color="gray.500" fontSize="sm" py={6} textAlign="center">
                      Sin detalle por empleado.
                    </Text>
                  ) : (
                    <Box maxH="480px" overflow="auto" borderWidth="1px" borderColor={borderColor} borderRadius="md">
                      <Table variant="simple" size="sm">
                        <Thead bg={bgHeader}>
                          <Tr>
                            <Th whiteSpace="nowrap" bg={bgHeader}>Empleado</Th>
                            <Th whiteSpace="nowrap" bg={bgHeader}>Centro de costo</Th>
                            <Th whiteSpace="nowrap" bg={bgHeader}>Pagadora</Th>
                            <Th whiteSpace="nowrap" bg={bgHeader}>Destino</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>%</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Dias</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Sueldo</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Bono Dec.</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Bono Inc.</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Bonos Ext.</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Bonos Cat.</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>H. Extra</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Bruto</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>IGSS Lab.</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>ISR</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Liquido</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>IGSS Pat.</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Costo Total</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Asg. Bruto</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Asg. Bonos Cat.</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Asg. IGSS</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Asg. ISR</Th>
                            <Th isNumeric whiteSpace="nowrap" bg={bgHeader}>Asg. Costo</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {(previewData.details || []).map((d, i) => (
                            <Tr key={`${d.employeeId}-${d.toCompanyId}-${i}`}>
                              <Td fontWeight="medium" whiteSpace="nowrap">{d.employeeName}</Td>
                              <Td fontSize="xs" whiteSpace="nowrap">{d.centroCosto || '-'}</Td>
                              <Td fontSize="xs" whiteSpace="nowrap">{d.fromCompany}</Td>
                              <Td fontSize="xs" whiteSpace="nowrap">{d.toCompany}</Td>
                              <Td isNumeric>{d.percentage}%</Td>
                              <Td isNumeric>{d.days ?? '-'}</Td>
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
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        </>
      )}
    </VStack>
  );
}

export default BillingExecutePanel;
