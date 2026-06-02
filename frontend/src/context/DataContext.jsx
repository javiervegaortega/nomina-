import React, { createContext, useState, useEffect } from 'react';
import { COMPANIES as INITIAL_COMPANIES, EMPLOYEES as INITIAL_EMPLOYEES, DEPARTMENTS as INITIAL_DEPARTMENTS } from '../data/mockData';

export const DataContext = createContext();

export function DataProvider({ children }) {
  // --- STATE ---
  const [companies, setCompanies] = useState(() => {
    const saved = localStorage.getItem('nomina-companies');
    return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
  });

  const [departments, setDepartments] = useState(() => {
    const saved = localStorage.getItem('nomina-departments');
    return saved ? JSON.parse(saved) : [];
  });

  const [areas, setAreas] = useState(() => {
    const saved = localStorage.getItem('nomina-areas');
    return saved ? JSON.parse(saved) : [];
  });

  const [divisions, setDivisions] = useState(() => {
    const saved = localStorage.getItem('nomina-divisions');
    return saved ? JSON.parse(saved) : [];
  });

  const [subdivisions, setSubdivisions] = useState(() => {
    const saved = localStorage.getItem('nomina-subdivisions');
    return saved ? JSON.parse(saved) : [];
  });

  const [employees, setEmployees] = useState([]);

  const [bonuses, setBonuses] = useState(() => {
    const saved = localStorage.getItem('nomina-bonuses');
    // Initially empty or some default types
    return saved ? JSON.parse(saved) : [];
  });

  const [activePayrolls, setActivePayrolls] = useState([]);

  const [payrollHistory, setPayrollHistory] = useState(() => {
    const saved = localStorage.getItem('nomina-history');
    return saved ? JSON.parse(saved) : [];
  });

  // --- EFFECT: PERSIST TO LOCAL STORAGE ---
  useEffect(() => {
    localStorage.setItem('nomina-companies', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('nomina-departments', JSON.stringify(departments));
  }, [departments]);

  useEffect(() => {
    localStorage.setItem('nomina-areas', JSON.stringify(areas));
  }, [areas]);

  useEffect(() => {
    localStorage.setItem('nomina-divisions', JSON.stringify(divisions));
  }, [divisions]);

  useEffect(() => {
    localStorage.setItem('nomina-subdivisions', JSON.stringify(subdivisions));
  }, [subdivisions]);

  useEffect(() => {
    localStorage.setItem('nomina-bonuses', JSON.stringify(bonuses));
  }, [bonuses]);

  useEffect(() => {
    localStorage.setItem('nomina-history', JSON.stringify(payrollHistory));
  }, [payrollHistory]);

  // --- FETCH FROM BACKEND ON MOUNT ---
  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const token = localStorage.getItem('nomina-token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const fetchOpts = { headers };

        const [compRes, empRes, histRes, deptRes, areaRes, divRes, subdivRes, draftsRes] = await Promise.all([
          fetch('http://localhost:3000/api/companies', fetchOpts),
          fetch('http://localhost:3000/api/employees', fetchOpts),
          fetch('http://localhost:3000/api/payrolls', fetchOpts),
          fetch('http://localhost:3000/api/departments', fetchOpts),
          fetch('http://localhost:3000/api/areas', fetchOpts),
          fetch('http://localhost:3000/api/divisions', fetchOpts),
          fetch('http://localhost:3000/api/subdivisions', fetchOpts),
          fetch('http://localhost:3000/api/payroll-drafts', fetchOpts)
        ]);
        
        if (compRes.ok) {
          const apiCompanies = await compRes.json();
          if (Array.isArray(apiCompanies)) setCompanies(apiCompanies);
        }
        
        if (empRes.ok) {
          const apiEmployees = await empRes.json();
          if (Array.isArray(apiEmployees)) setEmployees(apiEmployees);
        }

        if (histRes.ok) {
          const apiHistory = await histRes.json();
          if (Array.isArray(apiHistory)) setPayrollHistory(apiHistory);
        }

        if (deptRes.ok) {
          const apiDepts = await deptRes.json();
          if (Array.isArray(apiDepts)) setDepartments(apiDepts);
        }

        if (areaRes.ok) {
          const apiAreas = await areaRes.json();
          if (Array.isArray(apiAreas)) setAreas(apiAreas);
        }

        if (divRes.ok) {
          const apiDivs = await divRes.json();
          if (Array.isArray(apiDivs)) setDivisions(apiDivs);
        }

        if (subdivRes.ok) {
          const apiSubdivs = await subdivRes.json();
          if (Array.isArray(apiSubdivs)) setSubdivisions(apiSubdivs);
        }
        if (draftsRes.ok) {
          const apiDrafts = await draftsRes.json();
          if (Array.isArray(apiDrafts)) {
            const parsedDrafts = apiDrafts.map(d => {
              let comps = d.companies || [];
              let emps = d.employees || [];
              if (typeof comps === 'string') {
                try { comps = JSON.parse(comps); } catch(e) { comps = []; }
              }
              if (typeof emps === 'string') {
                try { emps = JSON.parse(emps); } catch(e) { emps = []; }
              }
              if (Array.isArray(emps)) {
                emps = emps.map(emp => (typeof emp === 'string' ? JSON.parse(emp) : emp));
              }
              return { ...d, companies: comps, employees: emps };
            });
            setActivePayrolls(parsedDrafts);
          }
        }
      } catch (err) {
        console.log('⚠️ Backend no disponible o en desarrollo, usando LocalStorage/MockData');
      }
    };

    fetchBackendData();
  }, []);

  // --- ACTIONS ---

  // Helper to get token
  const getAuthHeader = () => {
    const token = localStorage.getItem('nomina-token');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  };

  // Companies
  const addCompany = async (company) => {
    try {
      const res = await fetch('http://localhost:3000/api/companies', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(company)
      });
      if (res.ok) {
        const newC = await res.json();
        setCompanies([...companies, newC]);
      }
    } catch (err) {
      console.error(err);
      // Fallback
      setCompanies([...companies, { ...company, id: Date.now().toString() }]);
    }
  };

  const updateCompany = async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/companies/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setCompanies(companies.map(c => c.id === id ? { ...c, ...data } : c));
      }
    } catch (err) {
      setCompanies(companies.map(c => c.id === id ? { ...c, ...data } : c));
    }
  };

  const deleteCompany = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/companies/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setCompanies(companies.filter(c => c.id !== id));
      }
    } catch (err) {
      setCompanies(companies.filter(c => c.id !== id));
    }
  };

  // Departments
  const addDepartment = async (dept) => {
    try {
      const res = await fetch('http://localhost:3000/api/departments', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(dept)
      });
      if (res.ok) {
        const newD = await res.json();
        setDepartments([...departments, newD]);
      }
    } catch (err) {
      setDepartments([...departments, { ...dept, id: Date.now() }]);
    }
  };

  const updateDepartment = async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/departments/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setDepartments(departments.map(d => d.id === id ? { ...d, ...data } : d));
      }
    } catch (err) {
      setDepartments(departments.map(d => d.id === id ? { ...d, ...data } : d));
    }
  };

  const deleteDepartment = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/departments/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setDepartments(departments.filter(d => d.id !== id));
      }
    } catch (err) {
      setDepartments(departments.filter(d => d.id !== id));
    }
  };

  // Areas
  const addArea = async (area) => {
    try {
      const res = await fetch('http://localhost:3000/api/areas', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(area)
      });
      if (res.ok) {
        const newA = await res.json();
        setAreas([...areas, newA]);
      }
    } catch (err) {
      setAreas([...areas, { ...area, id: Date.now() }]);
    }
  };

  const updateArea = async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/areas/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setAreas(areas.map(a => a.id === id ? { ...a, ...data } : a));
      }
    } catch (err) {
      setAreas(areas.map(a => a.id === id ? { ...a, ...data } : a));
    }
  };

  const deleteArea = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/areas/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setAreas(areas.filter(a => a.id !== id));
      }
    } catch (err) {
      setAreas(areas.filter(a => a.id !== id));
    }
  };

  // Divisions
  const addDivision = async (div) => {
    try {
      const res = await fetch('http://localhost:3000/api/divisions', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(div)
      });
      if (res.ok) {
        const newD = await res.json();
        setDivisions([...divisions, newD]);
      }
    } catch (err) {
      setDivisions([...divisions, { ...div, id: Date.now() }]);
    }
  };

  const updateDivision = async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/divisions/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setDivisions(divisions.map(d => d.id === id ? { ...d, ...data } : d));
      }
    } catch (err) {
      setDivisions(divisions.map(d => d.id === id ? { ...d, ...data } : d));
    }
  };

  const deleteDivision = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/divisions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setDivisions(divisions.filter(d => d.id !== id));
      }
    } catch (err) {
      setDivisions(divisions.filter(d => d.id !== id));
    }
  };

  // Subdivisions
  const addSubdivision = async (subdiv) => {
    try {
      const res = await fetch('http://localhost:3000/api/subdivisions', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(subdiv)
      });
      if (res.ok) {
        const newSD = await res.json();
        setSubdivisions([...subdivisions, newSD]);
      }
    } catch (err) {
      setSubdivisions([...subdivisions, { ...subdiv, id: Date.now() }]);
    }
  };

  const updateSubdivision = async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/subdivisions/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setSubdivisions(subdivisions.map(s => s.id === id ? { ...s, ...data } : s));
      }
    } catch (err) {
      setSubdivisions(subdivisions.map(s => s.id === id ? { ...s, ...data } : s));
    }
  };

  const deleteSubdivision = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/subdivisions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setSubdivisions(subdivisions.filter(s => s.id !== id));
      }
    } catch (err) {
      setSubdivisions(subdivisions.filter(s => s.id !== id));
    }
  };

  // Employees
  const addEmployee = async (emp) => {
    try {
      const res = await fetch('http://localhost:3000/api/employees', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(emp)
      });
      if (res.ok) {
        const newE = await res.json();
        setEmployees([...employees, newE]);
      }
    } catch (err) {
      setEmployees([...employees, { ...emp, id: Date.now() }]);
    }
  };

  const updateEmployee = async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/employees/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setEmployees(employees.map(e => e.id === id ? { ...e, ...data } : e));
      }
    } catch (err) {
      setEmployees(employees.map(e => e.id === id ? { ...e, ...data } : e));
    }
  };

  const deleteEmployee = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/employees/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setEmployees(employees.filter(e => e.id !== id));
      }
    } catch (err) {
      setEmployees(employees.filter(e => e.id !== id));
    }
  };
  
  // Set all employees (useful for CSV import)
  const setAllEmployees = (newEmployees) => setEmployees(newEmployees);

  // Employee Records (estudios, cursos, puestos, eventos, record, hijos, empresa_anterior, vehiculo)
  const addEmployeeRecord = async (employeeId, type, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/employees/${employeeId}/records`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ type, data })
      });
      if (res.ok) {
        const newRecord = await res.json();
        setEmployees(employees.map(e => {
          if (e.id !== employeeId) return e;
          return { ...e, records: [...(e.records || []), newRecord] };
        }));
        return newRecord;
      }
    } catch (err) {
      const fallback = { id: Date.now(), employeeId, type, data, created_at: new Date().toISOString() };
      setEmployees(employees.map(e => {
        if (e.id !== employeeId) return e;
        return { ...e, records: [...(e.records || []), fallback] };
      }));
      return fallback;
    }
  };

  const updateEmployeeRecord = async (recordId, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/employee-records/${recordId}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify({ data })
      });
      if (res.ok) {
        setEmployees(employees.map(e => ({
          ...e,
          records: (e.records || []).map(r => r.id === recordId ? { ...r, data } : r)
        })));
      }
    } catch (err) {
      setEmployees(employees.map(e => ({
        ...e,
        records: (e.records || []).map(r => r.id === recordId ? { ...r, data } : r)
      })));
    }
  };

  const deleteEmployeeRecord = async (employeeId, recordId) => {
    try {
      await fetch(`http://localhost:3000/api/employee-records/${recordId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      setEmployees(employees.map(e => {
        if (e.id !== employeeId) return e;
        return { ...e, records: (e.records || []).filter(r => r.id !== recordId) };
      }));
    } catch (err) {
      setEmployees(employees.map(e => {
        if (e.id !== employeeId) return e;
        return { ...e, records: (e.records || []).filter(r => r.id !== recordId) };
      }));
    }
  };

  // Bonuses
  const addBonus = (bonus) => setBonuses([...bonuses, { ...bonus, id: Date.now().toString() }]);
  const updateBonus = (id, data) => setBonuses(bonuses.map(b => b.id === id ? { ...b, ...data } : b));
  const deleteBonus = (id) => setBonuses(bonuses.filter(b => b.id !== id));

  // Payroll
  // Payroll
  const createActivePayroll = async (title, selectedCompanies) => {
    // selectedCompanies contains commercial names of the selected companies
    // Map selectedCompany names to company IDs
    const selectedCompanyIds = selectedCompanies.map(name => {
      const comp = companies.find(c => (c.nombre_comercial || c.nit) === name || c.id?.toString() === name);
      return comp ? comp.id : null;
    }).filter(id => id !== null);

    const frozenEmployees = employees
      .filter(e => {
        if (selectedCompanies.length === 0) return true;
        
        // 1. Direct match by companyId
        if (e.companyId && selectedCompanyIds.includes(e.companyId)) return true;
        
        // 2. Match by empresa_principal
        if (e.empresa_principal && selectedCompanyIds.includes(e.empresa_principal)) return true;
        
        // 3. Match by distribution percentage
        let distData = {};
        if (typeof e.dist === 'string') {
          try { distData = JSON.parse(e.dist); } catch(err) {}
        } else {
          distData = e.dist || {};
        }
        return selectedCompanyIds.some(id => (distData[id] || 0) > 0);
      })
      .map(e => {
        const days = 30; // default to 30 days
        const baseSalary = Number(e.sueldo_ordinario) || 0;
        const baseFactor = days / 30;
        const igssVal = (baseSalary * baseFactor) * 0.0483;

        return {
          ...e,
          days,
          company: e.company || (companies.find(c => c.id === e.companyId)?.nombre_comercial || ''),
          deductions: {
            igss: igssVal,
            isr: Number(e.isr) || 0,
            cafe: 0,
            cell: 0,
            uniform: 0,
            shoes: 0,
            equipo: 0,
            product: 0,
            bancos: Number(e.bancos) || 0,
            otros: 0,
            judiciales: Number(e.judiciales) || 0,
            seguro: Number(e.seguro) || 0,
            parqueo: Number(e.parqueo) || 0,
            boleto_de_ornato: Number(e.boleto_de_ornato) || 0,
            otros_egresos: Number(e.otros_egresos) || 0,
          },
          extras: {
            simplesQty: Number(e.horas_extras_simples) || 0,
            simplesVal: 0,
            doblesQty: Number(e.horas_extras_dobles) || 0,
            doblesVal: 0,
            comisiones: 0,
            otrosIngresos: Number(e.otro_ingresos) || 0,
          },
          appliedBonuses: bonuses.reduce((acc, b) => {
            acc[b.id] = b.assignments?.[e.id] || 0;
            return acc;
          }, {})
        };
      });

    const newDraftData = {
      id: Date.now().toString(),
      title,
      companies: selectedCompanies,
      createdAt: new Date().toISOString(),
      employees: frozenEmployees,
    };

    try {
      const res = await fetch('http://localhost:3000/api/payroll-drafts', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(newDraftData)
      });
      if (res.ok) {
        const savedDraft = await res.json();
        setActivePayrolls([savedDraft, ...activePayrolls]);
        return savedDraft.id;
      }
    } catch(e) {}
    
    // Fallback if API fails
    setActivePayrolls([newDraftData, ...activePayrolls]);
    return newDraftData.id;
  };

  const updateActivePayroll = async (id, newEmployeesData) => {
    const updatedDrafts = activePayrolls.map(p => p.id === id ? { ...p, employees: newEmployeesData } : p);
    setActivePayrolls(updatedDrafts);

    const draft = updatedDrafts.find(p => p.id === id);
    if (draft) {
      try {
        await fetch(`http://localhost:3000/api/payroll-drafts/${id}`, {
          method: 'PUT',
          headers: getAuthHeader(),
          body: JSON.stringify(draft)
        });
      } catch(e) {}
    }
  };

  const updateDraftMetadata = async (id, title, companies, createdAt) => {
    const updatedDrafts = activePayrolls.map(p => p.id === id ? { ...p, title, companies, createdAt } : p);
    setActivePayrolls(updatedDrafts);

    const draft = updatedDrafts.find(p => p.id === id);
    if (draft) {
      try {
        await fetch(`http://localhost:3000/api/payroll-drafts/${id}`, {
          method: 'PUT',
          headers: getAuthHeader(),
          body: JSON.stringify(draft)
        });
      } catch(e) {}
    }
  };

  const deleteActivePayroll = async (id) => {
    setActivePayrolls(activePayrolls.filter(p => p.id !== id));
    try {
      await fetch(`http://localhost:3000/api/payroll-drafts/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
    } catch(e) {}
  };

  const closePayroll = (id) => {
    const draft = activePayrolls.find(p => p.id === id);
    if (draft) {
      // Calculate totals for history view
      let grossTotal = 0;
      let dedTotal = 0;
      draft.employees.forEach(e => {
        const baseFactor = (e.days || 30) / 30;
        const sueldoOrd = Number(e.sueldo_ordinario) || 0;
        const bonInc = Number(e.bon_incentivo) || 0;
        const bonDec = Number(e.bon_dec_37_2001) || 0;

        const baseSalary = sueldoOrd * baseFactor;
        const bonusLey = bonInc * baseFactor;
        const bonusDec = bonDec * baseFactor;

        const extrasVal = (e.extras?.simplesVal || 0) + (e.extras?.doblesVal || 0) + (e.extras?.comisiones || 0) + (e.extras?.otrosIngresos || 0);
        const bonusesSum = Object.values(e.appliedBonuses || {}).reduce((a, b) => a + b, 0);

        const gross = baseSalary + bonusLey + bonusDec + extrasVal + bonusesSum;
        const ded = Object.values(e.deductions || {}).reduce((a, b) => a + b, 0);

        grossTotal += gross;
        dedTotal += ded;
      });

      const historyRecord = {
        id: Date.now().toString(),
        ...draft,
        employeesCount: draft.employees.length,
        netTotal: grossTotal - dedTotal,
        closedAt: new Date().toISOString(),
        data: draft.employees // The snapshot
      };

      // Save to backend
      fetch('http://localhost:3000/api/payrolls', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(historyRecord)
      }).then(res => {
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            console.error('Error de autenticación: Tu sesión ha expirado.');
            // Idealmente podríamos lanzar un toast o un logout aquí.
          }
          throw new Error('Failed to save to history');
        }
        return res.json();
      }).then(() => {
        setPayrollHistory([historyRecord, ...payrollHistory]);
        deleteActivePayroll(id);
      }).catch(err => {
        console.error("No se pudo cerrar la nómina en el servidor", err);
      });
    }
  };

  // Deprecated savePayroll (keeping just in case some other code references it, but we won't use it)
  const savePayroll = (payrollData) => {
    setPayrollHistory([{ ...payrollData, id: Date.now().toString(), date: new Date().toISOString() }, ...payrollHistory]);
  };
  const deletePayroll = async (id) => {
    try {
      const token = localStorage.getItem('nomina-token');
      await fetch(`http://localhost:3000/api/payrolls/${id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
      });
      setPayrollHistory(payrollHistory.filter(p => p.id !== id));
    } catch (err) {
      setPayrollHistory(payrollHistory.filter(p => p.id !== id));
    }
  };

  return (
    <DataContext.Provider value={{
      companies, departments, employees, bonuses, payrollHistory, areas, divisions, subdivisions,
      addCompany, updateCompany, deleteCompany,
      addDepartment, updateDepartment, deleteDepartment,
      addArea, updateArea, deleteArea,
      addDivision, updateDivision, deleteDivision,
      addSubdivision, updateSubdivision, deleteSubdivision,
      addEmployee, updateEmployee, deleteEmployee, setAllEmployees,
      addEmployeeRecord, updateEmployeeRecord, deleteEmployeeRecord,
      addBonus, updateBonus, deleteBonus,
      activePayrolls, createActivePayroll, updateActivePayroll, updateDraftMetadata, deleteActivePayroll, closePayroll,
      savePayroll, deletePayroll
    }}>
      {children}
    </DataContext.Provider>
  );
}
