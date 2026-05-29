import React, { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Tabs, TabList, Tab, TabPanels, TabPanel,
  FormControl, FormLabel, Input, Select,
  SimpleGrid, Box, Heading, Text, Button, Flex,
  useColorModeValue,
} from '@chakra-ui/react';

const INITIAL_FORM = {
  nit: '',
  nombre_comercial: '',
  razon_social: '',
  direccion: '',
  calle: '',
  apto: '',
  departamento: '',
  apartado_postal: '',
  telefono: '',
  fax: '',
  email: '',
  nomenclatura: '',
  numero: '',
  colonia: '',
  municipio: '',
  direccion_patrono: '',
  nombre_patrono: '',
  numero_patrono: '',
  nit_patrono: '',
  id_banco: '',
  id_estado: 1, // Default state
};

export default function CompanyFormModal({ isOpen, onClose, onSave, initialData }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [tabIndex, setTabIndex] = useState(0);

  const bgModal = useColorModeValue('white', 'gray.800');
  const bgFooter = useColorModeValue('gray.50', 'gray.900');
  const subtitleColor = useColorModeValue('gray.500', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const inputBg = useColorModeValue('white', 'gray.700');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({ ...INITIAL_FORM, ...initialData });
      } else {
        setForm(INITIAL_FORM);
      }
      setTabIndex(0);
    }
  }, [isOpen, initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="xl" bg={bgModal} overflow="hidden" mx={4} maxH="90vh" display="flex" flexDirection="column">
        {/* Header */}
        <ModalHeader pb={2} pt={6} px={6}>
          <Heading size="lg" fontWeight={700}>
            {initialData ? 'Editar Empresa' : 'Nueva Empresa'}
          </Heading>
          <Text fontSize="sm" color={subtitleColor} mt={1}>
            {initialData
              ? 'Edite los datos de la empresa.'
              : 'Cree una nueva empresa, llenando los campos que se solicitan.'}
          </Text>
        </ModalHeader>
        <ModalCloseButton top={4} right={4} />

        {/* Tabs */}
        <Tabs
          index={tabIndex}
          onChange={(index) => setTabIndex(index)}
          colorScheme="brand"
          variant="line"
          display="flex"
          flexDirection="column"
          flex="1"
          minH="0"
        >
          <Box px={6} borderBottom="1px" borderColor={borderColor}>
            <TabList border="none">
              <Tab
                fontWeight={600}
                fontSize="sm"
                _selected={{ color: 'brand.500', borderColor: 'brand.500' }}
                transition="all 0.3s"
              >
                Datos Generales
              </Tab>
              <Tab
                fontWeight={600}
                fontSize="sm"
                _selected={{ color: 'brand.500', borderColor: 'brand.500' }}
                transition="all 0.3s"
              >
                Más Datos
              </Tab>
            </TabList>
          </Box>

          {/* Body */}
          <ModalBody px={6} py={5} overflowY="auto" flex="1">
            <form id="companyForm" onSubmit={handleSubmit}>
              <TabPanels>
                {/* Tab 1 — Datos Generales */}
                <TabPanel p={0}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel fontSize="sm">NIT</FormLabel>
                      <Input
                        name="nit"
                        value={form.nit || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel fontSize="sm">Nombre Comercial</FormLabel>
                      <Input
                        name="nombre_comercial"
                        value={form.nombre_comercial || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl gridColumn={{ md: 'span 2' }}>
                      <FormLabel fontSize="sm">Dirección</FormLabel>
                      <Input
                        name="direccion"
                        value={form.direccion || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Razón Social</FormLabel>
                      <Input
                        name="razon_social"
                        value={form.razon_social || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Calle</FormLabel>
                      <Input
                        name="calle"
                        value={form.calle || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Apto.</FormLabel>
                      <Input
                        name="apto"
                        value={form.apto || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Departamento</FormLabel>
                      <Input
                        name="departamento"
                        value={form.departamento || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Apartado Postal</FormLabel>
                      <Input
                        name="apartado_postal"
                        value={form.apartado_postal || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Teléfono</FormLabel>
                      <Input
                        name="telefono"
                        value={form.telefono || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">FAX</FormLabel>
                      <Input
                        name="fax"
                        value={form.fax || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">E-Mail</FormLabel>
                      <Input
                        name="email"
                        type="email"
                        value={form.email || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Nomenclatura</FormLabel>
                      <Input
                        name="nomenclatura"
                        value={form.nomenclatura || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Número</FormLabel>
                      <Input
                        name="numero"
                        value={form.numero || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Colonia</FormLabel>
                      <Input
                        name="colonia"
                        value={form.colonia || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Municipio</FormLabel>
                      <Input
                        name="municipio"
                        value={form.municipio || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>
                  </SimpleGrid>
                </TabPanel>

                {/* Tab 2 — Más Datos */}
                <TabPanel p={0}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <FormControl>
                      <FormLabel fontSize="sm">Dirección Patrono</FormLabel>
                      <Input
                        name="direccion_patrono"
                        value={form.direccion_patrono || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Nombre Patrono</FormLabel>
                      <Input
                        name="nombre_patrono"
                        value={form.nombre_patrono || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Número Patrono</FormLabel>
                      <Input
                        name="numero_patrono"
                        value={form.numero_patrono || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">NIT Patrono</FormLabel>
                      <Input
                        name="nit_patrono"
                        value={form.nit_patrono || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm">Banco</FormLabel>
                      <Select
                        name="id_banco"
                        value={form.id_banco || ''}
                        onChange={handleChange}
                        bg={inputBg}
                        borderRadius="lg"
                        size="md"
                        placeholder="Ninguno"
                      >
                        <option value="1">Banco Industrial</option>
                        <option value="2">Banrural</option>
                        <option value="3">BAM</option>
                        <option value="4">GyT Continental</option>
                      </Select>
                    </FormControl>
                  </SimpleGrid>
                </TabPanel>
              </TabPanels>
            </form>
          </ModalBody>
        </Tabs>

        {/* Footer */}
        <ModalFooter
          bg={bgFooter}
          borderTop="1px"
          borderColor={borderColor}
          px={6}
          py={4}
          gap={3}
        >
          <Button
            variant="ghost"
            onClick={onClose}
            fontWeight={600}
            transition="all 0.3s"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="companyForm"
            colorScheme="brand"
            fontWeight={600}
            px={6}
            borderRadius="lg"
            boxShadow="sm"
            transition="all 0.3s"
            _hover={{ transform: 'translateY(-1px)', boxShadow: 'md' }}
            _active={{ transform: 'translateY(0)' }}
          >
            Guardar Empresa
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
