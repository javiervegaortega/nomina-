/**
 * Borra las 3 nóminas 2ª julio (Proquima / Unhesa / Econacional),
 * las recrea con horas extra tomadas del Excel de mayo 2026.
 *
 * Uso:
 *   node scripts/recreate_julio_2da_with_may_he.js           # dry-run
 *   node scripts/recreate_julio_2da_with_may_he.js --apply   # escribe BD
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Sequelize } = require('sequelize');
const { calculateEmployeePayroll } = require('../src/services/payrollCalculator.service');

const APPLY = process.argv.includes('--apply');
const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(__dirname, 'output');

const PAYROLL_IDS = [
  'draft_1784990391268_682', // Unhesa
  'draft_1784990393201_775', // Proquima
  'draft_1784990395552_392' // Econacional
];

const EXCEL = {
  unhesaProquima: path.join(ROOT, 'nominas excel', 'NOMINA UNHESA PROQUIMA Segunda Quincena.xlsx'),
  econacional: path.join(ROOT, 'nominas excel', 'NOMINA ECONACIONAL 28.5 Segunda Quincena.xlsx')
};

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

function detectCompanyKey(title) {
  const t = String(title || '').toUpperCase();
  if (t.includes('ECONACIONAL')) return 'econacional';
  if (t.includes('PROQUIMA')) return 'proquima';
  if (t.includes('UNION HERMANOS') || t.includes('UNHESA')) return 'unhesa';
  return null;
}

function loadHeFromNominaSheet(filePath, sheetName) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  if (!wb.Sheets[sheetName]) {
    throw new Error(`Hoja no encontrada: ${sheetName} en ${filePath}`);
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true
  });
  let headerIdx = -1;
  for (let i = 0; i < 12; i += 1) {
    const cells = (rows[i] || []).map((c) => (c == null ? '' : String(c).toLowerCase()));
    if (
      cells.some((c) => c.includes('nombre'))
      && cells.some((c) => c.includes('horas simples') || c.includes('salario ordinario'))
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error(`No header en ${sheetName}`);

  const header = (rows[headerIdx] || []).map((c) => (c == null ? '' : String(c).toLowerCase()));
  const cNom = header.findIndex((c) => c.includes('nombre'));
  const cHS = header.findIndex((c) => c.includes('horas simples') && !c.includes('valor'));
  const cVS = header.findIndex((c) => c.includes('valor') && c.includes('simple'));
  const cHD = header.findIndex((c) => c.includes('horas dobles') && !c.includes('valor'));
  const cVD = header.findIndex((c) => c.includes('valor') && c.includes('doble'));

  const list = [];
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const name = String(row[cNom] || '').trim();
    if (!name || /total|area|presidencia|administrativ|gerencia/i.test(name)) continue;
    const sal = parseNum(row[6]);
    const bono = parseNum(row[7]);
    const hs = parseNum(row[cHS >= 0 ? cHS : 9]);
    const vs = parseNum(row[cVS >= 0 ? cVS : 10]);
    const hd = parseNum(row[cHD >= 0 ? cHD : 11]);
    const vd = parseNum(row[cVD >= 0 ? cVD : 12]);
    if (sal === 0 && bono === 0 && vs === 0 && vd === 0 && hs === 0 && hd === 0) continue;
    list.push({
      name,
      simplesQty: hs,
      simplesVal: round2(vs),
      doblesQty: hd,
      doblesVal: round2(vd)
    });
  }
  return list;
}

function buildHeIndex() {
  return {
    proquima: loadHeFromNominaSheet(EXCEL.unhesaProquima, 'Nomina Proquima'),
    unhesa: loadHeFromNominaSheet(EXCEL.unhesaProquima, 'Nomina Unhesa'),
    econacional: loadHeFromNominaSheet(EXCEL.econacional, 'ECONACIONAL')
  };
}

function matchHe(empName, heList, used) {
  let best = null;
  let bestScore = 0;
  let bestIdx = -1;
  heList.forEach((row, idx) => {
    if (used.has(idx)) return;
    const sc = nameScore(empName, row.name);
    if (sc > bestScore) {
      bestScore = sc;
      best = row;
      bestIdx = idx;
    }
  });
  if (best && bestScore >= 0.45) {
    used.add(bestIdx);
    return { row: best, score: bestScore };
  }
  return null;
}

function applyHeToEmployee(emp, heRow, periodType) {
  const next = { ...emp };
  const extras = { ...(emp.extras || {}) };
  extras.simplesQty = Number(heRow.simplesQty) || 0;
  extras.simplesVal = Number(heRow.simplesVal) || 0;
  extras.doblesQty = Number(heRow.doblesQty) || 0;
  extras.doblesVal = Number(heRow.doblesVal) || 0;
  next.extras = extras;
  // Recalcular snapshot con HE
  const recomputed = calculateEmployeePayroll(next, periodType || '2da');
  return recomputed;
}

function parsePayrollData(raw) {
  let d = raw;
  if (typeof d === 'string') d = JSON.parse(d);
  if (typeof d === 'string') d = JSON.parse(d);
  if (!Array.isArray(d)) throw new Error('Payroll data no es array');
  return d;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const heIndex = buildHeIndex();

  console.log('Modo:', APPLY ? 'APPLY' : 'DRY-RUN');
  console.log('HE cargadas:', {
    proquima: heIndex.proquima.length,
    unhesa: heIndex.unhesa.length,
    econacional: heIndex.econacional.length,
    heProquima: round2(heIndex.proquima.reduce((s, r) => s + r.simplesVal + r.doblesVal, 0)),
    heUnhesa: round2(heIndex.unhesa.reduce((s, r) => s + r.simplesVal + r.doblesVal, 0)),
    heEco: round2(heIndex.econacional.reduce((s, r) => s + r.simplesVal + r.doblesVal, 0))
  });

  const [rows] = await sequelize.query(
    'SELECT id, title, periodType, status, closedAt, notes, summary, data, createdAt, updatedAt FROM payrollhistories WHERE id IN (?)',
    { replacements: [PAYROLL_IDS] }
  );
  if (rows.length !== PAYROLL_IDS.length) {
    throw new Error(`Se esperaban ${PAYROLL_IDS.length} nóminas, hay ${rows.length}`);
  }

  const backupPath = path.join(OUT_DIR, `julio_2da_backup_before_he_${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(rows, null, 2), 'utf8');
  console.log('Backup:', backupPath);

  const report = [];
  const rebuilt = [];

  for (const row of rows) {
    const companyKey = detectCompanyKey(row.title);
    if (!companyKey) throw new Error(`No se detectó empresa en título: ${row.title}`);
    const heList = heIndex[companyKey];
    const employees = parsePayrollData(row.data);
    const used = new Set();
    let matched = 0;
    let withHe = 0;
    let heTotal = 0;
    const unmatched = [];
    const patched = employees.map((emp) => {
      const name = employeeFullName(emp);
      const hit = matchHe(name, heList, used);
      if (!hit) {
        unmatched.push(name);
        return emp;
      }
      matched += 1;
      const heVal = round2((hit.row.simplesVal || 0) + (hit.row.doblesVal || 0));
      if (heVal > 0 || hit.row.simplesQty || hit.row.doblesQty) {
        withHe += 1;
        heTotal += heVal;
        return applyHeToEmployee(emp, hit.row, row.periodType || '2da');
      }
      return emp;
    });

    const entry = {
      id: row.id,
      title: row.title,
      companyKey,
      employees: employees.length,
      matched,
      withHe,
      heTotal: round2(heTotal),
      unmatchedSample: unmatched.slice(0, 8),
      unmatchedCount: unmatched.length
    };
    report.push(entry);
    console.log(entry);

    rebuilt.push({
      id: row.id,
      title: row.title,
      periodType: row.periodType,
      status: 'cerrada',
      closedAt: row.closedAt || new Date().toISOString(),
      notes: row.notes,
      summary: row.summary,
      data: patched,
      createdAt: row.createdAt,
      updatedAt: new Date()
    });
  }

  const reportPath = path.join(OUT_DIR, `julio_2da_he_report_${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Reporte:', reportPath);

  if (!APPLY) {
    console.log('Dry-run OK. Ejecuta con --apply para escribir.');
    await sequelize.close();
    return;
  }

  const t = await sequelize.transaction();
  try {
    // Borrar billing runs ligados
    const [runs] = await sequelize.query(
      'SELECT id FROM billing_runs WHERE payrollId IN (?)',
      { replacements: [PAYROLL_IDS], transaction: t }
    );
    const runIds = runs.map((r) => r.id);
    if (runIds.length) {
      await sequelize.query('DELETE FROM billing_run_lines WHERE runId IN (?)', {
        replacements: [runIds],
        transaction: t
      });
      await sequelize.query('DELETE FROM billing_runs WHERE id IN (?)', {
        replacements: [runIds],
        transaction: t
      });
      console.log('Billing runs eliminados:', runIds.length);
    } else {
      console.log('Sin billing_runs ligados.');
    }

    await sequelize.query('DELETE FROM payrollhistories WHERE id IN (?)', {
      replacements: [PAYROLL_IDS],
      transaction: t
    });

    for (const item of rebuilt) {
      await sequelize.query(
        `INSERT INTO payrollhistories
          (id, title, periodType, status, closedAt, notes, summary, data, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        {
          replacements: [
            item.id,
            item.title,
            item.periodType,
            item.status,
            item.closedAt,
            item.notes,
            typeof item.summary === 'string' ? item.summary : JSON.stringify(item.summary),
            JSON.stringify(item.data),
            item.createdAt,
            item.updatedAt
          ],
          transaction: t
        }
      );
    }

    await t.commit();
    console.log('Recreadas 3 nóminas 2ª julio con HE de mayo.');
  } catch (err) {
    await t.rollback();
    throw err;
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
