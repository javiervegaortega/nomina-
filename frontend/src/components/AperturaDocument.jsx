import React from 'react';
import { Box, Text } from '@chakra-ui/react';

const AperturaDocument = React.forwardRef(({ emp, nombreBanco, representante, isPreview = false }, ref) => {
  if (!emp) return <div ref={ref} style={{ display: 'none' }} />;

  // Formatear la fecha actual
  const hoy = new Date();
  const optionsCurrentDate = { year: 'numeric', month: 'long', day: 'numeric' };
  const fechaActual = hoy.toLocaleDateString('es-GT', optionsCurrentDate);

  const fullName = `${emp.primer_nombre || ''} ${emp.segundo_nombre || ''} ${emp.otro_nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim() || 'Empleado';

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

      <Box mb={10}>
        <Text m={0} fontWeight="bold">Señores</Text>
        <Text m={0} fontWeight="bold" textTransform="uppercase">{nombreBanco || 'NOMBRE DEL BANCO'}</Text>
        <Text m={0}>Presente</Text>
      </Box>

      <Text mb={8}>Estimado Jefe de Agencia:</Text>

      <Text mb={8} textAlign="justify">
        Por este medio solicito la apertura de cuenta <strong>Monetaria Planilla</strong> a nombre de <strong>{fullName.toUpperCase()}</strong> quien se identifica con No. de DPI, <strong>{emp.dpi || '_________'}</strong> Extendida por el RENAP, quien inició a laborar en la presente fecha
      </Text>

      <Text mb={8} textAlign="justify">
        Agradezco considerar que el uso de dicha cuenta es para realizar pagos de planilla provenientes de la cuenta <strong>000-018447-3 de UNION HERMANOS, S.A.</strong> Por esta razón agradecemos la apertura con valor Q.0.00.
      </Text>

      <Text mb={16}>
        De antemano agradezco su apoyo, sin otro en particular.
      </Text>
      
      <Text mb={16}>
        Cordialmente,
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
    <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '216mm' }}>
      {content}
    </div>
  );
});

export default AperturaDocument;
