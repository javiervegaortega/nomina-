import React, { useState, useEffect, useContext } from 'react';
import {
  Box, VStack, HStack, FormControl, FormLabel, Select, Input, Textarea, Button, Table, Thead, Tbody, Tr, Th, Td, IconButton, Text, Badge, Checkbox
} from '@chakra-ui/react';
import { Trash2, Plus } from 'lucide-react';
import { AppContext } from '../App';
import { calcSuspensionDays } from '../utils/payrollPeriod';

const INCIDENCE_TYPES = [
  'Falta justificada',
  'Falta injustificada',
  'Suspensión laboral',
  'Suspensión IGSS',
  'Baja',
  'Alta'
];

const getFormLayout = (type) => {
  if (type === 'Falta justificada' || type === 'Baja' || type === 'Alta') return 'SINGLE_DATE';
  if (type === 'Falta injustificada') return 'SINGLE_DATE_WITH_7TH';
  return 'RANGE_QUINCENA';
};

/**
 * @param {{ employee: object, onSave: Function, onDelete: Function, draftDateStr?: string, periodType?: string }} props
 */
export default function EmployeeIncidences({ employee, onSave, onDelete, draftDateStr, periodType }) {
  const { showToast } = useContext(AppContext);
  const [type, setType] = useState('');
  const [daysQuincena, setDaysQuincena] = useState('');
  const [daysTotal, setDaysTotal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [observations, setObservations] = useState('');
  const [remove7thDay, setRemove7thDay] = useState(false);

  // Auto-calcular días al cambiar fechas / 7º día / tipo suspensión
  useEffect(() => {
    const layout = getFormLayout(type);
    if (layout !== 'RANGE_QUINCENA') return;
    if (!startDate || !endDate) return;
    const { daysTotal: dt, daysQuincena: dq } = calcSuspensionDays({
      startDate,
      endDate,
      draftDateStr,
      periodType,
      remove7thDay
    });
    setDaysTotal(String(dt));
    setDaysQuincena(String(dq));
  }, [startDate, endDate, remove7thDay, type, draftDateStr, periodType]);

  const handleSave = () => {
    if (!type) {
      showToast('Debe seleccionar un tipo de incidencia', 'warning');
      return;
    }

    const layout = getFormLayout(type);
    let dQ = layout === 'RANGE_QUINCENA' ? Number(daysQuincena) : Number(daysTotal);

    if (layout === 'SINGLE_DATE' || layout === 'SINGLE_DATE_WITH_7TH') {
      if (!startDate) {
        showToast('Indique la fecha', 'warning');
        return;
      }
      // Un día (más 7º si aplica)
      dQ = remove7thDay && layout === 'SINGLE_DATE_WITH_7TH' ? 2 : 1;
      if (!daysTotal) {
        // keep dQ
      } else {
        dQ = Number(daysTotal) || dQ;
      }
    }

    if (isNaN(dQ) || dQ <= 0) {
      showToast('Los días a descontar deben ser mayores a 0', 'warning');
      return;
    }

    const dailySalary = (Number(employee.sueldo_ordinario) || 0) / 30;
    const amountDeducted = Number((dailySalary * dQ).toFixed(2));

    const newIncidence = {
      id: Date.now().toString(),
      type,
      daysQuincena: dQ,
      daysTotal: Number(daysTotal) || dQ,
      startDate,
      endDate: layout === 'RANGE_QUINCENA' ? endDate : null,
      remove7thDay: layout === 'SINGLE_DATE_WITH_7TH' || layout === 'RANGE_QUINCENA' ? remove7thDay : false,
      observations,
      amountDeducted,
      createdAt: new Date().toISOString()
    };

    onSave(employee.id, newIncidence, dQ);

    setType('');
    setDaysQuincena('');
    setDaysTotal('');
    setStartDate('');
    setEndDate('');
    setObservations('');
    setRemove7thDay(false);
  };

  const incidences = employee?.incidences || [];
  const layout = getFormLayout(type);

  return (
    <Box>
      <VStack spacing={4} align="stretch" bg="gray.50" p={4} borderRadius="md" mb={6} borderWidth="1px" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }}>
        <Text fontWeight="bold" fontSize="sm">Registrar Nueva Incidencia</Text>

        <HStack spacing={3} align="flex-end">
          <FormControl flex={2}>
            <FormLabel fontSize="xs" mb={1} color="gray.500">Incidencia</FormLabel>
            <Select size="sm" value={type} onChange={(e) => setType(e.target.value)} borderRadius="md">
              <option value="">(Indique el tipo de incidencia)</option>
              {INCIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FormControl>

          {type && layout === 'RANGE_QUINCENA' && (
            <FormControl flex={1}>
              <FormLabel fontSize="xs" mb={1} color="gray.500">Días Quincena</FormLabel>
              <Input size="sm" type="number" value={daysQuincena} onChange={(e) => setDaysQuincena(e.target.value)} borderRadius="md" placeholder="0" />
            </FormControl>
          )}

          {type && (
            <FormControl flex={1}>
              <FormLabel fontSize="xs" mb={1} color="gray.500">Días Total</FormLabel>
              <Input size="sm" type="number" value={daysTotal} onChange={(e) => setDaysTotal(e.target.value)} borderRadius="md" placeholder="0" />
            </FormControl>
          )}
        </HStack>

        {type && layout === 'RANGE_QUINCENA' && (
          <>
            <HStack spacing={3}>
              <FormControl>
                <FormLabel fontSize="xs" mb={1} color="gray.500">Fecha Inicio</FormLabel>
                <Input size="sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} borderRadius="md" />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs" mb={1} color="gray.500">Fecha Final</FormLabel>
                <Input size="sm" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} borderRadius="md" />
              </FormControl>
            </HStack>
            <Checkbox size="sm" colorScheme="brand" isChecked={remove7thDay} onChange={(e) => setRemove7thDay(e.target.checked)}>
              Descontar séptimo día (domingos)
            </Checkbox>
            {daysQuincena !== '' && (
              <Text fontSize="xs" color="gray.600">
                Auto: {daysQuincena} días en quincena · {daysTotal} días totales
                {employee?.sueldo_ordinario ? ` · Descuento estimado Q${((Number(employee.sueldo_ordinario) / 30) * Number(daysQuincena || 0)).toFixed(2)}` : ''}
              </Text>
            )}
          </>
        )}

        {type && (layout === 'SINGLE_DATE' || layout === 'SINGLE_DATE_WITH_7TH') && (
          <HStack spacing={3}>
            <FormControl flex={1}>
              <FormLabel fontSize="xs" mb={1} color="gray.500">
                {type === 'Baja' ? 'Fecha Baja' : type === 'Alta' ? 'Fecha Alta' : 'Fecha Descuento'}
              </FormLabel>
              <Input size="sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} borderRadius="md" />
            </FormControl>
            {layout === 'SINGLE_DATE_WITH_7TH' ? (
              <FormControl flex={1} display="flex" alignItems="flex-end" pb={2}>
                <Checkbox size="sm" colorScheme="brand" isChecked={remove7thDay} onChange={(e) => setRemove7thDay(e.target.checked)}>
                  ¿Quitar el séptimo día?
                </Checkbox>
              </FormControl>
            ) : <Box flex={1} />}
          </HStack>
        )}

        <FormControl>
          <FormLabel fontSize="xs" mb={1} color="gray.500">Observaciones</FormLabel>
          <Textarea size="sm" value={observations} onChange={(e) => setObservations(e.target.value)} borderRadius="md" placeholder="Ingrese una observación..." rows={2} />
        </FormControl>

        <Button size="sm" colorScheme="brand" leftIcon={<Plus size={16} />} onClick={handleSave}>
          Guardar
        </Button>
      </VStack>

      <Text fontWeight="bold" fontSize="sm" mb={3}>Reporte de Días Laborados</Text>
      {incidences.length === 0 ? (
        <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>No hay incidencias registradas para este empleado.</Text>
      ) : (
        <Box overflowX="auto" borderWidth="1px" borderRadius="md" _dark={{ borderColor: 'gray.700' }}>
          <Table variant="simple" size="sm">
            <Thead bg="gray.50" _dark={{ bg: 'gray.800' }}>
              <Tr>
                <Th>Tipo</Th>
                <Th isNumeric>Días</Th>
                <Th isNumeric>Monto est.</Th>
                <Th>Acción</Th>
              </Tr>
            </Thead>
            <Tbody>
              {incidences.map(inc => (
                <Tr key={inc.id}>
                  <Td>
                    <HStack spacing={2}>
                      <Text fontWeight="medium" fontSize="xs">{inc.type}</Text>
                      {inc.carriedFromFirstQuincena && (
                        <Badge colorScheme="blue" fontSize="2xs">1ª quincena</Badge>
                      )}
                    </HStack>
                    {inc.startDate && <Text fontSize="2xs" color="gray.500">
                      {new Date(inc.startDate).toLocaleDateString()} {inc.endDate ? `al ${new Date(inc.endDate).toLocaleDateString()}` : ''}
                      {inc.remove7thDay ? ' (Séptimo día descontado)' : ''}
                    </Text>}
                  </Td>
                  <Td isNumeric>
                    <Badge colorScheme="red">-{inc.daysQuincena}</Badge>
                  </Td>
                  <Td isNumeric fontSize="xs">
                    {inc.amountDeducted != null ? `Q${Number(inc.amountDeducted).toFixed(2)}` : '—'}
                  </Td>
                  <Td>
                    <IconButton
                      icon={<Trash2 size={14} />}
                      size="xs"
                      colorScheme="red"
                      variant="ghost"
                      aria-label="Eliminar"
                      isDisabled={inc.carriedFromFirstQuincena}
                      title={inc.carriedFromFirstQuincena
                        ? 'La incidencia pertenece a la primera quincena cerrada.'
                        : 'Eliminar incidencia'}
                      onClick={() => onDelete(employee.id, inc.id, inc.daysQuincena)}
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
