import React, { useState } from 'react';
import {
  Box, VStack, HStack, FormControl, FormLabel, Select, Input, Button, Table, Thead, Tbody, Tr, Th, Td, IconButton, Text, Checkbox, Badge
} from '@chakra-ui/react';
import { Trash2 } from 'lucide-react';
import { formatQ } from '../data/mockData';
import { AppContext } from '../App';
import { useContext } from 'react';

const DEDUCTION_TYPES = [
  { key: 'cell', label: 'Celular' },
  { key: 'cafe', label: 'Cafetería' },
  { key: 'uniform', label: 'Uniforme' },
  { key: 'shoes', label: 'Calzado' },
  { key: 'equipo', label: 'Equipo' },
  { key: 'product', label: 'Producto' },
  { key: 'bancos', label: 'Bancos' },
  { key: 'otros', label: 'Otros...' }
];

export default function EmployeeDeductions({ employee, onSave, onDelete }) {
  const { showToast } = useContext(AppContext);
  const [type, setType] = useState('');
  const [isSinglePayment, setIsSinglePayment] = useState(true);
  const [totalAmount, setTotalAmount] = useState('');
  const [installments, setInstallments] = useState('');

  const handleSave = () => {
    if (!type) {
      showToast('Debe seleccionar un tipo de egreso', 'warning');
      return;
    }

    const total = Number(totalAmount);
    if (isNaN(total) || total <= 0) {
      showToast('El monto total debe ser mayor a 0', 'warning');
      return;
    }

    let cuotas = 1;
    if (!isSinglePayment) {
      cuotas = Number(installments);
      if (isNaN(cuotas) || cuotas <= 0) {
        showToast('La cantidad de cuotas debe ser mayor a 0', 'warning');
        return;
      }
    }

    const quotaAmount = Number((total / cuotas).toFixed(2));

    const newDeduction = {
      id: Date.now().toString(),
      type,
      typeLabel: DEDUCTION_TYPES.find(d => d.key === type)?.label || type,
      isSinglePayment,
      totalAmount: total,
      installments: cuotas,
      quotaAmount: quotaAmount,
      createdAt: new Date().toISOString()
    };

    onSave(employee.id, newDeduction);
    
    // Reset form
    setType('');
    setTotalAmount('');
    setInstallments('');
    setIsSinglePayment(true);
    // Notificamos solo en la pantalla principal
  };

  const deductionsHistory = employee?.deductionsHistory || [];

  return (
    <Box>
      <VStack spacing={4} align="stretch" bg="gray.50" p={4} borderRadius="md" mb={6} borderWidth="1px" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }}>
        <Text fontWeight="bold" fontSize="sm">Registrar Nuevo Descuento / Egreso</Text>
        
        <HStack spacing={4} align="flex-start" wrap="wrap">
          <FormControl flex={2} minW="200px">
            <FormLabel fontSize="xs" mb={1} color="gray.500">Tipo de egreso</FormLabel>
            <Select size="sm" value={type} onChange={(e) => setType(e.target.value)} borderRadius="md">
              <option value="">(Indique el tipo de egreso)</option>
              {DEDUCTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </FormControl>
          
          <FormControl flex={1} minW="120px" display="flex" flexDirection="column" justifyContent="center" pt={6}>
            <Checkbox 
              isChecked={isSinglePayment} 
              onChange={(e) => {
                setIsSinglePayment(e.target.checked);
                if (e.target.checked) setInstallments('');
              }}
              colorScheme="brand"
            >
              <Text fontSize="sm">¿Pago único?</Text>
            </Checkbox>
          </FormControl>
        </HStack>

        <HStack spacing={4} align="flex-end" wrap="wrap">
          <FormControl flex={1}>
            <FormLabel fontSize="xs" mb={1} color="gray.500">Monto total (Q)</FormLabel>
            <Input size="sm" type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} borderRadius="md" placeholder="0.00" />
          </FormControl>

          {!isSinglePayment && (
            <FormControl flex={1}>
              <FormLabel fontSize="xs" mb={1} color="gray.500">Cantidad de cuotas</FormLabel>
              <Input size="sm" type="number" value={installments} onChange={(e) => setInstallments(e.target.value)} borderRadius="md" placeholder="Ej. 3" />
            </FormControl>
          )}

          <Button size="sm" colorScheme="brand" onClick={handleSave} alignSelf="flex-end">
            + Guardar
          </Button>
        </HStack>
        
        {!isSinglePayment && totalAmount && installments && Number(installments) > 0 && (
          <Text fontSize="xs" color="blue.500">
            Se descontarán <b>{formatQ(Number(totalAmount) / Number(installments))}</b> en {installments} quincena(s).
          </Text>
        )}
      </VStack>

      <Text fontWeight="bold" fontSize="sm" mb={3}>Reporte de descuentos variados al empleado</Text>
      
      {deductionsHistory.length === 0 ? (
        <Box p={6} textAlign="center" bg="gray.50" borderRadius="md" border="1px dashed" borderColor="gray.200" _dark={{ bg: 'whiteAlpha.50', borderColor: 'whiteAlpha.200' }}>
          <Text fontSize="sm" color="gray.500">No hay descuentos adicionales registrados.</Text>
        </Box>
      ) : (
        <Box border="1px solid" borderColor="gray.200" borderRadius="md" overflow="hidden" _dark={{ borderColor: 'gray.700' }}>
          <Table size="sm" variant="simple">
            <Thead bg="gray.50" _dark={{ bg: 'gray.800' }}>
              <Tr>
                <Th fontSize="xs">Fecha</Th>
                <Th fontSize="xs">Tipo</Th>
                <Th fontSize="xs">Monto Total</Th>
                <Th fontSize="xs">Cuotas</Th>
                <Th fontSize="xs">Cuota Aplicada</Th>
                <Th fontSize="xs"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {deductionsHistory.map(d => (
                <Tr key={d.id}>
                  <Td fontSize="xs">{new Date(d.createdAt).toLocaleDateString()}</Td>
                  <Td fontSize="xs">
                    <Badge colorScheme="purple" variant="subtle" size="sm">{d.typeLabel}</Badge>
                  </Td>
                  <Td fontSize="xs" fontFamily="mono">{formatQ(d.totalAmount)}</Td>
                  <Td fontSize="xs">{d.isSinglePayment ? 'Único' : `${d.installments} cuotas`}</Td>
                  <Td fontSize="xs" fontFamily="mono" color="red.500" fontWeight="bold">{formatQ(d.quotaAmount)}</Td>
                  <Td textAlign="right">
                    <IconButton
                      icon={<Trash2 size={14} />}
                      size="xs"
                      colorScheme="red"
                      variant="ghost"
                      onClick={() => onDelete(employee.id, d.id, d.type, d.quotaAmount)}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
