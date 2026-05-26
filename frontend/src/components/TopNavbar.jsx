import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileSpreadsheet, Settings,
  Sun, Moon, Building2, Gift, History, Hexagon, LogOut
} from 'lucide-react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';

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
    <div className="top-nav-wrapper">
      <nav className="top-nav-island animate-slide-down">
        {/* Brand */}
        <div className="nav-brand">
          <div className="nav-brand-icon">
            <Hexagon size={20} strokeWidth={2.5} />
          </div>
          <span className="nav-brand-text">NóminaPro</span>
        </div>

        {/* Links */}
        <div className="nav-links">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `top-nav-link ${isActive ? 'active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Actions */}
        <div className="nav-actions">
          <button className="nav-action-btn" onClick={toggleTheme} title="Cambiar Tema">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button className="nav-action-btn" title="Configuración">
            <Settings size={18} />
          </button>

          <button className="nav-action-btn" title="Cerrar Sesión" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
            <LogOut size={18} />
          </button>

          <div className="nav-profile-btn" title={user?.name || 'Usuario'}>
            {user?.name ? user.name.substring(0, 2).toUpperCase() : 'JA'}
          </div>
        </div>
      </nav>
    </div>
  );
}
