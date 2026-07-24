import React, { createContext, useState, useEffect, useRef, useContext, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import {
  isDateInQuincena,
  parseLocalDate,
  formatLocalDateKey,
  toPayrollDateISO
} from '../utils/payrollPeriod';
import { getCuotaLaboralRate, getRecurringDeductionFactor } from '../utils/payrollCalculator';
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
  const draftSyncChains = useRef(new Map());
  const draftSyncRevisions = useRef(new Map());
  const draftServerRevisions = useRef(new Map());
  const draftConflictIds = useRef(new Set());
  const deletingDraftIds = useRef(new Set());
  const draftRefreshTask = useRef(null);
  const pendingDraftSaves = useRef(new Map());
  const persistTimer = useRef(null);
  const persistSnapshot = useRef({});

  const rememberDraftServerRevisions = (drafts) => {
    (Array.isArray(drafts) ? drafts : []).forEach((draft) => {
      const key = String(draft?.id ?? '');
      const revision = Number(draft?.revision);
      if (!key || !Number.isInteger(revision) || revision < 0) return;
      draftServerRevisions.current.set(key, revision);
      draftConflictIds.current.delete(key);
    });
  };

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
          compRes, empRes, deptRes, areaRes, divRes, subdivRes, dim5Res,
          draftsRes, bonusesRes, commissionsRes, opLogsRes
        ] = await Promise.all([
          fetch('http://localhost:3000/api/companies', fetchOpts),
          fetch('http://localhost:3000/api/employees', fetchOpts),
          fetch('http://localhost:3000/api/departments', fetchOpts),
          fetch('http://localhost:3000/api/areas', fetchOpts),
          fetch('http://localhost:3000/api/divisions', fetchOpts),
          fetch('http://localhost:3000/api/subdivisions', fetchOpts),
          fetch('http://localhost:3000/api/dimension5', fetchOpts),
          fetch('http://localhost:3000/api/payroll-drafts', fetchOpts),
          fetch('http://localhost:3000/api/bonuses', fetchOpts),
          fetch('http://localhost:3000/api/commissions', fetchOpts),
          fetch('http://localhost:3000/api/operation-logs', fetchOpts),
        ]);

        const [
          apiCompanies, apiEmployees, apiDepts, apiAreas, apiDivs, apiSubdivs,
          apiDim5s, apiDrafts, apiBonuses, apiCommissions, apiOperationLogs
        ] = await Promise.all([
          safeJson(compRes), safeJson(empRes), safeJson(deptRes), safeJson(areaRes),
          safeJson(divRes), safeJson(subdivRes), safeJson(dim5Res), safeJson(draftsRes),
          safeJson(bonusesRes), safeJson(commissionsRes), safeJson(opLogsRes)
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
        if (Array.isArray(apiDrafts)) {
          rememberDraftServerRevisions(apiDrafts);
          setActivePayrolls(parseDrafts(apiDrafts));
        }
        if (Array.isArray(apiBonuses)) setBonuses(apiBonuses);
        if (Array.isArray(apiCommissions)) setCommissions(apiCommissions);
        if (Array.isArray(apiOperationLogs)) setOperationLogs(apiOperationLogs);
        setIsLoading(false);

        // Historial en segundo plano (payload grande)
        const deferHeavy = async () => {
          try {
            const histRes = await fetch('http://localhost:3000/api/payrolls', fetchOpts);
            const apiHistory = await safeJson(histRes);
            if (cancelled) return;
            if (Array.isArray(apiHistory)) setPayrollHistory(apiHistory);
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
      const res = await fetch('http://localhost:3000/api/payrolls', { headers: getAuthHeader() });
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
        if (Array.isArray(apiDrafts)) {
          rememberDraftServerRevisions(apiDrafts);
          setActivePayrolls(parseDrafts(apiDrafts));
        }
      }
    } catch (err) {
      console.error('fetchActivePayrolls:', err);
    }
  };

  // Agrupa refrescos solicitados por altas/aprobaciones masivas en el mismo tick.
  const refreshDraftsAfterPayrollInput = () => {
    if (draftRefreshTask.current) return draftRefreshTask.current;
    draftRefreshTask.current = Promise.resolve()
      .then(fetchActivePayrolls)
      .finally(() => {
        draftRefreshTask.current = null;
      });
    return draftRefreshTask.current;
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
    await flushPendingDraftSaves();
    const res = await fetch('http://localhost:3000/api/commissions', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(comm)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'No se pudo guardar la solicitud.');
    }
    const newC = await res.json();
    setCommissions((current) => [...current, newC]);
    await refreshDraftsAfterPayrollInput();
    return newC;
  };

  const updateCommission = async (id, data) => {
    await flushPendingDraftSaves();
    const res = await fetch(`http://localhost:3000/api/commissions/${id}`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'No se pudo actualizar la solicitud.');
    }
    const updated = await res.json();
    setCommissions((current) => current.map(
      c => String(c.id) === String(id) ? updated : c
    ));
    await refreshDraftsAfterPayrollInput();
    return updated;
  };

  const deleteCommission = async (id) => {
    await flushPendingDraftSaves();
    const res = await fetch(`http://localhost:3000/api/commissions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'No se pudo eliminar la solicitud.');
    }
    setCommissions((current) => current.filter(
      c => String(c.id) !== String(id)
    ));
    await refreshDraftsAfterPayrollInput();
  };

  const bumpDraftSyncRevision = (draftId) => {
    const key = String(draftId);
    const nextRevision = (draftSyncRevisions.current.get(key) || 0) + 1;
    draftSyncRevisions.current.set(key, nextRevision);
    return nextRevision;
  };

  /**
   * Serializa los PUT completos por borrador. Varias aprobaciones o cambios
   * consecutivos pueden producir snapshots acumulativos; nunca deben llegar
   * fuera de orden ni permitir que una respuesta antigua reemplace la UI.
   */
  const persistDraftPatch = (
    draft,
    requestedRevision = null,
    expectedRevisionOverride = null
  ) => {
    const key = String(draft?.id ?? '');
    if (!key) return Promise.resolve(null);
    if (deletingDraftIds.current.has(key) || draftConflictIds.current.has(key)) {
      return Promise.resolve(null);
    }

    const revision = requestedRevision ?? bumpDraftSyncRevision(key);
    const snapshot = JSON.parse(JSON.stringify(draft));
    const snapshotRevision = Number(snapshot.revision);
    const overrideRevision = Number(expectedRevisionOverride);
    const capturedServerRevision = Number.isInteger(overrideRevision)
      ? overrideRevision
      : (
          Number.isInteger(snapshotRevision)
            ? snapshotRevision
            : (draftServerRevisions.current.get(key) ?? 0)
        );
    const previousTask = draftSyncChains.current.get(key) || Promise.resolve();

    const task = previousTask
      .catch(() => null)
      .then(async (previousSaved) => {
        // Si todavía no comenzó y ya existe un snapshot posterior, se agrupa.
        if (draftSyncRevisions.current.get(key) !== revision) return null;
        if (deletingDraftIds.current.has(key) || draftConflictIds.current.has(key)) return null;

        try {
          // Solo una escritura local anterior de esta misma cola puede
          // rebasar el snapshot. Un refresco externo nunca debe convertir un
          // snapshot viejo en una escritura válida contra una revisión nueva.
          const previousSavedRevision = Number(previousSaved?.revision);
          const expectedServerRevision = Number.isInteger(previousSavedRevision)
            ? previousSavedRevision
            : capturedServerRevision;
          const response = await fetch(`http://localhost:3000/api/payroll-drafts/${key}`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify({
              ...snapshot,
              revision: expectedServerRevision
            }),
          });
          if (response.status === 409) {
            const body = await response.json().catch(() => ({}));
            const currentRevision = Number(body.currentRevision);
            if (Number.isInteger(currentRevision) && currentRevision >= 0) {
              draftServerRevisions.current.set(key, currentRevision);
            }
            draftConflictIds.current.add(key);
            console.error(
              'El borrador cambió en otra pestaña o sesión. Debe recargarse antes de guardar.',
              body.error || ''
            );
            return null;
          }
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || `HTTP ${response.status}`);
          }
          const saved = await response.json();
          const savedRevision = Number(saved?.revision);
          if (Number.isInteger(savedRevision) && savedRevision >= 0) {
            draftServerRevisions.current.set(key, savedRevision);
            const pending = pendingDraftSaves.current.get(key);
            if (
              pending
              && pending.localRevision > revision
              && Number(pending.serverRevision) === expectedServerRevision
            ) {
              // El snapshot pendiente nació sobre esta escritura local. Puede
              // continuar desde la revisión confirmada sin aceptar cambios
              // provenientes de otra pestaña.
              pendingDraftSaves.current.set(key, {
                ...pending,
                serverRevision: savedRevision
              });
            }
          }
          draftConflictIds.current.delete(key);

          // Solo la respuesta del snapshot vigente puede actualizar la UI.
          if (draftSyncRevisions.current.get(key) === revision) {
            setActivePayrolls((current) => current.map((row) => (
              String(row.id) === key
                ? {
                    ...row,
                    ...saved,
                    employees: saved.employees || row.employees
                  }
                : row
            )));
          }
          return saved;
        } catch (error) {
          console.error('No se pudo recalcular/persistir el borrador:', error);
          return null;
        }
      });

    let trackedTask;
    trackedTask = task.finally(() => {
      if (draftSyncChains.current.get(key) === trackedTask) {
        draftSyncChains.current.delete(key);
      }
    });
    draftSyncChains.current.set(key, trackedTask);
    return trackedTask;
  };

  const flushPendingDraftSaves = async () => {
    let failed = false;

    // Normalmente basta una vuelta. La segunda cubre una edición que haya
    // entrado mientras se esperaba una escritura ya iniciada.
    for (let round = 0; round < 2; round += 1) {
      const pending = [...pendingDraftSaves.current.entries()];
      pendingDraftSaves.current.clear();

      const started = pending.map(([key, item]) => {
        if (saveTimeouts.current[key]) {
          clearTimeout(saveTimeouts.current[key]);
          delete saveTimeouts.current[key];
        }
        return persistDraftPatch(
          item.draft,
          item.localRevision,
          item.serverRevision
        );
      });
      const inFlight = [...draftSyncChains.current.values()];
      const results = await Promise.all([...started, ...inFlight]);
      if (results.some((result) => result === null)) failed = true;
      if (pendingDraftSaves.current.size === 0) break;
    }

    if (failed || draftConflictIds.current.size > 0) {
      throw new Error(
        'Una nómina cambió en otra pestaña o sesión. Recárguela y revise los datos antes de continuar.'
      );
    }
  };

  // Las APIs de novedades actualizan el borrador dentro de su propia
  // transacción. Estos alias solo refrescan la copia visible del servidor.
  const injectApprovedLogIntoActiveDrafts = () => refreshDraftsAfterPayrollInput();
  const revertLogFromActiveDrafts = () => refreshDraftsAfterPayrollInput();

  const addOperationLog = async (data) => {
    await flushPendingDraftSaves();
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
      await refreshDraftsAfterPayrollInput();
    }
    return newLog;
  };

  const updateOperationLogStatus = async (id, status, periodAssigned = null, justification = null, rejectionFromNomina = false, logSnapshot = null) => {
    await flushPendingDraftSaves();
    const res = await fetch(`http://localhost:3000/api/operation-logs/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeader(),
      body: JSON.stringify({ status, periodAssigned, justification, rejectionFromNomina }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Error al actualizar estado');
    }

    const updatedLog = await res.json();
    const prevLog = logSnapshot
      || operationLogs.find((log) => String(log.id) === String(id))
      || null;
    setOperationLogs((prev) => prev.map((log) => (
      String(log.id) === String(id) ? { ...log, ...updatedLog } : log
    )));

    const changedPayrollInput = (
      status === 'APPROVED_MANAGER'
      || (
        prevLog?.status === 'APPROVED_MANAGER'
        && status !== 'APPROVED_MANAGER'
        && status !== 'PROCESSED_PAYROLL'
      )
    );
    if (changedPayrollInput) {
      await refreshDraftsAfterPayrollInput();
    }
    return updatedLog;
  };

  const deleteOperationLog = async (id) => {
    await flushPendingDraftSaves();
    const prevLog = operationLogs.find((l) => String(l.id) === String(id));
    const res = await fetch(`http://localhost:3000/api/operation-logs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || 'Error al eliminar');
    }
    setOperationLogs((prev) => prev.filter((l) => String(l.id) !== String(id)));
    if (prevLog?.status === 'APPROVED_MANAGER') {
      await refreshDraftsAfterPayrollInput();
    }
  };

  const updateOperationLog = async (id, data) => {
    await flushPendingDraftSaves();
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
    setOperationLogs((prev) => prev.map((l) => (String(l.id) === String(id) ? updatedLog : l)));
    if (
      prevLog?.status === 'APPROVED_MANAGER'
      || updatedLog.status === 'APPROVED_MANAGER'
    ) {
      await refreshDraftsAfterPayrollInput();
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
  const createActivePayroll = async (
    title,
    selectedCompanies,
    periodType = '1ra',
    draftDateStr = null,
    notes = null
  ) => {
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
    const isInPayrollInputWindow = (dateValue) => {
      if (!dateValue) return false;
      if (periodType !== '2da') {
        return isDateInQuincena(dateValue, draftRefDate, periodType);
      }
      // 2ª es el acumulado mensual. Los registros de 1–15 ya procesados
      // tienen otro estado y no se duplican; los aprobados tarde sí deben entrar.
      const inputDate = parseLocalDate(dateValue);
      const referenceDate = parseLocalDate(draftRefDate);
      return inputDate.getFullYear() === referenceDate.getFullYear()
        && inputDate.getMonth() === referenceDate.getMonth();
    };

    // If 2nd quincena, find 1st quincena payouts + ISR (prefer cerrada, most recent)
    let firstQuincenaPayouts = {};
    let firstQuincenaIsr = {};
    let firstQuincenaExtras = {};
    let firstQuincenaAppliedBonuses = {};
    let firstQuincenaOperationLogs = {};
    let firstQuincenaDays = {};
    let firstQuincenaIncidences = {};
    let firstQuincenaEmployees = {};
    let firstQuincenaCommissionIds = {};
    let missingAnticipoWarning = false;
    if (periodType === '2da') {
      // Refrescar historial para no perder 1ras recién cerradas
      let historySource = payrollHistory;
      try {
        const histRes = await fetch('http://localhost:3000/api/payrolls', { headers: getAuthHeader() });
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

      const targetDate = parseLocalDate(draftRefDate);
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
        const hDate = parseLocalDate(h.createdAt || h.closedAt || Date.now());
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
        && h.status === 'cerrada'
      );

      // La 2ª solo puede tomar una 1ª cerrada y definitiva.
      histories1ra = histories1ra.sort((a, b) => {
        return new Date(b.createdAt || b.closedAt || 0) - new Date(a.createdAt || a.closedAt || 0);
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
          firstQuincenaEmployees[String(emp.id)] = emp;
          const payout = emp.netTotal != null
            ? Number(emp.netTotal)
            : (Number(emp.calculated?.netPayable) || Number(emp.calculated?.net) || 0);
          firstQuincenaPayouts[String(emp.id)] = payout;

          const isr1raPaid = Number(
            emp.calculated?.proratedDeductions?.isr
            ?? emp.deductions?.isr
            ?? 0
          ) || 0;
          if (isr1raPaid || firstQuincenaIsr[String(emp.id)] == null) {
            firstQuincenaIsr[String(emp.id)] = isr1raPaid;
          }

          const firstExtras = emp.extras || {};
          firstQuincenaExtras[String(emp.id)] = {
            bonos: Number(firstExtras.bonos) || 0,
            simplesQty: Number(firstExtras.simplesQty) || 0,
            simplesVal: Number(firstExtras.simplesVal) || 0,
            doblesQty: Number(firstExtras.doblesQty) || 0,
            doblesVal: Number(firstExtras.doblesVal) || 0,
            comisiones: Number(firstExtras.comisiones) || 0
          };
          firstQuincenaAppliedBonuses[String(emp.id)] = {
            ...(emp.appliedBonuses || {})
          };
          firstQuincenaDays[String(emp.id)] = Number(
            emp.days === undefined || emp.days === null || emp.days === ''
              ? 15
              : emp.days
          );
          firstQuincenaIncidences[String(emp.id)] = (
            Array.isArray(emp.incidences) ? emp.incidences : []
          ).map(incidence => ({
            ...incidence,
            carriedFromFirstQuincena: true,
            periodOrigin: '1ra'
          }));
          firstQuincenaOperationLogs[String(emp.id)] = (Array.isArray(emp.operationLogs)
            ? emp.operationLogs
            : []
          ).map(log => ({
            ...log,
            carriedFromFirstQuincena: true,
            periodOrigin: '1ra'
          }));
          firstQuincenaCommissionIds[String(emp.id)] = Array.isArray(emp.commissionIds)
            ? emp.commissionIds
            : [];
        });

        if (emps.length === 0) {
          missingAnticipoWarning = true;
        }
      } else {
        missingAnticipoWarning = true;
      }
    }

    const isActiveEmployee = (employee) => {
      const status = String(employee?.estado || employee?.status || 'ACTIVO')
        .trim()
        .toUpperCase();
      return status === 'ACTIVO' || status === 'ACTIVE';
    };
    const belongsToSelectedCompany = (employee) => selectedCompanyIds.some(
      id => String(id) === String(employee?.empresa_principal ?? employee?.companyId)
    );

    // En 2ª la nómina es acumulada: deben sobrevivir quienes cobraron en la
    // 1ª aunque hayan sido dados de baja (o ya no estén en el maestro).
    const employeeSources = periodType === '2da'
      ? (() => {
          const merged = new Map();
          employees.forEach((current) => {
            if (!belongsToSelectedCompany(current)) return;
            const first = firstQuincenaEmployees[String(current.id)];
            if (!isActiveEmployee(current) && !first) return;
            merged.set(String(current.id), {
              ...(first || {}),
              ...current,
              _hasCurrentMaster: true
            });
          });
          Object.values(firstQuincenaEmployees).forEach((first) => {
            if (!belongsToSelectedCompany(first) || merged.has(String(first.id))) return;
            merged.set(String(first.id), { ...first, _hasCurrentMaster: false });
          });
          return [...merged.values()];
        })()
      : employees
          .filter(e => isActiveEmployee(e) && belongsToSelectedCompany(e))
          .map(e => ({ ...e, _hasCurrentMaster: true }));

    const payrollMonth = parseLocalDate(draftRefDate);
    const employmentDaysInRange = (
      employee,
      startDay,
      endDay,
      allowOpenEnded
    ) => {
      let firstDay = startDay;
      let lastDay = endDay;
      const startDate = employee?.fecha_inicio
        ? parseLocalDate(employee.fecha_inicio)
        : null;
      const endDate = employee?.fecha_baja
        ? parseLocalDate(employee.fecha_baja)
        : null;
      const samePayrollMonth = date => (
        date
        && date.getFullYear() === payrollMonth.getFullYear()
        && date.getMonth() === payrollMonth.getMonth()
      );

      if (startDate) {
        const startsAfterMonth = (
          startDate.getFullYear() > payrollMonth.getFullYear()
          || (
            startDate.getFullYear() === payrollMonth.getFullYear()
            && startDate.getMonth() > payrollMonth.getMonth()
          )
        );
        if (startsAfterMonth) return 0;
        if (samePayrollMonth(startDate)) firstDay = Math.max(firstDay, Math.min(30, startDate.getDate()));
      }

      if (endDate) {
        const endedBeforeMonth = (
          endDate.getFullYear() < payrollMonth.getFullYear()
          || (
            endDate.getFullYear() === payrollMonth.getFullYear()
            && endDate.getMonth() < payrollMonth.getMonth()
          )
        );
        if (endedBeforeMonth) return 0;
        if (samePayrollMonth(endDate)) lastDay = Math.min(lastDay, Math.min(30, endDate.getDate()));
      } else if (!allowOpenEnded) {
        return 0;
      }

      return Math.max(0, lastDay - firstDay + 1);
    };

    const frozenEmployees = employeeSources
      .map(e => {
        const firstDaysKey = String(e.id);
        const hasFirstDays = Object.prototype.hasOwnProperty.call(
          firstQuincenaDays,
          firstDaysKey
        );
        const currentlyActive = e._hasCurrentMaster && isActiveEmployee(e);
        const periodDays = periodType === '1ra'
          ? employmentDaysInRange(e, 1, 15, true)
          : employmentDaysInRange(
              e,
              hasFirstDays ? 16 : 1,
              30,
              currentlyActive
            );
        const days = periodType === '1ra'
          ? periodDays
          : Math.min(
              30,
              Math.max(
                0,
                (hasFirstDays ? firstQuincenaDays[firstDaysKey] : 0) + periodDays
              )
            );
        // Una alta futura que no estaba en la 1ª no debe entrar con salario Q0
        // y media cuota de deducciones. Un snapshot heredado sí se conserva.
        if (days === 0 && !hasFirstDays) return null;
        const baseSalary = Number(e.sueldo_ordinario) || 0;
        const baseFactor = days / 30;
        const recurringDeductionFactor = getRecurringDeductionFactor(days);
        const laboralRate = getCuotaLaboralRate(e);

        // Reporte Operativo y registros de comisiones pendientes alimentan
        // horas/bonos extras de la quincena.
        let qtySimples = 0;
        let qtyDobles = 0;
        let totalBonos = 0;

        const draftMonthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        const draftMonthName = draftMonthNames[parseLocalDate(draftRefDate).getMonth()];
        const empCommissions = commissions.filter((commission) => {
          if (String(commission.employee_id) !== String(e.id)) return false;
          if (String(commission.estado || '').trim().toLowerCase() === 'aplicado') return false;
          if (
            commission.empresa_id
            && !selectedCompanyIds.some(id => String(id) === String(commission.empresa_id))
          ) {
            return false;
          }
          return commission.fecha
            ? isInPayrollInputWindow(commission.fecha)
            : String(commission.mes || '').trim().toLowerCase()
              === draftMonthName.toLowerCase();
        });
        empCommissions.forEach((commission) => {
          totalBonos += Number(commission.monto_bono) || 0;
          const hours = Number(commission.horas) || 0;
          if (String(commission.tipo_hora || '').trim().toUpperCase() === 'D') {
            qtySimples += hours;
          } else if (String(commission.tipo_hora || '').trim().toUpperCase() === 'N') {
            qtyDobles += hours;
          }
        });

        const empOpLogs = operationLogs.filter(l => {
          if (String(l.employeeId) !== String(e.id) || l.status !== 'APPROVED_MANAGER') return false;
          if (!isInPayrollInputWindow(l.date)) return false;
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
        const carriedExtras = periodType === '2da'
          ? firstQuincenaExtras[String(e.id)]
          : null;
        const carriedSimplesQty = carriedExtras
          ? (Number(carriedExtras.simplesQty) || 0)
          : (Number(e.horas_extras_simples) || 0);
        const carriedDoblesQty = carriedExtras
          ? (Number(carriedExtras.doblesQty) || 0)
          : (Number(e.horas_extras_dobles) || 0);
        const carriedSimplesVal = carriedExtras
          ? (Number(carriedExtras.simplesVal) || 0)
          : carriedSimplesQty * hourlyRate * 1.5;
        const carriedDoblesVal = carriedExtras
          ? (Number(carriedExtras.doblesVal) || 0)
          : carriedDoblesQty * hourlyRate * 2;
        const simplesQtyTotal = carriedSimplesQty + qtySimples;
        const doblesQtyTotal = carriedDoblesQty + qtyDobles;
        const valSimples = carriedSimplesVal + (qtySimples * hourlyRate * 1.5);
        const valDobles = carriedDoblesVal + (qtyDobles * hourlyRate * 2);
        const bonosAcumulados = (Number(carriedExtras?.bonos) || 0) + totalBonos;

        // Bonos del catálogo: se autoaplican por fecha/asignación. La segunda
        // quincena es acumulada y conserva también los aplicados en la primera.
        const periodAppliedBonuses = bonuses.reduce((assigned, bonus) => {
          if (!isDateInQuincena(bonus.date, draftRefDate, periodType)) return assigned;
          const assignments = bonus.assignments || {};
          const rawAmount = assignments[String(e.id)] ?? assignments[e.id];
          if (rawAmount === undefined || rawAmount === null || rawAmount === '') return assigned;
          const amount = Number(rawAmount);
          if (!Number.isFinite(amount) || amount === 0) return assigned;
          assigned[String(bonus.id)] = amount;
          return assigned;
        }, {});
        const appliedBonuses = periodType === '2da'
          ? {
              ...(firstQuincenaAppliedBonuses[String(e.id)] || {}),
              ...periodAppliedBonuses
            }
          : periodAppliedBonuses;
        const carriedOperationLogs = periodType === '2da'
          ? (firstQuincenaOperationLogs[String(e.id)] || [])
          : [];
        const combinedOperationLogs = [
          ...carriedOperationLogs,
          ...empOpLogs.map(log => ({ ...log, periodOrigin: periodType }))
        ].filter((log, index, all) => (
          all.findIndex(candidate => String(candidate.id) === String(log.id)) === index
        ));
        const combinedIncidences = periodType === '2da'
          ? [
              ...(firstQuincenaIncidences[String(e.id)] || []),
              ...(Array.isArray(e.incidences) ? e.incidences : [])
            ].filter((incidence, index, all) => (
              all.findIndex(candidate => String(candidate.id) === String(incidence.id)) === index
            ))
          : e.incidences;

        // Bantrab del maestro (campo bantrab) + bancos; ambos alimentan la columna Bancos/Bantrab
        const bantrabMensual = (Number(e.bantrab) || 0) + (Number(e.bancos) || 0);
        const vacacionesPeriodo = (Number(e.vacaciones) || 0) * baseFactor;
        const ventasPeriodo = (Number(e.ventas_economicas) || 0) * baseFactor;

        // Base afecta al IGSS: sueldo + horas extra + otros; bonos fuera de la base.
        const otrosIngresosVal = Number(e.otro_ingresos) || 0;
        const igssBase = (baseSalary * baseFactor) + valSimples + valDobles
          + otrosIngresosVal + vacacionesPeriodo + ventasPeriodo;
        const igssVal = laboralRate === 0 ? 0 : igssBase * laboralRate;

        // ISR: manda la retención mensual del maestro (como en el Excel); fórmula solo de fallback
        const monthlyIsr = (e.isr !== undefined && e.isr !== null && e.isr !== '')
          ? (Number(e.isr) || 0)
          : calculateMonthlyISR(
            baseSalary,
            Number(e.bon_dec_37_2001) || 0,
            laboralRate
          );

        // El Excel descuenta mitad con <=15 días y el total mensual con >15.
        // En 2ª no se resta ISR 1ª aquí: el anticipo neto se resta al final.
        const isr1ra = periodType === '2da'
          ? (Number(firstQuincenaIsr[String(e.id)] ?? firstQuincenaIsr[e.id]) || 0)
          : 0;
        const totalIsr = periodType === '2da' ? monthlyIsr : undefined;
        const periodIsr = Number((monthlyIsr * recurringDeductionFactor).toFixed(2));

        const { _hasCurrentMaster, ...employeeSnapshot } = e;
        return {
          ...employeeSnapshot,
          days,
          company: e.company || (companies.find(c => c.id === e.companyId)?.nombre_comercial || ''),
          ...(periodType === '2da' ? { totalIsr, isr1ra } : {}),
          deductions: {
            igss: igssVal,
            isr: periodIsr,
            cafe: 0,
            cell: 0,
            uniform: 0,
            shoes: 0,
            equipo: 0,
            product: 0,
            bancos: bantrabMensual * recurringDeductionFactor,
            prestamo_empresa: (Number(e.prestamo_empresa) || 0) * recurringDeductionFactor,
            otros: 0,
            judiciales: (Number(e.judiciales) || 0) * recurringDeductionFactor,
            seguro: (Number(e.seguro) || 0) * recurringDeductionFactor,
            parqueo: (Number(e.parqueo) || 0) * recurringDeductionFactor,
            boleto_de_ornato: (Number(e.boleto_de_ornato) || 0) * recurringDeductionFactor,
            otros_egresos: ((Number(e.otros_egresos) || 0) + (Number(e.otro_descuentos) || 0)) * recurringDeductionFactor,
          },
          anticipo1ra: firstQuincenaPayouts[String(e.id)] || firstQuincenaPayouts[e.id] || 0,
          missingAnticipoWarning: periodType === '2da' && missingAnticipoWarning,
          extras: {
            bonos: bonosAcumulados,
            simplesQty: simplesQtyTotal,
            simplesVal: valSimples,
            doblesQty: doblesQtyTotal,
            doblesVal: valDobles,
            comisiones: Number(carriedExtras?.comisiones) || 0,
            otrosIngresos: otrosIngresosVal,
            vacacionesVal: vacacionesPeriodo,
            ventasEconomicas: ventasPeriodo,
          },
          operationLogs: combinedOperationLogs,
          commissionIds: empCommissions.map(commission => commission.id),
          carriedCommissionIds: periodType === '2da'
            ? (firstQuincenaCommissionIds[String(e.id)] || [])
            : [],
          incidences: combinedIncidences,
          carriedAppliedBonuses: periodType === '2da'
            ? (firstQuincenaAppliedBonuses[String(e.id)] || {})
            : {},
          appliedBonuses
        };
      })
      .filter(Boolean);

    if (frozenEmployees.length === 0) {
      throw new Error('No hay empleados registrados cuya empresa principal coincida con la seleccionada.');
    }

    const newDraftData = {
      id: Date.now().toString(),
      title,
      periodType,
      companies: selectedCompanyIds,
      createdAt: draftDateStr ? toPayrollDateISO(draftDateStr) : toPayrollDateISO(),
      employees: frozenEmployees,
      notes,
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
        rememberDraftServerRevisions([savedDraft]);
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
      const draftKey = String(id);
      if (deletingDraftIds.current.has(draftKey)) {
        throw new Error('La nómina se está eliminando y ya no admite cambios.');
      }
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

      if (!previewRes.ok) {
        const errBody = await previewRes.json().catch(() => null);
        throw new Error(errBody?.error || 'El servidor no pudo validar los cálculos de nómina.');
      }
      const calculatedResults = await previewRes.json();

      // Merge the newly calculated rows back into the full list
      const calculatedEmployees = newEmployeesData.map(emp => {
        const calcEmp = calculatedResults.find(c => String(c.id) === String(emp.id));
        return calcEmp ? calcEmp : emp;
      });

      // 2. Update React state immediately for UI response
      const updatedDrafts = activePayrolls.map(p => p.id === id ? { ...p, employees: calculatedEmployees } : p);
      setActivePayrolls(updatedDrafts);

      const draft = updatedDrafts.find(p => p.id === id);
      if (draft) {
        // Invalida cualquier respuesta anterior desde el momento de la edición,
        // aunque este guardado permanezca diferido por 1.5 segundos.
        const revision = bumpDraftSyncRevision(id);
        const draftServerRevision = Number(draft.revision);
        const serverRevision = Number.isInteger(draftServerRevision)
          ? draftServerRevision
          : (draftServerRevisions.current.get(draftKey) ?? 0);
        pendingDraftSaves.current.set(draftKey, {
          draft,
          localRevision: revision,
          serverRevision
        });

        // 3. Clear existing timeout for this draft
        if (saveTimeouts.current[id]) {
          clearTimeout(saveTimeouts.current[id]);
        }
        
        // 4. Set a new timeout to persist to the database after 1.5 seconds of inactivity
        saveTimeouts.current[id] = setTimeout(async () => {
          delete saveTimeouts.current[id];
          const pending = pendingDraftSaves.current.get(draftKey);
          if (!pending || pending.localRevision !== revision) return;
          pendingDraftSaves.current.delete(draftKey);
          await persistDraftPatch(
            pending.draft,
            pending.localRevision,
            pending.serverRevision
          );
        }, 1500);
      }
      return { success: true };
    } catch(err) {
      console.error("Error in updateActivePayroll:", err);
      return { success: false, error: err.message };
    }
  };
  const updateDraftMetadata = async (
    id,
    title,
    companiesPayload,
    createdAt,
    periodType,
    notes
  ) => {
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

    const original = activePayrolls.find(p => p.id === id);
    if (!original) throw new Error('Borrador no encontrado');
    let currentCompanies = original.companies;
    if (typeof currentCompanies === 'string') {
      try { currentCompanies = JSON.parse(currentCompanies); } catch { currentCompanies = []; }
    }
    currentCompanies = (Array.isArray(currentCompanies) ? currentCompanies : []).map(value => {
      const company = companies.find(c =>
        String(c.id) === String(value)
        || c.nombre_comercial === value
        || c.nit === value
      );
      return String(company?.id ?? value);
    });
    const dateKey = value => formatLocalDateKey(value);
    const changesCalculationContext = (
      String(resolved[0]) !== String(currentCompanies[0])
      || String(periodType) !== String(original.periodType)
      || dateKey(createdAt) !== dateKey(original.createdAt)
    );
    if (changesCalculationContext) {
      throw new Error(
        'La empresa, el período y la fecha no pueden cambiarse después de generar el borrador. Cree uno nuevo.'
      );
    }

    const draft = {
      ...original,
      title,
      notes: notes !== undefined ? notes : original.notes
    };
    const saved = await persistDraftPatch(draft);
    if (!saved) throw new Error('No se pudo actualizar el borrador');
  };

  const deleteActivePayroll = async (id) => {
    const key = String(id);
    deletingDraftIds.current.add(key);
    pendingDraftSaves.current.delete(key);
    if (saveTimeouts.current[id]) {
      clearTimeout(saveTimeouts.current[id]);
      delete saveTimeouts.current[id];
    }
    // Invalida respuestas pendientes y espera cualquier PUT que ya esté en vuelo.
    bumpDraftSyncRevision(key);
    const pendingTask = draftSyncChains.current.get(key);
    if (pendingTask) await pendingTask;
    // También descarta una edición iniciada mientras se esperaba el PUT.
    pendingDraftSaves.current.delete(key);
    if (saveTimeouts.current[id]) {
      clearTimeout(saveTimeouts.current[id]);
      delete saveTimeouts.current[id];
    }

    try {
      const response = await fetch(`http://localhost:3000/api/payroll-drafts/${key}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'No se pudo eliminar el borrador');
      }

      setActivePayrolls((current) => current.filter(p => String(p.id) !== key));
      draftSyncChains.current.delete(key);
      draftSyncRevisions.current.delete(key);
      draftServerRevisions.current.delete(key);
      draftConflictIds.current.delete(key);
      pendingDraftSaves.current.delete(key);
    } catch (error) {
      await fetchActivePayrolls();
      throw error;
    } finally {
      deletingDraftIds.current.delete(key);
    }
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
      if (draft.periodType === '2da' && draft.missingAnticipoWarning) {
        return {
          success: false,
          error: 'No se puede cerrar la segunda quincena sin una primera quincena cerrada del mismo mes y empresa.'
        };
      }

      const logsToProcess = [];
      const commissionsToProcess = [];

      draft.employees.forEach(e => {
        if (e.operationLogs) {
          e.operationLogs
            .filter(log => !log.carriedFromFirstQuincena && log.status === 'APPROVED_MANAGER')
            .forEach(log => logsToProcess.push(log.id));
        }
        (Array.isArray(e.commissionIds) ? e.commissionIds : [])
          .forEach(commissionId => commissionsToProcess.push(commissionId));
      });

      try {
        // Vaciar cualquier guardado diferido y persistir el borrador editable.
        // Un aprobado no se toca: el servidor usará exactamente el snapshot
        // que recibió el visto bueno de Auditoría.
        if (saveTimeouts.current[id]) {
          clearTimeout(saveTimeouts.current[id]);
          delete saveTimeouts.current[id];
        }
        let persistedPendingDraft = null;
        const pendingSave = pendingDraftSaves.current.get(String(id));
        if (pendingSave) {
          pendingDraftSaves.current.delete(String(id));
          persistedPendingDraft = await persistDraftPatch(
            pendingSave.draft,
            pendingSave.localRevision,
            pendingSave.serverRevision
          );
          if (!persistedPendingDraft) {
            throw new Error(
              'No se pudo guardar el último cambio de la nómina antes de enviarla.'
            );
          }
        }
        if (!draft.isApproved && !persistedPendingDraft) {
          const persistedDraft = await persistDraftPatch(draft);
          if (!persistedDraft) {
            const conflictMessage = draftConflictIds.current.has(String(id))
              ? 'La nómina cambió en otra pestaña o sesión. Recargue la aplicación, revise los valores actualizados y vuelva a enviarla.'
              : 'No se pudo guardar el borrador antes de enviarlo.';
            throw new Error(conflictMessage);
          }
        }

        const res = await fetch('http://localhost:3000/api/payrolls', {
          method: 'POST',
          headers: getAuthHeader(),
          body: JSON.stringify({ draftId: id })
        });
        
        if (!res.ok) {
          if (res.status === 413) throw new Error('La nómina es demasiado grande para guardarse (Payload Too Large).');
          if (res.status === 403 || res.status === 401) throw new Error('Tu sesión ha expirado o no tienes permisos (Error 403/401). Inicia sesión nuevamente.');
          const errorBody = await res.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Error al conectar con el servidor.');
        }

        const saved = await res.json();
        setPayrollHistory((current) => [
          saved,
          ...current.filter((p) => p.id !== saved.id)
        ]);
        // El servidor eliminó el borrador dentro de la misma transacción.
        setActivePayrolls((current) => current.filter(p => p.id !== id));
        draftSyncChains.current.delete(String(id));
        draftSyncRevisions.current.delete(String(id));
        draftServerRevisions.current.delete(String(id));
        draftConflictIds.current.delete(String(id));
        pendingDraftSaves.current.delete(String(id));

        // Tras cerrar 2ª, refrescar fichas (Total ISR pudo actualizar employees.isr)
        if (draft.periodType === '2da' && saved.status === 'cerrada') {
          try {
            const empRes = await fetch('http://localhost:3000/api/employees', { headers: getAuthHeader() });
            if (empRes.ok) {
              const apiEmployees = await empRes.json();
              if (Array.isArray(apiEmployees)) setEmployees(apiEmployees);
            }
          } catch (e) {
            console.warn('No se pudo refrescar empleados tras cerrar 2ª:', e);
          }
        }

        // El servidor ya reservó/procesó los registros dentro de la misma
        // transacción que creó el historial; aquí solo reflejamos ese estado.
        if (logsToProcess.length > 0) {
          const periodLabel = saved.id || id;
          const processedIds = new Set(logsToProcess.map(String));
          setOperationLogs((current) => current.map((log) => (
            processedIds.has(String(log.id))
              ? { ...log, status: 'PROCESSED_PAYROLL', periodAssigned: periodLabel }
              : log
          )));
        }
        if (commissionsToProcess.length > 0) {
          const processedCommissionIds = new Set(commissionsToProcess.map(String));
          setCommissions((current) => current.map((commission) => (
            processedCommissionIds.has(String(commission.id))
              ? { ...commission, estado: 'Aplicado' }
              : commission
          )));
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
      const logsResponse = await fetch('http://localhost:3000/api/operation-logs', {
        headers: getAuthHeader()
      });
      if (logsResponse.ok) {
        const refreshedLogs = await logsResponse.json();
        if (Array.isArray(refreshedLogs)) setOperationLogs(refreshedLogs);
      }
      const commissionsResponse = await fetch('http://localhost:3000/api/commissions', {
        headers: getAuthHeader()
      });
      if (commissionsResponse.ok) {
        const refreshedCommissions = await commissionsResponse.json();
        if (Array.isArray(refreshedCommissions)) setCommissions(refreshedCommissions);
      }
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
      flushPendingDraftSaves,
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
