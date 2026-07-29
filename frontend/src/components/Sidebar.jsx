import React, { useContext, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calculator, History,
  Building2, Sun, Moon, LogOut,
  ChevronLeft, ChevronRight, Network,
  Menu as MenuIcon, Shield, Settings, Ban, Receipt, ClipboardList
} from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import {
  Box, Flex, Text, IconButton, Tooltip, Divider, VStack, Image,
  useColorModeValue, useBreakpointValue,
  Drawer, DrawerOverlay, DrawerContent, DrawerCloseButton,
  Menu, MenuButton, MenuList, MenuItem
} from '@chakra-ui/react';

const ALL_NAV_SECTIONS = [
  {
    title: 'Principal',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Nómina',
    items: [
      { to: '/employees', label: 'Empleados', icon: Users },
      { to: '/payroll', label: 'Nómina', icon: Calculator },
      { to: '/history', label: 'Historial', icon: History },
      { to: '/suspensions', label: 'Suspensiones', icon: Ban },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { to: '/operations', label: 'Reporte Operativo', icon: ClipboardList },
      { to: '/operations/bonuses-history', label: 'Historial Operaciones', icon: History },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/users', label: 'Usuarios', icon: Shield },
      { to: '/dimensions', label: 'Dimensiones', icon: Network },
      { to: '/companies', label: 'Empresas', icon: Building2 },
      { to: '/billing', label: 'Facturación', icon: Receipt },
    ],
  },
];

function isNavItemVisible(item, user) {
  if (!user) return false;
  const role = user.role;
  if (role === 'ADMIN' || role === 'GERENTE GENERAL') return true;
  if (role === 'NOMINA') return true;
  if (role === 'AUDITOR') {
    return (
      item.to !== '/operations' &&
      item.to !== '/operations/bonuses-history' &&
      item.to !== '/users' &&
      item.to !== '/billing' &&
      item.to !== '/payroll'
    );
  }
  if (role === 'DIGITADOR') {
    return item.to === '/employees' || item.to === '/users' || item.to === '/suspensions' || item.to === '/dashboard';
  }
  if (role === 'GERENTE') {
    return item.to === '/operations' || item.to === '/operations/bonuses-history';
  }
  if (role === 'SOLICITANTE') {
    return item.to === '/operations' || item.to === '/operations/bonuses-history';
  }
  return false;
}

