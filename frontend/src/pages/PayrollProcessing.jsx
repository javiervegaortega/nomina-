import React, { useState, useEffect, useMemo, useContext } from 'react';
import {
  Save, Download, FileText, Check, X, Edit3,
  ChevronRight, AlertCircle, DollarSign, Clock,
  Calculator, Building2, Plus, ArrowLeft, Trash2, Calendar
} from 'lucide-react';
import { AppContext } from '../App';
import { DataContext } from '../context/DataContext';
import { CUOTA_PATRONAL_RATE, CUOTA_LABORAL_RATE, formatQ } from '../data/mockData';
import { Box, Typography, Button, Paper, Grid, Avatar, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Chip, Divider } from '@mui/material';

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
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Nóminas en Progreso
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Borradores activos que aún no han sido procesados definitivamente.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" startIcon={<Plus size={16} />} sx={{ borderRadius: 2 }} onClick={() => {
            setTitle('');
            setSelectedCompany('');
            setShowModal(true);
          }}>
            Nueva Nómina
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {activePayrolls.map(draft => (
          <Grid item xs={12} sm={6} md={4} key={draft.id}>
            <Paper sx={{ p: 3, borderRadius: 3, position: 'relative', border: '1px solid', borderColor: 'divider', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }} elevation={0}>
              <IconButton 
                color="error"
                sx={{ position: 'absolute', top: 12, right: 12 }}
                onClick={() => {
                  confirmAction('¿Eliminar este borrador? Se perderán todos los avances.', () => {
                    deleteActivePayroll(draft.id);
                    showToast('Borrador eliminado', 'info');
                  });
                }}
              >
                <Trash2 size={18} />
              </IconButton>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.main', width: 44, height: 44 }}>
                  <Calendar size={20} />
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ maxWidth: '200px' }}>{draft.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Creada: {new Date(draft.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Empleados: <Typography component="span" variant="body2" fontWeight={700} color="primary.main">{draft.employees.length}</Typography>
                </Typography>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Empresas:</Typography>
                  {draft.companies.length === 0 ? (
                    <Chip label="Todas" size="small" />
                  ) : (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {draft.companies.map(c => <Chip key={c} label={c} size="small" variant="outlined" />)}
                    </Box>
                  )}
                </Box>
              </Box>

              <Button variant="outlined" fullWidth endIcon={<ChevronRight size={16} />} onClick={() => onSelectDraft(draft.id)} sx={{ justifyContent: 'space-between', borderRadius: 2 }}>
                Continuar Editando
              </Button>
            </Paper>
          </Grid>
        ))}

        {activePayrolls.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider', bgcolor: 'background.default' }} elevation={0}>
              <Typography variant="body1" color="text.secondary">
                No hay nóminas en progreso. Crea una nueva para comenzar.
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Crear Nuevo Borrador</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            margin="dense"
            label="Título del Periodo"
            placeholder="Ej: Primera Quincena Febrero 2026"
            fullWidth
            variant="outlined"
            value={title}
            onChange={e => setTitle(e.target.value)}
            sx={{ mb: 3 }}
          />
          <TextField
            select
            margin="dense"
            label="Empresa"
            fullWidth
            variant="outlined"
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
          >
            <MenuItem value="">Seleccione una empresa...</MenuItem>
            {companies.map(c => (
              <MenuItem key={c.id} value={c.nombre_comercial || c.nit}>{c.nombre_comercial || c.nit}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3 }}>
          <Button onClick={() => setShowModal(false)} color="inherit">Cancelar</Button>
          <Button onClick={handleCreate} variant="contained" disabled={!title.trim() || !selectedCompany} sx={{ borderRadius: 2 }}>
            Generar Borrador
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
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

  const totals = useMemo(() => {
    let grossTotal = 0, dedTotal = 0, patronalTotal = 0;
    data.forEach(e => {
      const baseFactor = (e.days || 30) / 30;
      const sueldoOrd = Number(e.sueldo_ordinario) || 0;
      const bonInc = Number(e.bon_incentivo) || 0;

      const baseSalary = sueldoOrd * baseFactor;
      const bonusLey = bonInc * baseFactor;
      
      const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
      const gross = baseSalary + bonusLey + (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0) + bonusesSum;
      
      const igssLaboral = baseSalary * CUOTA_LABORAL_RATE;
      const customDed = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);
      const isr = Number(e.isr) || 0;
      const ded = customDed + igssLaboral + isr;
      
      const patronal = baseSalary * CUOTA_PATRONAL_RATE;
      
      grossTotal += gross;
      dedTotal += ded;
      patronalTotal += patronal;
    });
    return { grossTotal, dedTotal, patronalTotal, netTotal: grossTotal - dedTotal };
  }, [data]);

  if (!draft) return null;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={onBack} title="Volver a Borradores">
            <ArrowLeft size={24} />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {draft.title}
              <Chip label="Borrador" color="warning" size="small" sx={{ fontWeight: 700 }} />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data.length} empleados en esta nómina
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" color="inherit" startIcon={<Download size={16} />} onClick={() => showToast('Función en desarrollo', 'info')} sx={{ borderRadius: 2 }}>
            Excel
          </Button>
          <Button variant="outlined" color="inherit" startIcon={<FileText size={16} />} onClick={() => showToast('Función en desarrollo', 'info')} sx={{ borderRadius: 2 }}>
            PDF
          </Button>
          <Button variant="contained" color="primary" startIcon={<Check size={16} />} onClick={handleClose} sx={{ borderRadius: 2 }}>
            Cerrar Nómina
          </Button>
        </Box>
      </Box>

      {/* Summary strip */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }} elevation={0}>
        <SummaryStat label="Costo Bruto Total" value={formatQ(totals.grossTotal)} />
        <Divider orientation="vertical" flexItem />
        <SummaryStat label="Deducciones Totales" value={formatQ(totals.dedTotal)} color="error.main" />
        <Divider orientation="vertical" flexItem />
        <SummaryStat label="Cuota Patronal Estimada" value={formatQ(totals.patronalTotal)} color="warning.main" />
        <Divider orientation="vertical" flexItem />
        <SummaryStat label="Neto a Pagar" value={formatQ(totals.netTotal)} color="primary.main" large />
      </Paper>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {TABS.map(t => (
            <Tab key={t.id} value={t.id} label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><t.icon size={16} />{t.label}</Box>} sx={{ fontWeight: 600, textTransform: 'none', fontSize: '0.95rem' }} />
          ))}
        </Tabs>
      </Box>

      {/* Tab content */}
      <Box sx={{ animation: 'fadeIn 0.3s' }}>
        {tab === 'income' && <IncomeTab data={data} onChange={handleChange} editingCell={editingCell} setEditingCell={setEditingCell} />}
        {tab === 'deductions' && <DeductionsTab data={data} onChange={handleChange} editingCell={editingCell} setEditingCell={setEditingCell} />}
        {tab === 'summary' && <SummaryTab data={data} bonuses={bonuses} />}
        {tab === 'distribution' && <DistributionTab data={data} />}
      </Box>
    </Box>
  );
}

