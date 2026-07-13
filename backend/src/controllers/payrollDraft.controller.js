const { PayrollDraft, PayrollDraftEmployee, sequelize } = require('../models');
const { calculatePayrollBatch } = require('../services/payrollCalculator.service');

const getAll = async (req, res) => {
  try {
    const drafts = await PayrollDraft.findAll({
      include: [{ model: PayrollDraftEmployee, as: 'draftEmployees' }]
    });

    // Transform backend structure back to what frontend expects
    const formattedDrafts = drafts.map(d => {
      const draftObj = d.toJSON();
      let employeesArr = draftObj.draftEmployees.map(de => {
        try {
          return typeof de.data === 'string' ? JSON.parse(de.data) : de.data;
        } catch(e) {
          return de.data;
        }
      });
      // Retrofit calculations for old drafts
      employeesArr = calculatePayrollBatch(employeesArr, draftObj.periodType);

      return {
        id: draftObj.id,
        title: draftObj.title,
        companies: draftObj.companies,
        periodType: draftObj.periodType,
        notes: draftObj.notes,
        employees: employeesArr,
        createdAt: draftObj.createdAt
      };
    });

    res.json(formattedDrafts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const create = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id, title, companies, employees, createdAt, periodType, notes } = req.body;
    
    // SERVER-SIDE CALCULATION ENFORCEMENT
    const calculatedEmployees = employees && employees.length > 0 
      ? calculatePayrollBatch(employees, periodType) 
      : [];
    
    // Create main draft record
    const newDraft = await PayrollDraft.create({
      id,
      title,
      companies,
      periodType,
      notes,
      employeesCount: calculatedEmployees.length,
      createdAt
    }, { transaction: t });

    // Create secondary records
    if (calculatedEmployees.length > 0) {
      const employeeRecords = calculatedEmployees.map(emp => ({
        draftId: id,
        employeeId: emp.id,
        data: emp
      }));
      await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
    }

    await t.commit();
    res.status(201).json({ ...req.body, employees: calculatedEmployees }); // Return the calculated payload
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
};

const update = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const draftId = req.params.id;
    const draft = await PayrollDraft.findByPk(draftId);
    
    if (!draft) {
      await t.rollback();
      return res.status(404).json({ error: 'Borrador no encontrado' });
    }

    const { title, companies, employees, createdAt, periodType, notes } = req.body;
    console.log("UPDATE DRAFT ID:", draftId, "PAYLOAD PERIOD:", periodType);
    
    // SERVER-SIDE CALCULATION ENFORCEMENT
    const calculatedEmployees = employees && employees.length > 0 
      ? calculatePayrollBatch(employees, periodType) 
      : [];

    // Update main record
    await draft.update({
      title,
      companies,
      periodType,
      notes,
      createdAt,
      employeesCount: calculatedEmployees.length
    }, { transaction: t });

    // If employees array is provided, rebuild the employees table for this draft
    if (employees) {
      await PayrollDraftEmployee.destroy({ where: { draftId }, transaction: t });
      
      if (calculatedEmployees.length > 0) {
        const employeeRecords = calculatedEmployees.map(emp => {
          const empObj = typeof emp === 'string' ? JSON.parse(emp) : emp;
          return {
            draftId,
            employeeId: empObj.id,
            data: empObj
          };
        });
        await PayrollDraftEmployee.bulkCreate(employeeRecords, { transaction: t });
      }
    }

    await t.commit();
    res.json({ ...req.body, employees: calculatedEmployees });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const draft = await PayrollDraft.findByPk(req.params.id);
    if (!draft) return res.status(404).json({ error: 'Borrador no encontrado' });
    
    // Cascade delete will handle PayrollDraftEmployee
    await draft.destroy();
    res.json({ message: 'Borrador eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getAll,
  create,
  update,
  remove
};
