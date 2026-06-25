import React, { useState, useContext } from 'react';
import { DataContext } from '../context/DataContext';
import { AppContext } from '../App';
import { AuthContext } from '../context/AuthContext';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { Plus, Edit2, Trash2, X, Check, Gift, Users } from 'lucide-react';
import { formatQ } from '../data/mockData';
import {
  Box,
  Flex,
  Skeleton,
  SkeletonText,
  SimpleGrid,
} from '@chakra-ui/react';

export default function Bonuses() {
  const { confirmAction } = useContext(AppContext);
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'AUDITOR';
  const { bonuses, addBonus, updateBonus, deleteBonus, employees, isLoading } = useContext(DataContext);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'fijo', assignments: {} });
  
  const pagination = usePagination(bonuses, 10);

  // States for adding a new assignment
  const [selectedEmp, setSelectedEmp] = useState('');
  const [assignAmount, setAssignAmount] = useState('');

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', type: 'fijo', assignments: {} });
    setSelectedEmp('');
    setAssignAmount('');
    setShowModal(true);
  };

  const openEdit = (b) => {
    setEditingId(b.id);
    setForm({ name: b.name, type: b.type || 'fijo', assignments: b.assignments || {} });
    setSelectedEmp('');
    setAssignAmount('');
    setShowModal(true);
  };

  const handleSave = () => {
    if (editingId) {
      updateBonus(editingId, { ...form });
    } else {
      addBonus({ ...form });
    }
    setShowModal(false);
  };

  const handleAddAssignment = () => {
    if (!selectedEmp || !assignAmount) return;
    setForm({
      ...form,
      assignments: {
        ...form.assignments,
        [selectedEmp]: Number(assignAmount)
      }
    });
    setSelectedEmp('');
    setAssignAmount('');
  };

  const removeAssignment = (empId) => {
    const newAssign = { ...form.assignments };
    delete newAssign[empId];
    setForm({ ...form, assignments: newAssign });
  };

  if (isLoading) {
    return (
      <Box p={{ base: 4, md: 6, lg: 8 }}>
        <Flex justify="space-between" align="center" mb={6}>
          <Box>
            <Skeleton h="28px" w="200px" mb={2} />
            <Skeleton h="14px" w="320px" />
          </Box>
          <Skeleton h="40px" w="140px" borderRadius="lg" />
        </Flex>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
          {[1,2,3,4,5,6].map(i => (
            <Box key={i} p={5} borderRadius="xl" border="1px solid" borderColor="gray.200" _dark={{ borderColor: 'whiteAlpha.100' }}>
              <Flex gap={3} align="center" mb={5}>
                <Skeleton w="44px" h="44px" borderRadius="md" />
                <Box flex={1}>
                  <Skeleton h="16px" w="70%" mb={2} />
                  <Skeleton h="12px" w="40%" />
                </Box>
              </Flex>
              <Box p={4} borderRadius="md" bg="gray.50" _dark={{ bg: 'whiteAlpha.50' }}>
                <Flex justify="space-between">
                  <Box>
                    <Skeleton h="10px" w="50px" mb={2} />
                    <Skeleton h="16px" w="90px" />
                  </Box>
                  <Box textAlign="right">
                    <Skeleton h="10px" w="80px" mb={2} />
                    <Skeleton h="20px" w="100px" />
                  </Box>
                </Flex>
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <h1>Gestión de Bonos</h1>
            <p>Configuración de bonificaciones e incentivos por empleado</p>
          </div>
        </div>
        <div>
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Crear Bono
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))', gap: '1.25rem' }}>
          {pagination.paginatedData.map((b, i) => {
            const assignedCount = Object.keys(b.assignments || {}).length;
            const totalAmount = Object.values(b.assignments || {}).reduce((a, val) => a + val, 0);

            return (
              <div key={b.id} className="card animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-subtle)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent-light)'
                    }}>
                      <Gift size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.15rem 0' }}>{b.name}</h3>
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{b.type.toUpperCase()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {!isReadOnly && (
                      <>
                        <button className="btn-icon" onClick={() => openEdit(b)} title="Editar Configuración"><Edit2 size={16} /></button>
                        <button 
                          className="btn btn-ghost" 
                          style={{ color: 'var(--danger)' }} 
                          onClick={() => {
                            confirmAction(`¿Seguro que desea eliminar el bono ${b.name}?`, () => {
                              deleteBonus(b.id);
                            });
                          }}
                          title="Eliminar"
                        ><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Alcance</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600 }}>
                      <Users size={14} style={{ color: 'var(--text-secondary)' }} /> {assignedCount} empleado{assignedCount !== 1 && 's'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Impacto Total Estimado</div>
                    <div className="font-mono text-gold" style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                      {formatQ(totalAmount)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {bonuses.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-tertiary)' }}>
              <Gift size={48} style={{ opacity: 0.3, marginBottom: '1rem', margin: '0 auto' }} />
              <p>No hay bonos configurados en el sistema.</p>
            </div>
          )}
        </div>
        {bonuses.length > 0 && <Pagination {...pagination} />}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '95%' }}>
            <div className="modal-header">
              <h2>{editingId ? 'Editar Bono' : 'Configuración de Bono'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group-row" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre del Incentivo/Bono</label>
                    <input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="ej: Bono de Productividad" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo</label>
                    <select className="input-field" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      <option value="fijo">Monto Fijo</option>
                      <option value="variable">Variable</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span>Asignaciones por Empleado</span>
                    <span className="badge badge-neutral">{Object.keys(form.assignments).length} asignados</span>
                  </label>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <select className="input-field" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} style={{ flex: 1 }}>
                      <option value="">-- Seleccione un empleado --</option>
                      {employees.filter(e => !form.assignments[e.id]).map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                    </select>
                    <input type="number" className="input-field" value={assignAmount} onChange={e => setAssignAmount(e.target.value)} placeholder="Monto Q" style={{ width: 120 }} />
                    <button className="btn btn-secondary" onClick={handleAddAssignment} disabled={!selectedEmp || !assignAmount}>Agregar</button>
                  </div>
                  
                  {Object.keys(form.assignments).length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      {Object.entries(form.assignments).map(([empId, amount], index) => {
                        const emp = employees.find(e => e.id.toString() === empId.toString());
                        const empName = emp?.name || 'Empleado Desconocido';
                        const empRole = emp?.role || '';
                        
                        return (
                          <div key={empId} style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                            padding: '0.6rem 1rem', 
                            background: index % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-glass)',
                            borderBottom: index < Object.entries(form.assignments).length - 1 ? '1px solid var(--border)' : 'none' 
                          }}>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{empName}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{empRole}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <span className="font-mono font-bold text-gold">{formatQ(amount)}</span>
                              <button className="btn-icon text-danger" onClick={() => removeAssignment(empId)} title="Quitar empleado"><X size={16} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name}><Check size={16} /> Guardar Configuración</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
