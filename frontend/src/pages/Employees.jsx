import React, { useState, useMemo, useContext } from 'react';
import {
  Search, Plus, Edit2, Trash2, X, Eye, ChevronDown,
  UserPlus, Filter, Download, Check, FileText
} from 'lucide-react';
import { DataContext } from '../context/DataContext';
import ImportData from '../components/ImportData';
import EmployeeFormModal from '../components/EmployeeFormModal';
import { formatQ, calculateMonthlyISR } from '../data/mockData';
import {
  Box, Typography, Button, TextField, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Chip, InputAdornment, Tooltip, Avatar
} from '@mui/material';

export default function Employees() {
  const { employees, addEmployee, updateEmployee, deleteEmployee, companies, departments } = useContext(DataContext);
  
  const INITIAL_FORM = {
    estado: 'Activo',
    moneda: 'GTQ',
    dist: companies.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {})
  };

  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add | edit | view
  const [currentEmp, setCurrentEmp] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Offboarding modal state
  const [offboardState, setOffboardState] = useState({ show: false, empId: null, reason: '', date: new Date().toISOString().split('T')[0] });
  
  // Finiquito modal state
  const [finiquitoState, setFiniquitoState] = useState({ show: false, emp: null, calculation: null });

  const getFullName = (e) => `${e.primer_nombre || ''} ${e.primer_apellido || ''}`.trim() || 'Sin Nombre';

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const fullName = getFullName(e);
      const matchSearch = fullName.toLowerCase().includes(search.toLowerCase()) ||
                          (e.puesto || '').toLowerCase().includes(search.toLowerCase());
      const matchDept = filterDept === 'ALL' || e.departamento_laboral === filterDept;
      const matchStatus = filterStatus === 'ALL' || e.estado === filterStatus || (filterStatus === 'active' && e.estado === 'Activo');
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, search, filterDept, filterStatus]);

  const openAdd = () => {
    setModalMode('add');
    setCurrentEmp(null);
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setModalMode('edit');
    setCurrentEmp(emp);
    setShowModal(true);
  };

  const openView = (emp) => {
    setModalMode('view');
    setCurrentEmp(emp);
    setShowModal(true);
  };

  const handleSave = (formData) => {
    if (modalMode === 'add') {
      addEmployee(formData);
    } else if (modalMode === 'edit' && currentEmp) {
      updateEmployee(currentEmp.id, formData);
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
      estado: 'Inactivo', 
      motivo_baja: offboardState.reason,
      fecha_baja: offboardState.date
    });
    setOffboardState({ show: false, empId: null, reason: '', date: '' });
  };

  const handleGenerateFiniquito = (emp) => {
    const baseTotal = Number(emp.sueldo_ordinario || 0) + Number(emp.bon_incentivo || 0);
    const calc = {
      indemnizacion: baseTotal * 1.5,
      aguinaldoProp: (baseTotal / 12) * 4,
      bono14Prop: (baseTotal / 12) * 2,
      vacaciones: (baseTotal / 30) * 15 * 0.5,
    };
    calc.total = calc.indemnizacion + calc.aguinaldoProp + calc.bono14Prop + calc.vacaciones;
    setFiniquitoState({ show: true, emp, calculation: calc });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Directorio de Empleados
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gestión de personal y distribución de costos · {employees.length} registros
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            color="secondary" 
            startIcon={<Download size={16} style={{ transform: 'rotate(180deg)' }} />} 
            onClick={() => setShowImport(true)}
            sx={{ borderRadius: 2 }}
          >
            Importar CSV
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<UserPlus size={16} />} 
            onClick={openAdd}
            sx={{ borderRadius: 2 }}
          >
            Nuevo Empleado
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder="Buscar por nombre o puesto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: '250px' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
            }}
          />
          <Button 
            variant={showFilters ? "contained" : "outlined"} 
            color="inherit" 
            startIcon={<Filter size={16} />} 
            onClick={() => setShowFilters(!showFilters)}
            sx={{ borderRadius: 2 }}
          >
            Filtros {showFilters ? '▲' : '▼'}
          </Button>
          {(filterDept !== 'ALL' || filterStatus !== 'ALL') && (
            <Button 
              variant="text" 
              color="inherit" 
              startIcon={<X size={16} />} 
              onClick={() => { setFilterDept('ALL'); setFilterStatus('ALL'); }}
            >
              Limpiar
            </Button>
          )}
        </Box>

        {/* Expandable filters */}
        {showFilters && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
            <TextField
              select
              label="Departamento"
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="ALL">Todos los departamentos</MenuItem>
              {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </TextField>
            <TextField
              select
              label="Estado"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="ALL">Todos los estados</MenuItem>
              <MenuItem value="Activo">Activo</MenuItem>
              <MenuItem value="Inactivo">Inactivo</MenuItem>
            </TextField>
          </Box>
        )}
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Table sx={{ minWidth: 800 }}>
          <TableHead sx={{ backgroundColor: 'background.default' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary', width: 50 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Empleado</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Departamento / Empresa</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Salario Base</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Distribución</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Estado</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((emp) => {
              const fullName = getFullName(emp);
              const companyName = companies.find(c => c.id === emp.companyId)?.nombre_comercial || 'Sin Asignar';
              
              return (
              <TableRow key={emp.id} hover>
                <TableCell>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">{emp.id}</Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.85rem', fontWeight: 700 }}>
                      {fullName.split(' ').slice(0, 2).map(n => n?.[0] || '').join('')}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ cursor: 'pointer' }} onClick={() => openView(emp)}>
                        {fullName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {emp.puesto || 'Sin Puesto'}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                    <Chip label={emp.departamento_laboral || 'N/A'} size="small" variant="outlined" color="primary" />
                    <Chip label={companyName} size="small" />
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600} color="secondary.main">
                    {formatQ(emp.sueldo_ordinario || 0)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={companies.filter(c => (emp.dist?.[c.id] || 0) > 0).map(c => `${c.nombre_comercial || c.nit}: ${emp.dist?.[c.id]}%`).join(' · ')}>
                    <Box sx={{ width: 120, height: 8, borderRadius: 4, display: 'flex', overflow: 'hidden', backgroundColor: 'action.hover' }}>
                      {companies.map(c => {
                        const pct = emp.dist?.[c.id] || 0;
                        return pct > 0 ? (
                          <Box key={c.id} sx={{ width: `${pct}%`, backgroundColor: c.color || 'primary.main' }} />
                        ) : null;
                      })}
                    </Box>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={emp.estado} 
                    size="small" 
                    color={emp.estado === 'Activo' ? 'success' : 'warning'} 
                    sx={{ fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton color="primary" size="small" onClick={() => openView(emp)} title="Ver detalle">
                    <Eye size={18} />
                  </IconButton>
                  <IconButton color="secondary" size="small" onClick={() => openEdit(emp)} title="Editar">
                    <Edit2 size={18} />
                  </IconButton>
                  {emp.estado === 'Activo' && (
                    <IconButton color="warning" size="small" onClick={() => setOffboardState({ show: true, empId: emp.id, reason: '', date: new Date().toISOString().split('T')[0] })} title="Dar de Baja">
                      <X size={18} />
                    </IconButton>
                  )}
                  {emp.estado === 'Inactivo' && (
                    <IconButton color="info" size="small" onClick={() => handleGenerateFiniquito(emp)} title="Generar Finiquito">
                      <FileText size={18} />
                    </IconButton>
                  )}
                  <IconButton color="error" size="small" onClick={() => handleDelete(emp.id)} title="Eliminar (Permanente)">
                    <Trash2 size={18} />
                  </IconButton>
                </TableCell>
              </TableRow>
            )})}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                  <Typography variant="body1" color="text.secondary">
                    No se encontraron empleados con los criterios de búsqueda.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {showModal && (modalMode === 'add' || modalMode === 'edit') && (
        <EmployeeFormModal 
          mode={modalMode} 
          initialData={currentEmp || INITIAL_FORM} 
          onClose={() => setShowModal(false)} 
          onSave={handleSave} 
          companies={companies} 
          departments={departments} 
        />
      )}

      {/* VIEW MODAL */}
      {showModal && modalMode === 'view' && currentEmp && (
        <Dialog open={true} onClose={() => setShowModal(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              Expediente del Empleado
              <IconButton onClick={() => setShowModal(false)} size="small">
                <X size={20} />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="h6" fontWeight={700} gutterBottom>{getFullName(currentEmp)}</Typography>
            <Typography variant="body1" sx={{ mb: 1 }}><strong>Puesto:</strong> {currentEmp.puesto}</Typography>
            <Typography variant="body1" sx={{ mb: 1 }}><strong>Empresa:</strong> {companies.find(c => c.id === currentEmp.companyId)?.nombre_comercial}</Typography>
            <Typography variant="body1" sx={{ mb: 2 }}><strong>Sueldo:</strong> {formatQ(currentEmp.sueldo_ordinario)}</Typography>
            <Typography variant="body2" color="text.secondary">
              Haz clic en editar para ver y modificar todos los detalles.
            </Typography>
          </DialogContent>
        </Dialog>
      )}

      {showImport && <ImportData onClose={() => setShowImport(false)} />}

      {/* OFFBOARDING MODAL */}
      <Dialog open={offboardState.show} onClose={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Dar de Baja
            <IconButton onClick={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })} size="small">
              <X size={20} />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            El empleado pasará a estado Inactivo y ya no aparecerá en nóminas futuras, pero su historial se mantendrá intacto.
          </Typography>
          <TextField
            label="Fecha de Baja"
            type="date"
            fullWidth
            value={offboardState.date}
            onChange={e => setOffboardState({ ...offboardState, date: e.target.value })}
            sx={{ mb: 3 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Motivo / Observaciones"
            multiline
            rows={3}
            fullWidth
            value={offboardState.reason}
            onChange={e => setOffboardState({ ...offboardState, reason: e.target.value })}
            placeholder="Ej: Renuncia voluntaria, fin de contrato, despido justificado..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleOffboard} disabled={!offboardState.reason} variant="contained" color="warning">
            Confirmar Baja
          </Button>
        </DialogActions>
      </Dialog>

      {/* FINIQUITO MODAL */}
      <Dialog open={finiquitoState.show && Boolean(finiquitoState.calculation)} onClose={() => setFiniquitoState({ show: false, emp: null, calculation: null })} maxWidth="sm" fullWidth>
        {finiquitoState.calculation && (
          <>
            <DialogTitle>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                Cálculo de Finiquito (Liquidación)
                <IconButton onClick={() => setFiniquitoState({ show: false, emp: null, calculation: null })} size="small">
                  <X size={20} />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">{getFullName(finiquitoState.emp)}</Typography>
                  <Typography variant="body2" color="text.secondary">{finiquitoState.emp?.puesto}</Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="caption" color="text.secondary">Salario Base Computable</Typography>
                  <Typography variant="body1" fontFamily="monospace" fontWeight={700} color="primary.main">
                    {formatQ(Number(finiquitoState.emp?.sueldo_ordinario || 0) + Number(finiquitoState.emp?.bon_incentivo || 0))}
                  </Typography>
                </Box>
              </Box>

              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Indemnización por Tiempo Servido</TableCell>
                      <TableCell align="right"><Typography fontFamily="monospace" color="primary.main">{formatQ(finiquitoState.calculation.indemnizacion)}</Typography></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Aguinaldo Proporcional</TableCell>
                      <TableCell align="right"><Typography fontFamily="monospace" color="primary.main">{formatQ(finiquitoState.calculation.aguinaldoProp)}</Typography></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Bono 14 Proporcional</TableCell>
                      <TableCell align="right"><Typography fontFamily="monospace" color="primary.main">{formatQ(finiquitoState.calculation.bono14Prop)}</Typography></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Vacaciones Pendientes de Goce</TableCell>
                      <TableCell align="right"><Typography fontFamily="monospace" color="primary.main">{formatQ(finiquitoState.calculation.vacaciones)}</Typography></TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell><Typography fontWeight={700} color="primary.main">GRAN TOTAL A RECIBIR</Typography></TableCell>
                      <TableCell align="right"><Typography fontFamily="monospace" fontWeight={700} color="secondary.main" fontSize="1.2rem">{formatQ(finiquitoState.calculation.total)}</Typography></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setFiniquitoState({ show: false, emp: null, calculation: null })} color="inherit">
                Cerrar
              </Button>
              <Button onClick={() => { alert('Generando PDF del Finiquito...'); setFiniquitoState({ show: false, emp: null, calculation: null }); }} variant="contained" color="primary" startIcon={<FileText size={16} />}>
                Imprimir Constancia
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
