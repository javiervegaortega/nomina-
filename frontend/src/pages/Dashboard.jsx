import React, { useContext } from 'react';
import {
  DollarSign, Users, TrendingUp, ArrowUpRight, ArrowDownRight,
  Building2, Clock, CheckCircle, AlertTriangle, BarChart3,
  Briefcase, PieChart
} from 'lucide-react';
import { AppContext } from '../App';
import { DataContext } from '../context/DataContext';
import { formatQ } from '../data/mockData';

export default function Dashboard() {
  const { employees, companies, payrollHistory } = useContext(DataContext);

  const EMPLOYEES = employees;
  const COMPANIES = companies;

  // Computed stats
  const totalEmployees = EMPLOYEES.length;
  const activeEmployees = EMPLOYEES.filter(e => e.status === 'active' || e.status === 'ACTIVO').length;
  const totalGrossPayroll = EMPLOYEES.reduce((s, e) => s + e.base + e.bonus, 0);
  const totalDeductions = EMPLOYEES.reduce((s, e) => s + Object.values(e.deductions || {}).reduce((a, b) => a + b, 0), 0);
  const totalNetPay = totalGrossPayroll - totalDeductions;

  const companyDistribution = COMPANIES.map(c => {
    const total = EMPLOYEES.reduce((s, e) => {
      const pct = (e.dist?.[c.id] || 0) / 100;
      return s + (e.base + e.bonus) * pct;
    }, 0);
    return { ...c, total };
  }).sort((a, b) => b.total - a.total);
  const maxCompanyTotal = companyDistribution.length ? companyDistribution[0].total : 1;

  const deptGroups = {};
  EMPLOYEES.forEach(e => {
    if (!deptGroups[e.dept]) deptGroups[e.dept] = { count: 0, cost: 0 };
    deptGroups[e.dept].count++;
    deptGroups[e.dept].cost += e.base + e.bonus;
  });
  const deptList = Object.entries(deptGroups).sort((a, b) => b[1].cost - a[1].cost).slice(0, 6);
  const maxDeptCost = deptList.length ? deptList[0][1].cost : 1;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <h1>Dashboard</h1>
            <p>Resumen general de nómina y costos operativos</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost btn-sm"><Clock size={14} /> Período</button>
          <button className="btn btn-primary btn-sm"><BarChart3 size={14} /> Reporte</button>
        </div>
      </div>

      <div className="page-content">
        {/* KPIs */}
        <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
          <KpiCard
            icon={<DollarSign size={20} />}
            iconBg="var(--gold-glow)"
            iconColor="var(--gold-light)"
            label="Costo Bruto Nómina"
            value={formatQ(totalGrossPayroll)}
            trend="+2.4%" trendDir="up"
            delay={1}
          />
          <KpiCard
            icon={<TrendingUp size={20} />}
            iconBg="var(--success-bg)"
            iconColor="var(--success)"
            label="Neto a Pagar"
            value={formatQ(totalNetPay)}
            trend="+1.8%" trendDir="up"
            delay={2}
          />
          <KpiCard
            icon={<Users size={20} />}
            iconBg="var(--accent-subtle)"
            iconColor="var(--accent-light)"
            label="Total Empleados"
            value={totalEmployees}
            trend={`${activeEmployees} activos`} trendDir="up"
            delay={3}
          />
          <KpiCard
            icon={<AlertTriangle size={20} />}
            iconBg="var(--danger-bg)"
            iconColor="var(--danger)"
            label="Total Deducciones"
            value={formatQ(totalDeductions)}
            trend="−0.5%" trendDir="down"
            delay={4}
          />
        </div>

        {/* Charts Row */}
        <div className="charts-grid">
          {/* Company Distribution */}
          <div className="card animate-slide-up stagger-3">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={16} style={{ color: 'var(--accent-light)' }} />
                Distribución por Empresa
              </h3>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{COMPANIES.length} empresas</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {companyDistribution.map((c, i) => (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.gradient || c.color || 'var(--accent)', boxShadow: `0 0 6px ${c.color || 'var(--accent)'}40` }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.name}</span>
                    </div>
                    <span className="font-mono" style={{ fontSize: '0.82rem', color: 'var(--gold-light)', fontWeight: 600 }}>
                      {formatQ(c.total)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${maxCompanyTotal > 0 ? (c.total / maxCompanyTotal) * 100 : 0}%`,
                        background: c.gradient || c.color || 'var(--accent-gradient)',
                        animationDelay: `${i * 0.12}s`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department Cost */}
          <div className="card animate-slide-up stagger-4">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={16} style={{ color: 'var(--accent-light)' }} />
                Costo por Departamento
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {deptList.map(([dept, data], i) => (
                <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 'var(--radius-xs, 6px)',
                    background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-tertiary)',
                    flexShrink: 0, border: '1px solid var(--border)'
                  }}>
                    {data.count}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dept}</span>
                      <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--gold-light)', flexShrink: 0, fontWeight: 600 }}>{formatQ(data.cost)}</span>
                    </div>
                    <div className="progress-bar" style={{ height: 3 }}>
                      <div className="progress-bar-fill" style={{ width: `${(data.cost / maxDeptCost) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity + Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div className="card animate-slide-up stagger-5">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem' }}>Actividad Reciente</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {[
                { icon: <CheckCircle size={14} />, color: 'var(--success)', text: 'Nómina 2da Quincena cerrada y aprobada', time: 'Hace 2 horas' },
                { icon: <Users size={14} />, color: 'var(--info)', text: 'Ajuste de distribución — Presidencia', time: 'Hace 5 horas' },
                { icon: <AlertTriangle size={14} />, color: 'var(--warning)', text: 'Horas extras pendientes — Control de Calidad', time: 'Ayer' },
                { icon: <DollarSign size={14} />, color: 'var(--accent-light)', text: 'Nuevo empleado registrado en el sistema', time: 'Hace 3 días' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.7rem 0',
                  borderBottom: i < 3 ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: item.color,
                    background: `${item.color}12`,
                    flexShrink: 0
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{item.text}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card animate-slide-up stagger-5">
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PieChart size={16} style={{ color: 'var(--accent-light)' }} />
              Resumen Rápido
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {[
                { label: 'Salario promedio', value: formatQ(totalEmployees > 0 ? totalGrossPayroll / totalEmployees : 0) },
                { label: 'Costo patronal estimado', value: formatQ(totalGrossPayroll * 0.1267) },
                { label: 'Nóminas procesadas', value: payrollHistory.length },
                { label: 'Empresas activas', value: COMPANIES.length },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--bg-base)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span className="font-mono" style={{ fontSize: '0.82rem', fontWeight: 700, color: typeof item.value === 'string' && item.value.includes('Q') ? 'var(--gold-light)' : 'var(--text-primary)' }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({ icon, iconBg, iconColor, label, value, trend, trendDir, delay }) {
  return (
    <div className={`card card-glow animate-slide-up stagger-${delay}`} style={{ cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value" style={{ color: typeof value === 'string' && value.includes('Q') ? 'var(--gold-light)' : 'var(--text-primary)' }}>{value}</div>
          <div className={`kpi-trend ${trendDir}`}>
            {trendDir === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </div>
        </div>
        <div className="kpi-icon-wrap" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
    </div>
  );
}
