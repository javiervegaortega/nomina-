/**
 * Sincroniza el maestro de empleados con los Excel de 2ª quincena Mayo 2026.
 *
 * Uso:
 *   node scripts/sync_employees_from_excel_mayo2026.js           # dry-run
 *   node scripts/sync_employees_from_excel_mayo2026.js --apply    # escribe BD
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { sequelize, Employee, Company } = require('../src/models');

const APPLY = process.argv.includes('--apply');
const BAJA_DATE = '2026-05-31';
const BAJA_MOTIVO = 'No aparece en nómina Excel Mayo 2026 2da';

const ROOT = path.resolve(__dirname, '..', '..');
const EXCEL_FILES = [
  path.join(ROOT, 'nominas excel', 'NOMINA UNHESA PROQUIMA Segunda Quincena.xlsx'),
  path.join(ROOT, 'nominas excel', 'NOMINA ECONACIONAL 28.5 Segunda Quincena.xlsx'),
];
const OUTPUT_DIR = path.join(__dirname, 'output');

const COMPANY_ALIASES = {
  proquima: 1,
  'proquima,s.a.': 1,
  'proquima, s.a.': 1,
  unhesa: 2,
  'union hermanos': 2,
  'union hermanos,s.a.': 2,
  'unión hermanos,s.a.': 2,
  econacional: 3,
  'econacional,s.a.': 3,
  'econacional, s.a.': 3,
  cleartec: 4,
  'cleartec, s. a.': 4,
  calidul: 5,
  hidroxon: 6,
};

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

/** Variantes ortográficas frecuentes en nómina GT */
const TOKEN_ALIASES = {
  gonzales: 'gonzalez',
  jimenez: 'jimenez',
  ximenez: 'jimenez',
  vasquez: 'vasquez',
  vazquez: 'vasquez',
  mendez: 'mendez',
  menendez: 'menendez',
  hernandes: 'hernandez',
  rodriges: 'rodriguez',
  rodrigues: 'rodriguez',
  ambrocio: 'ambrosio',
  ambrosio: 'ambrosio',
};

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeToken(t) {
  const base = stripAccents(String(t || '').trim().toLowerCase());
  return TOKEN_ALIASES[base] || base;
}

