import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calculator, History,
  Building2, Gift, Sun, Moon, LogOut, ChevronLeft, Hexagon
} from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Typography, IconButton, Avatar, Divider, Tooltip, useTheme
} from '@mui/material';

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Empleados', icon: Users },
  { to: '/payroll', label: 'Nómina', icon: Calculator },
  { to: '/history', label: 'Historial', icon: History },
  { to: '/companies', label: 'Empresas', icon: Building2 },
  { to: '/bonuses', label: 'Bonos', icon: Gift },
];

export default function Sidebar() {
  const { theme: themeMode, toggleTheme } = useContext(AppContext);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const muiTheme = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* Brand */}
      <Box sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(14,165,233,0.35)',
          }}
        >
          <Hexagon size={20} strokeWidth={2.5} />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.2, letterSpacing: '-0.5px' }}>
            NóminaPro
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
            Sistema de Nómina
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ mx: 2, mb: 1 }} />

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
        <Typography
          variant="overline"
          sx={{ px: 1.5, mb: 1, display: 'block', color: 'text.secondary', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em' }}
        >
          Menú Principal
        </Typography>
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <ListItem key={to} disablePadding>
              <ListItemButton
                component={NavLink}
                to={to}
                sx={{
                  borderRadius: 2,
                  py: 1.1,
                  px: 1.5,
                  color: 'text.secondary',
                  transition: 'all 0.2s ease',
                  '&.active': {
                    bgcolor: themeMode === 'dark' ? 'rgba(14, 165, 233, 0.12)' : 'rgba(2, 132, 199, 0.1)',
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: '60%',
                      borderRadius: '0 4px 4px 0',
                      bgcolor: 'primary.main',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'text.primary',
                    '& .MuiListItemIcon-root': {
                      color: 'text.primary',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit', transition: 'color 0.2s' }}>
                  <Icon size={20} />
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider sx={{ mx: 2 }} />

      {/* Bottom section: theme toggle + user */}
      <Box sx={{ p: 2 }}>
        {/* Theme toggle */}
        <Box
          onClick={toggleTheme}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 2,
            cursor: 'pointer',
            transition: 'all 0.2s',
            color: 'text.secondary',
            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
            mb: 1.5,
          }}
        >
          {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <Typography variant="body2" fontWeight={600}>
            {themeMode === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
          </Typography>
        </Box>

        {/* User card */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'background.default',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              fontWeight: 700,
              width: 36,
              height: 36,
              fontSize: '0.85rem',
            }}
          >
            {user?.name ? user.name.substring(0, 2).toUpperCase() : 'JA'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {user?.name || 'Usuario'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
              {user?.email || 'admin@nomina.com'}
            </Typography>
          </Box>
          <Tooltip title="Cerrar Sesión">
            <IconButton size="small" onClick={handleLogout} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
              <LogOut size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Drawer>
  );
}

export { DRAWER_WIDTH };
