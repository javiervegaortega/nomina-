import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Tabs, Tab, Box, Typography,
  IconButton, Grid, Divider
} from '@mui/material';
import { X } from 'lucide-react';

const INITIAL_FORM = {
  nit: '',
  nombre_comercial: '',
  razon_social: '',
  direccion: '',
  calle: '',
  apto: '',
  departamento: '',
  apartado_postal: '',
  telefono: '',
  fax: '',
  email: '',
  nomenclatura: '',
  numero: '',
  colonia: '',
  municipio: '',
  direccion_patrono: '',
  nombre_patrono: '',
  numero_patrono: '',
  nit_patrono: '',
  id_banco: '',
  id_estado: 1, // Default state
};

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other} style={{ paddingTop: '20px' }}>
      {value === index && children}
    </div>
  );
}

export default function CompanyFormModal({ isOpen, onClose, onSave, initialData }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setForm({ ...INITIAL_FORM, ...initialData });
      } else {
        setForm(INITIAL_FORM);
      }
      setTabValue(0);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 3,
          backgroundColor: 'background.paper',
          backgroundImage: 'none'
        }
      }}
    >
      <DialogTitle sx={{ m: 0, p: 3, pb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {initialData ? 'Editar Empresa' : 'Nueva Empresa'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {initialData ? 'Edite los datos de la empresa.' : 'Cree una nueva empresa, llenando los campos que se solicitan.'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
            <X size={24} />
          </IconButton>
        </Box>
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
          <Tab label="Datos Generales" />
          <Tab label="Más Datos" />
        </Tabs>
      </Box>

      <DialogContent dividers sx={{ p: 3 }}>
        <form id="companyForm" onSubmit={handleSubmit}>
          
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="NIT" name="nit" value={form.nit || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="Nombre Comercial" name="nombre_comercial" value={form.nombre_comercial || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Dirección" name="direccion" value={form.direccion || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Razón Social" name="razon_social" value={form.razon_social || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Calle" name="calle" value={form.calle || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Apto." name="apto" value={form.apto || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Departamento" name="departamento" value={form.departamento || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Apartado Postal" name="apartado_postal" value={form.apartado_postal || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Teléfono" name="telefono" value={form.telefono || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="FAX" name="fax" value={form.fax || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="E-Mail" name="email" type="email" value={form.email || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Nomenclatura" name="nomenclatura" value={form.nomenclatura || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Número" name="numero" value={form.numero || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Colonia" name="colonia" value={form.colonia || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Municipio" name="municipio" value={form.municipio || ''} onChange={handleChange} variant="outlined" />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Dirección Patrono" name="direccion_patrono" value={form.direccion_patrono || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Nombre Patrono" name="nombre_patrono" value={form.nombre_patrono || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Número Patrono" name="numero_patrono" value={form.numero_patrono || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="NIT Patrono" name="nit_patrono" value={form.nit_patrono || ''} onChange={handleChange} variant="outlined" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField 
                  select 
                  fullWidth 
                  label="Banco" 
                  name="id_banco" 
                  value={form.id_banco || ''} 
                  onChange={handleChange} 
                  variant="outlined"
                >
                  <MenuItem value=""><em>Ninguno</em></MenuItem>
                  <MenuItem value="1">Banco Industrial</MenuItem>
                  <MenuItem value="2">Banrural</MenuItem>
                  <MenuItem value="3">BAM</MenuItem>
                  <MenuItem value="4">GyT Continental</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </TabPanel>
        </form>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2, backgroundColor: 'background.default' }}>
        <Button onClick={onClose} color="inherit" sx={{ mr: 1 }}>
          Cancelar
        </Button>
        <Button type="submit" form="companyForm" variant="contained" color="primary">
          Guardar Empresa
        </Button>
      </DialogActions>
    </Dialog>
  );
}
