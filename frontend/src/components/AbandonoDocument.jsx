import React from 'react';
import { Box, Text } from '@chakra-ui/react';

const AbandonoDocument = React.forwardRef(({ emp, fechaFalta, representante, isPreview = false }, ref) => {
  if (!emp || !fechaFalta) return <div ref={ref} style={{ display: 'none' }} />;

  // Formatear la fecha actual (Guatemala, DD de mes del YYYY)
  const hoy = new Date();
  const optionsCurrentDate = { year: 'numeric', month: 'long', day: 'numeric' };
  const fechaActual = hoy.toLocaleDateString('es-GT', optionsCurrentDate);

  // Formatear la fecha de falta (DD de mes del YYYY)
  let fechaFaltaFormat = '';
  try {
    const [year, month, day] = fechaFalta.split('-');
    const dateObj = new Date(year, month - 1, day);
    fechaFaltaFormat = dateObj.toLocaleDateString('es-GT', optionsCurrentDate);
  } catch(e) {
    fechaFaltaFormat = fechaFalta;
  }

  const fullName = `${emp.primer_nombre || ''} ${emp.segundo_nombre || ''} ${emp.otro_nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim() || 'Empleado';

  const content = (
    <Box
      ref={!isPreview ? ref : null}
      bg="white"
      color="black"
      w={isPreview ? "100%" : "216mm"} // Letter width
      h={isPreview ? "auto" : "277mm"} // Slightly less than Letter height to prevent blank 2nd page
      p={isPreview ? 6 : "20mm"}  // margins
      fontFamily="'Times New Roman', Times, serif"
      fontSize={isPreview ? "sm" : "12pt"}
      lineHeight="1.5"
      boxShadow={isPreview ? "sm" : "none"}
      borderRadius={isPreview ? "md" : "none"}
      border={isPreview ? "1px solid" : "none"}
      borderColor="gray.200"
    >
      <Text mb={8}>Guatemala, {fechaActual}</Text>

      <Box mb={8}>
        <Text m={0}>Señores</Text>
        <Text m={0}>Inspección de trabajo</Text>
        <Text m={0}>Ministerio de trabajo</Text>
        <Text m={0}>Guatemala</Text>
      </Box>

      <Text mb={6}>Estimados señores</Text>

      <Text mb={8} textAlign="justify">
        Con la presente se informa que el señor <strong>{fullName}</strong>, quien se identifica con DPI No. <strong>{emp.dpi || '_________'}</strong>; no se ha presentado a sus labores regulares desde el día <strong>{fechaFaltaFormat}</strong>; desconocemos los motivos o razón para la ausencia indicada, por lo que basados en el artículo 76 inciso F del código de trabajo, se considera esta acción como
      </Text>

      <Text mb={8} textAlign="center" fontWeight="bold" textDecoration="underline">
        ABANDONO DE LABORES.
      </Text>

      <Text mb={8}>
        Sirvanse darle el trámite correspondiente a este aviso.
      </Text>

      <Text mb={16}>
        Sin otro particular, atentamente,
      </Text>

      <Box>
        <Text m={0} textDecoration="underline">{representante || '_____________________'}</Text>
        <Text m={0}>Recursos Humanos</Text>
      </Box>
    </Box>
  );

  if (isPreview) {
    return content;
  }

  return (
    <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '210mm' }}>
      {content}
    </div>
  );
});

export default AbandonoDocument;