function normalizeName(raw) {
  // Separar nombres pegados tipo "ClaudiaMaria"
  let s = String(raw || '').trim().replace(/([a-zà-ÿ])([A-ZÁ-Ý])/g, '$1 $2');
  s = stripAccents(s).toLowerCase();
  s = s.replace(/\d+$/g, ''); // Estrada...Gerardo1 → Gerardo
  s = s.replace(/[^a-z\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function nameTokens(raw) {
  return normalizeName(raw)
    .split(' ')
    .filter((t) => t && !PARTICLES.has(t))
    .map(normalizeToken);
}

function tokenKey(tokens) {
  return [...tokens].sort().join('|');
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  let s = String(val).trim();
  if (!s || s === '#N/A' || s === '#REF!' || s === '#VALUE!') return null;
  // 1.234,56 → 1234.56 ; also plain 1234.56
  if (/\d,\d{1,2}$/.test(s) && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\d,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  } else {
    s = s.replace(/[^0-9.-]+/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pctToHundred(val) {
  const n = parseNumber(val);
  if (n === null) return 0;
  // Excel usa fracciones 0-1; BD usa 0-100
  if (Math.abs(n) <= 1.0001) return Math.round(n * 10000) / 100;
  return Math.round(n * 100) / 100;
}

function resolveCompanyId(raw, companies) {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = stripAccents(String(raw).trim().toLowerCase()).replace(/\s+/g, ' ');
  if (COMPANY_ALIASES[s] != null) return COMPANY_ALIASES[s];
  for (const [alias, id] of Object.entries(COMPANY_ALIASES)) {
    if (s.includes(alias) || alias.includes(s)) return id;
  }
  const found = companies.find((c) => {
    const nc = stripAccents((c.nombre_comercial || '').toLowerCase());
    const rs = stripAccents((c.razon_social || '').toLowerCase());
    return nc.includes(s) || s.includes(nc.split(',')[0]) || rs.includes(s);
  });
  return found ? found.id : null;
}

function splitNameParts(rawName) {
  const tokens = String(rawName || '')
    .trim()
    .replace(/([a-zà-ÿ])([A-ZÁ-Ý])/g, '$1 $2')
    .replace(/\d+$/g, '')
    .split(/\s+/)
    .filter(Boolean);

  // Repegar partículas: "de Lemus" → "de Lemus" como un apellido compuesto al token anterior
  const merged = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (PARTICLES.has(stripAccents(t).toLowerCase()) && merged.length) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${t}`;
      continue;
    }
    if (
      i > 0
      && PARTICLES.has(stripAccents(tokens[i - 1] || '').toLowerCase())
    ) {
      // already handled
    }
    merged.push(t);
  }

  // Formato típico del Excel: Apellido(s) + Nombre(s)
  let primer_apellido = '';
  let segundo_apellido = '';
  let primer_nombre = '';
  let segundo_nombre = '';
  let otro_nombre = '';

  if (merged.length >= 4) {
    primer_apellido = merged[0];
    segundo_apellido = merged[1];
    primer_nombre = merged[2];
    segundo_nombre = merged[3];
    otro_nombre = merged.slice(4).join(' ');
  } else if (merged.length === 3) {
    primer_apellido = merged[0];
    segundo_apellido = merged[1];
    primer_nombre = merged[2];
  } else if (merged.length === 2) {
    primer_apellido = merged[0];
    primer_nombre = merged[1];
  } else if (merged.length === 1) {
    primer_nombre = merged[0];
  }

  return {
    primer_nombre,
    segundo_nombre,
    otro_nombre,
    primer_apellido,
    segundo_apellido,
  };
}

function fullNameFromDb(e) {
  return [e.primer_nombre, e.segundo_nombre, e.otro_nombre, e.primer_apellido, e.segundo_apellido]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSectionName(name) {
  const n = normalizeName(name);
  if (!n) return true;
  if (n.includes('total')) return true;
  const blocked = new Set([
    'area administrativa',
    'presidencia',
    'administrativo',
    'gerencia general',
    'asesoria',
    'operaciones',
    'produccion',
    'ventas',
    'mercadeo',
  ]);
  return blocked.has(n);
}

function findHeaderRow(rows, maxScan = 25) {
  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    const row = rows[i] || [];
    const cells = row.map((c) => (c == null ? '' : String(c).trim().toLowerCase()));
    const hasNombre = cells.some((c) => c === 'nombre' || c.startsWith('nombre'));
    const hasPuesto = cells.some((c) => c.includes('puesto'));
    const hasSalario = cells.some((c) => c.includes('salario ordinario'));
    if (hasNombre && hasPuesto && hasSalario) {
      return { index: i, header: cells };
    }
  }
  return null;
}

function colIndex(header, predicates) {
  for (let i = 0; i < header.length; i++) {
    const h = header[i] || '';
    for (const pred of predicates) {
      if (typeof pred === 'string') {
        if (h === pred || h.includes(pred)) return i;
      } else if (pred(h)) return i;
    }
  }
  return -1;
}

function buildDist(row, cols) {
  const dist = {};
  const mapping = [
    [cols.pctProquima, 1],
    [cols.pctUnhesa, 2],
    [cols.pctEconacional, 3],
    [cols.pctCleartec, 4],
    [cols.pctCalidul, 5],
    [cols.pctHidroxon, 6],
  ];
  for (const [idx, companyId] of mapping) {
    if (idx < 0) continue;
    const pct = pctToHundred(row[idx]);
    if (pct > 0) dist[String(companyId)] = pct;
  }
  // Si no hay %, 100% a empresa principal
  return dist;
}

function parseDistribucionSheet(filePath, companies) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  if (!wb.SheetNames.includes('distribucion')) {
    console.warn(`Sin hoja distribucion: ${filePath}`);
    return [];
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.distribucion, {
    header: 1,
    defval: null,
    raw: true,
  });
  const found = findHeaderRow(rows);
  if (!found) {
    console.warn(`No se encontró header en distribucion: ${filePath}`);
    return [];
  }
  const { index, header } = found;
  const cols = {
    nombre: colIndex(header, ['nombre']),
    puesto: colIndex(header, ['puesto']),
    empresa: colIndex(header, ['empresa real', 'empresa']),
    salario: colIndex(header, ['salario ordinario']),
    bono: colIndex(header, [(h) => h.includes('bono decreto') || h.includes('bonificacion incentivo') || h === 'bono decreto']),
    dias: colIndex(header, ['días laborados', 'dias laborados']),
    pctProquima: colIndex(header, [(h) => h.includes('% proquima') || h === 'proquima']),
    pctUnhesa: colIndex(header, [(h) => (h.includes('% unhesa') && !h.includes('liq')) || h === '% unhesa']),
    pctHidroxon: colIndex(header, [(h) => h.includes('hidroxon')]),
    pctEconacional: colIndex(header, [(h) => h.includes('% econacional') || h.includes('econacional')]),
    pctCleartec: colIndex(header, [(h) => h.includes('cleartec')]),
    pctCalidul: colIndex(header, [(h) => h.includes('calidul')]),
    pctEcomezclas: colIndex(header, [(h) => h.includes('ecomezclas')]),
  };

  // Preferir el primer bloque de % (cols cercanas a salario), no el de "DISTRIBUCION REAL" del final
  // Si hay varias columnas "% proquima", colIndex toma la primera — correcto para fila 6 del Unhesa file.
  const out = [];
  const source = path.basename(filePath);

  for (let i = index + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const rawName = cols.nombre >= 0 ? row[cols.nombre] : null;
    if (rawName == null || String(rawName).trim() === '') continue;
    const nombre = String(rawName).trim();
    if (isSectionName(nombre)) continue;

    const salario = parseNumber(row[cols.salario]);
    const bono = parseNumber(row[cols.bono]);
    if ((salario == null || salario === 0) && (bono == null || bono === 0)) continue;
    // Filas de sección a veces tienen basura numérica; exigir puesto o empresa
    const puesto = cols.puesto >= 0 && row[cols.puesto] != null
      ? String(row[cols.puesto]).trim()
      : '';
    const empresaRaw = cols.empresa >= 0 && row[cols.empresa] != null
      ? String(row[cols.empresa]).trim()
      : '';
    if (!puesto && !empresaRaw) continue;

    const companyId = resolveCompanyId(empresaRaw, companies);
    const tokens = nameTokens(nombre);
    if (tokens.length < 2) continue;

    let dist = buildDist(row, cols);
    if (Object.keys(dist).length === 0 && companyId) {
      dist = { [String(companyId)]: 100 };
    }

    out.push({
      nombre,
      tokens,
      tokenKey: tokenKey(tokens),
      puesto,
      empresaRaw,
      companyId,
      sueldo_ordinario: Math.round((salario || 0) * 100) / 100,
      bon_dec_37_2001: Math.round((bono || 0) * 100) / 100,
      dias: parseNumber(row[cols.dias]),
      dist,
      source,
      rowIndex: i + 1,
      nameParts: splitNameParts(nombre),
    });
  }
  return out;
}

function excelKey(emp) {
  return `${emp.tokenKey}::${emp.companyId || 'x'}`;
}

function dedupeExcel(employees) {
  const map = new Map();
  for (const e of employees) {
    const key = excelKey(e);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, e);
      continue;
    }
    // Preferir fila con más info de dist o sueldo mayor coherente
    const prevDist = Object.keys(prev.dist || {}).length;
    const nextDist = Object.keys(e.dist || {}).length;
    if (nextDist > prevDist || (e.sueldo_ordinario || 0) >= (prev.sueldo_ordinario || 0)) {
      map.set(key, e);
    }
  }
  return [...map.values()];
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function preferActiveThenSalary(candidates, excelEmp) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const active = candidates.filter((d) => String(d.estado || '') === 'Activo');
  const pool = active.length ? active : candidates;
  if (pool.length === 1) return pool[0];
  // Más cercano en sueldo+bono
  const scored = pool.map((d) => {
    const ds = Math.abs(round2(d.sueldo_ordinario) - round2(excelEmp.sueldo_ordinario))
      + Math.abs(round2(d.bon_dec_37_2001) - round2(excelEmp.bon_dec_37_2001));
    return { d, ds };
  }).sort((a, b) => a.ds - b.ds);
  if (scored[0].ds < scored[1].ds) return scored[0].d;
  return null; // empate real → ambiguo
}

function findDbMatches(excelEmp, dbEmployees) {
  const exact = [];
  const fuzzy = [];

  for (const db of dbEmployees) {
    const dbTokens = nameTokens(db._fullName);
    if (!dbTokens.length) continue;
    if (tokenKey(dbTokens) === excelEmp.tokenKey) {
      exact.push(db);
      continue;
    }
    const score = jaccard(excelEmp.tokens, dbTokens);
    const inter = excelEmp.tokens.filter((t) => dbTokens.includes(t)).length;
    if (score >= 0.8 || (inter >= 3 && score >= 0.55)) {
      fuzzy.push({ db, score, inter });
    }
  }

  if (exact.length) {
    const byCompany = exact.filter(
      (d) => excelEmp.companyId && Number(d.empresa_principal) === Number(excelEmp.companyId)
    );
    if (byCompany.length) {
      const picked = preferActiveThenSalary(byCompany, excelEmp);
      if (picked) return { match: picked, reason: 'exact+empresa' };
      return { ambiguous: byCompany, reason: 'exact+empresa multiple' };
    }
    const picked = preferActiveThenSalary(exact, excelEmp);
    if (picked) return { match: picked, reason: 'exact' };
    return { ambiguous: exact, reason: 'exact multiple sin empresa' };
  }

  fuzzy.sort((a, b) => b.score - a.score || b.inter - a.inter);
  if (fuzzy.length) {
    const byCompany = fuzzy.filter(
      (f) => excelEmp.companyId && Number(f.db.empresa_principal) === Number(excelEmp.companyId)
    );
    const pool = byCompany.length ? byCompany : fuzzy;
    if (pool.length === 1 || (pool[0].score - (pool[1]?.score || 0) >= 0.15)) {
      return { match: pool[0].db, reason: byCompany.length ? 'fuzzy+empresa' : 'fuzzy' };
    }
    const picked = preferActiveThenSalary(pool.map((p) => p.db), excelEmp);
    if (picked) return { match: picked, reason: 'fuzzy+prefer' };
    return { ambiguous: pool.map((p) => p.db), reason: 'fuzzy ambiguous' };
  }

  // Soft match: mismo sueldo (+empresa) y overlap parcial de nombre.
  // Cubre apellido de casada y pequeñas diferencias de bono en ficha vieja.
  const soft = [];
  for (const db of dbEmployees) {
    if (round2(db.sueldo_ordinario) !== round2(excelEmp.sueldo_ordinario)) continue;
    if (
      excelEmp.companyId
      && db.empresa_principal != null
      && Number(db.empresa_principal) !== Number(excelEmp.companyId)
    ) continue;
    const dbTokens = nameTokens(db._fullName);
    const inter = excelEmp.tokens.filter((t) => dbTokens.includes(t)).length;
    const score = jaccard(excelEmp.tokens, dbTokens);
    const bonoClose = Math.abs(round2(db.bon_dec_37_2001) - round2(excelEmp.bon_dec_37_2001)) <= 0.02
      || inter >= 3;
    if (inter >= 2 && score >= 0.4 && bonoClose) {
      soft.push({ db, score, inter });
    }
  }
  soft.sort((a, b) => b.score - a.score || b.inter - a.inter);
  if (soft.length === 1) {
    return { match: soft[0].db, reason: 'soft-salary+name' };
  }
  if (soft.length > 1) {
    const picked = preferActiveThenSalary(soft.map((s) => s.db), excelEmp);
    if (picked) return { match: picked, reason: 'soft-salary+name' };
    return { ambiguous: soft.map((s) => s.db), reason: 'soft ambiguous' };
  }

  return { match: null, reason: 'none' };
}

function distEqual(a, b) {
  const aa = a && typeof a === 'object' ? a : {};
  const bb = b && typeof b === 'object' ? b : {};
  const keys = new Set([...Object.keys(aa), ...Object.keys(bb)]);
  for (const k of keys) {
    if (round2(aa[k] || 0) !== round2(bb[k] || 0)) return false;
  }
  return true;
}

function buildUpdatePayload(excelEmp, dbEmp) {
  const payload = {
    estado: 'Activo',
    puesto: excelEmp.puesto || dbEmp.puesto,
    sueldo_ordinario: excelEmp.sueldo_ordinario,
    bon_dec_37_2001: excelEmp.bon_dec_37_2001,
    dist: excelEmp.dist,
    fecha_baja: null,
    motivo_baja: null,
  };
  if (excelEmp.companyId) {
    payload.empresa_principal = excelEmp.companyId;
  }

  const changes = [];
  if (String(dbEmp.estado || '') !== 'Activo') changes.push(`estado:${dbEmp.estado}->Activo`);
  if (round2(dbEmp.sueldo_ordinario) !== round2(excelEmp.sueldo_ordinario)) {
    changes.push(`sueldo:${dbEmp.sueldo_ordinario}->${excelEmp.sueldo_ordinario}`);
  }
  if (round2(dbEmp.bon_dec_37_2001) !== round2(excelEmp.bon_dec_37_2001)) {
    changes.push(`bono:${dbEmp.bon_dec_37_2001}->${excelEmp.bon_dec_37_2001}`);
  }
  if ((excelEmp.puesto || '') && String(dbEmp.puesto || '').trim() !== excelEmp.puesto.trim()) {
    changes.push(`puesto:${dbEmp.puesto}->${excelEmp.puesto}`);
  }
  if (excelEmp.companyId && Number(dbEmp.empresa_principal) !== Number(excelEmp.companyId)) {
    changes.push(`empresa:${dbEmp.empresa_principal}->${excelEmp.companyId}`);
  }
  if (!distEqual(dbEmp.dist, excelEmp.dist)) {
    changes.push('dist');
  }

  return { payload, changes, needsUpdate: changes.length > 0 };
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  await sequelize.authenticate();
  const companies = await Company.findAll({ raw: true });
  console.log(`Empresas BD: ${companies.length}`);
  console.log(`Modo: ${APPLY ? 'APPLY (escribe BD)' : 'DRY-RUN (sin cambios)'}`);

  let excelAll = [];
  for (const file of EXCEL_FILES) {
    if (!fs.existsSync(file)) {
      throw new Error(`No se encuentra Excel: ${file}`);
    }
    const parsed = parseDistribucionSheet(file, companies);
    console.log(`  ${path.basename(file)}: ${parsed.length} filas con salario`);
    excelAll = excelAll.concat(parsed);
  }
  const excelEmployees = dedupeExcel(excelAll);
  console.log(`Excel únicos (nombre+empresa): ${excelEmployees.length}`);

  const dbRows = await Employee.findAll({ raw: true });
  const dbEmployees = dbRows.map((e) => ({
    ...e,
    _fullName: fullNameFromDb(e),
  }));
  const activeDb = dbEmployees.filter((e) => String(e.estado || '') === 'Activo');
  console.log(`BD total=${dbEmployees.length} activos=${activeDb.length}`);

  const toUpdate = [];
  const toCreate = [];
  const ambiguous = [];
  const matchedDbIds = new Set();

  for (const excelEmp of excelEmployees) {
    const result = findDbMatches(excelEmp, dbEmployees);
    if (result.ambiguous) {
      ambiguous.push({
        excel: excelEmp,
        candidates: result.ambiguous.map((d) => ({
          id: d.id,
          nombre: d._fullName,
          empresa: d.empresa_principal,
          estado: d.estado,
        })),
        reason: result.reason,
      });
      continue;
    }
    if (!result.match) {
      toCreate.push(excelEmp);
      continue;
    }
    if (matchedDbIds.has(result.match.id)) {
      // Un mismo DB ya matcheó otra fila Excel → crear o marcar ambiguo
      ambiguous.push({
        excel: excelEmp,
        candidates: [{
          id: result.match.id,
          nombre: result.match._fullName,
          empresa: result.match.empresa_principal,
          estado: result.match.estado,
          note: 'ya_asignado_a_otro_excel',
        }],
        reason: 'db already matched',
      });
      continue;
    }
    matchedDbIds.add(result.match.id);
    const { payload, changes, needsUpdate } = buildUpdatePayload(excelEmp, result.match);
    toUpdate.push({
      dbId: result.match.id,
      dbName: result.match._fullName,
      excelName: excelEmp.nombre,
      reason: result.reason,
      changes,
      needsUpdate,
      payload,
      excel: excelEmp,
    });
  }

  const toBaja = activeDb.filter((d) => !matchedDbIds.has(d.id));

  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    sourceFiles: EXCEL_FILES.map((f) => path.basename(f)),
    summary: {
      excelUnique: excelEmployees.length,
      dbTotal: dbEmployees.length,
      dbActiveBefore: activeDb.length,
      update: toUpdate.filter((u) => u.needsUpdate).length,
      unchanged: toUpdate.filter((u) => !u.needsUpdate).length,
      create: toCreate.length,
      baja: toBaja.length,
      ambiguous: ambiguous.length,
    },
    updates: toUpdate,
    creates: toCreate,
    bajas: toBaja.map((d) => ({
      id: d.id,
      nombre: d._fullName,
      empresa: d.empresa_principal,
      sueldo: d.sueldo_ordinario,
      bono: d.bon_dec_37_2001,
    })),
    ambiguous,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(OUTPUT_DIR, `sync_mayo2026_${APPLY ? 'apply' : 'dryrun'}_${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n=== RESUMEN ===');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nReporte: ${reportPath}`);

  if (toUpdate.filter((u) => u.needsUpdate).length) {
    console.log('\nEjemplos UPDATE:');
    toUpdate.filter((u) => u.needsUpdate).slice(0, 8).forEach((u) => {
      console.log(`  #${u.dbId} ${u.dbName} <= ${u.excelName}: ${u.changes.join(', ')}`);
    });
  }
  if (toCreate.length) {
    console.log('\nEjemplos CREATE:');
    toCreate.slice(0, 8).forEach((e) => {
      console.log(`  ${e.nombre} | ${e.empresaRaw} | ${e.sueldo_ordinario}/${e.bon_dec_37_2001}`);
    });
  }
  if (toBaja.length) {
    console.log('\nEjemplos BAJA:');
    toBaja.slice(0, 8).forEach((d) => {
      console.log(`  #${d.id} ${d._fullName}`);
    });
  }
  if (ambiguous.length) {
    console.log('\nAmbiguos (NO se modifican):');
    ambiguous.slice(0, 8).forEach((a) => {
      console.log(`  ${a.excel.nombre} (${a.excel.empresaRaw}) — ${a.reason}`);
    });
  }

  if (!APPLY) {
    console.log('\nDry-run listo. Ejecuta con --apply para escribir en la BD.');
    await sequelize.close();
    return;
  }

  // Backup rápido de employee
  const backupPath = path.join(OUTPUT_DIR, `employee_backup_${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(dbRows, null, 2), 'utf8');
  console.log(`\nBackup employee: ${backupPath}`);

  const t = await sequelize.transaction();
  try {
    let updated = 0;
    let created = 0;
    let bajados = 0;

    for (const u of toUpdate) {
      if (!u.needsUpdate) continue;
      await Employee.update(u.payload, { where: { id: u.dbId }, transaction: t });
      updated += 1;
    }

    for (const e of toCreate) {
      const parts = e.nameParts;
      await Employee.create({
        ...parts,
        estado: 'Activo',
        puesto: e.puesto || null,
        empresa_principal: e.companyId || null,
        sueldo_ordinario: e.sueldo_ordinario,
        bon_dec_37_2001: e.bon_dec_37_2001,
        bon_incentivo: 0,
        dist: e.dist,
        moneda: 'GTQ',
        rol_permisos: 'empleado',
      }, { transaction: t });
      created += 1;
    }

    for (const d of toBaja) {
      await Employee.update({
        estado: 'De Baja',
        fecha_baja: BAJA_DATE,
        motivo_baja: BAJA_MOTIVO,
      }, { where: { id: d.id }, transaction: t });
      bajados += 1;
    }

    await t.commit();
    console.log(`\nAplicado: updated=${updated} created=${created} baja=${bajados}`);

    const [counts] = await sequelize.query(
      "SELECT COUNT(id) AS total, SUM(CASE WHEN estado='Activo' THEN 1 ELSE 0 END) AS activos FROM employee"
    );
    console.log('Conteos post-sync:', counts[0]);
  } catch (err) {
    await t.rollback();
    console.error('Error aplicando cambios, rollback hecho:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main().catch(async (err) => {
  console.error(err);
  try { await sequelize.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
