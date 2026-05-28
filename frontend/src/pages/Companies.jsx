import React, { useState, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { Plus, Edit2, Trash2, Eye } from 'lucide-react';
import CompanyFormModal from '../components/CompanyFormModal';
import {
  Box, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton
} from '@mui/material';

export default function Companies() {
  const { companies, addCompany, updateCompany, deleteCompany } = useContext(DataContext);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);

  const openAdd = () => {
    setEditingId(null);
    setEditingData(null);
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setEditingData(c);
    setShowModal(true);
  };

  const handleSave = (formData) => {
    if (editingId) {
      updateCompany(editingId, formData);
    } else {
      addCompany(formData);
    }
    setShowModal(false);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Directorio de Empresas
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gestión de empresas y centros de costo · {companies.length} registros
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<Plus size={18} />} 
          onClick={openAdd}
          sx={{ borderRadius: 2 }}
        >
          Nueva Empresa
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ backgroundColor: 'background.default' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>NIT</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Nombre Comercial</TableCell>
              <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Razón Social</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, color: 'text.secondary' }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies.map((c, i) => (
              <TableRow key={c.id || i} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                    {c.nit || 'S/N'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body1" fontWeight={500}>
                    {c.nombre_comercial || 'Sin Nombre'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {c.razon_social || '-'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton color="primary" onClick={() => openEdit(c)} size="small" sx={{ mr: 1 }}>
                    <Eye size={18} />
                  </IconButton>
                  <IconButton color="secondary" onClick={() => openEdit(c)} size="small" sx={{ mr: 1 }}>
                    <Edit2 size={18} />
                  </IconButton>
                  <IconButton color="error" size="small" onClick={() => {
                    if (window.confirm(`¿Seguro que desea eliminar ${c.nombre_comercial || c.nit}?`)) deleteCompany(c.id);
                  }}>
                    <Trash2 size={18} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                  <Typography variant="body1" color="text.secondary">
                    No hay empresas registradas en el sistema.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CompanyFormModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onSave={handleSave} 
        initialData={editingData} 
      />
    </Box>
  );
}
