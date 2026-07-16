/**
 * Recalcula ISR (e IGSS laboral/patronal) en employee y re-snapshot de drafts.
 * Ejecutar: node src/scripts/fix_isr_backfill.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Employee, PayrollDraft, PayrollDraftEmployee, sequelize } = require('../models');
const { calculateMonthlyISR } = require('../services/isr.service');
const { calculatePayrollBatch } = require('../services/payrollCalculator.service');

const CUOTA_LABORAL = 0.0483;
const CUOTA_PATRONAL = 0.1067;

async function main() {
  const employees = await Employee.findAll();
  let updatedEmps = 0;
  for (const emp of employees) {
    const base = Number(emp.sueldo_ordinario) || 0;
    const bonus = Number(emp.bon_dec_37_2001) || 0;
    const jubilado = !!(emp.jubilacion === true || emp.jubilacion === 1);
    const isr = calculateMonthlyISR(base, bonus);
    const igssLab = jubilado ? 0 : Number((base * CUOTA_LABORAL).toFixed(2));
    const igssPat = jubilado ? 0 : Number((base * CUOTA_PATRONAL).toFixed(2));
    const prevIsr = Number(emp.isr) || 0;
    if (prevIsr !== isr || Number(emp.igss_laboral) !== igssLab) {
      await emp.update({ isr, igss_laboral: igssLab, igss_patronal: igssPat });
      updatedEmps += 1;
      console.log(`employee ${emp.id}: isr ${prevIsr} -> ${isr}`);
    }
  }
  console.log(`Empleados actualizados: ${updatedEmps}/${employees.length}`);

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
      employeesArr = calculatePayrollBatch(employeesArr, draft.periodType);
      await PayrollDraftEmployee.destroy({ where: { draftId: draft.id }, transaction: t });
      if (employeesArr.length > 0) {
        await PayrollDraftEmployee.bulkCreate(
          employeesArr.map(emp => ({ draftId: draft.id, employeeId: emp.id, data: emp })),
          { transaction: t }
        );
      }
      await t.commit();
      const sample = employeesArr.filter(e => [47, 152, 153].includes(Number(e.id)));
      if (sample.length) {
        console.log(`draft ${draft.id} (${draft.title}):`);
        sample.forEach(e => {
          console.log(`  emp ${e.id}: isr ded=${e.deductions?.isr} prorated=${e.calculated?.proratedDeductions?.isr} gross=${e.calculated?.gross}`);
        });
      } else {
        console.log(`draft ${draft.id}: recalculado (${employeesArr.length} emps)`);
      }
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
