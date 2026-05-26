import React, { useState, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { Plus, Edit2, Trash2, X, Check, Building2, Users } from 'lucide-react';
import { formatQ } from '../data/mockData';

export default function Companies() {
  const { companies, addCompany, updateCompany, deleteCompany, employees } = useContext(DataContext);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ id: '', name: '', color: '#0D9488' });

  const openAdd = () => {
    setEditingId(null);
    setForm({ id: '', name: '', color: '#0D9488' });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ id: c.id, name: c.name, color: c.color });
    setShowModal(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateCompany(editingId, form);
    } else {
      addCompany(form);
    }
    setShowModal(false);
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <h1>Centro de Costos / Empresas</h1>
            <p>Empresas pagadoras y distribución de gastos operativos</p>
          </div>
        </div>
        <div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Agregar Empresa
          </button>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {companies.map((c, i) => {
            const empCount = employees.filter(e => e.company === c.name || (e.dist && e.dist[c.id] > 0)).length;
            const avgPct = employees.reduce((acc, e) => acc + (e.dist && e.dist[c.id] || 0), 0) / (employees.length || 1);
            
            return (
              <div key={c.id} className="card animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: c.gradient || c.color }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 'var(--radius-sm)',
                      background: `${c.color}15`, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: c.color, border: `1px solid ${c.color}30`
                    }}>
                      <Building2 size={22} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.15rem 0' }}>{c.name}</h3>
                      <span className="badge badge-neutral font-mono" style={{ fontSize: '0.65rem' }}>ID: {c.id.toUpperCase()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn-icon" onClick={() => openEdit(c)} title="Editar"><Edit2 size={16} /></button>
                    <button className="btn-icon text-danger" onClick={() => {
                      if (window.confirm(`¿Seguro que desea eliminar ${c.name}?`)) deleteCompany(c.id);
                    }} title="Eliminar"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Empleados Asignados</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.1rem', fontWeight: 700 }}>
                      <Users size={16} style={{ color: 'var(--accent-light)' }} /> {empCount}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Participación Promedio</div>
                    <div className="font-mono text-gold" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {avgPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {companies.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)' }}>
              <Building2 size={48} style={{ opacity: 0.3, marginBottom: '1rem', margin: '0 auto' }} />
              <p>No hay empresas registradas en el sistema.</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editingId ? 'Editar Empresa' : 'Registro de Empresa'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group-row" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Identificador Corto del Sistema</label>
                  <input className="input-field" value={form.id} onChange={e => setForm({...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})} placeholder="ej: proquima" disabled={!!editingId} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>Usado para cálculos internos. Sin espacios.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Razón Social o Nombre Comercial</label>
                  <input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="ej: PROQUIMA S.A." />
                </div>
                <div className="form-group">
                  <label className="form-label">Color Distintivo</label>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input type="color" className="input-field" value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={{ padding: '0.2rem', height: 42, width: 80, cursor: 'pointer' }} />
                    <span className="font-mono text-tertiary" style={{ fontSize: '0.85rem' }}>{form.color.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.id || !form.name}>
                <Check size={16} /> Guardar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
