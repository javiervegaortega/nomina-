import React, { useState, useEffect, useMemo, useContext } from 'react';
import {
  Save, Download, FileText, Check, X, Edit3,
  ChevronRight, AlertCircle, DollarSign, Clock,
  Calculator, Building2, Plus, ArrowLeft, Trash2, Calendar
} from 'lucide-react';
import { AppContext } from '../App';
import { DataContext } from '../context/DataContext';
import { CUOTA_PATRONAL_RATE, CUOTA_LABORAL_RATE, formatQ } from '../data/mockData';

const TABS = [
  { id: 'income', label: 'Ingresos Variables', icon: DollarSign },
  { id: 'deductions', label: 'Deducciones', icon: AlertCircle },
  { id: 'summary', label: 'Pre-Nómina', icon: Calculator },
  { id: 'distribution', label: 'Distribución', icon: Building2 },
];

const DEDUCTION_LABELS = {
  isr: 'ISR', bank: 'Bancos', cell: 'Celular', cafe: 'Cafetería',
  product: 'Producto', insurance: 'Seguro', other: 'Otros', shoes: 'Calzado', uniform: 'Uniforme',
};

export default function PayrollProcessing() {
  const [selectedDraftId, setSelectedDraftId] = useState(null);

  if (selectedDraftId) {
    return <PayrollEditor draftId={selectedDraftId} onBack={() => setSelectedDraftId(null)} />;
  }

  return <PayrollHub onSelectDraft={setSelectedDraftId} />;
}

