import React, { createContext, useState, useEffect, useRef, useContext, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import { isDateInQuincena, findMatchingActiveDraft, CUOTA_LABORAL_RATE } from '../utils/payrollPeriod';
import { calculateMonthlyISR } from '../data/mockData';

export const DataContext = createContext();

const CACHE_KEYS = {
  companies: 'nomina-companies',
  departments: 'nomina-departments',
  areas: 'nomina-areas',
  divisions: 'nomina-divisions',
  subdivisions: 'nomina-subdivisions',
  dimension5s: 'nomina-dimension5s',
  bonuses: 'nomina-bonuses',
  commissions: 'nomina-commissions',
};

const readCache = (key, fallback = []) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const parseDrafts = (apiDrafts) => apiDrafts.map(d => {
  let comps = d.companies || [];
  let emps = d.employees || [];
  if (typeof comps === 'string') {
    try { comps = JSON.parse(comps); } catch { comps = []; }
  }
  if (!Array.isArray(comps) && comps != null && typeof comps === 'object') {
    comps = Object.values(comps);
  }
  if (!Array.isArray(comps)) comps = [];
  if (typeof emps === 'string') {
    try { emps = JSON.parse(emps); } catch { emps = []; }
  }
  if (Array.isArray(emps)) {
    emps = emps.map(emp => (typeof emp === 'string' ? JSON.parse(emp) : emp));
  } else {
    emps = [];
  }
  return { ...d, companies: comps, employees: emps };
});

export function DataProvider({ children }) {
  // --- STATE ---
  const { token } = useContext(AuthContext);
  const saveTimeouts = useRef({});
  const persistTimer = useRef(null);
  const persistSnapshot = useRef({});

  const [companies, setCompanies] = useState(() => readCache(CACHE_KEYS.companies));
  const [departments, setDepartments] = useState(() => readCache(CACHE_KEYS.departments));
  const [areas, setAreas] = useState(() => readCache(CACHE_KEYS.areas));
  const [divisions, setDivisions] = useState(() => readCache(CACHE_KEYS.divisions));
  const [subdivisions, setSubdivisions] = useState(() => readCache(CACHE_KEYS.subdivisions));
  const [dimension5s, setDimension5s] = useState(() => readCache(CACHE_KEYS.dimension5s));
  const [employees, setEmployees] = useState([]);
  const [bonuses, setBonuses] = useState(() => readCache(CACHE_KEYS.bonuses));
  const [commissions, setCommissions] = useState(() => readCache(CACHE_KEYS.commissions));
  const [operationLogs, setOperationLogs] = useState([]);
  const [activePayrolls, setActivePayrolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Historial se carga solo desde API (evitar stringify masivo en localStorage)
  const [payrollHistory, setPayrollHistory] = useState([]);

  // Persistencia diferida de catálogos (no bloquea el hilo principal en cada setState)
  useEffect(() => {
    persistSnapshot.current = {
      companies, departments, areas, divisions, subdivisions, dimension5s, bonuses, commissions
    };
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const snap = persistSnapshot.current;
      try {
        localStorage.setItem(CACHE_KEYS.companies, JSON.stringify(snap.companies));
        localStorage.setItem(CACHE_KEYS.departments, JSON.stringify(snap.departments));
        localStorage.setItem(CACHE_KEYS.areas, JSON.stringify(snap.areas));
        localStorage.setItem(CACHE_KEYS.divisions, JSON.stringify(snap.divisions));
        localStorage.setItem(CACHE_KEYS.subdivisions, JSON.stringify(snap.subdivisions));
        localStorage.setItem(CACHE_KEYS.dimension5s, JSON.stringify(snap.dimension5s));
        localStorage.setItem(CACHE_KEYS.commissions, JSON.stringify(snap.commissions));
        // Limpiar historial gigante si quedó de versiones anteriores
        if (localStorage.getItem('nomina-history')) {
          localStorage.removeItem('nomina-history');
        }
      } catch {
        // QuotaExceeded u otros: no romper la app
      }
    }, 400);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [companies, departments, areas, divisions, subdivisions, dimension5s, bonuses, commissions]);

  // --- FETCH FROM BACKEND ON MOUNT ---
  useEffect(() => {
    let cancelled = false;

    const safeJson = async (res) => {
      if (!res?.ok) return null;
      try {
        return await res.json();
      } catch {
        return null;
      }
    };

    const fetchBackendData = async () => {
      try {
        const authToken = localStorage.getItem('nomina-token');
        const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
        const fetchOpts = { headers };

        // Carga crítica primero (sin historial/logs pesados ni SAP no usado)
        const [
          compRes, empRes, deptRes, areaRes, divRes, subdivRes, dim5Res, draftsRes
        ] = await Promise.all([
          fetch('http://localhost:3000/api/companies', fetchOpts),
          fetch('http://localhost:3000/api/employees', fetchOpts),
          fetch('http://localhost:3000/api/departments', fetchOpts),
          fetch('http://localhost:3000/api/areas', fetchOpts),
          fetch('http://localhost:3000/api/divisions', fetchOpts),
          fetch('http://localhost:3000/api/subdivisions', fetchOpts),
          fetch('http://localhost:3000/api/dimension5', fetchOpts),
          fetch('http://localhost:3000/api/payroll-drafts', fetchOpts),
        ]);

        const [
          apiCompanies, apiEmployees, apiDepts, apiAreas, apiDivs, apiSubdivs, apiDim5s, apiDrafts
        ] = await Promise.all([
          safeJson(compRes), safeJson(empRes), safeJson(deptRes), safeJson(areaRes),
          safeJson(divRes), safeJson(subdivRes), safeJson(dim5Res), safeJson(draftsRes)
        ]);

        if (cancelled) return;

        // Un solo batch de updates críticos → menos re-renders en cascada
        if (Array.isArray(apiCompanies)) setCompanies(apiCompanies);
        if (Array.isArray(apiEmployees)) setEmployees(apiEmployees);
        if (Array.isArray(apiDepts)) setDepartments(apiDepts);
        if (Array.isArray(apiAreas)) setAreas(apiAreas);
        if (Array.isArray(apiDivs)) setDivisions(apiDivs);
        if (Array.isArray(apiSubdivs)) setSubdivisions(apiSubdivs);
        if (Array.isArray(apiDim5s)) setDimension5s(apiDim5s);
        if (Array.isArray(apiDrafts)) setActivePayrolls(parseDrafts(apiDrafts));
        setBonuses([]);
        setCommissions([]);
        setIsLoading(false);

        // Historial y logs en segundo plano (payloads grandes)
        const deferHeavy = async () => {
          try {
            const [histRes, opLogsRes] = await Promise.all([
              fetch('http://localhost:3000/api/payrolls?summary=1', fetchOpts),
              fetch('http://localhost:3000/api/operation-logs', fetchOpts),
            ]);
            const [apiHistory, apiOperationLogs] = await Promise.all([
              safeJson(histRes), safeJson(opLogsRes)
            ]);
            if (cancelled) return;
            if (Array.isArray(apiHistory)) setPayrollHistory(apiHistory);
            if (Array.isArray(apiOperationLogs)) setOperationLogs(apiOperationLogs);
          } catch {
            // no-op
          }
        };

        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => { deferHeavy(); }, { timeout: 2000 });
        } else {
          setTimeout(deferHeavy, 0);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    };

    if (token) {
      fetchBackendData();
    } else {
      setIsLoading(false);
    }

    return () => { cancelled = true; };
  }, [token]);

  // --- ACTIONS ---

  // Helper to get token
  const getAuthHeader = () => {
    const token = localStorage.getItem('nomina-token');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  };

  const fetchPayrollHistory = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/payrolls?summary=1', { headers: getAuthHeader() });
      if (res.ok) {
        const apiHistory = await res.json();
        if (Array.isArray(apiHistory)) setPayrollHistory(apiHistory);
      }
    } catch (err) {
      console.error('fetchPayrollHistory:', err);
    }
  };

  const fetchActivePayrolls = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/payroll-drafts', { headers: getAuthHeader() });
      if (res.ok) {
        const apiDrafts = await res.json();
        if (Array.isArray(apiDrafts)) setActivePayrolls(parseDrafts(apiDrafts));
      }
    } catch (err) {
      console.error('fetchActivePayrolls:', err);
    }
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

  // Dimension 5
  const addDimension5 = async (dim5) => {
    try {
      const res = await fetch('http://localhost:3000/api/dimension5', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(dim5)
      });
      if (res.ok) {
        const newD5 = await res.json();
        setDimension5s([...dimension5s, newD5]);
      }
    } catch (err) {
      setDimension5s([...dimension5s, { ...dim5, id: Date.now() }]);
    }
  };

  const updateDimension5 = async (id, data) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dimension5/${id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setDimension5s(dimension5s.map(d => d.id === id ? { ...d, ...data } : d));
      }
    } catch (err) {
      setDimension5s(dimension5s.map(d => d.id === id ? { ...d, ...data } : d));
    }
  };

  const deleteDimension5 = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/dimension5/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setDimension5s(dimension5s.filter(d => d.id !== id));
      }
    } catch (err) {
      setDimension5s(dimension5s.filter(d => d.id !== id));
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

  // --- Operation Logs ↔ Active Payroll drafts ---
  const computeLogMoney = (log, emp) => {
    const baseSalary = Number(emp.sueldo_ordinario) || 0;
    const hourlyRate = baseSalary / 30 / 8;
    let valSimples = 0;
    let valDobles = 0;
    let totalBonos = 0;
    let qtySimples = 0;
    let qtyDobles = 0;
    if (log.type === 'HORA_EXTRA') {
      if (log.hourType === 'SIMPLE') {
        qtySimples = Number(log.hoursQty) || 0;
        valSimples = qtySimples * hourlyRate * 1.5;
      } else if (log.hourType === 'DOBLE' || log.hourType === 'NOCTURNA') {
        qtyDobles = Number(log.hoursQty) || 0;
        valDobles = qtyDobles * hourlyRate * 2;
      }
    } else if (log.type === 'BONO') {
      totalBonos = Number(log.bonusAmount) || 0;
    }
    return { valSimples, valDobles, totalBonos, qtySimples, qtyDobles };
  };

  const applyLogToDraftEmployee = (emp, log, mode) => {
    const already = (emp.operationLogs || []).some((l) => String(l.id) === String(log.id));
    if (mode === 'add' && already) return { emp, changed: false };
    if (mode === 'remove' && !already) return { emp, changed: false };

    const { valSimples, valDobles, totalBonos, qtySimples, qtyDobles } = computeLogMoney(log, emp);
    const sign = mode === 'add' ? 1 : -1;
    const next = { ...emp, extras: { ...(emp.extras || {}) } };

    if (qtySimples || valSimples) {
      next.extras.simplesQty = Math.max(0, (Number(next.extras.simplesQty) || 0) + sign * qtySimples);
      next.extras.simplesVal = Math.max(0, (Number(next.extras.simplesVal) || 0) + sign * valSimples);
    }
    if (qtyDobles || valDobles) {
      next.extras.doblesQty = Math.max(0, (Number(next.extras.doblesQty) || 0) + sign * qtyDobles);
      next.extras.doblesVal = Math.max(0, (Number(next.extras.doblesVal) || 0) + sign * valDobles);
    }
    if (totalBonos) {
      next.extras.bonos = Math.max(0, (Number(next.extras.bonos) || 0) + sign * totalBonos);
    }
    if (next.netTotal !== undefined) {
      next.netTotal = (Number(next.netTotal) || 0) + sign * (valSimples + valDobles + totalBonos);
    }
    if (mode === 'add') {
      next.operationLogs = [...(next.operationLogs || []), { ...log, status: 'APPROVED_MANAGER' }];
    } else {
      next.operationLogs = (next.operationLogs || []).filter((l) => String(l.id) !== String(log.id));
    }
    return { emp: next, changed: true };
  };

  const persistDraftPatch = (draft) => {
    fetch(`http://localhost:3000/api/payroll-drafts/${draft.id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(draft),
    }).catch(() => {});
  };

  const syncLogWithActiveDrafts = (log, mode) => {
    if (!log) return;
    setActivePayrolls((currentDrafts) => {
      const draftsToPersist = [];
      const next = currentDrafts.map((draft) => {
        const match = findMatchingActiveDraft([draft], log.date, log.companyId, companies);
        if (!match) return draft;
        const empIndex = (draft.employees || []).findIndex((e) => String(e.id) === String(log.employeeId));
        if (empIndex < 0) return draft;
        const { emp, changed } = applyLogToDraftEmployee(draft.employees[empIndex], log, mode);
        if (!changed) return draft;
        const newEmployees = [...draft.employees];
        newEmployees[empIndex] = emp;
        const newDraft = { ...draft, employees: newEmployees };
        draftsToPersist.push(newDraft);
        return newDraft;
      });
      if (draftsToPersist.length > 0) {
        queueMicrotask(() => draftsToPersist.forEach(persistDraftPatch));
      }
      return next;
    });
  };

  const injectApprovedLogIntoActiveDrafts = (log) => syncLogWithActiveDrafts(log, 'add');
  const revertLogFromActiveDrafts = (log) => syncLogWithActiveDrafts(log, 'remove');

  const addOperationLog = async (data) => {
    const res = await fetch('http://localhost:3000/api/operation-logs', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Error al crear el registro');
    }
    const newLog = await res.json();
    const emp = employees.find((e) => e.id === newLog.employeeId);
    if (emp) {
      newLog.Employee = {
        id: emp.id,
        primer_nombre: emp.primer_nombre,
        primer_apellido: emp.primer_apellido,
        empresa_principal: emp.empresa_principal,
      };
    }
    setOperationLogs((prev) => [...prev, newLog]);
    if (newLog.status === 'APPROVED_MANAGER') {
      injectApprovedLogIntoActiveDrafts(newLog);
    }
    return newLog;
  };

  const updateOperationLogStatus = async (id, status, periodAssigned = null, justification = null, rejectionFromNomina = false, logSnapshot = null) => {
    const res = await fetch(`http://localhost:3000/api/operation-logs/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify({ status, periodAssigned, justification, rejectionFromNomina }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Error al actualizar estado');
    }

    let prevLog = logSnapshot;
    setOperationLogs((prev) => {
      if (!prevLog) prevLog = prev.find((l) => String(l.id) === String(id)) || null;
      return prev.map((l) =>
        String(l.id) === String(id) ? { ...l, status, periodAssigned, justification } : l
      );
    });
    if (!prevLog && logSnapshot) prevLog = logSnapshot;

    const logForSync = prevLog
      ? { ...prevLog, status, periodAssigned, justification }
      : { id, status, periodAssigned, justification };

    if (status === 'APPROVED_MANAGER') {
      injectApprovedLogIntoActiveDrafts(logForSync);
    } else if (prevLog?.status === 'APPROVED_MANAGER' && status !== 'APPROVED_MANAGER' && status !== 'PROCESSED_PAYROLL') {
      revertLogFromActiveDrafts(prevLog);
    }
  };

  const deleteOperationLog = async (id) => {
    const prevLog = operationLogs.find((l) => String(l.id) === String(id));
    const res = await fetch(`http://localhost:3000/api/operation-logs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Error al eliminar');
    }
    if (prevLog?.status === 'APPROVED_MANAGER') {
      revertLogFromActiveDrafts(prevLog);
    }
    setOperationLogs((prev) => prev.filter((l) => String(l.id) !== String(id)));
  };

  const updateOperationLog = async (id, data) => {
    const prevLog = operationLogs.find((l) => String(l.id) === String(id));
    const res = await fetch(`http://localhost:3000/api/operation-logs/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Error al actualizar el registro');
    }
    const updatedLog = await res.json();
    if (prevLog?.status === 'APPROVED_MANAGER') {
      revertLogFromActiveDrafts(prevLog);
    }
    setOperationLogs((prev) => prev.map((l) => (String(l.id) === String(id) ? updatedLog : l)));
    if (updatedLog.status === 'APPROVED_MANAGER') {
      injectApprovedLogIntoActiveDrafts(updatedLog);
    }
    return updatedLog;
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

  // Bonuses (API)
  const addBonus = async (bonus) => {
    const res = await fetch('http://localhost:3000/api/bonuses', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(bonus)
    });
    if (!res.ok) throw new Error('No se pudo crear el bono');
    const created = await res.json();
    setBonuses((prev) => [...prev, created]);
    return created;
  };

  const updateBonus = async (id, data) => {
    const res = await fetch(`http://localhost:3000/api/bonuses/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('No se pudo actualizar el bono');
    const updated = await res.json();
    setBonuses((prev) => prev.map((b) => (b.id === id ? updated : b)));
    return updated;
  };

  const deleteBonus = async (id) => {
    const res = await fetch(`http://localhost:3000/api/bonuses/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('No se pudo eliminar el bono');
    setBonuses((prev) => prev.filter((b) => b.id !== id));
  };

  // Payroll
  const createActivePayroll = async (title, selectedCompanies, periodType = '1ra', draftDateStr = null) => {
    // Obligatorio: exactamente una empresa (no se permite "todas")
    const rawCompanies = Array.isArray(selectedCompanies) ? selectedCompanies : [];
    const hasAllToken = rawCompanies.some(c => {
      const s = String(c ?? '').trim().toLowerCase();
      return !s || s === 'all' || s === 'todas' || s === 'todas las empresas';
    });
    if (rawCompanies.length !== 1 || hasAllToken) {
      throw new Error('Debe seleccionar una empresa específica. Las nóminas se procesan empresa por empresa.');
    }

    // selectedCompanies contains commercial names of the selected companies
    // Map selectedCompany names to company IDs
    const selectedCompanyIds = rawCompanies.map(name => {
      const comp = companies.find(c => (c.nombre_comercial || c.nit) === name || c.id?.toString() === name);
      return comp ? comp.id : null;
    }).filter(id => id !== null);

    if (selectedCompanyIds.length !== 1) {
      throw new Error('Debe seleccionar una empresa válida para crear el borrador.');
    }

    const draftRefDate = draftDateStr || new Date().toISOString();

    // If 2nd quincena, find 1st quincena payouts (prefer cerrada, most recent)
    let firstQuincenaPayouts = {};
    let missingAnticipoWarning = false;
    if (periodType === '2da') {
      // Refrescar historial para no perder 1ras recién cerradas
      let historySource = payrollHistory;
      try {
        const histRes = await fetch('http://localhost:3000/api/payrolls?summary=1', { headers: getAuthHeader() });
        if (histRes.ok) {
          const apiHistory = await histRes.json();
          if (Array.isArray(apiHistory)) {
            historySource = apiHistory;
            setPayrollHistory(apiHistory);
          }
        }
      } catch (e) {
        console.warn('No se pudo refrescar historial para anticipo 1ra:', e);
      }

      const targetDate = new Date(draftRefDate);
      const month = targetDate.getMonth();
      const year = targetDate.getFullYear();

      const parseCompanies = (h) => {
        const set = new Set();
        const addAll = (raw) => {
          let comps = raw;
          if (typeof comps === 'string') {
            try { comps = JSON.parse(comps); } catch { comps = []; }
          }
          if (!Array.isArray(comps)) return;
          comps.forEach((c) => {
            if (c != null && String(c).trim()) set.add(String(c).trim());
          });
        };
        addAll(h.companies);
        let summary = h.summary;
        if (typeof summary === 'string') {
          try { summary = JSON.parse(summary); } catch { summary = null; }
        }
        if (summary && typeof summary === 'object') addAll(summary.companies);
        return Array.from(set);
      };

      const matchesCompanies = (h) => {
        const hComps = parseCompanies(h);
        if (selectedCompanyIds.length === 0) return false;
        if (hComps.length === 0 || hComps.includes('ALL')) return false;

        // IDs originales si el API ya resolvió nombres en summary.companies
        let summary = h.summary;
        if (typeof summary === 'string') {
          try { summary = JSON.parse(summary); } catch { summary = null; }
        }
        const companyIds = Array.isArray(summary?.companyIds) ? summary.companyIds.map(String) : [];

        const selectedNames = selectedCompanyIds.map((id) => {
          const c = companies.find((x) => String(x.id) === String(id));
          return c ? (c.nombre_comercial || c.razon_social || String(id)) : String(id);
        });
        const selectedNits = selectedCompanyIds.map((id) => {
          const c = companies.find((x) => String(x.id) === String(id));
          return c?.nit ? String(c.nit).trim() : null;
        }).filter(Boolean);

        const idMatch = selectedCompanyIds.some((id) =>
          hComps.some((hc) => String(hc) === String(id))
          || companyIds.some((cid) => String(cid) === String(id))
        );
        const nameMatch = selectedNames.some((name) =>
          hComps.some((hc) => String(hc).trim().toLowerCase() === String(name).trim().toLowerCase())
        );
        const nitMatch = selectedNits.some((nit) =>
          hComps.some((hc) => String(hc).trim() === nit)
        );
        return idMatch || nameMatch || nitMatch;
      };

      const matchesMonth = (h) => {
        const hDate = new Date(h.closedAt || h.createdAt || Date.now());
        return hDate.getMonth() === month && hDate.getFullYear() === year;
      };

      const isFirstQuincena = (h) => {
        const pt = String(h.periodType || '').toLowerCase();
        return pt === '1ra' || pt.startsWith('1ra');
      };

      // Solo 1ra quincena del mismo mes; preferir cerrada
      let histories1ra = historySource.filter(h =>
        isFirstQuincena(h)
        && matchesMonth(h)
        && matchesCompanies(h)
      );

      // Prefer cerrada over auditoria; then most recent
      histories1ra = histories1ra.sort((a, b) => {
        const statusScore = (s) => (s === 'cerrada' ? 2 : s === 'auditoria' ? 1 : 0);
        const ds = statusScore(b.status) - statusScore(a.status);
        if (ds !== 0) return ds;
        return new Date(b.closedAt || b.createdAt || 0) - new Date(a.closedAt || a.createdAt || 0);
      });

      // Use only the best matching history (avoid overwriting with older ones)
      const best = histories1ra[0];
      if (best) {
        let emps = [];
        if (typeof best.data === 'string') {
          try { emps = JSON.parse(best.data); } catch (e) { emps = []; }
        } else if (Array.isArray(best.data)) {
          emps = best.data;
        } else if (typeof best.employees === 'string') {
          try { emps = JSON.parse(best.employees); } catch (e) { emps = []; }
        } else if (Array.isArray(best.employees)) {
          emps = best.employees;
        }

        // El listado del historial suele venir sin data (summary=1); cargar detalle
        if (!Array.isArray(emps) || emps.length === 0) {
          try {
            const detailRes = await fetch(`http://localhost:3000/api/payrolls/${best.id}`, {
              headers: getAuthHeader()
            });
            if (detailRes.ok) {
              const full = await detailRes.json();
              let fullEmps = full.data || full.employees || [];
              if (typeof fullEmps === 'string') {
                try { fullEmps = JSON.parse(fullEmps); } catch { fullEmps = []; }
              }
              if (Array.isArray(fullEmps)) emps = fullEmps;
            }
          } catch (e) {
            console.error('No se pudo cargar detalle de 1ra quincena:', e);
          }
        }

        emps.forEach(emp => {
          const payout = emp.netTotal != null
            ? Number(emp.netTotal)
            : (Number(emp.calculated?.netPayable) || Number(emp.calculated?.net) || 0);
          if (payout) firstQuincenaPayouts[String(emp.id)] = payout;
        });

        if (Object.keys(firstQuincenaPayouts).length === 0) {
          missingAnticipoWarning = true;
        }
      } else {
        missingAnticipoWarning = true;
      }
    }

    const frozenEmployees = employees
      .filter(e => selectedCompanyIds.some(id => String(id) === String(e.empresa_principal)))
      .map(e => {
        const days = periodType === '1ra' ? 15 : 30;
        const baseSalary = Number(e.sueldo_ordinario) || 0;
        const baseFactor = days / 30;
        const igssExempt = !!(e.jubilacion === true || e.jubilacion === 1);

        // Solo Reporte Operativo (APPROVED_MANAGER) alimenta horas/bonos extras
        let qtySimples = 0;
        let qtyDobles = 0;
        let totalBonos = 0;

        const empOpLogs = operationLogs.filter(l => {
          if (String(l.employeeId) !== String(e.id) || l.status !== 'APPROVED_MANAGER') return false;
          if (!isDateInQuincena(l.date, draftRefDate, periodType)) return false;
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

        // 1 normal hour = BaseSalary / 30 / 8 (sobre sueldo mensual)
        const hourlyRate = baseSalary / 30 / 8;
        const simplesQtyTotal = (Number(e.horas_extras_simples) || 0) + qtySimples;
        const doblesQtyTotal = (Number(e.horas_extras_dobles) || 0) + qtyDobles;
        const valSimples = simplesQtyTotal * hourlyRate * 1.5;
        const valDobles = doblesQtyTotal * hourlyRate * 2;

        // Catálogo de bonos / comisiones ya no se auto-aplican
        const appliedBonuses = {};

        // Bantrab del maestro (campo bantrab) + bancos; ambos alimentan la columna Bancos/Bantrab
        const bantrabMensual = (Number(e.bantrab) || 0) + (Number(e.bancos) || 0);
        const vacacionesPeriodo = (Number(e.vacaciones) || 0) * baseFactor;
        const ventasPeriodo = (Number(e.ventas_economicas) || 0) * baseFactor;

        // Base afecta al IGSS: sueldo + hrs extra + bonos/comisiones + otros (sin bono decreto)
        const otrosIngresosVal = Number(e.otro_ingresos) || 0;
        const igssBase = (baseSalary * baseFactor) + valSimples + valDobles + totalBonos
          + otrosIngresosVal + vacacionesPeriodo + ventasPeriodo;
        const igssVal = igssExempt ? 0 : igssBase * CUOTA_LABORAL_RATE;

        // ISR: manda la retención mensual del maestro (como en el Excel); fórmula solo de fallback
        const monthlyIsr = (e.isr !== undefined && e.isr !== null && e.isr !== '')
          ? (Number(e.isr) || 0)
          : calculateMonthlyISR(baseSalary, Number(e.bon_dec_37_2001) || 0);

        return {
          ...e,
          days,
          company: e.company || (companies.find(c => c.id === e.companyId)?.nombre_comercial || ''),
          deductions: {
            igss: igssVal,
            isr: monthlyIsr * baseFactor,
            cafe: 0,
            cell: 0,
            uniform: 0,
            shoes: 0,
            equipo: 0,
            product: 0,
            bancos: bantrabMensual * baseFactor,
            prestamo_empresa: (Number(e.prestamo_empresa) || 0) * baseFactor,
            otros: 0,
            judiciales: (Number(e.judiciales) || 0) * baseFactor,
            seguro: (Number(e.seguro) || 0) * baseFactor,
            parqueo: (Number(e.parqueo) || 0) * baseFactor,
            boleto_de_ornato: (Number(e.boleto_de_ornato) || 0) * baseFactor,
            otros_egresos: ((Number(e.otros_egresos) || 0) + (Number(e.otro_descuentos) || 0)) * baseFactor,
          },
          anticipo1ra: firstQuincenaPayouts[String(e.id)] || firstQuincenaPayouts[e.id] || 0,
          missingAnticipoWarning: periodType === '2da' && missingAnticipoWarning,
          extras: {
            bonos: totalBonos,
            simplesQty: simplesQtyTotal,
            simplesVal: valSimples,
            doblesQty: doblesQtyTotal,
            doblesVal: valDobles,
            comisiones: 0,
            otrosIngresos: otrosIngresosVal,
            vacacionesVal: vacacionesPeriodo,
            ventasEconomicas: ventasPeriodo,
          },
          operationLogs: empOpLogs,
          appliedBonuses
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
      employees: frozenEmployees,
      missingAnticipoWarning: periodType === '2da' && missingAnticipoWarning
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
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'No se pudo crear el borrador de nómina');
      }
    } catch(e) {
      throw e;
    }
  };

  const updateActivePayroll = async (id, newEmployeesData) => {
    try {
      const draftToUpdate = activePayrolls.find(p => p.id === id);
      if (draftToUpdate?.isApproved) return;
      const periodType = draftToUpdate ? draftToUpdate.periodType : 'mensual';
      const oldEmployees = draftToUpdate ? draftToUpdate.employees : [];

      // Find exactly which employees changed by comparing object references
      const changedEmployees = newEmployeesData.filter(newEmp => {
        const oldEmp = oldEmployees.find(e => e.id === newEmp.id);
        return newEmp !== oldEmp; 
      });

      // If we couldn't find any (e.g. initial load) or there are changes, we send those.
      // Otherwise we fallback to sending everything (shouldn't happen on edits).
      const employeesToCalculate = changedEmployees.length > 0 ? changedEmployees : newEmployeesData;

      // 1. Fetch exact calculations from the backend engine only for changed employees
      const previewRes = await fetch('http://localhost:3000/api/calculator/preview', {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ employees: employeesToCalculate, periodType })
      });

      let calculatedEmployees = newEmployeesData;
      if (previewRes.ok) {
        const calculatedResults = await previewRes.json();
        
        // Merge the newly calculated rows back into the full list
        calculatedEmployees = newEmployeesData.map(emp => {
          const calcEmp = calculatedResults.find(c => c.id === emp.id);
          return calcEmp ? calcEmp : emp;
        });
      }

      // 2. Update React state immediately for UI response
      const updatedDrafts = activePayrolls.map(p => p.id === id ? { ...p, employees: calculatedEmployees } : p);
      setActivePayrolls(updatedDrafts);

      const draft = updatedDrafts.find(p => p.id === id);
      if (draft) {
        // 3. Clear existing timeout for this draft
        if (saveTimeouts.current[id]) {
          clearTimeout(saveTimeouts.current[id]);
        }
        
        // 4. Set a new timeout to persist to the database after 1.5 seconds of inactivity
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
  } catch(err) {
    console.error("Error in updateActivePayroll:", err);
  }
};
  const updateDraftMetadata = async (id, title, companiesPayload, createdAt, periodType) => {
    const rawCompanies = Array.isArray(companiesPayload) ? companiesPayload : [];
    const hasAllToken = rawCompanies.some(c => {
      const s = String(c ?? '').trim().toLowerCase();
      return !s || s === 'all' || s === 'todas' || s === 'todas las empresas';
    });
    if (rawCompanies.length !== 1 || hasAllToken) {
      throw new Error('Debe seleccionar una empresa específica. Las nóminas se procesan empresa por empresa.');
    }

    const resolved = rawCompanies.map(name => {
      const comp = companies.find(c => (c.nombre_comercial || c.nit) === name || c.id?.toString() === name);
      return comp ? comp.id : name;
    });

    const updatedDrafts = activePayrolls.map(p => p.id === id ? { ...p, title, companies: resolved, createdAt, periodType } : p);
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
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.error || 'No se pudo actualizar el borrador');
        }
      } catch(e) {
        throw e;
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
      let draftCompanies = draft.companies || [];
      if (typeof draftCompanies === 'string') {
        try { draftCompanies = JSON.parse(draftCompanies); } catch { draftCompanies = []; }
      }
      const hasAllToken = (Array.isArray(draftCompanies) ? draftCompanies : []).some(c => {
        const s = String(c ?? '').trim().toLowerCase();
        return !s || s === 'all' || s === 'todas' || s === 'todas las empresas';
      });
      if (!Array.isArray(draftCompanies) || draftCompanies.length !== 1 || hasAllToken) {
        return {
          success: false,
          error: 'No se puede cerrar una nómina sin una empresa específica. Las nóminas se procesan empresa por empresa.'
        };
      }

      // Calculate totals for history view
      let grossTotal = 0;
      let dedTotal = 0;
      const logsToProcess = [];

      draft.employees.forEach(e => {
        // Read values exactly as computed by the backend engine
        const gross = e.calculated?.gross || 0;
        const ded = e.calculated?.ded || 0;
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
        companies: draftCompanies,
        status: draft.isApproved ? 'cerrada' : 'auditoria',
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

        const saved = await res.json();
        const { data: _fullData, ...listEntry } = saved;
        setPayrollHistory([listEntry, ...payrollHistory.filter((p) => p.id !== saved.id)]);
        deleteActivePayroll(id);

        // Mark operation logs as PROCESSED_PAYROLL with periodAssigned
        if (logsToProcess.length > 0) {
          const periodLabel = saved.id || historyRecord.id;
          await Promise.all(logsToProcess.map(logId => 
            updateOperationLogStatus(logId, 'PROCESSED_PAYROLL', periodLabel)
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

  const auditorApprovePayroll = async (id) => {
    try {
      const response = await fetch(`http://localhost:3000/api/payrolls/${id}/auditor-approve`, {
        method: 'POST',
        headers: getAuthHeader()
      });
      if (!response.ok) throw new Error('Error al aprobar nómina');
      await fetchActivePayrolls();
      await fetchPayrollHistory();
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const auditorRejectPayroll = async (id, note) => {
    try {
      const response = await fetch(`http://localhost:3000/api/payrolls/${id}/auditor-reject`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ note })
      });
      if (!response.ok) throw new Error('Error al rechazar nómina');
      await fetchActivePayrolls();
      await fetchPayrollHistory();
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const activeAreas = useMemo(
    () => areas.filter(a => String(a.id_estado) === '1' || a.id_estado === undefined),
    [areas]
  );
  const activeDivisions = useMemo(
    () => divisions.filter(d => String(d.id_estado) === '1' || d.id_estado === undefined),
    [divisions]
  );
  const activeSubdivisions = useMemo(
    () => subdivisions.filter(s => String(s.id_estado) === '1' || s.id_estado === undefined),
    [subdivisions]
  );
  const activeDimension5s = useMemo(
    () => dimension5s.filter(d => String(d.id_estado) === '1' || d.id_estado === undefined),
    [dimension5s]
  );

  const contextValue = useMemo(() => ({
      companies, 
      departments, 
      employees, 
      bonuses, 
      commissions, 
      payrollHistory, 
      areas: activeAreas, 
      divisions: activeDivisions, 
      subdivisions: activeSubdivisions, 
      dimension5s: activeDimension5s, 
      isLoading,
      addCompany, updateCompany, deleteCompany,
      addDepartment, updateDepartment, deleteDepartment,
      addArea, updateArea, deleteArea,
      addDivision, updateDivision, deleteDivision,
      addSubdivision, updateSubdivision, deleteSubdivision,
      addDimension5, updateDimension5, deleteDimension5,
      addEmployee, updateEmployee, deleteEmployee, setAllEmployees,
      addEmployeeRecord, updateEmployeeRecord, deleteEmployeeRecord,
      addBonus, updateBonus, deleteBonus,
      addCommission, updateCommission, deleteCommission,
      operationLogs, addOperationLog, updateOperationLogStatus, deleteOperationLog, updateOperationLog,
      injectApprovedLogIntoActiveDrafts, revertLogFromActiveDrafts,
      activePayrolls, createActivePayroll, updateActivePayroll, updateDraftMetadata, deleteActivePayroll, closePayroll,
      savePayroll, deletePayroll, auditorApprovePayroll, auditorRejectPayroll, fetchPayrollHistory, fetchActivePayrolls
  }), [
    companies, departments, employees, bonuses, commissions, payrollHistory,
    activeAreas, activeDivisions, activeSubdivisions, activeDimension5s, isLoading,
    operationLogs, activePayrolls
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}
