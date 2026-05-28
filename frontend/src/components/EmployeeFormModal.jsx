import React, { useState } from 'react';
import { X, Check, User, Users, FileSignature, Landmark, GraduationCap } from 'lucide-react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Checkbox, FormControlLabel,
  Box, Grid, Typography, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, IconButton, Slider
} from '@mui/material';

export default function EmployeeFormModal({ mode, initialData, onClose, onSave, companies, departments }) {
  const [tab, setTab] = useState('personal');
  const [form, setForm] = useState(initialData || {});

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    // Validations could go here
    onSave(form);
  };

  const distTotal = form.dist ? Object.values(form.dist).reduce((a, b) => a + b, 0) : 0;

  return (
    <Dialog 
      open={true} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 3,
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
          height: '85vh',
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden'
        }
      }}
    >
      {/* Sidebar Navigation */}
      <Box sx={{ width: 280, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        <Box sx={{ p: 3, pb: 2 }}>
          <Typography variant="h6" fontWeight={700}>
            {mode === 'add' ? 'Nuevo Empleado' : 'Editar Empleado'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Formulario completo del expediente
          </Typography>
        </Box>
        <List sx={{ flex: 1, overflowY: 'auto', px: 2 }}>
          <SidebarTab icon={User} label="Datos Personales" active={tab === 'personal'} onClick={() => setTab('personal')} />
          <SidebarTab icon={Users} label="Contacto y Familia" active={tab === 'family'} onClick={() => setTab('family')} />
          <SidebarTab icon={FileSignature} label="Legal y Contrato" active={tab === 'legal'} onClick={() => setTab('legal')} />
          <SidebarTab icon={Landmark} label="Salario y Banco" active={tab === 'salary'} onClick={() => setTab('salary')} />
          <SidebarTab icon={GraduationCap} label="Educación" active={tab === 'education'} onClick={() => setTab('education')} />
        </List>
      </Box>

      {/* Form Content Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 4, pt: 3, pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {tab === 'personal' ? 'Datos Personales' : tab === 'family' ? 'Contacto y Familia' : tab === 'legal' ? 'Legal y Contrato' : tab === 'salary' ? 'Salario y Banco' : 'Educación'}
          </Typography>
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }} size="small">
            <X size={22} />
          </IconButton>
        </Box>
        
        <DialogContent sx={{ px: 4, py: 3, overflowY: 'auto', flex: 1 }}>
          
          {tab === 'personal' && (
            <Box>
              <SectionTitle title="Nombres y Apellidos" />
              <Grid container spacing={2}>
                <Field label="Primer Nombre" val={form.primer_nombre} onChange={v => handleChange('primer_nombre', v)} />
                <Field label="Segundo Nombre" val={form.segundo_nombre} onChange={v => handleChange('segundo_nombre', v)} />
                <Field label="Otro Nombre" val={form.otro_nombre} onChange={v => handleChange('otro_nombre', v)} />
                <Field label="Primer Apellido" val={form.primer_apellido} onChange={v => handleChange('primer_apellido', v)} />
                <Field label="Segundo Apellido" val={form.segundo_apellido} onChange={v => handleChange('segundo_apellido', v)} />
                <Field label="Apellido de Casada" val={form.apellido_casada} onChange={v => handleChange('apellido_casada', v)} />
              </Grid>

              <SectionTitle title="Información Demográfica" />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField 
                    fullWidth label="Fecha de Nacimiento" type="date" 
                    value={form.fecha_nacimiento?.split('T')[0] || ''} 
                    onChange={e => handleChange('fecha_nacimiento', e.target.value)} 
                    InputLabelProps={{ shrink: true }}
                    size="small"
                  />
                </Grid>
                <Field label="Edad" val={form.edad} onChange={v => handleChange('edad', v)} />
                <SelectField label="Género" val={form.genero} onChange={v => handleChange('genero', v)} options={['Masculino', 'Femenino', 'Otro']} />
                <SelectField label="Estado Civil" val={form.estado_civil} onChange={v => handleChange('estado_civil', v)} options={['Soltero', 'Casado', 'Divorciado', 'Viudo', 'Unido']} />
                <Field label="Nacionalidad" val={form.nacionalidad} onChange={v => handleChange('nacionalidad', v)} />
              </Grid>
            </Box>
          )}

          {tab === 'family' && (
            <Box>
              <SectionTitle title="Datos de Contacto" />
              <Grid container spacing={2}>
                <Grid item xs={12}><TextField fullWidth label="Dirección de Residencia" value={form.direccion || ''} onChange={e => handleChange('direccion', e.target.value)} size="small" /></Grid>
                <Field label="Teléfono Fijo" val={form.telefono} onChange={v => handleChange('telefono', v)} />
                <Field label="Teléfono Celular" val={form.telefono_celular} onChange={v => handleChange('telefono_celular', v)} />
              </Grid>

              <SectionTitle title="Cónyuge" />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={5}><TextField fullWidth label="Nombre Completo" value={form.conyugue || ''} onChange={e => handleChange('conyugue', e.target.value)} size="small" /></Grid>
                <Grid item xs={12} sm={2}><TextField fullWidth label="Edad" value={form.edad_conyuge || ''} onChange={e => handleChange('edad_conyuge', e.target.value)} size="small" /></Grid>
                <Grid item xs={12} sm={5}><TextField fullWidth label="Ocupación" value={form.ocupacion_conyuge || ''} onChange={e => handleChange('ocupacion_conyuge', e.target.value)} size="small" /></Grid>
              </Grid>

              <SectionTitle title="Padres" />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={5}><TextField fullWidth label="Nombre del Padre" value={form.nombre_padre || ''} onChange={e => handleChange('nombre_padre', e.target.value)} size="small" /></Grid>
                <Grid item xs={12} sm={2}><TextField fullWidth label="Edad" value={form.edad_padre || ''} onChange={e => handleChange('edad_padre', e.target.value)} size="small" /></Grid>
                <Grid item xs={12} sm={5}><TextField fullWidth label="Ocupación" value={form.ocupacion_padre || ''} onChange={e => handleChange('ocupacion_padre', e.target.value)} size="small" /></Grid>
                <Grid item xs={12} sm={5}><TextField fullWidth label="Nombre de la Madre" value={form.nombre_madre || ''} onChange={e => handleChange('nombre_madre', e.target.value)} size="small" /></Grid>
                <Grid item xs={12} sm={2}><TextField fullWidth label="Edad" value={form.edad_madre || ''} onChange={e => handleChange('edad_madre', e.target.value)} size="small" /></Grid>
                <Grid item xs={12} sm={5}><TextField fullWidth label="Ocupación" value={form.ocupacion_madre || ''} onChange={e => handleChange('ocupacion_madre', e.target.value)} size="small" /></Grid>
              </Grid>

              <SectionTitle title="Contacto de Emergencia" />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Nombre de Emergencia" value={form.nombre_emergencia || ''} onChange={e => handleChange('nombre_emergencia', e.target.value)} size="small" /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth label="Teléfono de Emergencia" value={form.telefono_emergencia || ''} onChange={e => handleChange('telefono_emergencia', e.target.value)} size="small" /></Grid>
              </Grid>
            </Box>
          )}

          {tab === 'legal' && (
            <Box>
              <SectionTitle title="Identidad Legal" />
              <Grid container spacing={2}>
                <Field label="DPI" val={form.dpi} onChange={v => handleChange('dpi', v)} />
                <Field label="Emisión de DPI (Lugar)" val={form.emision_dpi} onChange={v => handleChange('emision_dpi', v)} />
                <Field label="NIT" val={form.nit} onChange={v => handleChange('nit', v)} />
                <Field label="Número IGSS" val={form.no_igss} onChange={v => handleChange('no_igss', v)} />
                <Field label="Cédula (Si aplica)" val={form.cedula} onChange={v => handleChange('cedula', v)} />
              </Grid>

              <SectionTitle title="Licencia de Conducir" />
              <Grid container spacing={2}>
                <Field label="Número de Licencia" val={form.licencia} onChange={v => handleChange('licencia', v)} />
                <SelectField label="Tipo de Licencia" val={form.tipo_licencia} onChange={v => handleChange('tipo_licencia', v)} options={['A', 'B', 'C', 'M']} />
                <SelectField label="Clase de Licencia" val={form.clase_licencia} onChange={v => handleChange('clase_licencia', v)} options={['Vehículo Liviano', 'Motocicleta', 'Pesado', 'Transporte']} />
              </Grid>

              <SectionTitle title="Contrato y Empresa" />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField select fullWidth label="Empresa Principal" value={form.companyId || ''} onChange={e => handleChange('companyId', e.target.value)} size="small">
                    <MenuItem value=""><em>Seleccione empresa...</em></MenuItem>
                    {companies.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre_comercial || c.nit}</MenuItem>)}
                  </TextField>
                </Grid>
                <SelectField label="Estado de Empleado" val={form.estado} onChange={v => handleChange('estado', v)} options={['Activo', 'Inactivo', 'Suspendido']} half />
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Fecha de Inicio" type="date" value={form.fecha_inicio?.split('T')[0] || ''} onChange={e => handleChange('fecha_inicio', e.target.value)} InputLabelProps={{ shrink: true }} size="small" />
                </Grid>
                <SelectField label="Tipo de Plantilla" val={form.tipo_plantilla} onChange={v => handleChange('tipo_plantilla', v)} options={['Permanente', 'Temporal']} half />
                <Field label="Puesto / Cargo" val={form.puesto} onChange={v => handleChange('puesto', v)} half />
                <SelectField label="Departamento Laboral" val={form.departamento_laboral} onChange={v => handleChange('departamento_laboral', v)} options={departments} half />
                <SelectField label="Rol de Sistema" val={form.rol_permisos} onChange={v => handleChange('rol_permisos', v)} options={['empleado', 'admin', 'rrhh']} half />
              </Grid>
            </Box>
          )}

          {tab === 'salary' && (
            <Box>
              <SectionTitle title="Compensación Fija" />
              <Grid container spacing={2}>
                <Field label="Sueldo Ordinario Base (Q)" type="number" val={form.sueldo_ordinario} onChange={v => handleChange('sueldo_ordinario', v)} />
                <Field label="Bono Decreto 37-2001 (Q)" type="number" val={form.bon_dec_37_2001} onChange={v => handleChange('bon_dec_37_2001', v)} />
                <Field label="Bonificación Incentivo (Q)" type="number" val={form.bon_incentivo} onChange={v => handleChange('bon_incentivo', v)} />
                <Field label="Ventas / Comisiones Promedio" type="number" val={form.ventas_economicas} onChange={v => handleChange('ventas_economicas', v)} />
                <Field label="Otros Ingresos (Q)" type="number" val={form.otro_ingresos} onChange={v => handleChange('otro_ingresos', v)} />
              </Grid>

              <SectionTitle title="Distribución de Costos por Empresa" />
              <Box sx={{ mb: 4, p: 3, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">Porcentaje de Costo</Typography>
                  <Box 
                    sx={{ 
                      bgcolor: distTotal === 100 ? 'success.main' : 'error.main', 
                      color: 'white', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 700 
                    }}
                  >
                    {distTotal}%
                  </Box>
                </Box>
                {companies.map(c => (
                  <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c.color || 'primary.main', flexShrink: 0 }} />
                    <Typography sx={{ width: 150, fontSize: '0.85rem' }}>{c.nombre_comercial || c.nit}</Typography>
                    <Slider 
                      value={form.dist?.[c.id] || 0} 
                      onChange={(e, val) => handleChange('dist', { ...form.dist, [c.id]: val })} 
                      step={5} min={0} max={100}
                      sx={{ flex: 1, color: c.color || 'primary.main' }}
                    />
                    <Typography fontFamily="monospace" sx={{ width: 50, textAlign: 'right', fontWeight: 600 }}>{form.dist?.[c.id] || 0}%</Typography>
                  </Box>
                ))}
              </Box>

              <SectionTitle title="Bancos e Ingresos" />
              <Grid container spacing={2}>
                <SelectField label="Método de Pago" val={form.tipo_de_pago} onChange={v => handleChange('tipo_de_pago', v)} options={['Transferencia', 'Efectivo', 'Cheque']} />
                <SelectField label="Banco" val={form.banco} onChange={v => handleChange('banco', v)} options={['Banrural', 'Industrial', 'Promerica', 'Bantrab', 'G&T Continental', 'BAM']} />
                <Field label="Número de Cuenta" val={form.no_cuenta} onChange={v => handleChange('no_cuenta', v)} />
                <SelectField label="Tipo de Cuenta" val={form.tipo_cuenta} onChange={v => handleChange('tipo_cuenta', v)} options={['Monetaria', 'Ahorro']} />
                <SelectField label="Moneda" val={form.moneda} onChange={v => handleChange('moneda', v)} options={['GTQ', 'USD']} />
              </Grid>

              <SectionTitle title="Deducciones Constantes (Q)" />
              <Grid container spacing={2}>
                <Field label="Total IGSS" type="number" val={form.total_igss} onChange={v => handleChange('total_igss', v)} />
                <Field label="ISR (Mensual)" type="number" val={form.isr} onChange={v => handleChange('isr', v)} />
                <Field label="Préstamo Empresa" type="number" val={form.prestamo_empresa} onChange={v => handleChange('prestamo_empresa', v)} />
                <Field label="Bancos (Deducción directa)" type="number" val={form.bancos} onChange={v => handleChange('bancos', v)} />
                <Field label="Seguro" type="number" val={form.seguro} onChange={v => handleChange('seguro', v)} />
                <Field label="Parqueo" type="number" val={form.parqueo} onChange={v => handleChange('parqueo', v)} />
                <Field label="Otras Deducciones" type="number" val={form.otro_descuentos} onChange={v => handleChange('otro_descuentos', v)} />
              </Grid>
            </Box>
          )}

          {tab === 'education' && (
            <Box>
              <SectionTitle title="Nivel Académico" />
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}><FormControlLabel control={<Checkbox checked={!!form.primaria} onChange={e => handleChange('primaria', e.target.checked)} />} label="Primaria Completada" /></Grid>
                <Grid item xs={12} sm={8}><TextField fullWidth label="Grado Primaria Alcanzado" value={form.grado_primaria || ''} onChange={e => handleChange('grado_primaria', e.target.value)} size="small" /></Grid>
                
                <Grid item xs={12} sm={4}><FormControlLabel control={<Checkbox checked={!!form.secundaria} onChange={e => handleChange('secundaria', e.target.checked)} />} label="Secundaria Completada" /></Grid>
                <Grid item xs={12} sm={8}><TextField fullWidth label="Grado Secundaria Alcanzado" value={form.grado_secundaria || ''} onChange={e => handleChange('grado_secundaria', e.target.value)} size="small" /></Grid>
                
                <Grid item xs={12} sm={4}><FormControlLabel control={<Checkbox checked={!!form.diversificado} onChange={e => handleChange('diversificado', e.target.checked)} />} label="Diversificado" /></Grid>
                <Grid item xs={12} sm={8}><TextField fullWidth label="Título Diversificado" value={form.titulo_diploma || ''} onChange={e => handleChange('titulo_diploma', e.target.value)} size="small" /></Grid>
                
                <Grid item xs={12}><FormControlLabel control={<Checkbox checked={!!form.universidad} onChange={e => handleChange('universidad', e.target.checked)} />} label="Universidad" /></Grid>
              </Grid>
              
              <SectionTitle title="Información Adicional" />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={3} label="Discapacidad (Detallar si existe)" value={form.discapacidad || ''} onChange={e => handleChange('discapacidad', e.target.value)} size="small" />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, backgroundColor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={onClose} color="inherit" sx={{ mr: 1 }}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" color="primary" startIcon={<Check size={16} />}>
            {mode === 'add' ? 'Crear Empleado' : 'Guardar Cambios'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// Subcomponents
function SectionTitle({ title }) {
  return (
    <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2, mt: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {title}
    </Typography>
  );
}

function Field({ label, val, onChange, type = "text", half }) {
  return (
    <Grid item xs={12} sm={half ? 6 : 4}>
      <TextField 
        fullWidth 
        label={label} 
        type={type}
        value={val || (type === 'number' ? '0' : '')} 
        onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} 
        size="small"
      />
    </Grid>
  );
}

function SelectField({ label, val, onChange, options, half }) {
  return (
    <Grid item xs={12} sm={half ? 6 : 4}>
      <TextField 
        select 
        fullWidth 
        label={label} 
        value={val || ''} 
        onChange={e => onChange(e.target.value)}
        size="small"
      >
        <MenuItem value=""><em>Seleccione...</em></MenuItem>
        {options.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
      </TextField>
    </Grid>
  );
}

function SidebarTab({ icon: Icon, label, active, onClick }) {
  return (
    <ListItem disablePadding sx={{ mb: 1 }}>
      <ListItemButton 
        onClick={onClick}
        sx={{ 
          borderRadius: 2,
          bgcolor: active ? 'action.selected' : 'transparent',
          borderLeft: active ? '3px solid' : '3px solid transparent',
          borderColor: active ? 'primary.main' : 'transparent',
          '&:hover': {
            bgcolor: 'action.hover'
          }
        }}
      >
        <ListItemIcon sx={{ minWidth: 36, color: active ? 'primary.main' : 'text.secondary' }}>
          <Icon size={18} />
        </ListItemIcon>
        <ListItemText 
          primary={label} 
          primaryTypographyProps={{ 
            fontSize: '0.85rem', 
            fontWeight: active ? 600 : 500,
            color: active ? 'text.primary' : 'text.secondary'
          }} 
        />
      </ListItemButton>
    </ListItem>
  );
}