function PayrollHub({ onSelectDraft }) {
  const { activePayrolls, deleteActivePayroll, createActivePayroll, companies } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');

  const handleCreate = () => {
    if (!title || !selectedCompany) return;
    const newId = createActivePayroll(title, [selectedCompany]);
    setShowModal(false);
    onSelectDraft(newId);
  };



  return (
    <>
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <h1>Nóminas en Progreso</h1>
            <p>Borradores activos que aún no han sido procesados definitivamente.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={() => {
            setTitle('');
            setSelectedCompany('');
            setShowModal(true);
          }}>
            <Plus size={16} /> Nueva Nómina
          </button>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {activePayrolls.map(draft => (
            <div key={draft.id} className="card animate-slide-up" style={{ padding: '1.25rem', position: 'relative' }}>
              <button 
                className="btn-icon" 
                style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--danger)' }}
                onClick={() => {
                  confirmAction('¿Eliminar este borrador? Se perderán todos los avances.', () => {
                    deleteActivePayroll(draft.id);
                    showToast('Borrador eliminado', 'info');
                  });
                }}
              >
                <Trash2 size={16} />
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.6rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <Calendar size={20} className="text-primary" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{draft.title}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Creada: {new Date(draft.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <div style={{ marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Empleados:</span> <strong className="text-primary">{draft.employees.length}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Empresas:</span>{' '}
                  {draft.companies.length === 0 ? (
                    <span className="badge badge-neutral">Todas</span>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {draft.companies.map(c => <span key={c} className="badge badge-neutral">{c}</span>)}
                    </div>
                  )}
                </div>
              </div>

              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => onSelectDraft(draft.id)}>
                Continuar Editando <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
              </button>
            </div>
          ))}

          {activePayrolls.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
              No hay nóminas en progreso. Crea una nueva para comenzar.
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Crear Nuevo Borrador de Nómina</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Título del Periodo</label>
                <input 
                  className="input-field" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="Ej: Primera Quincena Febrero 2026" 
                  autoFocus 
                />
              </div>
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">Empresa</label>
                <select 
                  className="input-field" 
                  value={selectedCompany} 
                  onChange={e => setSelectedCompany(e.target.value)}
                >
                  <option value="">Seleccione una empresa...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!title.trim() || !selectedCompany} onClick={handleCreate}>Generar Borrador</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PayrollEditor({ draftId, onBack }) {
  const { activePayrolls, updateActivePayroll, closePayroll, bonuses } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  
  const draft = activePayrolls.find(p => p.id === draftId);
  const data = draft?.employees || [];

  const [tab, setTab] = useState('income');
  const [editingCell, setEditingCell] = useState(null); // { id, field, type }

  const handleChange = (id, section, field, value) => {
    const newData = data.map(e => {
      if (e.id !== id) return e;
      if (section === 'root') return { ...e, [field]: Number(value) || 0 };
      if (section === 'appliedBonuses') return { ...e, appliedBonuses: { ...e.appliedBonuses, [field]: Number(value) || 0 } };
      return { ...e, [section]: { ...e[section], [field]: Number(value) || 0 } };
    });
    updateActivePayroll(draftId, newData);
  };

  const handleClose = () => {
    confirmAction('¿Estás seguro de cerrar esta nómina? Se moverá al Historial y ya no podrá ser editada.', () => {
      closePayroll(draftId);
      showToast('Nómina cerrada exitosamente', 'success');
      onBack();
    });
  };

  // Computed totals
  const totals = useMemo(() => {
    let grossTotal = 0, dedTotal = 0, patronalTotal = 0;
    data.forEach(e => {
      const baseFactor = (e.days || 30) / 30;
      const baseSalary = e.base * baseFactor;
      const bonusLey = e.bonus * baseFactor;
      
      const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
      const gross = baseSalary + bonusLey + e.extras.simplesVal + e.extras.doblesVal + e.extras.comisiones + e.extras.otrosIngresos + bonusesSum;
      
      const igssLaboral = baseSalary * CUOTA_LABORAL_RATE;
      const customDed = Object.values(e.deductions).reduce((a, b) => a + b, 0);
      const ded = customDed + igssLaboral;
      
      const patronal = baseSalary * CUOTA_PATRONAL_RATE;
      
      grossTotal += gross;
      dedTotal += ded;
      patronalTotal += patronal;
    });
    return { grossTotal, dedTotal, patronalTotal, netTotal: grossTotal - dedTotal };
  }, [data]);

  if (!draft) return null;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={onBack} title="Volver a Borradores">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {draft.title}
              <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>Borrador</span>
            </h1>
            <p>{data.length} empleados en esta nómina</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => showToast('Función en desarrollo', 'info')}><Download size={14} /> Exportar Excel</button>
          <button className="btn btn-ghost btn-sm" onClick={() => showToast('Función en desarrollo', 'info')}><FileText size={14} /> Vouchers PDF</button>
          <button className="btn btn-primary" onClick={handleClose}>
            <Check size={16} style={{ marginRight: '0.3rem' }} /> Cerrar Nómina Definitivamente
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Summary strip */}
        <div className="card animate-slide-up stagger-1" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <SummaryStat label="Costo Bruto Total" value={formatQ(totals.grossTotal)} />
            <div style={{ width: 1, height: 36, background: 'var(--border)' }} />
            <SummaryStat label="Deducciones Totales" value={formatQ(totals.dedTotal)} color="var(--danger)" />
            <div style={{ width: 1, height: 36, background: 'var(--border)' }} />
            <SummaryStat label="Cuota Patronal Estimada" value={formatQ(totals.patronalTotal)} color="var(--warning)" />
            <div style={{ width: 1, height: 36, background: 'var(--border)' }} />
            <SummaryStat label="Neto a Pagar" value={formatQ(totals.netTotal)} color="var(--accent-light)" large />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ marginBottom: '1.25rem' }} className="animate-slide-up stagger-2">
          <div className="tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={14} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="animate-fade" key={tab}>
          {tab === 'income' && <IncomeTab data={data} onChange={handleChange} editingCell={editingCell} setEditingCell={setEditingCell} />}
          {tab === 'deductions' && <DeductionsTab data={data} onChange={handleChange} editingCell={editingCell} setEditingCell={setEditingCell} />}
          {tab === 'summary' && <SummaryTab data={data} bonuses={bonuses} />}
          {tab === 'distribution' && <DistributionTab data={data} />}
        </div>
      </div>
    </>
  );
}

