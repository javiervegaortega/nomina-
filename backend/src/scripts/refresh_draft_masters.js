/**
 * Refresca los snapshots de borradores de nómina con los maestros actuales
 * de employee (sueldo, bonos, ISR, bancos, descuentos) y recalcula.
 * Ejecutar: node src/scripts/refresh_draft_masters.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Employee, PayrollDraft, PayrollDraftEmployee, sequelize } = require('../models');
const { calculatePayrollBatch } = require('../services/payrollCalculator.service');

const MASTER_FIELDS = [
  'sueldo_ordinario', 'bon_dec_37_2001', 'bon_incentivo', 'isr',
  'igss_laboral', 'igss_patronal', 'bantrab', 'bancos', 'prestamo_empresa',
  'otro_descuentos', 'otros_egresos', 'seguro', 'boleto_de_ornato',
  'judiciales', 'parqueo', 'vacaciones', 'ventas_economicas', 'otro_ingresos',
  'jubilacion', 'dist', 'anticipo_quincenal'
];

async function main() {
  const masters = {};
  (await Employee.findAll({ attributes: ['id', ...MASTER_FIELDS] })).forEach(m => {
    masters[m.id] = m.toJSON();
  });

  const drafts = await PayrollDraft.findAll({
    include: [{ model: PayrollDraftEmployee, as: 'draftEmployees' }]
  });

  for (const draft of drafts) {
    const t = await sequelize.transaction();
    try {
      let employeesArr = draft.draftEmployees.map(de => {
        try {
          return typeof de.data === 'string' ? JSON.parse(de.data) : de.data;
        } catch {
          return de.data;
        }
      });

      employeesArr = employeesArr.map(e => {
        const master = masters[e.id];
        if (!master) return e;
        const next = { ...e };
        MASTER_FIELDS.forEach(f => { next[f] = master[f]; });

        // Re-siembra deducciones maestras del período (ISR/IGSS los pone el motor)
        const factor = (Number(next.days) || 30) / 30;
        const per = (v) => Math.round((Number(v) || 0) * factor * 100) / 100;
        next.deductions = {
          ...(next.deductions || {}),
          bancos: per((Number(master.bantrab) || 0) + (Number(master.bancos) || 0)),
          prestamo_empresa: per(master.prestamo_empresa),
          otros_egresos: per((Number(master.otros_egresos) || 0) + (Number(master.otro_descuentos) || 0)),
          judiciales: per(master.judiciales),
          seguro: per(master.seguro),
          parqueo: per(master.parqueo),
          boleto_de_ornato: per(master.boleto_de_ornato)
        };
        return next;
      });

      employeesArr = calculatePayrollBatch(employeesArr, draft.periodType);

      await PayrollDraftEmployee.destroy({ where: { draftId: draft.id }, transaction: t });
      if (employeesArr.length > 0) {
        await PayrollDraftEmployee.bulkCreate(
          employeesArr.map(emp => ({ draftId: draft.id, employeeId: emp.id, data: emp })),
          { transaction: t }
        );
      }
      await t.commit();

      const sample = employeesArr.filter(e => [5, 152, 153, 47].includes(Number(e.id)));
      console.log(`draft ${draft.id} (${draft.title}, ${draft.periodType}): ${employeesArr.length} empleados refrescados`);
      sample.forEach(e => {
        console.log(`  emp ${e.id}: isr=${e.calculated?.proratedDeductions?.isr} igss=${e.calculated?.proratedDeductions?.igss} bancos=${e.calculated?.proratedDeductions?.bancos} gross=${e.calculated?.gross} neto=${e.calculated?.netPayable}`);
      });
    } catch (err) {
      await t.rollback();
      console.error(`Error draft ${draft.id}:`, err.message);
    }
  }

  await sequelize.close();
  console.log('Listo.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
