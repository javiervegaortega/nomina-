/**
 * Alinea la nómina 2ª julio Econacional con la lógica de facturación del Excel mayo:
 * - Bono decreto = suma columnas Decreto de "DISTRIBUCION REAL" (hoja ECONACIONAL / REAL)
 * - HE en extras + component_dist.extras por columna de empresa (P/U/H/C)
 * - component_dist.bonuses según Decreto REAL por empresa
 *
 * Uso:
 *   node scripts/align_econacional_julio_to_may_billing.js
 *   node scripts/align_econacional_julio_to_may_billing.js --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Sequelize } = require('sequelize');
const { calculateEmployeePayroll } = require('../src/services/payrollCalculator.service');

const APPLY = process.argv.includes('--apply');
const PAYROLL_ID = 'draft_1784990395552_392';
const EXCEL = path.resolve(__dirname, '../../nominas excel/NOMINA ECONACIONAL 28.5 Segunda Quincena.xlsx');
const OUT_DIR = path.join(__dirname, 'output');

const COMPANY = { P: 1, U: 2, H: 6, C: 4 };

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dialect: 'mysql',
  logging: false
});

function parseNum(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s || s.startsWith('#')) return 0;
  if (/\d,\d{1,2}$/.test(s) && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\d,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/[^0-9.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(s) {
  return new Set(normName(s).split(' ').filter((t) => t.length > 2));
}

function nameScore(a, b) {
  const A = nameTokens(a);
  const B = nameTokens(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / Math.max(A.size, B.size, 1);
}

function employeeFullName(e) {
  return [e.primer_nombre, e.segundo_nombre, e.primer_apellido, e.segundo_apellido]
    .filter(Boolean)
    .join(' ');
}

/** Porcentajes con alta precisión para no perder céntimos al repartir montos. */
function pctMapFromAmounts(amountByCompanyId) {
  const entries = Object.entries(amountByCompanyId)
    .map(([id, amt]) => [Number(id), Number(amt) || 0])
    .filter(([, amt]) => amt > 0);
  const total = entries.reduce((s, [, amt]) => s + amt, 0);
  if (total <= 0) return null;
  const map = {};
  let assigned = 0;
  const roundPct = (n) => Math.round(n * 1e8) / 1e8;
  entries.forEach(([id, amt], idx) => {
    if (idx === entries.length - 1) {
      map[id] = roundPct(100 - assigned);
    } else {
      const p = roundPct((amt / total) * 100);
      map[id] = p;
      assigned = roundPct(assigned + p);
    }
  });
  return map;
}

