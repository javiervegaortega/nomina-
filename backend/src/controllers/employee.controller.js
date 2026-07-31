const { Op } = require('sequelize');
const Decimal = require('decimal.js');
const {
  Employee,
  EmployeeRecord,
  EmployeeIncidence,
  Department,
  sequelize
} = require('../models');
const { calculateMonthlyISR } = require('../services/isr.service');
const { getPagination, toPagedResponse, wantsPagination } = require('../utils/pagination');

const CUOTA_LABORAL = 0.0483;
const CUOTA_LABORAL_JUBILADO = 0.03;
const CUOTA_PATRONAL = 0.1067;
const IRTRA_RATE = 0.01;
const INTECAP_RATE = 0.01;

/**
 * Sincroniza IGSS automático desde sueldo / jubilación.
 * ISR: se respeta el valor manual si viene en el payload (retención definida por
 * contabilidad, como en el Excel); la fórmula 5%-7% solo se usa si no se envía.
 */
const applyAutoPayrollFields = (body) => {
  if (!body || typeof body !== 'object') return body;
  const next = { ...body };
  const hasSueldo = next.sueldo_ordinario !== undefined && next.sueldo_ordinario !== null;
  const hasBono = next.bon_dec_37_2001 !== undefined && next.bon_dec_37_2001 !== null;
  const hasJub = next.jubilacion !== undefined && next.jubilacion !== null;
  const hasExempt = next.igss_exempt !== undefined && next.igss_exempt !== null;
  if (!hasSueldo && !hasBono && !hasJub && !hasExempt) return next;

  const base = Number(next.sueldo_ordinario) || 0;
  const bonus = Number(next.bon_dec_37_2001) || 0;
  const jubilado = !!(next.jubilacion === true || next.jubilacion === 1);
  const igssExempt = !!(next.igss_exempt === true || next.igss_exempt === 1);
  const laboralRate = igssExempt
    ? 0
    : (jubilado ? CUOTA_LABORAL_JUBILADO : CUOTA_LABORAL);

  const hasManualIsr = next.isr !== undefined && next.isr !== null && next.isr !== '';
  next.isr = hasManualIsr
    ? (Number(next.isr) || 0)
    : calculateMonthlyISR(base, bonus, laboralRate);
  next.igss_laboral = Number((base * laboralRate).toFixed(2));
  // Jubilados conservan 10.67% patronal; solo la exención explícita la elimina.
  next.igss_patronal = igssExempt ? 0 : Number((base * CUOTA_PATRONAL).toFixed(2));
  next.irtra = igssExempt ? 0 : Number((base * IRTRA_RATE).toFixed(2));
  next.intecap = igssExempt ? 0 : Number((base * INTECAP_RATE).toFixed(2));
  return next;
};

const validateDist = (dist) => {
  if (dist === undefined || dist === null) return null;

  let distObj = dist;
  if (typeof dist === 'string') {
    try { distObj = JSON.parse(dist); } catch { return 'Distribución intercompañía inválida (JSON mal formado).'; }
  }
  if (typeof distObj !== 'object' || Array.isArray(distObj)) {
    return 'Distribución intercompañía inválida.';
  }

  const keys = Object.keys(distObj);
  if (keys.length === 0) return null;

  const invalidCompany = keys.some((k) => !Number.isInteger(Number(k)) || Number(k) <= 0);
  const values = keys.map((k) => Number(distObj[k]));
  const invalidPercentage = values.some((v) => !Number.isFinite(v) || v < 0 || v > 100);
  if (invalidCompany || invalidPercentage) {
    return 'La distribución intercompañía solo acepta empresas válidas y porcentajes entre 0% y 100%.';
  }

  const allZero = values.every((v) => v === 0);
  if (allZero) return null;

  const sum = values.reduce((total, value) => total.plus(value), new Decimal(0));
  if (!sum.equals(100)) {
    return `La distribución intercompañía debe sumar exactamente 100% (actual: ${sum.toString()}%). Deje todos en 0 para asignar 100% a la empresa principal.`;
  }
  return null;
};

const parseJsonObject = (value) => {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : null;
};

const normalizeAndValidateComponentDist = (componentDist) => {
  if (componentDist === undefined || componentDist === null || componentDist === '') {
    return { value: {}, error: null };
  }

  const parsed = parseJsonObject(componentDist);
  if (parsed === null) {
    return {
      value: null,
      error: 'Distribución por componente inválida (JSON mal formado).'
    };
  }

  const allowedComponents = new Set(['bonuses', 'extras']);
  const unexpected = Object.keys(parsed).filter((key) => !allowedComponents.has(key));
  if (unexpected.length > 0) {
    return {
      value: null,
      error: `Distribución por componente inválida: solo acepta "bonuses" y "extras" (recibido: ${unexpected.join(', ')}).`
    };
  }

  const normalized = {};
  for (const component of allowedComponents) {
    if (parsed[component] === undefined || parsed[component] === null || parsed[component] === '') {
      continue;
    }

    const override = parseJsonObject(parsed[component]);
    if (override === null) {
      return {
        value: null,
        error: `La distribución de ${component === 'bonuses' ? 'bonos' : 'extras'} debe ser un objeto por empresa.`
      };
    }

    const error = validateDist(override);
    if (error) {
      return {
        value: null,
        error: error
          .replace('distribución intercompañía', `distribución de ${component === 'bonuses' ? 'bonos' : 'extras'}`)
          .replace('Distribución intercompañía', `Distribución de ${component === 'bonuses' ? 'bonos' : 'extras'}`)
      };
    }
    const values = Object.values(override).map((value) => Number(value));
    const hasOverride = values.some((value) => value !== 0);
    const exactTotal = values.reduce(
      (sum, value) => sum.plus(Number.isFinite(value) ? value : 0),
      new Decimal(0)
    );
    if (hasOverride && !exactTotal.equals(100)) {
      return {
        value: null,
        error: `La distribución de ${component === 'bonuses' ? 'bonos' : 'extras'} debe sumar exactamente 100% (actual: ${exactTotal.toString()}%).`
      };
    }
    normalized[component] = override;
  }

  return { value: normalized, error: null };
};

