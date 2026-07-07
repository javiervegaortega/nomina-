import React from 'react';
import { Box, Text, Table, Thead, Tbody, Tr, Th, Td } from '@chakra-ui/react';
import { formatQ } from '../data/mockData';

const ConstanciaDocument = React.forwardRef(({ emp, desde, al, hastaLaFecha, representante, puesto, isPreview = false }, ref) => {
  if (!emp) return <div ref={ref} style={{ display: 'none' }} />;

  // Formatear la fecha actual
  const hoy = new Date();
  const optionsCurrentDate = { year: 'numeric', month: 'long', day: 'numeric' };
  const fechaActual = hoy.toLocaleDateString('es-GT', optionsCurrentDate);

  const fullName = `${emp.primer_nombre || ''} ${emp.segundo_nombre || ''} ${emp.otro_nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim() || 'Empleado';

  // Formatear fechas
  const formatDate = (dateStr) => {
    if (!dateStr) return '_____';
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const fechaDesdeStr = formatDate(desde);
  const fechaAlStr = hastaLaFecha ? 'hasta la fecha' : formatDate(al);

  const ordinario = Number(emp.sueldo_ordinario || 0);
  const bonificacion = Number(emp.bon_incentivo || 0);
  const total = ordinario + bonificacion;

  const content = (
    <Box
      ref={!isPreview ? ref : null}
      bg="white"
      color="black"
      w={isPreview ? "100%" : "216mm"} // Letter width
      h={isPreview ? "auto" : "277mm"} // Letter height
      p={isPreview ? 6 : "20mm"}  // margins
      fontFamily="'Times New Roman', Times, serif"
      fontSize={isPreview ? "sm" : "11pt"}
      lineHeight="1.5"
      boxShadow={isPreview ? "sm" : "none"}
      borderRadius={isPreview ? "md" : "none"}
      border={isPreview ? "1px solid" : "none"}
      borderColor="gray.200"
    >
      <Text mb={12}>Guatemala, {fechaActual}</Text>

      <Text mb={12} fontWeight="bold" fontStyle="italic">
        A QUIEN INTERESE:
      </Text>

      <Text mb={8} textAlign="justify">
        Por este medio hago constar que <strong>{fullName}</strong> quien se identifica con el dpi <strong>{emp.dpi || '_________'}</strong> labora para esta empresa, desde el día <strong>{fechaDesdeStr}</strong> {hastaLaFecha ? '' : 'al '}<strong>{fechaAlStr}</strong>. desempeñando el cargo de <strong>{puesto || emp.puesto || '_________'}</strong> en el área de <strong>{emp.departmentData?.nombre_dimension || emp.departmentId || '_________'}</strong>, percibiendo ingresos mensuales de la siguiente forma:
      </Text>

      <Box display="flex" justifyContent="center" mb={12} mt={10}>
        <Table size={isPreview ? "sm" : "md"} w="auto" css={{ '& th, & td': { borderBottom: 'none' } }}>
          <Thead>
            <Tr>
              <Th color="black" fontFamily="'Times New Roman', Times, serif" fontWeight="bold" textTransform="none" fontSize={isPreview ? "sm" : "11pt"}>Ordinario</Th>
              <Th color="black" fontFamily="'Times New Roman', Times, serif" fontWeight="bold" textTransform="none" fontSize={isPreview ? "sm" : "11pt"}>Bonificación</Th>
              <Th color="black" fontFamily="'Times New Roman', Times, serif" fontWeight="bold" textTransform="none" fontSize={isPreview ? "sm" : "11pt"}>Total</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td fontStyle="italic">{formatQ(ordinario)}</Td>
              <Td fontStyle="italic">{formatQ(bonificacion)}</Td>
              <Td fontStyle="italic">{formatQ(total)}</Td>
            </Tr>
          </Tbody>
        </Table>
      </Box>

      <Text mb={24}>
        Y para los usos que al interesado (a) convenga extiendo, firmo y sello la presente en la ciudad de Guatemala.
      </Text>

      <Box textAlign="center" w="50%" mx="auto">
        <Text m={0} textDecoration="underline">{representante || '_____________________'}</Text>
        <Text m={0}>Recursos Humanos</Text>
      </Box>
    </Box>
  );

  if (isPreview) {
    return content;
  }

  return (
    <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '216mm' }}>
      {content}
    </div>
  );
});

export default ConstanciaDocument;
