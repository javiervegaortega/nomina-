import React, { useContext, useMemo, useState } from 'react';
import { DataContext } from '../context/DataContext';
import { AppContext } from '../App';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { History, Calendar, Trash2, Eye, Download, FileText, CheckCircle2, ArrowLeft, Building2, X, Search } from 'lucide-react';
import { formatQ, CUOTA_LABORAL_RATE, CUOTA_PATRONAL_RATE } from '../data/mockData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

export default function PayrollHistory() {
  const { payrollHistory, deletePayroll, bonuses } = useContext(DataContext);
  const { confirmAction, showToast } = useContext(AppContext);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Group by title
  const groupedHistory = useMemo(() => {
    const groups = {};
    payrollHistory.forEach(p => {
      const t = p.title || 'Nómina sin título';
      if (!groups[t]) {
        groups[t] = {
          title: t,
          date: p.date, // use most recent date
          records: [],
          employeesCount: 0,
          grossTotal: 0,
          netTotal: 0,
          companies: new Set()
        };
      }
      
      groups[t].records.push(p);
      groups[t].employeesCount += p.employeesCount || 0;
      groups[t].netTotal += p.netTotal || 0;
      
      const emps = p.details || p.employees || [];
      const gross = emps.reduce((s, e) => {
        const baseFactor = (e.days || 30) / 30;
        return s + (e.base * baseFactor) + (e.bonus * baseFactor);
      }, 0);
      
      groups[t].grossTotal += gross;
      
      if (p.companies && p.companies.length > 0) {
        p.companies.forEach(c => groups[t].companies.add(c));
      }
      
      if (new Date(p.date) > new Date(groups[t].date)) {
        groups[t].date = p.date;
      }
    });
    
    return Object.values(groups).sort((a,b) => new Date(b.date) - new Date(a.date));
  }, [payrollHistory]);

  const filteredHistory = groupedHistory.filter(g => 
    g.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pagination = usePagination(filteredHistory, 10);

  const handleDeleteGroup = (title, records) => {
    confirmAction(`¿Seguro que desea eliminar el registro consolidado "${title}"? Se borrarán ${records.length} nómina(s) de las empresas involucradas.`, () => {
      records.forEach(r => deletePayroll(r.id));
      showToast('Registro eliminado exitosamente', 'info');
      if (selectedGroup && selectedGroup.title === title) setSelectedGroup(null);
    });
  };

  const handleDownload = () => {
    showToast('Generando archivo de exportación...', 'success');
  };

  if (selectedGroup) {
    return <PayrollHistoryDetail group={selectedGroup} onBack={() => setSelectedGroup(null)} />;
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <h1>Historial de Nóminas</h1>
            <p>Registro inmutable de procesos de nómina cerrados y agrupados por periodo</p>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            placeholder="Buscar por título..." 
            className="input" 
            style={{ paddingLeft: '35px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="page-content">
        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
          {pagination.paginatedData.length > 0 && (
            <div style={{ 
              position: 'absolute', top: '20px', bottom: '20px', left: '23px', 
              width: '2px', background: 'linear-gradient(to bottom, var(--accent) 0%, var(--border) 100%)',
              zIndex: 0 
            }} />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {pagination.paginatedData.map((group, i) => (
              <div key={group.title} className="animate-slide-right" style={{ 
                animationDelay: `${i * 0.1}s`,
                display: 'flex', gap: '1.5rem', position: 'relative', zIndex: 1
              }}>
                <div style={{ 
                  width: 48, height: 48, borderRadius: '50%', 
                  background: 'var(--bg-base)', border: '2px solid var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent)', flexShrink: 0, boxShadow: '0 0 0 4px var(--bg-base)'
                }}>
                  <CheckCircle2 size={24} />
                </div>
                
                <div className="card card-glow" style={{ flex: 1, padding: '1.5rem', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {group.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={14} /> 
                          Última actualiz. {new Date(group.date).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Building2 size={14} /> 
                          {group.companies.size === 0 ? 'Múltiples' : Array.from(group.companies).join(', ')}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn-icon" onClick={() => setSelectedGroup(group)} title="Ver Detalle Completo"><Eye size={18} /></button>
                      <button className="btn-icon" onClick={handleDownload} title="Exportar Consolidado"><Download size={18} /></button>
                      <button className="btn-icon text-danger" onClick={() => handleDeleteGroup(group.title, group.records)} title="Eliminar Registro"><Trash2 size={18} /></button>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                    gap: '1rem', padding: '1.25rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Empleados</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{group.employeesCount} liquidaciones</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Creado (Bruto Base)</div>
                      <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 600 }}>{formatQ(group.grossTotal)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Desembolso Total Neto</div>
                      <div className="font-mono font-bold text-gold" style={{ fontSize: '1.3rem' }}>
                        {formatQ(group.netTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {pagination.paginatedData.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <Pagination {...pagination} />
              </div>
            )}

            {filteredHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)' }}>
                <History size={48} style={{ margin: '0 auto 1.5rem', opacity: 0.3 }} />
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Historial Vacío</h3>
                <p>Aún no hay nóminas procesadas en el sistema.</p>
                <div style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>
                  Dirígete a <strong>Proceso de Nómina</strong> y presiona "Cerrar Nómina" para registrar la primera.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ========== FULL PAGE DETAIL VIEW ========== */
function PayrollHistoryDetail({ group, onBack }) {
  const { bonuses } = useContext(DataContext);
  const { showToast } = useContext(AppContext);
  const [selectedVoucherEmp, setSelectedVoucherEmp] = useState(null);

  // Combine all employees and calculate totals
  const { data, totals } = useMemo(() => {
    const emps = [];
    let grossTotal = 0, dedTotal = 0, patronalTotal = 0;
    
    group.records.forEach(r => {
      const list = r.details || r.employees || [];
      const company = r.companies?.[0] || 'N/A';
      
      list.forEach(e => {
        const baseFactor = (e.days || 30) / 30;
        const baseSalary = e.base * baseFactor;
        const bonusLey = e.bonus * baseFactor;
        
        const extrasTotal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
        const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
        const gross = baseSalary + bonusLey + extrasTotal + bonusesSum;
        
        const igssLaboral = baseSalary * CUOTA_LABORAL_RATE;
        const customDed = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);
        const ded = customDed + igssLaboral;
        
        const patronal = baseSalary * CUOTA_PATRONAL_RATE;
        
        grossTotal += gross;
        dedTotal += ded;
        patronalTotal += patronal;
        
        emps.push({
          ...e,
          company,
          calculated: { baseSalary, bonusLey, extrasTotal, bonusesSum, gross, igssLaboral, customDed, ded, net: gross - ded }
        });
      });
    });
    
    return { data: emps, totals: { grossTotal, dedTotal, patronalTotal, netTotal: grossTotal - dedTotal } };
  }, [group]);

  const exportExcel = () => {
    showToast('Generando Excel...', 'success');
    
    // Prepare data for Excel
    const rows = data.map(e => {
      const row = {
        'Nombre': e.name,
        'Rol': e.role,
        'Empresa': e.company,
        'Salario Base': e.calculated.baseSalary,
        'Bono Ley': e.calculated.bonusLey,
        'Horas Extras': e.calculated.extrasTotal
      };
      bonuses.forEach(b => {
        row[`Bono: ${b.name}`] = e.appliedBonuses?.[b.id] || 0;
      });
      row['Devengado Bruto'] = e.calculated.gross;
      row['IGSS Laboral'] = e.calculated.igssLaboral;
      row['Otras Deducciones'] = e.calculated.customDed;
      row['Neto a Recibir'] = e.calculated.net;
      row['Cuenta Bancaria'] = e.bankAccount || 'N/A';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nómina");
    XLSX.writeFile(wb, `Nomina_${group.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  };

  const exportPDF = async () => {
    showToast('Generando PDF...', 'success');
    const element = document.getElementById('voucher-content');
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Boleta_${selectedVoucherEmp.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);
    } catch (err) {
      console.error(err);
      showToast('Error al generar PDF', 'error');
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={onBack} title="Volver al Historial">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {group.title}
              <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>Cerrada</span>
            </h1>
            <p>{data.length} empleados procesados en este periodo</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={exportExcel}>
            <Download size={16} style={{ marginRight: '0.3rem' }} /> Exportar Reporte Total
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
            <SummaryStat label="Cuota Patronal (Ref.)" value={formatQ(totals.patronalTotal)} color="var(--warning)" />
            <div style={{ width: 1, height: 36, background: 'var(--border)' }} />
            <SummaryStat label="Neto Desembolsado" value={formatQ(totals.netTotal)} color="var(--accent-light)" large />
          </div>
        </div>

        <div className="animate-fade stagger-2" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Desglose Detallado de Empleados
          </h3>
          <div className="table-wrap" style={{ overflowX: 'auto', border: '1px solid var(--border)' }}>
            <table className="table" style={{ minWidth: '1300px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Empleado</th>
                  <th>Empresa</th>
                  <th style={{ textAlign: 'right' }}>Salario</th>
                  <th style={{ textAlign: 'right' }}>Bono Ley</th>
                  <th style={{ textAlign: 'right' }}>H. Extras y Otros</th>
                  {bonuses.map(b => (
                    <th key={b.id} style={{ textAlign: 'right' }}>{b.name}</th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Devengado (Bruto)</th>
                  <th style={{ textAlign: 'right' }}>IGSS</th>
                  <th style={{ textAlign: 'right' }}>Otras Ded.</th>
                  <th style={{ textAlign: 'right', background: 'var(--bg-hover)' }}>Neto (Líquido)</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>Boleta</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e, idx) => {
                  const { baseSalary, bonusLey, extrasTotal, gross, igssLaboral, customDed, net } = e.calculated;
                  
                  return (
                    <tr key={e.id + '-' + idx}>
                      <td>
                        <div className="font-semibold text-primary" style={{ fontSize: '0.82rem' }}>{e.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{e.role}</div>
                      </td>
                      <td><span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{e.company}</span></td>
                      <td style={{ textAlign: 'right' }} className="font-mono">{formatQ(baseSalary)}</td>
                      <td style={{ textAlign: 'right' }} className="font-mono">{formatQ(bonusLey)}</td>
                      <td style={{ textAlign: 'right' }} className="font-mono text-gold">{extrasTotal > 0 ? formatQ(extrasTotal) : '—'}</td>
                      {bonuses.map(b => (
                        <td key={b.id} style={{ textAlign: 'right' }} className="font-mono text-gold">{e.appliedBonuses?.[b.id] > 0 ? formatQ(e.appliedBonuses[b.id]) : '—'}</td>
                      ))}
                      <td style={{ textAlign: 'right' }} className="font-mono font-bold text-gold">{formatQ(gross)}</td>
                      <td style={{ textAlign: 'right' }} className="font-mono" style={{ color: igssLaboral > 0 ? 'var(--danger)' : 'var(--text-tertiary)', textAlign: 'right' }}>
                        {igssLaboral > 0 ? `- ${formatQ(igssLaboral)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }} className="font-mono" style={{ color: customDed > 0 ? 'var(--danger)' : 'var(--text-tertiary)', textAlign: 'right' }}>
                        {customDed > 0 ? `- ${formatQ(customDed)}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', background: 'var(--bg-hover)' }}>
                        <span className="font-mono font-bold text-primary" style={{ fontSize: '1.05rem' }}>{formatQ(net)}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn-icon" style={{ color: 'var(--accent)' }} title="Ver Boleta de Pago" onClick={() => setSelectedVoucherEmp(e)}>
                          <FileText size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* VOUCHER MODAL */}
      {selectedVoucherEmp && (
        <div className="modal-overlay" onClick={() => setSelectedVoucherEmp(null)} style={{ zIndex: 10000 }}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', padding: 0 }}>
            <div className="modal-header" style={{ padding: '1rem 1.5rem', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
              <h2>Boleta de Pago</h2>
              <button className="btn-icon" onClick={() => setSelectedVoucherEmp(null)}><X size={18} /></button>
            </div>
            
            <div id="voucher-content" className="modal-body" style={{ padding: '2rem', background: '#fff', color: '#1a1a1a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e5e7eb', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#111827' }}>{selectedVoucherEmp.company}</h1>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>Recibo de Nómina</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>Periodo: {group.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Fecha de Pago: {group.closedAt}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empleado</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{selectedVoucherEmp.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>{selectedVoucherEmp.role} · {selectedVoucherEmp.dept}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Depósito a Cuenta</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{selectedVoucherEmp.bankName || 'N/A'} - {selectedVoucherEmp.bankAccount || 'N/A'}</div>
                  <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>Afiliación IGSS: {selectedVoucherEmp.igssNumber || 'N/A'}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                {/* Ingresos */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '0.75rem', color: '#111827' }}>Ingresos</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#374151' }}>
                    <span>Salario Base</span>
                    <span className="font-mono">{formatQ(selectedVoucherEmp.calculated.baseSalary)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#374151' }}>
                    <span>Bono Decreto (Ley)</span>
                    <span className="font-mono">{formatQ(selectedVoucherEmp.calculated.bonusLey)}</span>
                  </div>
                  {selectedVoucherEmp.calculated.extrasTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#374151' }}>
                      <span>Horas Extras / Comisiones</span>
                      <span className="font-mono">{formatQ(selectedVoucherEmp.calculated.extrasTotal)}</span>
                    </div>
                  )}
                  {bonuses.map(b => selectedVoucherEmp.appliedBonuses?.[b.id] > 0 && (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#374151' }}>
                      <span>Bono: {b.name}</span>
                      <span className="font-mono">{formatQ(selectedVoucherEmp.appliedBonuses[b.id])}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px dashed #d1d5db', color: '#111827' }}>
                    <span>Total Ingresos Brutos</span>
                    <span className="font-mono">{formatQ(selectedVoucherEmp.calculated.gross)}</span>
                  </div>
                </div>

                {/* Deducciones */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '0.75rem', color: '#111827' }}>Deducciones</h4>
                  {selectedVoucherEmp.calculated.igssLaboral > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#ef4444' }}>
                      <span>IGSS Laboral (4.83%)</span>
                      <span className="font-mono">{formatQ(selectedVoucherEmp.calculated.igssLaboral)}</span>
                    </div>
                  )}
                  {Object.entries(selectedVoucherEmp.deductions).map(([k, v]) => v > 0 && (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#ef4444' }}>
                      <span style={{ textTransform: 'capitalize' }}>Deducción: {k}</span>
                      <span className="font-mono">{formatQ(v)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px dashed #d1d5db', color: '#ef4444' }}>
                    <span>Total Deducciones</span>
                    <span className="font-mono">{formatQ(selectedVoucherEmp.calculated.ded)}</span>
                  </div>
                </div>
              </div>

              {/* Total Neto */}
              <div style={{ background: '#f3f4f6', padding: '1.5rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>NETO A RECIBIR</span>
                <span className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{formatQ(selectedVoucherEmp.calculated.net)}</span>
              </div>
              
              <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderBottom: '1px solid #9ca3af', height: '40px' }}></div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>Firma del Empleado</div>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                  Documento generado electrónicamente el {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost" onClick={() => setSelectedVoucherEmp(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={exportPDF}>
                <FileText size={16} /> Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