function IncomeTab({ data, onChange, editingCell, setEditingCell }) {
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Table sx={{ minWidth: 1000 }} size="small">
        <TableHead sx={{ bgcolor: 'background.default' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Empleado</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Días Lab.</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>H.E. Simples (Cant)</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>H.E. Simples (Q)</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>H.E. Dobles (Cant)</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>H.E. Dobles (Q)</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Comisiones</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Otros Ingresos</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Total Bruto</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(e => {
            const baseFactor = (e.days || 30) / 30;
            const sueldoOrd = Number(e.sueldo_ordinario) || 0;
            const bonInc = Number(e.bon_incentivo) || 0;
            const extrasVal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
            const gross = (sueldoOrd * baseFactor) + (bonInc * baseFactor) + extrasVal;
            
            return (
              <TableRow key={e.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', fontWeight: 700, bgcolor: 'background.default', color: 'text.primary', border: '1px solid', borderColor: 'divider' }}>
                      {(e.nombres?.[0] || '') + (e.apellidos?.[0] || '')}
                    </Avatar>
                    <Typography variant="body2" fontWeight={600} color="primary.main">{e.nombres} {e.apellidos}</Typography>
                  </Box>
                </TableCell>
                <EditableCell id={e.id} field="days" section="root" value={e.days} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={70} />
                <EditableCell id={e.id} field="simplesQty" section="extras" value={e.extras?.simplesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={70} />
                <EditableCell id={e.id} field="simplesVal" section="extras" value={e.extras?.simplesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={90} isMoney />
                <EditableCell id={e.id} field="doblesQty" section="extras" value={e.extras?.doblesQty || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={70} />
                <EditableCell id={e.id} field="doblesVal" section="extras" value={e.extras?.doblesVal || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={90} isMoney />
                <EditableCell id={e.id} field="comisiones" section="extras" value={e.extras?.comisiones || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={100} isMoney />
                <EditableCell id={e.id} field="otrosIngresos" section="extras" value={e.extras?.otrosIngresos || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={100} isMoney />
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="secondary.main">{formatQ(gross)}</Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DeductionsTab({ data, onChange, editingCell, setEditingCell }) {
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Table sx={{ minWidth: 1000 }} size="small">
        <TableHead sx={{ bgcolor: 'background.default' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Empleado</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>IGSS (4.83%)</TableCell>
            {Object.keys(DEDUCTION_LABELS).map(k => <TableCell key={k} sx={{ fontWeight: 700 }}>{DEDUCTION_LABELS[k]}</TableCell>)}
            <TableCell sx={{ fontWeight: 700 }} align="right">Total Deducciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(e => {
            const baseFactor = (e.days || 30) / 30;
            const sueldoOrd = Number(e.sueldo_ordinario) || 0;
            const igssLaboral = (sueldoOrd * baseFactor) * CUOTA_LABORAL_RATE;
            const customDed = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);
            const totalDed = customDed + igssLaboral;
            
            return (
              <TableRow key={e.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', fontWeight: 700, bgcolor: 'background.default', color: 'text.primary', border: '1px solid', borderColor: 'divider' }}>
                      {(e.nombres?.[0] || '') + (e.apellidos?.[0] || '')}
                    </Avatar>
                    <Typography variant="body2" fontWeight={600} color="primary.main">{e.nombres} {e.apellidos}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }} title="Calculado automáticamente (4.83% s/ base proporc.)">{formatQ(igssLaboral)}</TableCell>
                {Object.keys(DEDUCTION_LABELS).map(k => (
                  <EditableCell key={k} id={e.id} field={k} section="deductions" value={e.deductions?.[k] || 0} onChange={onChange} editing={editingCell} setEditing={setEditingCell} width={80} isMoney isDanger />
                ))}
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="error.main">{formatQ(totalDed)}</Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SummaryTab({ data, bonuses }) {
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
      <Table sx={{ minWidth: 1200 }} size="small">
        <TableHead sx={{ bgcolor: 'background.default' }}>
          <TableRow>
            <TableCell sx={{ minWidth: 200, fontWeight: 700 }}>Empleado</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Empresas</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Salario</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Bono Ley</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>H. Extras</TableCell>
            {bonuses?.map(b => (
              <TableCell key={b.id} sx={{ fontWeight: 700 }}>{b.name}</TableCell>
            ))}
            <TableCell sx={{ fontWeight: 700 }}>Devengado (Bruto)</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>IGSS</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Otras Ded.</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">Neto (Líquido)</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="right">1ra Quincena</TableCell>
            <TableCell sx={{ fontWeight: 700, bgcolor: 'action.hover' }} align="right">2da Quincena</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(e => {
            const baseFactor = (e.days || 30) / 30;
            const sueldoOrd = Number(e.sueldo_ordinario) || 0;
            const bonInc = Number(e.bon_incentivo) || 0;

            const baseSalary = sueldoOrd * baseFactor;
            const bonusLey = bonInc * baseFactor;
            
            const extrasTotal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
            const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);
            const gross = baseSalary + bonusLey + extrasTotal + bonusesSum;
            
            const igssLaboral = baseSalary * CUOTA_LABORAL_RATE;
            const customDed = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);
            const isr = Number(e.isr) || 0;
            const ded = customDed + igssLaboral + isr;
            
            const net = gross - ded;
            const q1 = net > 0 ? net / 2 : 0;
            const q2 = net > 0 ? net - q1 : 0;
            
            return (
              <TableRow key={e.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600} color="primary.main">{e.nombres} {e.apellidos}</Typography>
                  <Typography variant="caption" color="text.secondary">{e.puesto_laboral || e.departamento_laboral || 'Sin puesto'}</Typography>
                </TableCell>
                <TableCell>
                   <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {e.empresas?.map(emp => <Chip key={emp.id} label={emp.nombre_comercial} size="small" sx={{ fontSize: '0.65rem' }} />)}
                   </Box>
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{formatQ(baseSalary)}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{formatQ(bonusLey)}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', color: extrasTotal > 0 ? 'secondary.main' : 'inherit' }}>{extrasTotal > 0 ? formatQ(extrasTotal) : '—'}</TableCell>
                {bonuses?.map(b => (
                  <TableCell key={b.id} sx={{ fontFamily: 'monospace', color: 'secondary.main' }}>{formatQ(e.appliedBonuses?.[b.id] || 0)}</TableCell>
                ))}
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'secondary.main' }}>{formatQ(gross)}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', color: igssLaboral > 0 ? 'error.main' : 'text.secondary' }}>{igssLaboral > 0 ? `- ${formatQ(igssLaboral)}` : '—'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', color: customDed > 0 ? 'error.main' : 'text.secondary' }}>{customDed > 0 ? `- ${formatQ(customDed)}` : '—'}</TableCell>
                <TableCell align="right">
                  <Typography variant="body1" fontFamily="monospace" fontWeight={800} color="primary.main">{formatQ(net)}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ bgcolor: 'action.hover' }}>
                  <Typography variant="body2" fontFamily="monospace" color="primary.main">{formatQ(q1)}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ bgcolor: 'action.hover' }}>
                  <Typography variant="body2" fontFamily="monospace" color="primary.main">{formatQ(q2)}</Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DistributionTab({ data }) {
  const { companies: COMPANIES } = useContext(DataContext);
  const companyTotals = COMPANIES.map(c => {
    let salary = 0, bonus = 0, extras = 0, patronal = 0;
    data.forEach(e => {
      const distData = typeof e.dist === 'string' ? JSON.parse(e.dist) : e.dist;
      const pct = (distData?.[c.id] || 0) / 100;
      const baseFactor = (e.days || 30) / 30;
      
      const sueldoOrd = Number(e.sueldo_ordinario) || 0;
      const bonInc = Number(e.bon_incentivo) || 0;
      
      salary += (sueldoOrd * baseFactor) * pct;
      bonus += (bonInc * baseFactor) * pct;
      extras += ((e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0)) * pct;
      patronal += (sueldoOrd * baseFactor) * CUOTA_PATRONAL_RATE * pct;
    });
    return { ...c, salary, bonus, extras, patronal, total: salary + bonus + extras + patronal };
  }).filter(c => c.total > 0);
  
  const grandTotal = companyTotals.reduce((s, c) => s + c.total, 0);

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {companyTotals.map((c, i) => (
          <Grid item xs={12} sm={6} md={4} key={c.id}>
            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c.color || 'primary.main', boxShadow: `0 0 10px ${c.color || '#3B82F6'}50` }} />
                <Typography variant="subtitle2" fontWeight={700}>{c.nombre_comercial || c.nit}</Typography>
              </Box>
              <Typography variant="h5" fontFamily="monospace" fontWeight={800} color="secondary.main" gutterBottom>
                {formatQ(c.total)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                {grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0}% del costo total
              </Typography>
              <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden', mt: 1 }}>
                <Box sx={{ height: '100%', bgcolor: c.color || 'primary.main', width: `${grandTotal > 0 ? (c.total / grandTotal) * 100 : 0}%` }} />
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'background.default' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Empresa</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Salarios Ordinarios</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Bonos Ley</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>H. Extras y Otros</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Cuota Patronal Estimada</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Costo Total Asignado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companyTotals.map(c => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color || 'primary.main' }} />
                    <Typography variant="body2" fontWeight={600} color="primary.main">{c.nombre_comercial || c.nit}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{formatQ(c.salary)}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{formatQ(c.bonus)}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{formatQ(c.extras)}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', color: 'warning.main' }}>{formatQ(c.patronal)}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="secondary.main">{formatQ(c.total)}</Typography>
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 800, color: 'primary.main' }}>GRAN TOTAL</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatQ(companyTotals.reduce((s, c) => s + c.salary, 0))}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatQ(companyTotals.reduce((s, c) => s + c.bonus, 0))}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatQ(companyTotals.reduce((s, c) => s + c.extras, 0))}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'warning.main' }}>{formatQ(companyTotals.reduce((s, c) => s + c.patronal, 0))}</TableCell>
              <TableCell align="right">
                <Typography variant="body1" fontFamily="monospace" fontWeight={800} color="primary.main">{formatQ(grandTotal)}</Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function EditableCell({ id, field, section, value, onChange, editing, setEditing, width, isMoney, isDanger }) {
  const isEditing = editing?.id === id && editing?.field === field;

  if (isEditing) {
    return (
      <TableCell sx={{ p: 0.5 }}>
        <TextField
          type="number"
          size="small"
          autoFocus
          defaultValue={value}
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
          sx={{ width, minWidth: 60 }}
          InputProps={{ sx: { fontSize: '0.8rem', height: 32 } }}
        />
      </TableCell>
    );
  }

  return (
    <TableCell
      onClick={() => setEditing({ id, field })}
      sx={{ 
        cursor: 'pointer', 
        '&:hover': { bgcolor: 'action.hover' },
        transition: 'background-color 0.2s',
        position: 'relative'
      }}
      title="Haz clic para editar"
    >
      <Typography 
        variant="body2" 
        fontFamily="monospace"
        sx={{
          color: (isMoney && value > 0 && !isDanger) ? 'secondary.main' : (isDanger && value > 0) ? 'error.main' : 'inherit',
          display: 'inline-block',
          minWidth: 40
        }}
      >
        {isMoney && value > 0 ? formatQ(value) : value}
        {isMoney && value === 0 && <Typography component="span" color="text.tertiary">—</Typography>}
      </Typography>
    </TableCell>
  );
}

function SummaryStat({ label, value, color, large }) {
  return (
    <Box>
      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h6" fontFamily="monospace" fontWeight={800} sx={{ fontSize: large ? '1.5rem' : '1.25rem', color: color || 'secondary.main', letterSpacing: '-0.02em' }}>
        {value}
      </Typography>
    </Box>
  );
}
