import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import { DataContext } from '../context/DataContext';
import { apiFetch } from '../utils/api';
import { Plus, Edit2, Trash2, Shield, Search } from 'lucide-react';
import {
  Box, Flex, Heading, Text, Button, Table, Thead, Tbody, Tr, Th, Td,
  IconButton, Badge, Tooltip, useColorModeValue, Skeleton, SkeletonText,
  Input, InputGroup, InputLeftElement, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalFooter, ModalBody, ModalCloseButton, FormControl,
  FormLabel, Select, useDisclosure
} from '@chakra-ui/react';

export default function Users() {
  const { user, token } = useContext(AuthContext);
  const { confirmAction, showToast } = useContext(AppContext);
  const { departments } = useContext(DataContext);
  
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingUser, setEditingUser] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: '',
    idDepartamento: ''
  });

  const [isSaving, setIsSaving] = useState(false);

  // Role permissions logic
  const isLimitedCreator = user?.role === 'NOMINA' || user?.role === 'DIGITADOR';
  const availableRoles = isLimitedCreator 
    ? ['NOMINA', 'DIGITADOR'] 
    : ['ADMIN', 'GERENTE GENERAL', 'NOMINA', 'GERENTE', 'SOLICITANTE', 'DIGITADOR', 'AUDITOR'];
  const roleRequiresDepartment = ['SOLICITANTE', 'GERENTE'].includes(formData.role);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        showToast('Error al cargar usuarios', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, [token]);

  const handleOpenModal = (userToEdit = null) => {
    if (userToEdit) {
      // Prevent NOMINA/DIGITADOR from editing ADMINs or GERENTE GENERAL
      if (isLimitedCreator && userToEdit.role !== 'NOMINA' && userToEdit.role !== 'DIGITADOR') {
        showToast('No tienes permisos para editar este rol', 'warning');
        return;
      }
      setEditingUser(userToEdit);
      setFormData({
        name: userToEdit.name,
        username: userToEdit.username || '',
        email: userToEdit.email,
        password: '', // Blank for security
        role: userToEdit.role,
        idDepartamento: userToEdit.idDepartamento || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        username: '',
        email: '',
        password: '',
        role: isLimitedCreator ? 'DIGITADOR' : 'SOLICITANTE',
        idDepartamento: ''
      });
    }
    onOpen();
  };

  const handleSave = async () => {
    if (roleRequiresDepartment && !formData.idDepartamento) {
      showToast('El departamento es obligatorio para SOLICITANTE y GERENTE', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const url = editingUser 
        ? `/api/users/${editingUser.id}`
        : `/api/users`;
      
      const method = editingUser ? 'PUT' : 'POST';

      const payload = { ...formData };
      if (editingUser && !payload.password) {
        delete payload.password; // Don't update password if blank
      }

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar');
      }

      showToast(`Usuario ${editingUser ? 'actualizado' : 'creado'} exitosamente`, 'success');
      fetchUsers();
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id, role) => {
    if (isLimitedCreator && role !== 'NOMINA' && role !== 'DIGITADOR') {
      showToast('No tienes permisos para eliminar este rol', 'warning');
      return;
    }
    
    confirmAction('¿Estás seguro de eliminar a este usuario? Esta acción no se puede deshacer.', async () => {
      try {
        const res = await apiFetch(`/api/users/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          setUsers(users.filter(u => u.id !== id));
          showToast('Usuario eliminado', 'success');
        } else {
          const errorData = await res.json();
          showToast(errorData.error || 'Error al eliminar', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Error al eliminar', 'error');
      }
    });
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (role) => {
    switch (role) {
      case 'ADMIN': return 'red';
      case 'GERENTE GENERAL': return 'orange';
      case 'GERENTE': return 'yellow';
      case 'NOMINA': return 'purple';
      case 'AUDITOR': return 'teal';
      case 'DIGITADOR': return 'blue';
      case 'SOLICITANTE': return 'green';
      default: return 'gray';
    }
  };

  const getDepartmentName = (departmentId) => {
    if (!departmentId) return 'Sin asignar';
    return (departments || []).find(d => String(d.id) === String(departmentId))?.nombre_dimension || departmentId;
  };

  // Color modes
  const tableContainerBg = useColorModeValue('white', 'rgba(15, 23, 42, 0.8)');
  const tableBorderColor = useColorModeValue('gray.200', 'whiteAlpha.100');
  const editHoverBg = useColorModeValue('accent.50', 'whiteAlpha.100');
  const deleteHoverBg = useColorModeValue('red.50', 'whiteAlpha.100');
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400');
  const toolbarBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const searchInputBg = useColorModeValue('white', 'blackAlpha.300');
  const tableHeaderBg = useColorModeValue('gray.50', 'blackAlpha.300');
  const rowHoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  const modalFooterBorder = useColorModeValue('gray.100', 'whiteAlpha.100');

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        mb={6}
        flexWrap="wrap"
        gap={4}
      >
        <Box>
          <Heading size="lg" fontWeight={800} mb={1}>
            Gestión de Usuarios
          </Heading>
          <Text color={mutedTextColor} fontSize="md">
            Crea usuarios y asigna roles en el sistema.
          </Text>
        </Box>
        <Button 
          colorScheme="brand" 
          leftIcon={<Plus size={16} />} 
          onClick={() => handleOpenModal()} 
          borderRadius="lg" 
          transition="all 0.3s"
          _hover={{ shadow: 'lg' }}
        >
          Nuevo Usuario
        </Button>
      </Flex>

      <Box bg={tableContainerBg} borderRadius="2xl" border="1px solid" borderColor={tableBorderColor} overflow="hidden" boxShadow="sm">
        <Flex p={4} borderBottom="1px solid" borderColor={tableBorderColor} bg={toolbarBg}>
          <InputGroup maxW="400px">
            <InputLeftElement pointerEvents="none"><Search size={18} color="gray.400" /></InputLeftElement>
            <Input 
              placeholder="Buscar por nombre o correo..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              bg={searchInputBg}
              borderRadius="xl"
            />
          </InputGroup>
        </Flex>

        <Box overflowX="auto">
          <Table variant="simple">
            <Thead bg={tableHeaderBg}>
              <Tr>
                <Th>ID</Th>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                <Th>Rol</Th>
                <Th>Departamento</Th>
                <Th textAlign="right">Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <Tr key={i}>
                    <Td><Skeleton height="20px" width="40px" /></Td>
                    <Td><Skeleton height="20px" width="150px" /></Td>
                    <Td><Skeleton height="20px" width="200px" /></Td>
                    <Td><Skeleton height="20px" width="80px" /></Td>
                    <Td><Skeleton height="20px" width="110px" /></Td>
                    <Td><Skeleton height="32px" width="80px" ml="auto" /></Td>
                  </Tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <Tr>
                  <Td colSpan={6} textAlign="center" py={10} color="gray.500">
                    No se encontraron usuarios
                  </Td>
                </Tr>
              ) : (
                filteredUsers.map(u => (
                  <Tr key={u.id} _hover={{ bg: rowHoverBg }} transition="background 0.2s">
                    <Td fontWeight="bold" color="gray.500">#{u.id}</Td>
                    <Td fontWeight="600">{u.name}</Td>
                    <Td color="gray.500">{u.email}</Td>
                    <Td>
                      <Badge colorScheme={getRoleColor(u.role)} px={3} py={1} borderRadius="full" fontSize="xs">
                        {u.role}
                      </Badge>
                    </Td>
                    <Td color={u.idDepartamento ? undefined : 'gray.500'}>
                      {getDepartmentName(u.idDepartamento)}
                    </Td>
                    <Td textAlign="right">
                      <Flex justify="flex-end" gap={2}>
                        <Tooltip label="Editar Usuario" placement="top">
                          <IconButton
                            icon={<Edit2 size={16} />}
                            aria-label="Editar"
                            size="sm"
                            variant="ghost"
                            colorScheme="brand"
                            _hover={{ bg: editHoverBg }}
                            onClick={() => handleOpenModal(u)}
                            isDisabled={isLimitedCreator && u.role !== 'NOMINA' && u.role !== 'DIGITADOR'}
                          />
                        </Tooltip>
                        <Tooltip label="Eliminar" placement="top">
                          <IconButton
                            icon={<Trash2 size={16} />}
                            aria-label="Eliminar"
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            _hover={{ bg: deleteHoverBg }}
                            onClick={() => handleDelete(u.id, u.role)}
                            isDisabled={user.id === u.id || (isLimitedCreator && u.role !== 'NOMINA' && u.role !== 'DIGITADOR')}
                          />
                        </Tooltip>
                      </Flex>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </Box>

      {/* Modal Crear/Editar */}
      <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl">
          <ModalHeader>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Flex direction="column" gap={4}>
              <FormControl isRequired>
                <FormLabel>Nombre Completo</FormLabel>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej. Juan Pérez" />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Correo Electrónico</FormLabel>
                <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="juan@ejemplo.com" />
              </FormControl>
              <FormControl>
                <FormLabel>Nombre de Usuario (Opcional)</FormLabel>
                <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="jperez" />
              </FormControl>
              <FormControl isRequired={!editingUser}>
                <FormLabel>{editingUser ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}</FormLabel>
                <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Rol en el Sistema</FormLabel>
                <Select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value, idDepartamento: ['SOLICITANTE', 'GERENTE'].includes(e.target.value) ? formData.idDepartamento : ''})}>
                  {availableRoles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
              </FormControl>
              {roleRequiresDepartment && (
                <FormControl isRequired>
                  <FormLabel>Departamento</FormLabel>
                  <Select
                    placeholder="Selecciona un departamento"
                    value={formData.idDepartamento}
                    onChange={e => setFormData({...formData, idDepartamento: e.target.value})}
                  >
                    {(departments || []).map(department => (
                      <option key={department.id} value={department.id}>
                        {department.nombre_dimension}
                      </option>
                    ))}
                  </Select>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Los cambios de departamento se aplican al iniciar sesion nuevamente.
                  </Text>
                </FormControl>
              )}
            </Flex>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={modalFooterBorder}>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
            <Button colorScheme="brand" onClick={handleSave} isLoading={isSaving} loadingText="Guardando...">
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