function loadExcelRealRows() {
  const wb = XLSX.readFile(EXCEL);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.distribucion, {
    header: 1,
    defval: null,
    raw: true
  });
  const list = [];
  for (let i = 7; i < 147; i += 1) {
    const r = rows[i] || [];
    const name = String(r[6] || '').trim();
    if (!name || /total|area/i.test(name)) continue;
    const sal = parseNum(r[9]);
    const bonoDist = parseNum(r[10]);
    if (sal === 0 && bonoDist === 0) continue;

    const dec = {
      [COMPANY.P]: parseNum(r[53]),
      [COMPANY.U]: parseNum(r[62]),
      [COMPANY.H]: parseNum(r[71]),
      [COMPANY.C]: parseNum(r[80])
    };
    const he = {
      [COMPANY.P]: parseNum(r[55]) + parseNum(r[57]),
      [COMPANY.U]: parseNum(r[64]) + parseNum(r[66]),
      [COMPANY.H]: parseNum(r[73]) + parseNum(r[75]),
      [COMPANY.C]: parseNum(r[82]) + parseNum(r[84])
    };
    // También HE crudas de columnas globales (por si REAL qty/valor vienen vacíos)
    const heCols = {
      [COMPANY.P]: parseNum(r[21]) + parseNum(r[23]),
      [COMPANY.U]: parseNum(r[25]) + parseNum(r[27]),
      [COMPANY.H]: parseNum(r[29]) + parseNum(r[31]),
      [COMPANY.C]: parseNum(r[33]) + parseNum(r[35])
    };
    const heUse = Object.values(he).some((v) => v > 0) ? he : heCols;
    const decSumProrated = round2(Object.values(dec).reduce((a, b) => a + b, 0));
    const heTotal = round2(Object.values(heUse).reduce((a, b) => a + b, 0));
    // Col 12 = días laborados del Excel (ya prorratea Ordinario/Decreto REAL).
    let days = parseNum(r[12]) || 30;
    if (days <= 0 || days > 30) days = 30;
    // Las columnas Decreto REAL ya vienen prorrateadas → subir a base “días=30”.
    const bonoFull = decSumProrated > 0
      ? round2(decSumProrated * (30 / days))
      : bonoDist;

    list.push({
      name,
      sal,
      bonoDist,
      bonoReal: bonoFull,
      dec,
      he: heUse,
      heTotal,
      days,
      bonusesPct: pctMapFromAmounts(dec),
      extrasPct: pctMapFromAmounts(heUse)
    });
  }
  return list;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const excelRows = loadExcelRealRows();
  const [rows] = await sequelize.query(
    'SELECT id, title, periodType, status, closedAt, notes, summary, data, createdAt, updatedAt FROM payrollhistories WHERE id = ?',
    { replacements: [PAYROLL_ID] }
  );
  if (!rows[0]) throw new Error(`No existe nómina ${PAYROLL_ID}`);

  let employees = rows[0].data;
  if (typeof employees === 'string') employees = JSON.parse(employees);
  if (typeof employees === 'string') employees = JSON.parse(employees);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(OUT_DIR, `eco_julio_before_may_align_${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(rows[0], null, 2), 'utf8');

  const used = new Set();
  let matched = 0;
  let bonoBefore = 0;
  let bonoAfter = 0;
  let heTotal = 0;
  const unmatched = [];

  const patched = employees.map((emp) => {
    bonoBefore += Number(emp.bon_dec_37_2001) || 0;
    const name = employeeFullName(emp);
    let best = null;
    let bestScore = 0;
    let bestIdx = -1;
    excelRows.forEach((row, idx) => {
      if (used.has(idx)) return;
      const sc = nameScore(name, row.name);
      if (sc > bestScore) {
        bestScore = sc;
        best = row;
        bestIdx = idx;
      }
    });
    if (!best || bestScore < 0.45) {
      unmatched.push(name);
      return emp;
    }
    used.add(bestIdx);
    matched += 1;

    const next = { ...emp };
    next.bon_dec_37_2001 = best.bonoReal;
    next.days = best.days;
    const extras = { ...(emp.extras || {}) };
    extras.simplesQty = best.heTotal > 0 ? (Number(extras.simplesQty) || 0) : 0;
    // Conservar qty si ya venía; valor = HE total mayo
    if (best.heTotal > 0) {
      extras.simplesVal = best.heTotal;
      extras.doblesVal = 0;
      extras.doblesQty = 0;
      if (!extras.simplesQty) extras.simplesQty = 1;
    }
    next.extras = extras;

    const componentDist = {};
    if (best.bonusesPct) componentDist.bonuses = best.bonusesPct;
    if (best.extrasPct) componentDist.extras = best.extrasPct;
    next.component_dist = Object.keys(componentDist).length ? componentDist : null;

    const recomputed = calculateEmployeePayroll(next, rows[0].periodType || '2da');
    bonoAfter += Number(recomputed.bon_dec_37_2001) || 0;
    heTotal += Number(recomputed.extras?.simplesVal) || 0;
    return recomputed;
  });

  const report = {
    payrollId: PAYROLL_ID,
    matched,
    unmatched,
    bonoBefore: round2(bonoBefore),
    bonoAfter: round2(bonoAfter),
    heTotal: round2(heTotal),
    excelBonoReal: round2(excelRows.reduce((s, r) => s + r.bonoReal, 0)),
    excelHe: round2(excelRows.reduce((s, r) => s + r.heTotal, 0))
  };
  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, `eco_julio_may_align_report_${stamp}.json`),
    JSON.stringify(report, null, 2),
    'utf8'
  );
  console.log('Backup:', backupPath);

  if (!APPLY) {
    console.log('Dry-run OK. Usa --apply para escribir.');
    await sequelize.close();
    return;
  }

  await sequelize.query(
    'UPDATE payrollhistories SET data = ?, updatedAt = ? WHERE id = ?',
    {
      replacements: [JSON.stringify(patched), new Date(), PAYROLL_ID]
    }
  );
  console.log('Nómina Econacional julio actualizada.');
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
