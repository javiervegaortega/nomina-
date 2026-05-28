import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Hexagon, Sun, Moon, Settings, LogOut } from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import { AppBar, Toolbar, Box, Button, IconButton, Avatar, Tooltip } from '@mui/material';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/employees', label: 'Empleados' },
  { to: '/payroll', label: 'Nómina' },
  { to: '/history', label: 'Historial' },
  { to: '/companies', label: 'Empresas' },
  { to: '/bonuses', label: 'Bonos' },
];

export default function TopNavbar() {
  const { theme, toggleTheme } = useContext(AppContext);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', zIndex: 1100, position: 'relative' }}>
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          backgroundColor: 'background.paper',
          borderRadius: 4,
          maxWidth: 1200,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: theme === 'dark' ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.05)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 3 }, minHeight: '64px !important' }}>
          
          {/* Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ color: 'primary.main', display: 'flex' }}>
              <Hexagon size={24} strokeWidth={2.5} />
            </Box>
            <Box sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'text.primary', letterSpacing: '-0.5px' }}>
              NóminaPro
            </Box>
          </Box>

          {/* Links */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            {NAV_ITEMS.map(({ to, label }) => (
              <Button
                key={to}
                component={NavLink}
                to={to}
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  '&.active': {
                    backgroundColor: theme === 'dark' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(2, 132, 199, 0.1)',
                    color: 'primary.main',
                  },
                  '&:hover': {
                    color: 'text.primary',
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                {label}
              </Button>
            ))}
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Cambiar Tema">
              <IconButton onClick={toggleTheme} sx={{ color: 'text.secondary' }}>
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Configuración">
              <IconButton sx={{ color: 'text.secondary' }}>
                <Settings size={20} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Cerrar Sesión">
              <IconButton onClick={handleLogout} sx={{ color: 'error.main' }}>
                <LogOut size={20} />
              </IconButton>
            </Tooltip>

            <Avatar 
              sx={{ 
                ml: 1, 
                bgcolor: 'primary.main', 
                fontWeight: 700, 
                width: 36, 
                height: 36, 
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'JA'}
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>
    </Box>
  );
}