const getEmployees = async (req, res) => {
  try {
    const listView = req.query.view === 'list';
    const paged = listView || wantsPagination(req.query);
    if (paged) {
      const { page, pageSize, limit, offset } = getPagination(req.query);
      const where = {};
      if (req.query.status) where.estado = req.query.status;
      if (req.query.companyId) where.empresa_principal = req.query.companyId;
      if (req.query.departmentId) where.departmentId = req.query.departmentId;
      if (req.query.areaId) where.areaId = req.query.areaId;
      if (req.query.divisionId) where.divisionId = req.query.divisionId;
      if (req.query.subdivisionId) where.subdivisionId = req.query.subdivisionId;
      const q = String(req.query.q || '').trim();
      if (q) {
        const like = `%${q}%`;
        where[Op.or] = [
          sequelize.where(
            sequelize.fn(
              'CONCAT_WS',
              ' ',
              sequelize.col('Employee.primer_nombre'),
              sequelize.col('Employee.segundo_nombre'),
              sequelize.col('Employee.otro_nombre'),
              sequelize.col('Employee.primer_apellido'),
              sequelize.col('Employee.segundo_apellido')
            ),
            { [Op.like]: like }
          ),
          { primer_nombre: { [Op.like]: like } },
          { segundo_nombre: { [Op.like]: like } },
          { primer_apellido: { [Op.like]: like } },
          { segundo_apellido: { [Op.like]: like } },
          { puesto: { [Op.like]: like } },
          { dpi: { [Op.like]: like } },
          { no_igss: { [Op.like]: like } },
          { nit: { [Op.like]: like } }
        ];
      }
      const listAttributes = [
        'id', 'empresa_principal', 'estado',
        'primer_nombre', 'segundo_nombre', 'otro_nombre',
        'primer_apellido', 'segundo_apellido', 'apellido_casada',
        'puesto', 'dpi', 'no_igss', 'nit', 'sueldo_ordinario',
        'departmentId', 'areaId', 'divisionId', 'subdivisionId',
        'nivel_5', 'dimension_5', 'dist', 'fecha_inicio', 'fecha_baja'
      ];
      const { rows, count } = await Employee.findAndCountAll({
        where,
        attributes: listView ? listAttributes : { exclude: ['foto'] },
        include: [{ model: Department, as: 'departmentData' }],
        order: [['primer_apellido', 'ASC'], ['primer_nombre', 'ASC'], ['id', 'ASC']],
        limit,
        offset,
        distinct: true
      });
      return res.json(toPagedResponse(rows, count, page, pageSize));
    }

    const employees = await Employee.findAll({
      // foto (BLOB) no se usa en el frontend y infla masivamente el JSON de arranque
      attributes: { exclude: ['foto'] },
      include: [
        { model: Department, as: 'departmentData' },
        // separate evita producto cartesiano records×incidences
        { model: EmployeeRecord, as: 'records', separate: true },
        { model: EmployeeIncidence, as: 'incidences', separate: true }
      ]
    });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      attributes: { exclude: ['foto'] },
      include: [
        { model: Department, as: 'departmentData' },
        { model: EmployeeRecord, as: 'records', separate: true },
        { model: EmployeeIncidence, as: 'incidences', separate: true }
      ]
    });
    if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });
    return res.json(employee);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createEmployee = async (req, res) => {
  try {
    const distError = validateDist(req.body.dist);
    if (distError) return res.status(400).json({ error: distError });
    const componentResult = normalizeAndValidateComponentDist(req.body.component_dist);
    if (componentResult.error) return res.status(400).json({ error: componentResult.error });
    const payload = applyAutoPayrollFields({
      ...req.body,
      ...(req.body.component_dist !== undefined
        ? { component_dist: componentResult.value }
        : {})
    });
    const newEmployee = await Employee.create(payload);
    res.status(201).json(newEmployee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'No encontrado' });
    if (req.body.dist !== undefined) {
      const distError = validateDist(req.body.dist);
      if (distError) return res.status(400).json({ error: distError });
    }
    const componentResult = normalizeAndValidateComponentDist(req.body.component_dist);
    if (componentResult.error) return res.status(400).json({ error: componentResult.error });
    const merged = {
      sueldo_ordinario: employee.sueldo_ordinario,
      bon_dec_37_2001: employee.bon_dec_37_2001,
      jubilacion: employee.jubilacion,
      igss_exempt: employee.igss_exempt,
      // Preserva la retención ISR manual si el payload no la trae
      isr: employee.isr,
      ...req.body,
      ...(req.body.component_dist !== undefined
        ? { component_dist: componentResult.value }
        : {})
    };
    const payload = applyAutoPayrollFields(merged);
    await employee.update(payload);
    res.json(employee);
  } catch (err) {
    console.error('Update error:', err);
    res.status(400).json({ error: err.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'No encontrado' });
    await employee.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
};
