require('dotenv').config();
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { User } = require('../../models');

const BASE = `http://localhost:${process.env.PORT || 3000}`;

function createAssert(state) {
  return (condition, message) => {
    if (condition) {
      state.passed += 1;
      console.log(`  OK: ${message}`);
    } else {
      state.failed += 1;
      console.error(`  FAIL: ${message}`);
    }
  };
}

async function getTokenForRole(role) {
  const variants = role ? [role] : [];
  if (role) {
    variants.push(role.toUpperCase(), role.toLowerCase());
    if (role.toLowerCase() === 'admin') variants.push('ADMIN', 'admin');
  }
  let user = null;
  for (const r of [...new Set(variants)]) {
    user = await User.findOne({ where: { role: r } });
    if (user) break;
  }
  user = user
    || await User.findOne({ where: { role: 'ADMIN' } })
    || await User.findOne({ where: { role: 'admin' } })
    || await User.findOne();
  if (!user) throw new Error('No hay usuarios en BD');
  return {
    token: jwt.sign(
      {
        id: user.id,
        name: user.name,
        role: user.role,
        idDepartamento: user.idDepartamento
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    ),
    user
  };
}

async function login(identifier, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: identifier, password })
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function api(path, opts = {}, token) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

async function checkServer() {
  try {
    const res = await fetch(`${BASE}/api/companies`);
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
}

function getQuincenaDateRange(draftDateStr, periodType) {
  const d = draftDateStr ? new Date(draftDateStr) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (periodType === '2da') {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: new Date(year, month, 16),
      end: new Date(year, month, lastDay, 23, 59, 59)
    };
  }
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month, 15, 23, 59, 59)
  };
}

function isDateInQuincena(dateStr, draftDateStr, periodType) {
  if (!dateStr) return false;
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length < 3) return false;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const { start, end } = getQuincenaDateRange(draftDateStr, periodType);
  return dt >= start && dt <= end;
}

function buildDraftEmployee(emp, ctx) {
  const {
    periodType = '1ra',
    draftRefDate,
    operationLogs = [],
    bonuses = [],
    commissions = []
  } = ctx;

  const days = periodType === '1ra' ? 15 : 30;
  const baseSalary = Number(emp.sueldo_ordinario) || 0;
  const companyId = emp.empresa_principal || emp.companyId;

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const currentMonth = monthNames[new Date(draftRefDate).getMonth()];

  let qtySimples = 0;
  let qtyDobles = 0;
  let totalBonos = 0;
  const attachedLogs = [];

  commissions
    .filter((c) => c.employee_id === emp.id && c.estado !== 'Aplicado' && c.mes === currentMonth)
    .forEach((c) => {
      totalBonos += Number(c.monto_bono) || 0;
    });

  operationLogs
    .filter((l) => {
      if (String(l.employeeId) !== String(emp.id) || l.status !== 'APPROVED_MANAGER') return false;
      return isDateInQuincena(l.date, draftRefDate, periodType);
    })
    .forEach((l) => {
      attachedLogs.push(l);
      if (l.type === 'HORA_EXTRA') {
        if (l.hourType === 'SIMPLE') qtySimples += Number(l.hoursQty) || 0;
        else qtyDobles += Number(l.hoursQty) || 0;
      } else if (l.type === 'BONO') {
        totalBonos += Number(l.bonusAmount) || 0;
      }
    });

  const hourlyRate = baseSalary / 30 / 8;
  const simplesQtyTotal = (Number(emp.horas_extras_simples) || 0) + qtySimples;
  const doblesQtyTotal = (Number(emp.horas_extras_dobles) || 0) + qtyDobles;
  const valSimples = simplesQtyTotal * hourlyRate * 1.5;
  const valDobles = doblesQtyTotal * hourlyRate * 2;

  const appliedBonuses = bonuses.reduce((acc, b) => {
    const amount = b.assignments?.[emp.id] || b.assignments?.[String(emp.id)] || 0;
    if (!amount) return acc;
    if (!b.date || !isDateInQuincena(b.date, draftRefDate, periodType)) return acc;
    acc[b.id] = Number(amount);
    return acc;
  }, {});

  return {
    ...emp,
    days,
    extras: {
      simplesQty: simplesQtyTotal,
      doblesQty: doblesQtyTotal,
      simplesVal: valSimples,
      doblesVal: valDobles,
      bonos: totalBonos,
      comisiones: 0,
      otrosIngresos: Number(emp.otro_ingresos) || 0
    },
    appliedBonuses,
    operationLogs: attachedLogs,
    deductions: emp.deductions || {}
  };
}

function getFirstQuincenaPayouts(closedPayrollEmployees) {
  const payouts = {};
  (closedPayrollEmployees || []).forEach((emp) => {
    const payout = emp.netTotal != null
      ? Number(emp.netTotal)
      : (Number(emp.calculated?.netPayable) || Number(emp.calculated?.net) || 0);
    if (payout) payouts[emp.id] = payout;
  });
  return payouts;
}

module.exports = {
  BASE,
  createAssert,
  getTokenForRole,
  login,
  api,
  checkServer,
  isDateInQuincena,
  buildDraftEmployee,
  getFirstQuincenaPayouts
};
