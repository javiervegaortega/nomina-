import React, { useContext } from 'react';
import {
  DollarSign, Users, TrendingUp, ArrowUpRight, ArrowDownRight,
  Building2, Clock, CheckCircle, AlertTriangle, BarChart3,
  Briefcase, PieChart
} from 'lucide-react';
import { DataContext } from '../context/DataContext';
import { formatQ } from '../data/mockData';
import { Box, Typography, Button, Paper, Grid, Avatar } from '@mui/material';

export default function Dashboard() {
  const { employees, companies, payrollHistory } = useContext(DataContext);

  const EMPLOYEES = employees;
  const COMPANIES = companies;

  // Computed stats
  const totalEmployees = EMPLOYEES.length;
  const activeEmployees = EMPLOYEES.filter(e => e.status === 'active' || e.status === 'ACTIVO' || e.estado === 'Activo').length;
  const totalGrossPayroll = EMPLOYEES.reduce((s, e) => s + (Number(e.sueldo_ordinario) || 0) + (Number(e.bon_incentivo) || 0), 0);
  const totalDeductions = EMPLOYEES.reduce((s, e) => s + (Number(e.total_igss) || 0) + (Number(e.isr) || 0), 0);
  const totalNetPay = totalGrossPayroll - totalDeductions;

  const companyDistribution = COMPANIES.map(c => {
    const total = EMPLOYEES.reduce((s, e) => {
      const pct = (e.dist?.[c.id] || 0) / 100;
      const base = (Number(e.sueldo_ordinario) || 0) + (Number(e.bon_incentivo) || 0);
      return s + (base * pct);
    }, 0);
    return { ...c, total };
  }).sort((a, b) => b.total - a.total);
  const maxCompanyTotal = companyDistribution.length ? companyDistribution[0].total : 1;

  const deptGroups = {};
  EMPLOYEES.forEach(e => {
    const dept = e.departamento_laboral || 'Sin Depto';
    if (!deptGroups[dept]) deptGroups[dept] = { count: 0, cost: 0 };
    deptGroups[dept].count++;
    deptGroups[dept].cost += (Number(e.sueldo_ordinario) || 0) + (Number(e.bon_incentivo) || 0);
  });
  const deptList = Object.entries(deptGroups).sort((a, b) => b[1].cost - a[1].cost).slice(0, 6);
  const maxDeptCost = deptList.length ? deptList[0][1].cost : 1;

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Resumen general de nómina y costos operativos
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" color="inherit" startIcon={<Clock size={16} />} sx={{ borderRadius: 2 }}>
            Período
          </Button>
          <Button variant="contained" color="primary" startIcon={<BarChart3 size={16} />} sx={{ borderRadius: 2 }}>
            Reporte
          </Button>
        </Box>
      </Box>

      {/* KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<DollarSign size={24} />}
            iconBg="rgba(255, 184, 0, 0.15)"
            iconColor="#FFB800"
            label="Costo Bruto Nómina"
            value={formatQ(totalGrossPayroll)}
            trend="+2.4%" trendDir="up"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<TrendingUp size={24} />}
            iconBg="rgba(16, 185, 129, 0.15)"
            iconColor="#10B981"
            label="Neto a Pagar"
            value={formatQ(totalNetPay)}
            trend="+1.8%" trendDir="up"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<Users size={24} />}
            iconBg="rgba(59, 130, 246, 0.15)"
            iconColor="#3B82F6"
            label="Total Empleados"
            value={totalEmployees}
            trend={`${activeEmployees} activos`} trendDir="up"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            icon={<AlertTriangle size={24} />}
            iconBg="rgba(239, 68, 68, 0.15)"
            iconColor="#EF4444"
            label="Total Deducciones"
            value={formatQ(totalDeductions)}
            trend="−0.5%" trendDir="down"
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Company Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%', border: '1px solid', borderColor: 'divider' }} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Building2 size={18} style={{ color: '#3B82F6' }} />
                Distribución por Empresa
              </Typography>
              <Typography variant="caption" color="text.secondary">{COMPANIES.length} empresas</Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {companyDistribution.map((c, i) => (
                <Box key={c.id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color || 'primary.main', boxShadow: `0 0 8px ${c.color || '#3B82F6'}60` }} />
                      <Typography variant="body2" fontWeight={600}>{c.nombre_comercial || c.nit}</Typography>
                    </Box>
                    <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="secondary.main">
                      {formatQ(c.total)}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
                    <Box 
                      sx={{ 
                        height: '100%', 
                        bgcolor: c.color || 'primary.main',
                        width: `${maxCompanyTotal > 0 ? (c.total / maxCompanyTotal) * 100 : 0}%`,
                        transition: 'width 1s ease-out'
                      }} 
                    />
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Department Cost */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%', border: '1px solid', borderColor: 'divider' }} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Briefcase size={18} style={{ color: '#3B82F6' }} />
                Costo por Departamento
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {deptList.map(([dept, data], i) => (
                <Box key={dept} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar variant="rounded" sx={{ width: 32, height: 32, bgcolor: 'background.default', color: 'text.secondary', border: '1px solid', borderColor: 'divider', fontSize: '0.8rem', fontWeight: 700 }}>
                    {data.count}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{dept}</Typography>
                      <Typography variant="caption" fontFamily="monospace" fontWeight={700} color="secondary.main">{formatQ(data.cost)}</Typography>
                    </Box>
                    <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', bgcolor: 'primary.light', width: `${(data.cost / maxDeptCost) * 100}%` }} />
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activity + Quick Stats */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%', border: '1px solid', borderColor: 'divider' }} elevation={0}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Actividad Reciente</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { icon: <CheckCircle size={16} />, color: '#10B981', text: 'Nómina 2da Quincena cerrada y aprobada', time: 'Hace 2 horas' },
                { icon: <Users size={16} />, color: '#3B82F6', text: 'Ajuste de distribución — Presidencia', time: 'Hace 5 horas' },
                { icon: <AlertTriangle size={16} />, color: '#F59E0B', text: 'Horas extras pendientes — Control de Calidad', time: 'Ayer' },
                { icon: <DollarSign size={16} />, color: '#8B5CF6', text: 'Nuevo empleado registrado en el sistema', time: 'Hace 3 días' },
              ].map((item, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  py: 1.5,
                  borderBottom: i < 3 ? '1px solid' : 'none',
                  borderColor: 'divider'
                }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: `${item.color}15`, color: item.color }}>
                    {item.icon}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{item.text}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.time}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%', border: '1px solid', borderColor: 'divider' }} elevation={0}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PieChart size={18} style={{ color: '#3B82F6' }} />
              Resumen Rápido
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[
                { label: 'Salario promedio', value: formatQ(totalEmployees > 0 ? totalGrossPayroll / totalEmployees : 0) },
                { label: 'Costo patronal estimado', value: formatQ(totalGrossPayroll * 0.1267) },
                { label: 'Nóminas procesadas', value: payrollHistory?.length || 0 },
                { label: 'Empresas activas', value: COMPANIES.length },
              ].map((item, i) => (
                <Box key={i} sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  p: 1.5,
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider'
                }}>
                  <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={700} color={typeof item.value === 'string' && item.value.includes('Q') ? 'secondary.main' : 'text.primary'}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function KpiCard({ icon, iconBg, iconColor, label, value, trend, trendDir }) {
  return (
    <Paper 
      sx={{ 
        p: 3, 
        borderRadius: 3, 
        border: '1px solid', 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '2px',
          background: `linear-gradient(90deg, ${iconColor}, transparent)`
        }
      }} 
      elevation={0}
    >
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={800} sx={{ my: 1, color: typeof value === 'string' && value.includes('Q') ? 'secondary.main' : 'text.primary' }}>
          {value}
        </Typography>
        <Typography variant="caption" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: trendDir === 'up' ? 'success.main' : 'error.main' }}>
          {trendDir === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </Typography>
      </Box>
      <Avatar sx={{ bgcolor: iconBg, color: iconColor, width: 48, height: 48 }}>
        {icon}
      </Avatar>
    </Paper>
  );
}
