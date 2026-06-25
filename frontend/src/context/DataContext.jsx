import React, { createContext, useState, useEffect, useRef } from 'react';

export const DataContext = createContext();

export function DataProvider({ children }) {
  // --- STATE ---
  const saveTimeouts = useRef({});

  const [companies, setCompanies] = useState(() => {
    const saved = localStorage.getItem('nomina-companies');
    return saved ? JSON.parse(saved) : [];
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

  const [commissions, setCommissions] = useState(() => {
    const saved = localStorage.getItem('nomina-commissions');
    return saved ? JSON.parse(saved) : [];
  });

  const [operationLogs, setOperationLogs] = useState([]);
  const [activePayrolls, setActivePayrolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
    localStorage.setItem('nomina-commissions', JSON.stringify(commissions));
  }, [commissions]);

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

        const [compRes, empRes, histRes, deptRes, areaRes, divRes, subdivRes, draftsRes, commRes, opLogsRes] = await Promise.all([
          fetch('http://localhost:3000/api/companies', fetchOpts),
          fetch('http://localhost:3000/api/employees', fetchOpts),
          fetch('http://localhost:3000/api/payrolls', fetchOpts),
          fetch('http://localhost:3000/api/departments', fetchOpts),
          fetch('http://localhost:3000/api/areas', fetchOpts),
          fetch('http://localhost:3000/api/divisions', fetchOpts),
          fetch('http://localhost:3000/api/subdivisions', fetchOpts),
          fetch('http://localhost:3000/api/payroll-drafts', fetchOpts),
          fetch('http://localhost:3000/api/commissions', fetchOpts),
          fetch('http://localhost:3000/api/operation-logs', fetchOpts)
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
        
        if (commRes.ok) {
          const apiCommissions = await commRes.json();
          if (Array.isArray(apiCommissions)) setCommissions(apiCommissions);
        }

        if (opLogsRes.ok) {
          const apiOperationLogs = await opLogsRes.json();
          if (Array.isArray(apiOperationLogs)) setOperationLogs(apiOperationLogs);
        }
      } catch (err) {
      } finally {
        setIsLoading(false);
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

  // Commissions
  const addCommission = async (comm) => {
    try {
      const res = await fetch('http://localhost:3000/api/commissions', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(comm)
      });
      if (res.ok) {
        const newC = await res.json();
        setCommissions([...commissions, newC]);
      }
    } catch (err) {
      setCommissions([...commissions, { ...comm, id: Date.now() }]);
    }
  };

  const updateCommission = async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/commissions/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setCommissions(commissions.map(c => c.id === id ? { ...c, ...data } : c));
      }
    } catch (err) {
      setCommissions(commissions.map(c => c.id === id ? { ...c, ...data } : c));
    }
  };

  const deleteCommission = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/commissions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setCommissions(commissions.filter(c => c.id !== id));
      }
    } catch (err) {
      setCommissions(commissions.filter(c => c.id !== id));
    }
  };

  
  // Operation Logs
  const addOperationLog = async (data) => {
    try {
      const res = await fetch('http://localhost:3000/api/operation-logs', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const newLog = await res.json();
        const emp = employees.find(e => e.id === newLog.employeeId);
        if (emp) newLog.Employee = { id: emp.id, primer_nombre: emp.primer_nombre, primer_apellido: emp.primer_apellido, empresa_principal: emp.empresa_principal };
        setOperationLogs(prev => [...prev, newLog]);
      }
    } catch (e) {}
  };

  const updateOperationLogStatus = async (id, status, periodAssigned = null, justification = null) => {
    try {
      const res = await fetch(`http://localhost:3000/api/operation-logs/${id}/status`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify({ status, periodAssigned, justification })
      });
      if (res.ok) {
        setOperationLogs(prev => {
          const updatedLogs = prev.map(l => l.id === id ? { ...l, status, periodAssigned, justification } : l);
          
          if (status === 'APPROVED_MANAGER') {
            const log = prev.find(l => l.id === id);
            if (log) {
              const updatedDraftsToSave = [];
              setActivePayrolls(currentDrafts => {
                const nextDrafts = currentDrafts.map(draft => {
                  const draftMonth = new Date(draft.createdAt).getMonth();
                  const draftYear = new Date(draft.createdAt).getFullYear();
                  const logMonth = new Date(log.date).getMonth();
                  const logYear = new Date(log.date).getFullYear();
                  
                  if (draftMonth === logMonth && draftYear === logYear) {
                    const draftCompanies = draft.companies || [];
                    const matchesCompany = draftCompanies.length === 0 || !log.companyId || draftCompanies.some(c => {
                      const strC = String(c);
                      if (strC === String(log.companyId)) return true;
                      const compByName = companies.find(comp => comp.nombre_comercial === strC || comp.nit === strC);
                      return compByName && String(compByName.id) === String(log.companyId);
                    });
                    
                    if (matchesCompany) {
                      const empIndex = draft.employees.findIndex(e => String(e.id) === String(log.employeeId));
                      if (empIndex > -1) {
                        const emp = { ...draft.employees[empIndex] };
                        const baseSalary = Number(emp.sueldo_ordinario) || 0;
                        const hourlyRate = baseSalary / 30 / 8;
                        
                        let valSimples = 0, valDobles = 0, totalBonos = 0;
                        if (log.type === 'HORA_EXTRA') {
                          if (log.hourType === 'SIMPLE') valSimples = Number(log.hoursQty) * hourlyRate * 1.5;
                          else valDobles = Number(log.hoursQty) * hourlyRate * 2;
                        } else if (log.type === 'BONO') {
                          totalBonos = Number(log.bonusAmount);
                        }

                        emp.extras = { ...emp.extras };
                        if (valSimples) { emp.extras.simplesQty = (emp.extras.simplesQty || 0) + Number(log.hoursQty); emp.extras.simplesVal = (emp.extras.simplesVal || 0) + valSimples; }
                        if (valDobles) { emp.extras.doblesQty = (emp.extras.doblesQty || 0) + Number(log.hoursQty); emp.extras.doblesVal = (emp.extras.doblesVal || 0) + valDobles; }
                        if (totalBonos) { emp.extras.bonos = (emp.extras.bonos || 0) + totalBonos; }
                        
                        if (emp.netTotal !== undefined) {
                           emp.netTotal += valSimples + valDobles + totalBonos;
                        }
                        
                        emp.operationLogs = [...(emp.operationLogs || []), { ...log, status: 'APPROVED_MANAGER' }];

                        const newEmployees = [...draft.employees];
                        newEmployees[empIndex] = emp;
                        const newDraft = { ...draft, employees: newEmployees };
                        updatedDraftsToSave.push(newDraft);
                        return newDraft;
                      }
                    }
                  }
                  return draft;
                });
                return nextDrafts;
              });

              // Persist changes to DB
              updatedDraftsToSave.forEach(draft => {
                fetch(`http://localhost:3000/api/payroll-drafts/${draft.id}`, {
                  method: 'PUT',
                  headers: getAuthHeader(),
                  body: JSON.stringify(draft)
                }).catch(() => {});
              });
            }
          }
          return updatedLogs;
        });
      }
    } catch (e) {}
  };

  const deleteOperationLog = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/operation-logs/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setOperationLogs(prev => prev.filter(l => l.id !== id));
      }
    } catch (e) {}
  };

  const updateOperationLog = async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/operation-logs/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const updatedLog = await res.json();
        setOperationLogs(prev => prev.map(l => l.id === id ? updatedLog : l));
      }
    } catch (e) {}
  };

  // Employees
  const addEmployee = async (data) => {
    try {
      const cleanedData = { ...data };
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === '') cleanedData[key] = null;
      });

      const res = await fetch('http://localhost:3000/api/employees', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(cleanedData)
      });
      if (res.ok) {
        const saved = await res.json();
        setEmployees([...employees, saved]);
      } else {
        await res.json();
      }
    } catch (err) {
    }
  };

  const updateEmployee = async (id, data) => {
    try {
      // Clean empty strings to null to prevent DB validation errors
      const cleanedData = { ...data };
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === '') {
          cleanedData[key] = null;
        }
      });
      
      const res = await fetch(`http://localhost:3000/api/employees/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(cleanedData)
      });
      if (res.ok) {
        setEmployees(employees.map(e => e.id === id ? { ...e, ...cleanedData } : e));
      } else {
        await res.json();
      }
    } catch (err) {
      // Fallback update on local state if offline, optionally.
      // But it's better not to falsely update if the backend failed.
      // We will revert/not update the state if it fails.
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
  const createActivePayroll = async (title, selectedCompanies, periodType = '1ra', draftDateStr = null) => {
    // selectedCompanies contains commercial names of the selected companies
    // Map selectedCompany names to company IDs
    const selectedCompanyIds = selectedCompanies.map(name => {
      const comp = companies.find(c => (c.nombre_comercial || c.nit) === name || c.id?.toString() === name);
      return comp ? comp.id : null;
    }).filter(id => id !== null);

    // If 2nd quincena, find 1st quincena payouts
    let firstQuincenaPayouts = {};
    if (periodType === '2da') {
      const targetDate = draftDateStr ? new Date(draftDateStr) : new Date();
      const month = targetDate.getMonth();
      const year = targetDate.getFullYear();
      
      const histories1ra = payrollHistory.filter(h => {
        if (h.periodType !== '1ra') return false;
        const hDate = new Date(h.createdAt || h.closedAt || Date.now());
        if (hDate.getMonth() !== month || hDate.getFullYear() !== year) return false;
        // Check if it belongs to the same companies
        let hComps = [];
        if (Array.isArray(h.companies)) hComps = h.companies;
        else if (typeof h.companies === 'string') {
          try { hComps = JSON.parse(h.companies); } catch(e) {}
        }
        if (selectedCompanyIds.length === 0) return true; // If we selected ALL companies, include all 1st quincenas
        if (hComps.length === 0 || hComps.includes('ALL')) return true; // If history was for ALL companies, include it
        return selectedCompanyIds.some(id => hComps.some(hc => String(hc) === String(id)));
      });

      if (histories1ra.length > 0) {
        histories1ra.forEach(history1ra => {
          let emps = [];
          if (typeof history1ra.data === 'string') {
            try { emps = JSON.parse(history1ra.data); } catch(e) {}
          } else if (Array.isArray(history1ra.data)) {
            emps = history1ra.data;
          } else if (typeof history1ra.employees === 'string') {
            try { emps = JSON.parse(history1ra.employees); } catch(e) {}
          } else if (Array.isArray(history1ra.employees)) {
            emps = history1ra.employees;
          }
          emps.forEach(emp => {
            if (emp.netTotal) {
              firstQuincenaPayouts[emp.id] = emp.netTotal;
            }
          });
        });
      }
    }

    const targetDateForCommissions = draftDateStr ? new Date(draftDateStr) : new Date();
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentMonth = monthNames[targetDateForCommissions.getMonth()];
    
    // Find un-applied commissions for this month
    const currentCommissions = commissions.filter(c => c.mes === currentMonth && c.estado !== 'Aplicado');

    const frozenEmployees = employees
      .filter(e => {
        if (selectedCompanyIds.length === 0) return true;
        return selectedCompanyIds.includes(e.empresa_principal);
      })
      .map(e => {
        const days = periodType === '1ra' ? 15 : 30;
        const baseSalary = Number(e.sueldo_ordinario) || 0;
        const baseFactor = days / 30;
        const igssVal = (baseSalary * baseFactor) * 0.0483;

        // Calculate commissions
        const empCommissions = currentCommissions.filter(c => c.employee_id === e.id);
        let qtySimples = 0;
        let qtyDobles = 0;
        let totalBonos = 0;

        empCommissions.forEach(c => {
          if (c.tipo_hora === 'D') qtySimples += Number(c.horas) || 0;
          else if (c.tipo_hora === 'N') qtyDobles += Number(c.horas) || 0;
          totalBonos += (Number(c.monto_bono) || 0);
        });

        // Calculate operation logs (APPROVED_MANAGER)
        const empOpLogs = operationLogs.filter(l => {
          if (String(l.employeeId) !== String(e.id) || l.status !== 'APPROVED_MANAGER') return false;
          if (selectedCompanyIds.length > 0 && l.companyId) {
            return selectedCompanyIds.some(id => String(id) === String(l.companyId));
          }
          return true;
        });
        empOpLogs.forEach(l => {
          if (l.type === 'HORA_EXTRA') {
            if (l.hourType === 'SIMPLE') qtySimples += Number(l.hoursQty) || 0;
            else if (l.hourType === 'DOBLE' || l.hourType === 'NOCTURNA') qtyDobles += Number(l.hoursQty) || 0;
          } else if (l.type === 'BONO') {
            totalBonos += Number(l.bonusAmount) || 0;
          }
        });

        // 1 normal hour = BaseSalary / 30 / 8
        const hourlyRate = baseSalary / 30 / 8;
        const valSimples = qtySimples * hourlyRate * 1.5;
        const valDobles = qtyDobles * hourlyRate * 2;

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
            bancos: (Number(e.bancos) || 0) * baseFactor,
            otros: 0,
            judiciales: (Number(e.judiciales) || 0) * baseFactor,
            seguro: (Number(e.seguro) || 0) * baseFactor,
            parqueo: (Number(e.parqueo) || 0) * baseFactor,
            boleto_de_ornato: (Number(e.boleto_de_ornato) || 0) * baseFactor,
            otros_egresos: (Number(e.otros_egresos) || 0) * baseFactor,
          },
          anticipo1ra: firstQuincenaPayouts[e.id] || 0,
          extras: {
            bonos: totalBonos,
            simplesQty: (Number(e.horas_extras_simples) || 0) + qtySimples,
            simplesVal: valSimples,
            doblesQty: (Number(e.horas_extras_dobles) || 0) + qtyDobles,
            doblesVal: valDobles,
            comisiones: 0,
            otrosIngresos: Number(e.otro_ingresos) || 0,
          },
          operationLogs: empOpLogs,
          appliedBonuses: bonuses.reduce((acc, b) => {
            acc[b.id] = b.assignments?.[e.id] || 0;
            return acc;
          }, {})
        };
      });

    if (frozenEmployees.length === 0) {
      throw new Error('No hay empleados registrados cuya empresa principal coincida con la seleccionada.');
    }

    const newDraftData = {
      id: Date.now().toString(),
      title,
      periodType,
      companies: selectedCompanyIds,
      createdAt: draftDateStr ? new Date(draftDateStr).toISOString() : new Date().toISOString(),
      employees: frozenEmployees
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
      } else {
        await res.json().catch(() => null);
      }
    } catch(e) {
    }
    
    // Fallback if API fails
    setActivePayrolls([newDraftData, ...activePayrolls]);
    return newDraftData.id;
  };

  const updateActivePayroll = async (id, newEmployeesData) => {
    // 1. Update React state immediately for instant UI response
    const updatedDrafts = activePayrolls.map(p => p.id === id ? { ...p, employees: newEmployeesData } : p);
    setActivePayrolls(updatedDrafts);

    const draft = updatedDrafts.find(p => p.id === id);
    if (draft) {
      // 2. Clear existing timeout for this draft
      if (saveTimeouts.current[id]) {
        clearTimeout(saveTimeouts.current[id]);
      }
      
      // 3. Set a new timeout to persist to the database after 1.5 seconds of inactivity
      saveTimeouts.current[id] = setTimeout(async () => {
        try {
          const res = await fetch(`http://localhost:3000/api/payroll-drafts/${id}`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify(draft)
          });
          if (!res.ok) {
            await res.json().catch(() => null);
          }
        } catch(e) {
          console.error("Error saving draft in background:", e);
        }
      }, 1500);
    }
  };

  const updateDraftMetadata = async (id, title, companies, createdAt, periodType) => {
    const updatedDrafts = activePayrolls.map(p => p.id === id ? { ...p, title, companies, createdAt, periodType } : p);
    setActivePayrolls(updatedDrafts);

    const draft = updatedDrafts.find(p => p.id === id);
    if (draft) {
      try {
        const res = await fetch(`http://localhost:3000/api/payroll-drafts/${id}`, {
          method: 'PUT',
          headers: getAuthHeader(),
          body: JSON.stringify(draft)
        });
        if (!res.ok) {
          await res.json().catch(() => null);
        }
      } catch(e) {
      }
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

  const closePayroll = async (id) => {
    const draft = activePayrolls.find(p => p.id === id);
    if (draft) {
      // Calculate totals for history view
      let grossTotal = 0;
      let dedTotal = 0;
      const logsToProcess = [];

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
        const anticipo = e.anticipo1ra || 0;
        
        e.netTotal = gross - ded - anticipo; // Save snapshot of their net pay

        grossTotal += gross;
        dedTotal += ded + anticipo;

        if (e.operationLogs) {
          e.operationLogs.forEach(log => logsToProcess.push(log.id));
        }
      });

      const historyRecord = {
        id: Date.now().toString(),
        ...draft,
        employeesCount: draft.employees.length,
        netTotal: grossTotal - dedTotal,
        closedAt: new Date().toISOString(),
        data: draft.employees // The snapshot
      };

      try {
        const res = await fetch('http://localhost:3000/api/payrolls', {
          method: 'POST',
          headers: getAuthHeader(),
          body: JSON.stringify(historyRecord)
        });
        
        if (!res.ok) {
          if (res.status === 413) throw new Error('La nómina es demasiado grande para guardarse (Payload Too Large).');
          if (res.status === 403 || res.status === 401) throw new Error('Tu sesión ha expirado o no tienes permisos (Error 403/401). Inicia sesión nuevamente.');
          throw new Error('Error al conectar con el servidor.');
        }

        await res.json();
        setPayrollHistory([historyRecord, ...payrollHistory]);
        deleteActivePayroll(id);

        // Mark operation logs as PROCESSED_PAYROLL
        if (logsToProcess.length > 0) {
          await Promise.all(logsToProcess.map(logId => 
            updateOperationLogStatus(logId, 'PROCESSED_PAYROLL')
          ));
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Draft no encontrado localmente' };
  };
  
  // Retained comment from old implementation

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
      companies, departments, employees, bonuses, commissions, payrollHistory, areas, divisions, subdivisions, isLoading,
      addCompany, updateCompany, deleteCompany,
      addDepartment, updateDepartment, deleteDepartment,
      addArea, updateArea, deleteArea,
      addDivision, updateDivision, deleteDivision,
      addSubdivision, updateSubdivision, deleteSubdivision,
      addEmployee, updateEmployee, deleteEmployee, setAllEmployees,
      addEmployeeRecord, updateEmployeeRecord, deleteEmployeeRecord,
      addBonus, updateBonus, deleteBonus,
      addCommission, updateCommission, deleteCommission,
      operationLogs, addOperationLog, updateOperationLogStatus, deleteOperationLog, updateOperationLog,
      activePayrolls, createActivePayroll, updateActivePayroll, updateDraftMetadata, deleteActivePayroll, closePayroll,
      savePayroll, deletePayroll
    }}>
      {children}
    </DataContext.Provider>
  );
}
