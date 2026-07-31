const { Op } = require('sequelize');
const {
  Employee,
  EmployeeIncidence,
  Commission,
  OperationLog,
  Bonus,
  PayrollHistory
} = require('../models');
const { getMonthBoundsFromDate } = require('../services/operationPayroll.service');
const { parsePayrollSummary } = require('../services/payrollSummary.service');

const ALLOWED_ROLES = new Set(['ADMIN', 'GERENTE GENERAL', 'NOMINA']);
const PAYROLL_EMPLOYEE_ATTRIBUTES = [
  'id',
  'empresa_principal',
  'estado',
  'primer_nombre',
  'segundo_nombre',
  'otro_nombre',
  'primer_apellido',
  'segundo_apellido',
  'apellido_casada',
  'dpi',
  'no_igss',
  'fecha_inicio',
  'fecha_baja',
  'tipo_de_pago',
  'banco',
  'no_cuenta',
  'tipo_cuenta',
  'bon_dec_37_2001',
  'bon_incentivo',
  'horas_extras_dobles',
  'horas_extras_simples',
  'sueldo_ordinario',
  'otro_ingresos',
  'total_igss',
  'vacaciones',
  'bantrab',
  'boleto_de_ornato',
  'igss_laboral',
  'igss_patronal',
  'isr',
  'otro_descuentos',
  'otros_egresos',
  'prestamo_empresa',
  'bancos',
  'judiciales',
  'seguro',
  'parqueo',
  'ventas_economicas',
  'departmentId',
  'areaId',
  'divisionId',
  'subdivisionId',
  'nivel_5',
  'dimension_5',
  'puesto',
  'jubilacion',
  'igss_exempt',
  'observaciones',
  'dist',
  'component_dist'
];

const getPayrollInputs = async (req, res) => {
  try {
    const role = String(req.user?.role || '').trim().toUpperCase();
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(403).json({ error: 'No tienes permiso para preparar nóminas.' });
    }
    const companyId = Number(req.query.companyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({ error: 'companyId es requerido.' });
    }
    const bounds = getMonthBoundsFromDate(req.query.date || new Date());
    const periodType = String(req.query.periodType || '1ra').trim().toLowerCase();
    const [employees, commissions, operationLogs, bonuses, firstPayrolls] = await Promise.all([
      Employee.findAll({
        where: { empresa_principal: companyId },
        attributes: PAYROLL_EMPLOYEE_ATTRIBUTES,
        include: [{ model: EmployeeIncidence, as: 'incidences', separate: true }]
      }),
      Commission.findAll({
        where: {
          empresa_id: companyId,
          estado: { [Op.ne]: 'Aplicado' },
          fecha: { [Op.between]: [bounds.start, bounds.end] }
        }
      }),
      OperationLog.findAll({
        where: {
          companyId,
          date: { [Op.between]: [bounds.start, bounds.end] }
        },
        order: [['date', 'ASC'], ['id', 'ASC']]
      }),
      Bonus.findAll({ order: [['name', 'ASC']] }),
      periodType === '2da'
        ? PayrollHistory.findAll({
            where: {
              periodType: '1ra',
              status: 'cerrada',
              createdAt: {
                [Op.gte]: new Date(`${bounds.start}T00:00:00`),
                [Op.lt]: new Date(new Date(`${bounds.end}T00:00:00`).getTime() + 86400000)
              }
            },
            order: [['createdAt', 'DESC']]
          })
        : Promise.resolve([])
    ]);
    const firstQuincena = firstPayrolls.find((payroll) => {
      const summary = parsePayrollSummary(payroll.summary);
      return (summary?.companies || []).some((id) => Number(id) === companyId);
    }) || null;
    res.set('Cache-Control', 'no-store');
    return res.json({
      employees,
      commissions,
      operationLogs,
      bonuses,
      firstQuincena
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getPayrollInputs };
