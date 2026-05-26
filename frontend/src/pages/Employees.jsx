import React, { useState, useMemo, useContext } from 'react';
import {
  Search, Plus, Edit2, Trash2, X, Eye, ChevronDown,
  UserPlus, Filter, Download, Check, FileText,
  User, FileSignature, Landmark, Calculator
} from 'lucide-react';
import { DataContext } from '../context/DataContext';
import ImportData from '../components/ImportData';
import { formatQ, calculateMonthlyISR } from '../data/mockData';

export default function Employees() {
  const { employees, setAllEmployees, addEmployee, updateEmployee, deleteEmployee, companies, departments } = useContext(DataContext);
  
  const INITIAL_FORM = {
    name: '', role: '', hierarchy: 'Operativa', dept: departments.length > 0 ? departments[0] : '', company: companies.length > 0 ? companies[0].name : '',
    base: '', bonus: '', status: 'active',
    bankAccount: '', bankName: '', igssNumber: '',
    contractType: 'Indefinido', hireDate: new Date().toISOString().split('T')[0],
    dist: companies.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {})
  };
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add | edit | view
  const [modalTab, setModalTab] = useState('personal'); // personal | bank | salary
  const [currentEmp, setCurrentEmp] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [showFilters, setShowFilters] = useState(false);
  
  // Offboarding modal state
  const [offboardState, setOffboardState] = useState({ show: false, empId: null, reason: '', date: new Date().toISOString().split('T')[0] });
  
  // Finiquito modal state
  const [finiquitoState, setFiniquitoState] = useState({ show: false, emp: null, calculation: null });

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
                          e.role.toLowerCase().includes(search.toLowerCase());
      const matchDept = filterDept === 'ALL' || e.dept === filterDept;
      const matchStatus = filterStatus === 'ALL' || e.status === filterStatus;
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, search, filterDept, filterStatus]);

  const openAdd = () => {
    setModalMode('add');
    setModalTab('personal');
    setForm(INITIAL_FORM);
    setCurrentEmp(null);
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setModalMode('edit');
    setModalTab('personal');
    setForm({
      name: emp.name, role: emp.role, hierarchy: emp.hierarchy || 'Operativa', dept: emp.dept, company: emp.company,
      base: emp.base, bonus: emp.bonus, status: emp.status,
      bankAccount: emp.bankAccount || '', bankName: emp.bankName || '', igssNumber: emp.igssNumber || '',
      contractType: emp.contractType || 'Indefinido', hireDate: emp.hireDate || new Date().toISOString().split('T')[0],
      dist: { ...emp.dist }
    });
    setCurrentEmp(emp);
    setShowModal(true);
  };

  const openView = (emp) => {
    setModalMode('view');
    setCurrentEmp(emp);
    setShowModal(true);
  };

  const handleSave = () => {
    if (modalMode === 'add') {
      const newEmp = {
        ...form,
        base: Number(form.base),
        bonus: Number(form.bonus),
        days: 30,
        deductions: { isr: calculateMonthlyISR(Number(form.base), Number(form.bonus)), bank: 0, cell: 0, cafe: 0, product: 0, insurance: 0, other: 0, shoes: 0, uniform: 0 },
        extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 }
      };
      addEmployee(newEmp);
    } else if (modalMode === 'edit' && currentEmp) {
      updateEmployee(currentEmp.id, { 
        ...form, 
        base: Number(form.base), 
        bonus: Number(form.bonus),
        deductions: {
          ...currentEmp.deductions,
          isr: calculateMonthlyISR(Number(form.base), Number(form.bonus)) // Auto-update ISR on base change
        }
      });
    }
    setShowModal(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("¿Está seguro de eliminar este empleado completamente de la base de datos? (Para historial, use 'Dar de Baja')")) {
      deleteEmployee(id);
    }
  };

  const handleOffboard = () => {
    updateEmployee(offboardState.empId, { 
      status: 'inactive', 
      terminationReason: offboardState.reason,
      terminationDate: offboardState.date
    });
    setOffboardState({ show: false, empId: null, reason: '', date: '' });
  };

  const handleGenerateFiniquito = (emp) => {
    // Basic mock calculation for Finiquito
    const baseTotal = emp.base + emp.bonus;
    const calc = {
      indemnizacion: baseTotal * 1.5, // Mock 1.5 years
      aguinaldoProp: (baseTotal / 12) * 4, // 4 months
      bono14Prop: (baseTotal / 12) * 2, // 2 months
      vacaciones: (baseTotal / 30) * 15 * 0.5, // half year unused
    };
    calc.total = calc.indemnizacion + calc.aguinaldoProp + calc.bono14Prop + calc.vacaciones;
    setFiniquitoState({ show: true, emp, calculation: calc });
  };

  const distTotal = Object.values(form.dist).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <h1>Directorio de Empleados</h1>
            <p>Gestión de personal y distribución de costos · {employees.length} registros</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>
            <Download size={14} style={{ transform: 'rotate(180deg)' }} /> Importar CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <UserPlus size={14} /> Nuevo Empleado
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="card animate-slide-up stagger-1" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="search-wrapper">
              <Search size={15} className="search-icon" />
              <input
                className="input-field"
                placeholder="Buscar por nombre o puesto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            <button className={`btn btn-ghost btn-sm ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter size={14} /> Filtros {showFilters ? '▲' : '▼'}
            </button>
            
            {(filterDept !== 'ALL' || filterStatus !== 'ALL') && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setFilterDept('ALL'); setFilterStatus('ALL'); }}>
                <X size={14} /> Limpiar
              </button>
            )}
          </div>

          {/* Expandable filters */}
          {showFilters && (
            <div style={{
              display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1rem',
              borderTop: '1px solid var(--border)', flexWrap: 'wrap',
              animation: 'slideUp 0.3s ease forwards'
            }}>
              <div className="form-group" style={{ minWidth: 200 }}>
                <label className="form-label">Departamento</label>
                <select className="input-field" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                  <option value="ALL">Todos los departamentos</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: 150 }}>
                <label className="form-label">Estado</label>
                <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="ALL">Todos los estados</option>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Employee Table */}
        <div className="table-wrap animate-slide-up stagger-2">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Empleado</th>
                <th>Departamento / Empresa</th>
                <th>Salario Base</th>
                <th>Distribución</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right', minWidth: '140px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, i) => (
                <tr key={emp.id}>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontWeight: 600 }}>{emp.id}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-elevated)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.75rem',
                        border: '1px solid var(--border)', flexShrink: 0
                      }}>
                        {emp.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-semibold text-primary" style={{ cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => openView(emp)}>
                          {emp.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{emp.role}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                      <span className="dept-tag">{emp.dept}</span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{emp.company}</span>
                    </div>
                  </td>
                  <td className="font-mono font-semibold text-gold">{formatQ(emp.base)}</td>
                  <td>
                    <div className="tooltip-wrap">
                      <div className="dist-bar-group">
                        {companies.map(c => {
                          const pct = emp.dist[c.id] || 0;
                          return pct > 0 ? (
                            <div key={c.id} className="dist-bar-segment" style={{ width: `${pct}%`, background: c.gradient || c.color }} />
                          ) : null;
                        })}
                      </div>
                      <span className="tooltip-text">
                        {companies.filter(c => (emp.dist[c.id] || 0) > 0).map(c => `${c.name}: ${emp.dist[c.id]}%`).join(' · ')}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${emp.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                      {emp.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                      <button className="btn-icon" title="Ver detalle" onClick={() => openView(emp)}><Eye size={16} /></button>
                      <button className="btn-icon" title="Editar" onClick={() => openEdit(emp)}><Edit2 size={16} /></button>
                      {emp.status === 'active' && (
                        <button className="btn-icon" title="Dar de Baja" style={{ color: 'var(--warning)' }} onClick={() => setOffboardState({ show: true, empId: emp.id, reason: '', date: new Date().toISOString().split('T')[0] })}><X size={16} /></button>
                      )}
                      {emp.status === 'inactive' && (
                        <button className="btn-icon" title="Generar Finiquito" style={{ color: 'var(--accent)' }} onClick={() => handleGenerateFiniquito(emp)}><FileText size={16} /></button>
                      )}
                      <button className="btn-icon" title="Eliminar (Permanente)" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(emp.id)}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)' }}>
                    No se encontraron empleados con los criterios de búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== MODAL ===================== */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: modalMode === 'view' ? '600px' : '850px', padding: 0, overflow: 'hidden' }}>
            
            {/* VIEW MODE */}
            {modalMode === 'view' && currentEmp ? (
              <>
                <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                  <h2>Expediente del Empleado</h2>
                  <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                </div>
                <div className="modal-body" style={{ padding: '1.5rem' }}>
                  <ViewEmployeeDetail emp={currentEmp} companies={companies} />
                </div>
              </>
            ) : (
              /* ADD/EDIT MODE (Premium Split Layout) */
              <div style={{ display: 'flex', height: '600px', maxHeight: '85vh' }}>
                
                {/* Sidebar Navigation */}
                <div style={{ width: '240px', background: 'var(--bg-elevated)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '1.5rem 1.25rem' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                      {modalMode === 'add' ? 'Nuevo Empleado' : 'Editar Empleado'}
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', marginBottom: 0 }}>
                      Complete la información requerida
                    </p>
                  </div>
                  
                  <div style={{ flex: 1, padding: '0 0.75rem' }}>
                    <SidebarTab 
                      icon={User} label="Datos Personales" active={modalTab === 'personal'} 
                      onClick={() => setModalTab('personal')} 
                    />
                    <SidebarTab 
                      icon={FileSignature} label="Contrato" active={modalTab === 'contract'} 
                      onClick={() => setModalTab('contract')} 
                    />
                    <SidebarTab 
                      icon={Landmark} label="Legales & Bancarios" active={modalTab === 'bank'} 
                      onClick={() => setModalTab('bank')} 
                    />
                    <SidebarTab 
                      icon={Calculator} label="Salario & Distribución" active={modalTab === 'salary'} 
                      onClick={() => setModalTab('salary')} 
                    />
                  </div>
                </div>

                {/* Form Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
                  <div className="modal-header" style={{ padding: '1.25rem 2rem', borderBottom: 'none' }}>
                    <div style={{ flex: 1 }}></div>
                    <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                  </div>
                  
                  <div className="modal-body" style={{ padding: '0 2rem 2rem 2rem', overflowY: 'auto', flex: 1 }}>
                    {modalTab === 'personal' && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Información Básica</h3>
                      <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label className="form-label">Nombre Completo</label>
                          <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: García López María Fernanda" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Puesto</label>
                          <input className="input-field" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Ej: Analista" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Jerarquía / Rol</label>
                          <select className="input-field" value={form.hierarchy} onChange={e => setForm({ ...form, hierarchy: e.target.value })}>
                            <option value="Operativa">Operativa</option>
                            <option value="Administrativa">Administrativa</option>
                            <option value="Gerencia General">Gerencia General</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Departamento</label>
                          <select className="input-field" value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })}>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Empresa Principal</label>
                          <select className="input-field" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}>
                            {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Estado</label>
                          <select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                          </select>
                        </div>
                      </div>
                      </div>
                    )}

                    {modalTab === 'contract' && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalles de Contratación</h3>
                      <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Tipo de Contrato</label>
                          <select className="input-field" value={form.contractType} onChange={e => setForm({ ...form, contractType: e.target.value })}>
                            <option value="Indefinido">Indefinido</option>
                            <option value="Temporal">Temporal / Plazo Fijo</option>
                            <option value="Servicios Profesionales">Servicios Profesionales</option>
                            <option value="Practicante">Practicante</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Fecha de Inicio de Labores</label>
                          <input type="date" className="input-field" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })} />
                        </div>
                      </div>
                      </div>
                    )}

                    {modalTab === 'bank' && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registros Legales y Cuentas</h3>
                      <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Número de Afiliación (IGSS)</label>
                          <input className="input-field" value={form.igssNumber} onChange={e => setForm({ ...form, igssNumber: e.target.value })} placeholder="Ej: 12345678" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Banco</label>
                          <select className="input-field" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })}>
                            <option value="">Seleccione un banco...</option>
                            <option value="PROMERICA">Promerica</option>
                            <option value="INDUSTRIAL">Industrial</option>
                            <option value="BANTRAB">Bantrab</option>
                            <option value="BAM">BAM</option>
                            <option value="RURAL">Banrural</option>
                            <option value="GYT">G&T Continental</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label className="form-label">Número de Cuenta</label>
                          <input className="input-field" value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })} placeholder="Ej: 4510765" />
                        </div>
                      </div>
                      </div>
                    )}

                    {modalTab === 'salary' && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compensación</h3>
                        <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div className="form-group">
                            <label className="form-label">Salario Base Ordinario (Q)</label>
                            <input type="number" className="input-field" value={form.base} onChange={e => setForm({ ...form, base: e.target.value })} placeholder="0.00" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Bono Decreto (Q)</label>
                            <input type="number" className="input-field" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} placeholder="250.00" />
                          </div>
                        </div>

                        {/* Distribution Sliders */}
                        <div style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <span className="form-label" style={{ margin: 0 }}>Distribución por Empresa</span>
                            <span className={`badge ${distTotal === 100 ? 'badge-success' : 'badge-danger'}`}>
                              {distTotal === 100 ? <Check size={12} /> : null}
                              {distTotal}%
                            </span>
                          </div>
                          {companies.map(c => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.gradient || c.color, flexShrink: 0 }} />
                              <span style={{ width: '110px', fontSize: '0.78rem', fontWeight: 500, flexShrink: 0 }}>{c.name}</span>
                              <input
                                type="range"
                                min="0" max="100" step="5"
                                value={form.dist[c.id] || 0}
                                onChange={e => setForm({ ...form, dist: { ...form.dist, [c.id]: Number(e.target.value) } })}
                                style={{ flex: 1, accentColor: c.color, cursor: 'pointer' }}
                              />
                              <span className="font-mono" style={{ width: '40px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>{form.dist[c.id] || 0}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '1.25rem 2rem' }}>
                    <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || distTotal !== 100}>
                      <Check size={14} />
                      {modalMode === 'add' ? 'Crear Registro' : 'Guardar Cambios'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showImport && <ImportData onClose={() => setShowImport(false)} />}

      {/* OFFBOARDING MODAL */}
      {offboardState.show && (
        <div className="modal-overlay" onClick={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })} style={{ zIndex: 10000 }}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Dar de Baja</h2>
              <button className="btn-icon" onClick={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                El empleado pasará a estado Inactivo y ya no aparecerá en nóminas futuras, pero su historial se mantendrá intacto.
              </p>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Fecha de Baja</label>
                <input type="date" className="input-field" value={offboardState.date} onChange={e => setOffboardState({ ...offboardState, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Motivo / Observaciones</label>
                <textarea className="input-field" rows={3} value={offboardState.reason} onChange={e => setOffboardState({ ...offboardState, reason: e.target.value })} placeholder="Ej: Renuncia voluntaria, fin de contrato, despido justificado..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: 'var(--warning)', color: '#fff' }} onClick={handleOffboard} disabled={!offboardState.reason}>Confirmar Baja</button>
            </div>
          </div>
        </div>
      )}

      {/* FINIQUITO MODAL */}
      {finiquitoState.show && finiquitoState.calculation && (
        <div className="modal-overlay" onClick={() => setFiniquitoState({ show: false, emp: null, calculation: null })} style={{ zIndex: 10000 }}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>Cálculo de Finiquito (Liquidación)</h2>
              <button className="btn-icon" onClick={() => setFiniquitoState({ show: false, emp: null, calculation: null })}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div className="font-semibold text-primary">{finiquitoState.emp.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{finiquitoState.emp.role}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Salario Base Computable</div>
                  <div className="font-mono text-primary font-bold">{formatQ(finiquitoState.emp.base + finiquitoState.emp.bonus)}</div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    <tr>
                      <td>Indemnización por Tiempo Servido</td>
                      <td style={{ textAlign: 'right' }} className="font-mono text-primary">{formatQ(finiquitoState.calculation.indemnizacion)}</td>
                    </tr>
                    <tr>
                      <td>Aguinaldo Proporcional</td>
                      <td style={{ textAlign: 'right' }} className="font-mono text-primary">{formatQ(finiquitoState.calculation.aguinaldoProp)}</td>
                    </tr>
                    <tr>
                      <td>Bono 14 Proporcional</td>
                      <td style={{ textAlign: 'right' }} className="font-mono text-primary">{formatQ(finiquitoState.calculation.bono14Prop)}</td>
                    </tr>
                    <tr>
                      <td>Vacaciones Pendientes de Goce</td>
                      <td style={{ textAlign: 'right' }} className="font-mono text-primary">{formatQ(finiquitoState.calculation.vacaciones)}</td>
                    </tr>
                    <tr style={{ background: 'var(--bg-elevated)' }}>
                      <td className="font-bold text-primary">GRAN TOTAL A RECIBIR</td>
                      <td style={{ textAlign: 'right' }} className="font-mono font-bold text-gold" style={{ fontSize: '1.2rem' }}>{formatQ(finiquitoState.calculation.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setFiniquitoState({ show: false, emp: null, calculation: null })}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => { alert('Generando PDF del Finiquito...'); setFiniquitoState({ show: false, emp: null, calculation: null }); }}>
                <FileText size={16} /> Imprimir Constancia
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ViewEmployeeDetail({ emp, companies }) {
  const totalGross = emp.base + emp.bonus + emp.extras.simplesVal + emp.extras.doblesVal + emp.extras.comisiones + emp.extras.otrosIngresos;
  const totalDed = Object.values(emp.deductions).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 'var(--radius-sm)',
          background: 'var(--accent-gradient)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: '1rem',
          boxShadow: 'var(--shadow-glow)'
        }}>
          {emp.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
        </div>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{emp.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {emp.role} {emp.hierarchy && `(${emp.hierarchy})`} · <span className="text-primary">{emp.dept}</span>
          </div>
          {emp.contractType && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
              Contrato: {emp.contractType} | Inicio: {emp.hireDate}
            </div>
          )}
        </div>
        <span className={`badge ${emp.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ marginLeft: 'auto' }}>
          {emp.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {emp.status === 'inactive' && emp.terminationReason && (
        <div style={{ background: 'var(--danger-bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(220, 38, 38, 0.2)', marginBottom: '1.5rem' }}>
          <div className="form-label" style={{ color: 'var(--danger)' }}>Motivo de Baja ({emp.terminationDate})</div>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>{emp.terminationReason}</p>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <MiniStat label="Salario Base" value={formatQ(emp.base)} />
        <MiniStat label="Bono Decreto" value={formatQ(emp.bonus)} />
        <MiniStat label="Neto Estimado" value={formatQ(totalGross - totalDed)} accent />
      </div>

      {/* Distribution Visual */}
      <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
        <div className="form-label" style={{ marginBottom: '0.75rem' }}>Distribución de Costo</div>
        <div style={{ display: 'flex', gap: '2px', height: 8, borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '0.75rem' }}>
          {companies.map(c => {
            const pct = emp.dist[c.id] || 0;
            return pct > 0 ? <div key={c.id} style={{ width: `${pct}%`, background: c.gradient || c.color, transition: 'width 0.8s var(--ease-spring)' }} /> : null;
          })}
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {companies.filter(c => (emp.dist[c.id] || 0) > 0).map(c => (
            <span key={c.id} style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.gradient || c.color, display: 'inline-block' }} />
              {c.name}: <strong className="font-mono">{emp.dist[c.id]}%</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Deductions */}
      {totalDed > 0 && (
        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
          <div className="form-label" style={{ marginBottom: '0.75rem' }}>Deducciones Históricas Mensuales</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {Object.entries(emp.deductions).filter(([, v]) => v > 0).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{k}</span>
                <span className="font-mono font-semibold text-danger">{formatQ(v)}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
            <span>Total Deducciones</span>
            <span className="font-mono text-danger">{formatQ(totalDed)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div style={{
      padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
      background: 'var(--bg-base)', border: '1px solid var(--border)',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>{label}</div>
      <div className={`font-mono ${accent ? 'text-gold' : 'text-primary'}`} style={{ fontSize: '1.05rem', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

// Helper component for the new Sidebar
function SidebarTab({ icon: Icon, label, active, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
        cursor: 'pointer', marginBottom: '0.5rem',
        background: active ? 'var(--bg-hover)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
        transition: 'all 0.2s ease',
        fontWeight: active ? 600 : 500,
        fontSize: '0.85rem'
      }}
      onMouseOver={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseOut={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={18} style={{ color: active ? 'var(--accent)' : 'inherit' }} />
      {label}
    </div>
  );
}
