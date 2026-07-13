import React, { useState, useEffect, useContext } from 'react';
import {
  Box, Flex, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  Select, VStack, HStack, Divider, Badge, Spinner, useColorModeValue
} from '@chakra-ui/react';
import { Calculator, Save, Download, ArrowRight } from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import { DataContext } from '../context/DataContext';
import { utils, writeFile } from 'xlsx';

export default function BillingDistribution() {
  const { showToast } = useContext(AppContext);
  const { token } = useContext(AuthContext);
  const { payrollHistory: payrolls } = useContext(DataContext);
  
  const [selectedPayroll, setSelectedPayroll] = useState('');
  const [distributionData, setDistributionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCalculate = async () => {
    if (!selectedPayroll) {
      showToast('Por favor selecciona una nómina', 'warning');
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:3000/api/billing/calculate/${selectedPayroll}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error en el cálculo');
      const data = await res.json();
      setDistributionData(data);
      showToast('Cálculo completado');
    } catch (error) {
      showToast('Error al calcular distribución', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!distributionData || !distributionData.distributions.length) return;
    
    try {
      setSaving(true);
      const res = await fetch('http://localhost:3000/api/billing/save', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          period: selectedPayroll,
          distributions: distributionData.distributions
        })
      });
      if (!res.ok) throw new Error('Error');
      showToast('Reporte guardado en el historial exitosamente');
    } catch (error) {
      showToast('Error al guardar reporte', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (!distributionData) return;
    
    const wsData = [
      ['Reporte de Distribución y Facturación'],
      ['Nómina:', distributionData.payrollTitle],
      [],
      ['EMPRESA EMISORA', 'EMPRESA RECEPTORA', 'CONCEPTO', 'BASE', 'MARGEN %', 'MONTO MARGEN', 'IVA', 'TOTAL']
    ];

    distributionData.distributions.forEach(d => {
      wsData.push([
        d.fromCompany,
        d.toCompany,
        d.concept,
        d.baseAmount,
        `${d.marginPercentage}%`,
        d.marginAmount,
        d.ivaAmount,
        d.totalAmount
      ]);
    });

    const ws = utils.aoa_to_sheet(wsData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Distribucion');
    writeFile(wb, `Distribucion_${selectedPayroll}.xlsx`);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(val);
  };

  const bgCard = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const bgHeader = useColorModeValue('gray.50', 'whiteAlpha.50');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const selectBg = useColorModeValue('white', 'gray.800');

  return (
    <Box p={6}>
      <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={4}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold">Distribución y Facturación</Text>
          <Text color="gray.500">Calcula la facturación intercompañías basándote en la nómina.</Text>
        </Box>
        
        <HStack>
          <Select 
            placeholder="Seleccionar Nómina" 
            w="300px" 
            bg={selectBg}
            value={selectedPayroll}
            onChange={(e) => setSelectedPayroll(e.target.value)}
          >
            {payrolls.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
          <Button 
            leftIcon={<Calculator size={18} />} 
            colorScheme="brand" 
            onClick={handleCalculate}
            isLoading={loading}
          >
            Calcular
          </Button>
        </HStack>
      </Flex>

      {distributionData && (
        <VStack spacing={6} align="stretch">
          
          <Box bg={bgCard} p={5} borderRadius="xl" shadow="sm" borderWidth="1px" borderColor={borderColor}>
            <Flex justify="space-between" align="center" mb={4}>
              <Text fontSize="lg" fontWeight="bold">Resumen de Cálculo</Text>
              <HStack>
                <Button 
                  leftIcon={<Download size={18} />} 
                  variant="outline" 
                  onClick={handleExport}
                >
                  Exportar Excel
                </Button>
                <Button 
                  leftIcon={<Save size={18} />} 
                  colorScheme="green" 
                  onClick={handleSave}
                  isLoading={saving}
                >
                  Guardar Historial
                </Button>
              </HStack>
            </Flex>
            <Divider mb={4} />
            
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead bg={bgHeader}>
                  <Tr>
                    <Th>Emisora (Factura desde)</Th>
                    <Th></Th>
                    <Th>Receptora (Factura hacia)</Th>
                    <Th>Concepto</Th>
                    <Th isNumeric>Base (Costo Nómina)</Th>
                    <Th isNumeric>Margen</Th>
                    <Th isNumeric>IVA</Th>
                    <Th isNumeric>Total Factura</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {distributionData.distributions.map((d, i) => (
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
                  {distributionData.distributions.length === 0 && (
                    <Tr>
                      <Td colSpan={8} textAlign="center" py={8} color="gray.500">
                        No se generaron facturas. Revisa las Reglas de Facturación o asegúrate de que la nómina tenga empleados para las empresas destino.
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </Box>
        </VStack>
      )}
    </Box>
  );
}
