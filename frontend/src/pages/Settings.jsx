import React, { useContext } from 'react';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import { User, Shield, Bell, Database, Palette, Smartphone, Globe } from 'lucide-react';

export default function Settings() {
  const { theme, toggleTheme, showToast } = useContext(AppContext);
  const { user } = useContext(AuthContext);

  const handleSave = () => {
    showToast('Configuraciones guardadas exitosamente', 'success');
  };

  return (
    <div className="animate-fade" style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Configuración del Sistema</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Gestiona tus preferencias, cuenta y parámetros del sistema de nóminas.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Menu Lateral de Configuración */}
        <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <button className="btn btn-ghost" style={{ justifyContent: 'flex-start', background: 'var(--accent-subtle)', color: 'var(--accent-light)' }}>
              <User size={18} style={{ marginRight: '0.5rem' }} /> Mi Perfil
            </button>
            <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }}>
              <Palette size={18} style={{ marginRight: '0.5rem' }} /> Apariencia
            </button>
            <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }}>
              <Shield size={18} style={{ marginRight: '0.5rem' }} /> Seguridad
            </button>
            <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }}>
              <Database size={18} style={{ marginRight: '0.5rem' }} /> Base de Datos
            </button>
          </div>
        </div>

        {/* Panel Principal de Configuración */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Tarjeta: Mi Perfil */}
          <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={20} color="var(--accent)" /> Datos Personales
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre Completo</label>
                <input type="text" className="input-field" defaultValue={user?.name || 'Administrador'} />
              </div>
              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input type="email" className="input-field" defaultValue={user?.email || 'admin@nomina.com'} disabled style={{ opacity: 0.7 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Rol en el Sistema</label>
                <input type="text" className="input-field" defaultValue={(user?.role || 'admin').toUpperCase()} disabled style={{ opacity: 0.7 }} />
              </div>
            </div>
          </div>

          {/* Tarjeta: Apariencia */}
          <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Palette size={20} color="var(--accent)" /> Preferencias de Interfaz
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0' }}>Modo Oscuro</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cambia entre el tema claro (Corporate) y oscuro (Slate).</p>
              </div>
              <button 
                className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`} 
                onClick={toggleTheme}
              >
                {theme === 'dark' ? 'Activado' : 'Desactivado'}
              </button>
            </div>
          </div>

          {/* Tarjeta: Base de Datos */}
          <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} color="var(--accent)" /> Conexión MySQL
            </h2>
            <div style={{ padding: '1rem', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'currentColor', boxShadow: '0 0 8px currentColor' }}></div>
              <span style={{ fontWeight: 600 }}>Conectado a nomina_db en localhost (Puerto 3306)</span>
            </div>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn btn-ghost">Restablecer Valores</button>
            <button className="btn btn-primary" onClick={handleSave}>Guardar Configuraciones</button>
          </div>

        </div>
      </div>
    </div>
  );
}
