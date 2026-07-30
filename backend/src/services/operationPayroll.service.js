const { PayrollDraft, Company } = require('../models');
const { isDateInQuincena } = require('./payrollCalculator.service');

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const inferPeriodTypeFromDate = (dateStr) => {
  if (!dateStr) return '1ra';
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length < 3) return '1ra';
  const day = Number(parts[2]);
  return day <= 15 ? '1ra' : '2da';
};

const formatQuincenaLabel = (dateStr) => {
  if (!dateStr) return '';
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length < 3) return '';
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const period = inferPeriodTypeFromDate(dateStr);
  const monthName = MONTH_NAMES_ES[month] || '';
  return `${period} · ${monthName} ${year}`;
};

const normalizeCompaniesList = (draftCompanies) => {
  if (Array.isArray(draftCompanies)) return draftCompanies;
  if (typeof draftCompanies === 'string') {
    try {
      const parsed = JSON.parse(draftCompanies);
      return Array.isArray(parsed) ? parsed : (parsed != null ? [parsed] : []);
    } catch {
      return draftCompanies.trim() ? [draftCompanies] : [];
    }
  }
  if (draftCompanies != null && typeof draftCompanies === 'object') {
    return Object.values(draftCompanies);
  }
  return [];
};

const draftMatchesCompany = (draftCompanies, companyId, companies) => {
  if (!companyId) return false;
  const list = normalizeCompaniesList(draftCompanies);
  if (list.length === 0) return false;
  return list.some((c) => {
    const strC = String(c);
    if (strC === String(companyId)) return true;
    const comp = (companies || []).find(
      (x) => x.nombre_comercial === strC || x.nit === strC || String(x.id) === strC
    );
    return comp && String(comp.id) === String(companyId);
  });
};

/**
 * Verifica que exista un payroll draft abierto para la empresa + quincena de la fecha.
 * @returns {{ ok: true, draft } | { ok: false, error: string }}
 */
const findMatchingActiveDraft = async (date, companyId) => {
  if (!date) {
    return { ok: false, error: 'La fecha del registro es requerida.' };
  }
  if (!companyId) {
    return { ok: false, error: 'La empresa del registro es requerida.' };
  }

  const [drafts, companies] = await Promise.all([
    PayrollDraft.findAll(),
    Company.findAll({ attributes: ['id', 'nombre_comercial', 'nit'] }),
  ]);

  const company = companies.find((c) => String(c.id) === String(companyId));
  const companyName = company?.nombre_comercial || `empresa #${companyId}`;
  const quincenaLabel = formatQuincenaLabel(date);

  const matchingDrafts = drafts.filter((draft) => {
    const draftRefDate = draft.createdAt || new Date().toISOString();
    const periodType = draft.periodType || '1ra';
    if (!isDateInQuincena(date, draftRefDate, periodType)) return false;
    return draftMatchesCompany(draft.companies, companyId, companies);
  });
  const match = matchingDrafts.find((draft) => !draft.isApproved);

  if (!match) {
    if (matchingDrafts.some((draft) => draft.isApproved)) {
      return {
        ok: false,
        error: `La nómina de ${companyName} para ${quincenaLabel || 'esa quincena'} ya fue aprobada por Auditoría y no admite más bonos ni horas extras.`,
      };
    }
    return {
      ok: false,
      error: `No hay nómina activa para ${companyName} en ${quincenaLabel || 'esa quincena'}.`,
    };
  }

  return { ok: true, draft: match };
};

const assertActivePayrollForLog = async (date, companyId) => {
  const result = await findMatchingActiveDraft(date, companyId);
  if (!result.ok) {
    const err = new Error(result.error);
    err.statusCode = 400;
    throw err;
  }
  return result.draft;
};

/** Bonos operativos solo en 2ª quincena (día 16–fin de mes). */
const assertBonusDateInSecondQuincena = (dateStr) => {
  if (!dateStr) {
    const err = new Error('La fecha del bono es requerida.');
    err.statusCode = 400;
    throw err;
  }
  const parts = String(dateStr).slice(0, 10).split('-');
  const day = Number(parts[2]);
  if (!Number.isFinite(day) || day <= 15) {
    const err = new Error(
      'Los bonos operativos solo se registran en la 2ª quincena (días 16 al fin de mes).'
    );
    err.statusCode = 400;
    throw err;
  }
};

const getMonthBoundsFromDate = (dateStr) => {
  const parts = String(dateStr || '').slice(0, 10).split('-');
  if (parts.length < 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return null;
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    year,
    month
  };
};

module.exports = {
  inferPeriodTypeFromDate,
  formatQuincenaLabel,
  findMatchingActiveDraft,
  assertActivePayrollForLog,
  assertBonusDateInSecondQuincena,
  getMonthBoundsFromDate,
  draftMatchesCompany,
  normalizeCompaniesList,
};
