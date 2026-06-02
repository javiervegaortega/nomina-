import React from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton,
  Box, Flex, Text, Avatar, Badge, Grid, GridItem, Divider, Button,
  useColorModeValue, Icon
} from '@chakra-ui/react';
import { Briefcase, Building2, DollarSign, Calendar, Fingerprint, Award, Edit2 } from 'lucide-react';
import { formatQ } from '../data/mockData';

const InfoItem = ({ icon, label, value }) => {
  const bg = useColorModeValue('brand.50', 'rgba(59, 130, 246, 0.1)');
  const iconColor = useColorModeValue('brand.600', '#60a5fa');
  const subColor = useColorModeValue('gray.500', '#94a3b8');
  const textC = useColorModeValue('gray.800', '#e2e8f0');

  return (
    <GridItem>
      <Flex align="center" gap={3}>
        <Flex 
          w="36px" 
          h="36px" 
          borderRadius="lg" 
          bg={bg} 
          color={iconColor}
          align="center" 
          justify="center"
        >
          <Icon as={icon} size={18} />
        </Flex>
        <Box>
          <Text fontSize="10px" color={subColor} fontWeight="700" textTransform="uppercase" letterSpacing="wider">
            {label}
          </Text>
          <Text fontSize="sm" fontWeight="600" color={textC}>
            {value || '-'}
          </Text>
        </Box>
      </Flex>
    </GridItem>
  );
};