/* ========== INCOME TAB ========== */
function IncomeTab({ data, onChange, editingCell, setEditingCell }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Días Lab.</th>
            <th>H.E. Simples (Cant)</th>
            <th>H.E. Simples (Q)</th>
            <th>H.E. Dobles (Cant)</th>
            <th>H.E. Dobles (Q)</th>
            <th>Comisiones</th>
            <th>Otros Ingresos</th>
            <th style={{ textAlign: 'right' }}>Total Bruto</th>
          </tr>
        </thead>
        <tbody>
          {data.map(e => {
            const baseFactor = (e.days || 30) / 30;
            const gross = (e.base * baseFactor) + (e.bonus * baseFactor) + e.extras.simplesVal + e.extras.doblesVal + e.extras.comisiones + e.extras.otrosIngresos;
            return (
              <tr key={e.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'var(--bg-elevated)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.6rem',
                      border: '1px solid var(--border)'
                    }}>
                      {e.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-primary" style={{ fontSize: '0.8rem' }}>{e.name}</div>
                    </div>
                  </div>
                </td>
                <EditableCell id={e.id} field="days" section="root" value={e.days} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={70} />
                <EditableCell id={e.id} field="simplesQty" section="extras" value={e.extras.simplesQty} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={70} />
                <EditableCell id={e.id} field="simplesVal" section="extras" value={e.extras.simplesVal} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={90} isMoney />
                <EditableCell id={e.id} field="doblesQty" section="extras" value={e.extras.doblesQty} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={70} />
                <EditableCell id={e.id} field="doblesVal" section="extras" value={e.extras.doblesVal} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={90} isMoney />
                <EditableCell id={e.id} field="comisiones" section="extras" value={e.extras.comisiones} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={100} isMoney />
                <EditableCell id={e.id} field="otrosIngresos" section="extras" value={e.extras.otrosIngresos} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={100} isMoney />
                <td style={{ textAlign: 'right' }}>
                  <span className="font-mono font-bold text-gold">{formatQ(gross)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ========== DEDUCTIONS TAB ========== */
function DeductionsTab({ data, onChange, editingCell, setEditingCell }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>IGSS (4.83%)</th>
            {Object.keys(DEDUCTION_LABELS).map(k => <th key={k}>{DEDUCTION_LABELS[k]}</th>)}
            <th style={{ textAlign: 'right' }}>Total Deducciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map(e => {
            const baseFactor = (e.days || 30) / 30;
            const igssLaboral = (e.base * baseFactor) * CUOTA_LABORAL_RATE;
            const customDed = Object.values(e.deductions).reduce((a, b) => a + b, 0);
            const totalDed = customDed + igssLaboral;
            return (
              <tr key={e.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'var(--bg-elevated)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.6rem',
                      border: '1px solid var(--border)'
                    }}>
                      {e.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                    </div>
                    <div className="font-semibold text-primary" style={{ fontSize: '0.8rem' }}>{e.name}</div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-tertiary)' }} title="Calculado automáticamente (4.83% s/ base proporc.)">{formatQ(igssLaboral)}</td>
                {Object.keys(DEDUCTION_LABELS).map(k => (
                  <EditableCell key={k} id={e.id} field={k} section="deductions" value={e.deductions[k]} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                ))}
                <td style={{ textAlign: 'right' }}>
                  <span className="font-mono font-bold text-danger">{formatQ(totalDed)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ========== SUMMARY TAB ========== */
function SummaryTab({ data, bonuses }) {
  return (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      <table className="table" style={{ minWidth: '1200px' }}>
        <thead>
          <tr>
            <th style={{ minWidth: 200 }}>Empleado</th>
            <th>Empresa</th>
            <th>Salario</th>
            <th>Bono Ley</th>
            <th>H. Extras</th>
            {bonuses.map(b => (
              <th key={b.id}>{b.name}</th>
            ))}
            <th>Devengado (Bruto)</th>
            <th>IGSS</th>
            <th>Otras Ded.</th>
            <th style={{ textAlign: 'right' }}>Neto (Líquido)</th>
            <th style={{ textAlign: 'right', background: 'var(--bg-hover)' }}>1ra Quincena</th>
            <th style={{ textAlign: 'right', background: 'var(--bg-hover)' }}>2da Quincena</th>
          </tr>
        </thead>
        <tbody>
          {data.map(e => {
            const baseFactor = (e.days || 30) / 30;
            const baseSalary = e.base * baseFactor;
            const bonusLey = e.bonus * baseFactor;
            
            const extrasTotal = e.extras.simplesVal + e.extras.doblesVal + e.extras.comisiones + e.extras.otrosIngresos;
            const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
            const gross = baseSalary + bonusLey + extrasTotal + bonusesSum;
            
            const igssLaboral = baseSalary * CUOTA_LABORAL_RATE;
            const customDed = Object.values(e.deductions).reduce((a, b) => a + b, 0);
            const ded = customDed + igssLaboral;
            
            const net = gross - ded;
            const q1 = net > 0 ? net / 2 : 0;
            const q2 = net > 0 ? net - q1 : 0;
            
            return (
              <tr key={e.id}>
                <td>
                  <div className="font-semibold text-primary" style={{ fontSize: '0.82rem' }}>{e.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{e.role}</div>
                </td>
                <td><span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{e.company}</span></td>
                <td className="font-mono">{formatQ(baseSalary)}</td>
                <td className="font-mono">{formatQ(bonusLey)}</td>
                <td className="font-mono text-gold">{extrasTotal > 0 ? formatQ(extrasTotal) : '—'}</td>
                {bonuses.map(b => (
                  <td key={b.id} className="font-mono text-gold">{formatQ(e.appliedBonuses?.[b.id] || 0)}</td>
                ))}
                <td className="font-mono font-bold text-gold">{formatQ(gross)}</td>
                <td className="font-mono" style={{ color: igssLaboral > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}>{igssLaboral > 0 ? `- ${formatQ(igssLaboral)}` : '—'}</td>
                <td className="font-mono" style={{ color: customDed > 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}>{customDed > 0 ? `- ${formatQ(customDed)}` : '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="font-mono font-bold text-primary" style={{ fontSize: '1.05rem' }}>{formatQ(net)}</span>
                </td>
                <td style={{ textAlign: 'right', background: 'var(--bg-hover)' }}>
                  <span className="font-mono text-primary">{formatQ(q1)}</span>
                </td>
                <td style={{ textAlign: 'right', background: 'var(--bg-hover)' }}>
                  <span className="font-mono text-primary">{formatQ(q2)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ========== DISTRIBUTION TAB ========== */
function DistributionTab({ data }) {
  const { companies: COMPANIES } = useContext(DataContext);
  const companyTotals = COMPANIES.map(c => {
    let salary = 0, bonus = 0, extras = 0, patronal = 0;
    data.forEach(e => {
      const pct = (e.dist[c.id] || 0) / 100;
      const baseFactor = (e.days || 30) / 30;
      salary += (e.base * baseFactor) * pct;
      bonus += (e.bonus * baseFactor) * pct;
      extras += (e.extras.simplesVal + e.extras.doblesVal + e.extras.comisiones + e.extras.otrosIngresos) * pct;
      patronal += (e.base * baseFactor) * CUOTA_PATRONAL_RATE * pct;
    });
    return { ...c, salary, bonus, extras, patronal, total: salary + bonus + extras + patronal };
  });
  const grandTotal = companyTotals.reduce((s, c) => s + c.total, 0);

  return (
    <div>
      {/* Visual summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {companyTotals.map((c, i) => (
          <div key={c.id} className="card" style={{ padding: '1.25rem', animation: `slideUp 0.4s ${i * 0.05}s var(--ease-out) both` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.gradient || c.color, boxShadow: `0 0 10px ${c.color}50` }} />
              <span className="font-semibold" style={{ fontSize: '0.85rem' }}>{c.name}</span>
            </div>
            <div className="font-mono text-gold" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>{formatQ(c.total)}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              <span>{grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0}% del costo total</span>
            </div>
            <div className="progress-bar" style={{ marginTop: '0.6rem', height: '4px' }}>
              <div className="progress-bar-fill" style={{ width: `${grandTotal > 0 ? (c.total / grandTotal) * 100 : 0}%`, background: c.gradient || c.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Detailed table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Salarios Ordinarios</th>
              <th>Bonos Ley</th>
              <th>H. Extras y Otros</th>
              <th>Cuota Patronal Estimada</th>
              <th style={{ textAlign: 'right' }}>Costo Total Asignado</th>
            </tr>
          </thead>
          <tbody>
            {companyTotals.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.gradient || c.color }} />
                    <span className="font-semibold text-primary">{c.name}</span>
                  </div>
                </td>
                <td className="font-mono">{formatQ(c.salary)}</td>
                <td className="font-mono">{formatQ(c.bonus)}</td>
                <td className="font-mono">{formatQ(c.extras)}</td>
                <td className="font-mono" style={{ color: 'var(--warning)' }}>{formatQ(c.patronal)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="font-mono font-bold text-gold">{formatQ(c.total)}</span>
                </td>
              </tr>
            ))}
            <tr style={{ background: 'var(--bg-elevated)' }}>
              <td className="font-bold text-primary">GRAN TOTAL</td>
              <td className="font-mono font-bold">{formatQ(companyTotals.reduce((s, c) => s + c.salary, 0))}</td>
              <td className="font-mono font-bold">{formatQ(companyTotals.reduce((s, c) => s + c.bonus, 0))}</td>
              <td className="font-mono font-bold">{formatQ(companyTotals.reduce((s, c) => s + c.extras, 0))}</td>
              <td className="font-mono font-bold" style={{ color: 'var(--warning)' }}>{formatQ(companyTotals.reduce((s, c) => s + c.patronal, 0))}</td>
              <td style={{ textAlign: 'right' }}>
                <span className="font-mono font-bold text-primary" style={{ fontSize: '1.1rem' }}>{formatQ(grandTotal)}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ========== EDITABLE CELL ========== */
function EditableCell({ id, field, section, value, onChange, editing, setEditing, width, isMoney, isDanger }) {
  const isEditing = editing?.id === id && editing?.field === field;

  if (isEditing) {
    return (
      <td>
        <input
          type="number"
          className="input-field"
          style={{ width, padding: '0.25rem 0.5rem', fontSize: '0.8rem', height: '28px' }}
          defaultValue={value}
          autoFocus
          onBlur={(e) => {
            onChange(id, section, field, e.target.value);
            setEditing(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onChange(id, section, field, e.target.value);
              setEditing(null);
            }
            if (e.key === 'Escape') setEditing(null);
          }}
        />
      </td>
    );
  }

  return (
    <td
      onClick={() => setEditing({ id, field })}
      style={{ cursor: 'pointer', position: 'relative' }}
      title="Haz clic para editar"
    >
      <span className={`font-mono ${isMoney && value > 0 && !isDanger ? 'text-gold' : ''} ${isDanger && value > 0 ? 'text-danger' : ''}`} style={{
        padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-xs)',
        transition: 'background 0.2s ease',
        background: 'transparent',
        display: 'inline-block',
        minWidth: '40px'
      }}
      onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
      >
        {isMoney && value > 0 ? formatQ(value) : value}
        {isMoney && value === 0 && <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
      </span>
    </td>
  );
}

function SummaryStat({ label, value, color, large }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '0.2rem' }}>{label}</div>
      <div className="font-mono" style={{ fontSize: large ? '1.35rem' : '1.1rem', fontWeight: 800, color: color || 'var(--gold-light)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}
