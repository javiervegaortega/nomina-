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
    return saved ? JSON.parse(saved) : INITIAL_DEPARTMENTS;
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
        const [compRes, empRes, histRes] = await Promise.all([
          fetch('http://localhost:3000/api/companies'),
          fetch('http://localhost:3000/api/employees'),
          fetch('http://localhost:3000/api/payrolls')
        ]);
        
        if (compRes.ok) {
          const apiCompanies = await compRes.json();
          if (apiCompanies.length > 0) setCompanies(apiCompanies);
        }
        
        if (empRes.ok) {
          const apiEmployees = await empRes.json();
          if (apiEmployees.length > 0) setEmployees(apiEmployees);
        }

        if (histRes.ok) {
          const apiHistory = await histRes.json();
          if (apiHistory.length > 0) setPayrollHistory(apiHistory);
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
      companies, departments, employees, bonuses, payrollHistory,
      addCompany, updateCompany, deleteCompany,
      addEmployee, updateEmployee, deleteEmployee, setAllEmployees,
      addBonus, updateBonus, deleteBonus,
      activePayrolls, createActivePayroll, updateActivePayroll, deleteActivePayroll, closePayroll,
      savePayroll, deletePayroll
    }}>
      {children}
    </DataContext.Provider>
  );
}