export default function EmployeeViewModal({ isOpen, onClose, employee, companies, onEdit }) {
  const modalBg = useColorModeValue('white', '#0f111a');
  const textColor = useColorModeValue('gray.800', '#e2e8f0');
  const subtextColor = useColorModeValue('gray.500', '#94a3b8');
  const cardBg = useColorModeValue('gray.50', '#1a1f2e');
  const borderColor = useColorModeValue('gray.200', '#2d3748');
  const buttonHoverBg = useColorModeValue('gray.100', 'whiteAlpha.100');

  if (!employee) return null;

  const getFullName = (e) => `${e.primer_nombre || ''} ${e.segundo_nombre || ''} ${e.primer_apellido || ''} ${e.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim() || 'Sin Nombre';

  const companyName = companies?.find(c => c.id === employee.empresa_principal)?.nombre_comercial || 'Sin Asignar';

  const getDist = (emp) => {
    if (typeof emp.dist === 'string') {
      try { return JSON.parse(emp.dist); } catch(e) { return {}; }
    }
    return emp.dist || {};
  };

  const parsedDist = getDist(employee);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent bg={modalBg} borderRadius="2xl" boxShadow="2xl" overflow="hidden">
        <ModalCloseButton color="white" _hover={{ bg: 'whiteAlpha.200' }} mt={2} zIndex={10} />
        
        {/* Banner Header */}
        <Box h="110px" bg="linear-gradient(135deg, var(--chakra-colors-brand-500) 0%, var(--chakra-colors-brand-800) 100%)" position="relative">
          <Avatar 
            size="2xl" 
            name={getFullName(employee)} 
            position="absolute"
            bottom="-40px"
            left="32px"
            border="4px solid"
            borderColor={modalBg}
            bg="brand.300"
            color="white"
            boxShadow="lg"
          />
        </Box>

        <ModalBody pt="55px" px={{ base: 6, md: 8 }} pb={8}>
          <Flex justify="space-between" align="flex-start" mb={6}>
            <Box>
              <Text fontSize="2xl" fontWeight="800" color={textColor} lineHeight="1.2">
                {getFullName(employee)}
              </Text>
              <Text fontSize="md" color={subtextColor} mt={1} fontWeight="500">
                {employee.puesto || 'Puesto no especificado'}
              </Text>
            </Box>
            <Badge 
              colorScheme={employee.estado === 'Activo' ? 'green' : 'red'} 
              px={3} py={1} borderRadius="full" fontSize="xs" fontWeight="700"
              boxShadow="sm"
            >
              {employee.estado || 'Inactivo'}
            </Badge>
          </Flex>

          <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={5} bg={cardBg} p={5} borderRadius="xl" border="1px solid" borderColor={borderColor}>
            <InfoItem icon={Fingerprint} label="DPI" value={employee.dpi} />
            <InfoItem icon={Building2} label="Empresa Principal" value={companyName} />
            <InfoItem icon={Briefcase} label="Departamento" value={employee.departamento_laboral} />
            <InfoItem icon={DollarSign} label="Sueldo Ordinario" value={formatQ(employee.sueldo_ordinario || 0)} />
            <InfoItem icon={Calendar} label="Fecha Ingreso" value={(employee.fecha_ingreso || employee.fecha_inicio || '').split('T')[0]} />
            <InfoItem icon={Award} label="Bonificación Ley" value={formatQ(employee.bonificacion_ley || 250)} />
          </Grid>

          {Object.keys(parsedDist).length > 0 && (
            <Box mt={6}>
              <Text fontSize="sm" fontWeight="700" color={textColor} mb={3}>Distribución Salarial</Text>
              <Flex direction="column" gap={2}>
                {companies?.map(c => {
                  const pct = parsedDist[c.id];
                  if (!pct) return null;
                  return (
                    <Flex key={c.id} justify="space-between" align="center" bg={cardBg} p={3} borderRadius="lg" border="1px solid" borderColor={borderColor} transition="all 0.2s" _hover={{ borderColor: 'brand.400' }}>
                      <Flex align="center" gap={3}>
                        <Box w="10px" h="10px" borderRadius="full" bg={c.color || 'brand.500'} />
                        <Text fontSize="sm" color={textColor} fontWeight="600">{c.nombre_comercial}</Text>
                        {c.id === employee.empresa_principal && (
                          <Badge colorScheme="green" fontSize="10px" px={2} borderRadius="full">PRINCIPAL</Badge>
                        )}
                      </Flex>
                      <Badge colorScheme="brand" variant="subtle" fontSize="sm" px={2}>{pct}%</Badge>
                    </Flex>
                  );
                })}
              </Flex>
            </Box>
          )}

          {/* Quick Stats of Records */}
          {employee.records && employee.records.length > 0 && (
            <Box mt={6}>
              <Text fontSize="sm" fontWeight="700" color={textColor} mb={3}>Resumen de Expediente</Text>
              <Grid templateColumns="repeat(auto-fill, minmax(100px, 1fr))" gap={3}>
                {['estudio', 'curso', 'puesto', 'evento', 'record', 'empresa_anterior', 'vehiculo'].map(type => {
                  const count = employee.records.filter(r => r.type === type).length;
                  if (count === 0) return null;
                  const labels = {
                    estudio: 'Estudios', curso: 'Cursos', puesto: 'Puestos',
                    evento: 'Eventos', record: 'Llamadas Att.', empresa_anterior: 'Exp. Previa', vehiculo: 'Vehículos'
                  };
                  return (
                    <Flex key={type} direction="column" align="center" bg={cardBg} p={2} borderRadius="lg" border="1px solid" borderColor={borderColor}>
                      <Text fontSize="10px" color={subtextColor} fontWeight="700" textTransform="uppercase">{labels[type]}</Text>
                      <Text fontSize="lg" fontWeight="800" color={textColor}>{count}</Text>
                    </Flex>
                  );
                })}
              </Grid>
            </Box>
          )}

          <Divider my={6} borderColor={borderColor} />

          <Flex justify="flex-end" gap={3}>
            <Button variant="ghost" onClick={onClose} color={subtextColor} _hover={{ bg: buttonHoverBg }}>
              Cerrar
            </Button>
            <Button colorScheme="blue" leftIcon={<Edit2 size={16} />} onClick={() => { onClose(); onEdit(employee); }}>
              Editar Empleado
            </Button>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
