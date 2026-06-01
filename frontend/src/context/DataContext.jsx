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

  const [activePayrolls, setActivePayrolls] = useState(() => {
    const saved = localStorage.getItem('nomina-active-payrolls');
    return saved ? JSON.parse(saved) : [];
  });

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
    localStorage.setItem('nomina-active-payrolls', JSON.stringify(activePayrolls));
  }, [activePayrolls]);

  useEffect(() => {
    localStorage.setItem('nomina-history', JSON.stringify(payrollHistory));
  }, [payrollHistory]);

  // --- FETCH FROM BACKEND ON MOUNT ---
  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const [compRes, empRes, histRes, deptRes, areaRes, divRes, subdivRes] = await Promise.all([
          fetch('http://localhost:3000/api/companies'),
          fetch('http://localhost:3000/api/employees'),
          fetch('http://localhost:3000/api/payrolls'),
          fetch('http://localhost:3000/api/departments'),
          fetch('http://localhost:3000/api/areas'),
          fetch('http://localhost:3000/api/divisions'),
          fetch('http://localhost:3000/api/subdivisions')
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

  // Bonuses
  const addBonus = (bonus) => setBonuses([...bonuses, { ...bonus, id: Date.now().toString() }]);
  const updateBonus = (id, data) => setBonuses(bonuses.map(b => b.id === id ? { ...b, ...data } : b));
  const deleteBonus = (id) => setBonuses(bonuses.filter(b => b.id !== id));

  // Payroll
  const createActivePayroll = (title, selectedCompanies) => {
    // 1. Filter employees by selected companies
    // 2. Freeze their state into the draft
    const frozenEmployees = employees
      .filter(e => selectedCompanies.length === 0 || selectedCompanies.includes(e.company))
      .map(e => ({
        ...e,
        extras: { ...e.extras },
        deductions: { ...e.deductions },
        appliedBonuses: bonuses.reduce((acc, b) => {
          acc[b.id] = b.assignments?.[e.id] || 0;
          return acc;
        }, {})
      }));

    const newDraft = {
      id: Date.now().toString(),
      title,
      companies: selectedCompanies,
      createdAt: new Date().toISOString(),
      employees: frozenEmployees,
    };
    setActivePayrolls([newDraft, ...activePayrolls]);
    return newDraft.id;
  };

  const updateActivePayroll = (id, newEmployeesData) => {
    setActivePayrolls(activePayrolls.map(p => p.id === id ? { ...p, employees: newEmployeesData } : p));
  };

  const deleteActivePayroll = (id) => setActivePayrolls(activePayrolls.filter(p => p.id !== id));

  const closePayroll = (id) => {
    const draft = activePayrolls.find(p => p.id === id);
    if (draft) {
      // Calculate totals for history view
      let grossTotal = 0;
      let dedTotal = 0;
      draft.employees.forEach(e => {
        // Simple history summary calculation
        const baseFactor = (e.days || 30) / 30;
        const gross = (e.base * baseFactor) + (e.bonus * baseFactor) + e.extras.simplesVal + e.extras.doblesVal + e.extras.comisiones + e.extras.otrosIngresos + Object.values(e.appliedBonuses || {}).reduce((a,b)=>a+b,0);
        const ded = Object.values(e.deductions).reduce((a, b) => a + b, 0) + ((e.base * baseFactor) * 0.0483);
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
      const token = localStorage.getItem('nomina-token');
      fetch('http://localhost:3000/api/payrolls', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
        body: JSON.stringify(historyRecord)
      }).catch(err => console.error(err));

      setPayrollHistory([historyRecord, ...payrollHistory]);
      deleteActivePayroll(id);
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
      addBonus, updateBonus, deleteBonus,
      activePayrolls, createActivePayroll, updateActivePayroll, deleteActivePayroll, closePayroll,
      savePayroll, deletePayroll
    }}>
      {children}
    </DataContext.Provider>
  );
}
