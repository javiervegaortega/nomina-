import React from 'react';
import { Box, Text } from '@chakra-ui/react';

const CancelacionDocument = React.forwardRef(({ emp, fechaCancelacion, representante, isPreview = false }, ref) => {
  if (!emp) return <div ref={ref} style={{ display: 'none' }} />;

  // Formatear la fecha actual
  const hoy = new Date();
  const optionsCurrentDate = { year: 'numeric', month: 'long', day: 'numeric' };
  const fechaActual = hoy.toLocaleDateString('es-GT', optionsCurrentDate);

  const fullName = `${emp.primer_nombre || ''} ${emp.segundo_nombre || ''} ${emp.otro_nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim() || 'Empleado';

  // Formatear la fecha de cancelación
  let fechaFormat = '';
  try {
    const [year, month, day] = fechaCancelacion.split('-');
    fechaFormat = `${year}-${month}-${day}`; // Muestra en formato YYYY-MM-DD como en la imagen o lo puedo dejar así
  } catch {
    fechaFormat = fechaCancelacion;
  }

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
      <Box mb={10}>
        <Text m={0}>Guatemala</Text>
        <Text m={0}>{fechaActual}</Text>
      </Box>

      <Box mb={8}>
        <Text m={0}>Señor (ra) (srita.)</Text>
        <Text m={0}>Guatemala</Text>
      </Box>

      <Text mb={8}>{fullName}</Text>

      <Text mb={6} textAlign="justify">
        Con la presente hacemos de su conocimiento que su <strong>CONTRATO DE TRABAJO</strong> queda cancelado a partir de la presente fecha <strong>{fechaFormat}</strong>, por causa justificada en base al Artículo 77 inciso d) del Código de Trabajo
      </Text>

      <Text mb={8} textAlign="justify">
        Por lo anterior le informamos que ya se han dado los avisos necesarios a las instancias que correspondan para iniciar el proceso de su desvinculación de la empresa.
      </Text>

      <Text mb={16}>
        Sin otro particular, atentamente,
      </Text>
      
      <Box mb={24}>
        <Text m={0} textDecoration="underline">{representante || '_____________________'}</Text>
        <Text m={0}>Recursos Humanos</Text>
      </Box>

      <Box textAlign="center" mt="auto" pt={16}>
        <Text m={0} fontWeight="bold">{fullName}</Text>
        <Text m={0} fontSize="sm">Firma de conocimiento y aceptación</Text>
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

export default CancelacionDocument;