export default function Sidebar() {
  const { theme: themeMode, toggleTheme, confirmAction } = useContext(AppContext);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isMobile = useBreakpointValue({ base: true, md: false });

  const drawerWidth = isCollapsed ? 80 : 260;

  // Color mode values
  const sidebarBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textSecondary = useColorModeValue('gray.500', 'gray.400');
  const textPrimary = useColorModeValue('gray.800', 'white');
  const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.100');
  const activeBg = useColorModeValue('rgba(2, 132, 199, 0.1)', 'rgba(14, 165, 233, 0.12)');
  const activeColor = useColorModeValue('brand.600', 'brand.300');
  const userCardBg = useColorModeValue('gray.50', 'gray.900');
  const brandSubtitle = useColorModeValue('gray.500', 'gray.500');
  const logoutHoverBg = useColorModeValue('red.50', 'whiteAlpha.100');
  const sidebarShadow = useColorModeValue('2px 0 12px rgba(0,0,0,0.03)', 'none');

  const handleLogout = () => {
    confirmAction('¿Estás seguro que deseas cerrar sesión?', () => {
      logout();
      navigate('/login');
    });
  };

  const NAV_SECTIONS = ALL_NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isNavItemVisible(item, user)),
    }))
    .filter((section) => section.items.length > 0);

  // Shared nav content renderer (used by both mobile drawer and desktop sidebar)
  const renderNavContent = (mobile = false) => (
    <>
      {/* Brand */}
      <Flex 
        align="center" 
        justify={!mobile && isCollapsed ? "center" : "flex-start"}
        direction={!mobile && isCollapsed ? "column" : "row"}
        gap={!mobile && isCollapsed ? 4 : 3} 
        p={!mobile && isCollapsed ? 4 : 6} 
        pb={4} 
        position="relative"
      >
        <Flex
          w="44px"
          h="44px"
          minW="44px"
          borderRadius="lg"
          bg="transparent"
          align="center"
          justify="center"
          cursor={!mobile && isCollapsed ? "pointer" : "default"}
          onClick={() => !mobile && isCollapsed && setIsCollapsed(false)}
        >
          <Image src="/favicon.png" boxSize="40px" objectFit="contain" />
        </Flex>

        {(mobile || !isCollapsed) && (
          <Box flex={1} whiteSpace="nowrap" opacity={1} transition="opacity 0.2s" ml={2}>
            <Text fontWeight={800} fontSize="md" lineHeight="1.2" letterSpacing="-0.5px" color={textPrimary}>
              Nómina
            </Text>
            <Text fontSize="0.68rem" color={brandSubtitle}>
              Sistema de Planilla
            </Text>
          </Box>
        )}

        {!mobile && (
          <IconButton
            icon={isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            size="xs"
            position={isCollapsed ? 'relative' : 'absolute'}
            right={isCollapsed ? 'auto' : 4}
            variant="ghost"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle Sidebar"
            color={textSecondary}
          />
        )}
      </Flex>

      <Divider mx={!mobile && isCollapsed ? 2 : 4} mb={2} borderColor={borderColor} transition="margin 0.3s" />

      {/* Navigation */}
      <Box flex={1} overflowY="auto" overflowX="hidden" px={!mobile && isCollapsed ? 2 : 3} py={2} css={{ '&::-webkit-scrollbar': { width: '4px' } }}>
        <VStack spacing={4} align="stretch">
          {NAV_SECTIONS.map((section) => {
            const showSectionTitle = mobile || !isCollapsed;

            return (
              <Box key={section.title}>
                {showSectionTitle && (
                  <Text
                    px={3}
                    mb={2}
                    fontSize="0.65rem"
                    fontWeight={700}
                    letterSpacing="0.1em"
                    textTransform="uppercase"
                    color={textSecondary}
                    whiteSpace="nowrap"
                  >
                    {section.title}
                  </Text>
                )}
                <VStack spacing="2px" align="stretch">
                  {section.items.map((item) => {
                    const { to, label, icon: Icon } = item;
                    const showLabel = mobile || !isCollapsed;

                    const linkContent = (
                      <Box
                        key={to}
                        as={NavLink}
                        to={to}
                        end={to !== '/billing' && to !== '/dimensions'}
                        display="flex"
                        alignItems="center"
                        justifyContent={!mobile && isCollapsed ? 'center' : 'flex-start'}
                        gap={!mobile && isCollapsed ? 0 : 3}
                        px={!mobile && isCollapsed ? 0 : 3}
                        py="9px"
                        borderRadius="lg"
                        position="relative"
                        transition="all 0.2s ease"
                        textDecoration="none"
                        color={textSecondary}
                        fontWeight={600}
                        fontSize="0.875rem"
                        _hover={{
                          bg: hoverBg,
                          color: textPrimary,
                          textDecoration: 'none',
                        }}
                        _activeLink={{
                          bg: activeBg,
                          color: activeColor,
                          _before: {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            w: '3px',
                            borderRadius: '0 4px 4px 0',
                            bg: activeColor,
                          },
                        }}
                        sx={{
                          '& svg': {
                            transition: 'color 0.2s',
                          },
                        }}
                        onClick={mobile ? () => setMobileOpen(false) : undefined}
                      >
                        <Box as="span" display="flex" alignItems="center" minW="20px" justifyContent="center">
                          <Icon size={20} />
                        </Box>
                        {showLabel && (
                          <Text as="span" fontSize="0.875rem" fontWeight={600} whiteSpace="nowrap">
                            {label}
                          </Text>
                        )}
                      </Box>
                    );

                    return !mobile && isCollapsed ? (
                      <Tooltip key={to} label={label} placement="right" hasArrow>
                        {linkContent}
                      </Tooltip>
                    ) : (
                      linkContent
                    );
                  })}
                </VStack>
              </Box>
            );
          })}
        </VStack>
      </Box>

      <Divider mx={!mobile && isCollapsed ? 2 : 4} borderColor={borderColor} transition="margin 0.3s" />

      {/* Bottom section: theme toggle + user */}
      <Box p={!mobile && isCollapsed ? 2 : 4}>
        {/* Theme toggle */}
        <Tooltip label={themeMode === 'dark' ? 'Modo Claro' : 'Modo Oscuro'} placement="right" isDisabled={mobile || !isCollapsed} hasArrow>
          <Flex
            align="center"
            justify={!mobile && isCollapsed ? 'center' : 'flex-start'}
            gap={!mobile && isCollapsed ? 0 : 3}
            px={!mobile && isCollapsed ? 0 : 3}
            py={2}
            borderRadius="lg"
            cursor="pointer"
            transition="all 0.2s"
            color={textSecondary}
            _hover={{ bg: hoverBg, color: textPrimary }}
            mb={3}
            onClick={toggleTheme}
            role="button"
            tabIndex={0}
          >
            {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {(mobile || !isCollapsed) && (
              <Text fontSize="sm" fontWeight={600} whiteSpace="nowrap">
                {themeMode === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              </Text>
            )}
          </Flex>
        </Tooltip>

        {/* User card */}
        <Menu placement="top-end">
          <MenuButton as={Box} w="100%" cursor="pointer" borderRadius="lg" _hover={{ bg: hoverBg }}>
            <Flex
              align="center"
              justify={!mobile && isCollapsed ? 'center' : 'space-between'}
              gap={!mobile && isCollapsed ? 0 : 3}
              p={!mobile && isCollapsed ? 2 : 3}
              borderRadius="lg"
              bg={!mobile && isCollapsed ? 'transparent' : userCardBg}
              border={!mobile && isCollapsed ? 'none' : '1px solid'}
              borderColor={borderColor}
              position="relative"
            >
              <Tooltip label={user?.name || 'Usuario'} placement="right" isDisabled={mobile || !isCollapsed} hasArrow>
                <Flex
                  w="36px"
                  h="36px"
                  minW="36px"
                  borderRadius="full"
                  bgGradient="linear(135deg, brand.400, brand.600)"
                  align="center"
                  justify="center"
                  color="white"
                  fontWeight={700}
                  fontSize="0.85rem"
                >
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : 'JA'}
                </Flex>
              </Tooltip>

              {(mobile || !isCollapsed) && (
                <Box flex={1} minW={0} whiteSpace="nowrap" textAlign="left">
                  <Text fontSize="sm" fontWeight={700} color={textPrimary} isTruncated>
                    {user?.name || 'Usuario'}
                  </Text>
                  <Text fontSize="0.7rem" color={textSecondary} isTruncated>
                    {user?.username || 'username'}
                  </Text>
                </Box>
              )}
            </Flex>
          </MenuButton>
          <MenuList zIndex={1500} bg={sidebarBg} borderColor={borderColor} shadow="lg">
            <MenuItem icon={<Settings size={16} />} bg={sidebarBg} _hover={{ bg: hoverBg }} onClick={() => navigate('/settings')}>
              Configuración
            </MenuItem>
            <MenuItem icon={<LogOut size={16} />} bg={sidebarBg} _hover={{ bg: hoverBg }} color="red.500" onClick={handleLogout}>
              Cerrar Sesión
            </MenuItem>
          </MenuList>
        </Menu>
      </Box>
    </>
  );

  // Mobile: hamburger button + Drawer
  if (isMobile) {
    return (
      <>
        <IconButton
          aria-label="Menu"
          icon={<MenuIcon size={22} />}
          onClick={() => setMobileOpen(true)}
          position="fixed"
          top={3}
          left={3}
          zIndex={1401}
          size="md"
          variant="solid"
          colorScheme="brand"
          borderRadius="lg"
          boxShadow="lg"
          display={{ base: 'flex', md: 'none' }}
        />
        <Drawer isOpen={mobileOpen} placement="left" onClose={() => setMobileOpen(false)}>
          <DrawerOverlay />
          <DrawerContent bg={sidebarBg} maxW="280px" display="flex" flexDirection="column">
            <DrawerCloseButton />
            {renderNavContent(true)}
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: existing sidebar
  return (
    <Box
      as="nav"
      w={`${drawerWidth}px`}
      minW={`${drawerWidth}px`}
      h="100vh"
      position="sticky"
      top={0}
      bg={sidebarBg}
      borderRight="1px solid"
      borderColor={borderColor}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      boxShadow={sidebarShadow}
      transition="width 0.3s ease, min-width 0.3s ease"
    >
      {renderNavContent(false)}
    </Box>
  );
}

export const DRAWER_WIDTH = 260;
