import React, { useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { AuthContext } from '../context/AuthContext';
import { User, Shield, Bell, Database, Palette, Smartphone, Globe } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function Settings() {
  const { theme, toggleTheme, showToast } = useContext(AppContext);
  const { user } = useContext(AuthContext);
  
  const perfilRef = useRef(null);
  const aparienciaRef = useRef(null);
  const basedatosRef = useRef(null);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSave = () => {
    showToast('Configuraciones guardadas exitosamente', 'success');
  };

  return (
    <div className="animate-fade" style={{ padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Configuración del Sistema</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Gestiona tus preferencias, cuenta y parámetros del sistema de nóminas.</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          
          {/* Tarjeta: Mi Perfil */}
          <div ref={perfilRef} style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
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
          <div ref={aparienciaRef} style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
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

          {/* Tarjeta: Integración SAP */}
          <div ref={basedatosRef} style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={20} color="var(--accent)" /> Integración ERP (SAP B1)
            </h2>
            <div style={{ padding: '1rem', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>
                Sincroniza los Centros de Costo desde SAP B1 para actualizar los Departamentos, Áreas, Divisiones y Subdivisiones.
              </p>
              <button 
                className="btn btn-primary" 
                onClick={async () => {
                  showToast('Iniciando sincronización con SAP...', 'success');
                  try {
                    const token = localStorage.getItem('nomina-token');
                    const res = await apiFetch('/api/sap/sync-catalogs', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if(res.ok) {
                      showToast(data.message || 'Sincronización completada', 'success');
                    } else {
                      showToast(data.error || 'Error al sincronizar', 'error');
                    }
                  } catch (e) {
                    showToast('Error de conexión', 'error');
                  }
                }}
              >
                Sincronizar Catálogos Manual
              </button>
            </div>
          </div>

        </div>
    </div>
  );
}
