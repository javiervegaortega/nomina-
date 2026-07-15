import React, { useState, useMemo, useContext, useRef, useEffect, useCallback } from 'react';
import {
  Search, Plus, Edit2, Trash2, X, Eye, ChevronDown,
  UserPlus, Filter, Download, Check, FileText, UserMinus, Cake
} from 'lucide-react';
import { toast } from 'sonner';
import { AppContext } from '../App';
import { DataContext } from '../context/DataContext';
import { AuthContext } from '../context/AuthContext';
import usePagination from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import ImportData from '../components/ImportData';
import EmployeeFormModal from '../components/EmployeeFormModal';
import EmployeeViewModal from '../components/EmployeeViewModal';
import FiniquitoDocument from '../components/FiniquitoDocument';
import AbandonoDocument from '../components/AbandonoDocument';
import AperturaDocument from '../components/AperturaDocument';
import ConstanciaDocument from '../components/ConstanciaDocument';
import CancelacionDocument from '../components/CancelacionDocument';
import DisciplinariaDocument from '../components/DisciplinariaDocument';
import CumpleanerosModal from '../components/CumpleanerosModal';
import { formatQ, calculateMonthlyISR } from '../data/mockData';
import {
  Box, Flex, Heading, Text, Button, Input, Select,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
  IconButton, Badge, Avatar, Tooltip, HStack, VStack,
  InputGroup, InputLeftElement, useColorModeValue,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalFooter, ModalCloseButton, FormControl, FormLabel,
  Textarea, Collapse,
  Menu, MenuButton, MenuList, MenuItem,
  Skeleton, SkeletonText, SkeletonCircle
} from '@chakra-ui/react';

const getHtml2Canvas = () => import('html2canvas').then(m => m.default);
const getJsPDF = () => import('jspdf').then(m => m.default);
const getXLSX = () => import('xlsx');


export default function Employees() {
  const { confirmAction } = useContext(AppContext);
  const { employees, addEmployee, updateEmployee, deleteEmployee, companies, departments, areas, divisions, subdivisions, dimension5s, isLoading } = useContext(DataContext);
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'AUDITOR';
  
  const INITIAL_FORM = useMemo(() => ({
    estado: 'Activo',
    moneda: 'GTQ',
    dist: companies.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {})
  }), [companies]);

  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Strip accents/tildes for search comparison
  const normalize = useCallback((str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), []);
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterArea, setFilterArea] = useState('ALL');
  const [filterDiv, setFilterDiv] = useState('ALL');
  const [filterSubdiv, setFilterSubdiv] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('Activo');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // add | edit | view
  const [currentEmp, setCurrentEmp] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCumpleaneros, setShowCumpleaneros] = useState(false);
  
  // Offboarding modal state
  const [offboardState, setOffboardState] = useState({ show: false, empId: null, reason: '', date: new Date().toISOString().split('T')[0] });
  
  // Finiquito modal state
  const [finiquitoState, setFiniquitoState] = useState({ show: false, emp: null, calculation: null });
  const finiquitoRef = useRef(null);
  const finiquitoPrintRef = useRef(null);

  // Report modal state
  const [reportModalState, setReportModalState] = useState({ show: false, type: null, title: '', data: [] });

  // Abandono modal state
  const [abandonoState, setAbandonoState] = useState({ show: false, emp: null, fechaFalta: new Date().toISOString().split('T')[0], representante: '' });
  const abandonoPrintRef = useRef(null);

  // Apertura modal state
  const [aperturaState, setAperturaState] = useState({ show: false, emp: null, nombreBanco: '', representante: '' });
  const aperturaPrintRef = useRef(null);

  // Constancia modal state
  const [constanciaState, setConstanciaState] = useState({ show: false, emp: null, desde: new Date().toISOString().split('T')[0], al: new Date().toISOString().split('T')[0], hastaLaFecha: true, representante: '', puesto: '' });
  const constanciaPrintRef = useRef(null);

  // Cancelacion modal state
  const [cancelacionState, setCancelacionState] = useState({ show: false, emp: null, fechaCancelacion: new Date().toISOString().split('T')[0], representante: '' });
  const cancelacionPrintRef = useRef(null);

  // Disciplinaria modal state
  const [disciplinariaState, setDisciplinariaState] = useState({ show: false, emp: null });
  const disciplinariaPrintRef = useRef(null);

  // Theme-aware colors
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const subtleBg = useColorModeValue('gray.50', 'gray.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const textSecondary = useColorModeValue('gray.500', 'gray.400');
  const textPrimary = useColorModeValue('gray.800', 'white');
  const brandColor = useColorModeValue('brand.600', 'brand.300');
  const accentColor = useColorModeValue('accent.600', 'accent.300');
  const theadBg = useColorModeValue('gray.50', 'gray.900');
  const distBarBg = useColorModeValue('gray.100', 'gray.600');
  const modalBg = useColorModeValue('white', 'gray.800');
  const finiquitoRowBg = useColorModeValue('gray.50', 'gray.700');

  const getFullName = useCallback((e) => `${e.primer_nombre || ''} ${e.segundo_nombre || ''} ${e.otro_nombre || ''} ${e.primer_apellido || ''} ${e.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim() || 'Sin Nombre', []);

  const getDist = useCallback((emp) => {
    if (typeof emp.dist === 'string') {
      try { return JSON.parse(emp.dist); } catch(e) { return {}; }
    }
    return emp.dist || {};
  }, []);

  const filteredEmployees = useMemo(() => {
    const searchNorm = normalize(debouncedSearch);
    return employees.filter(e => {
      if (filterDept !== 'ALL' && getEmployeeDepartment(e) !== filterDept) return false;
      if (filterArea !== 'ALL' && String(e.areaId) !== filterArea) return false;
      if (filterDiv !== 'ALL' && String(e.divisionId) !== filterDiv) return false;
      if (filterSubdiv !== 'ALL' && String(e.subdivisionId) !== filterSubdiv) return false;
      if (filterStatus !== 'ALL') {
        const empStatus = (e.estado || '').toUpperCase();
        const selStatus = filterStatus.toUpperCase();
        if (empStatus !== selStatus) return false;
      }
      if (!searchNorm) return true;
      const fullName = normalize(getFullName(e));
      return fullName.includes(searchNorm) ||
             normalize(e.puesto || '').includes(searchNorm) ||
             (e.dpi || '').includes(debouncedSearch) ||
             (e.no_igss || '').includes(debouncedSearch) ||
             (e.nit || '').includes(debouncedSearch);
    });
  }, [employees, debouncedSearch, filterDept, filterArea, filterDiv, filterSubdiv, filterStatus, normalize]);

  const pagination = usePagination(filteredEmployees, 10);

  const openAdd = useCallback(() => {
    setModalMode('add');
    setCurrentEmp(null);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((emp) => {
    setModalMode('edit');
    setCurrentEmp(emp);
    setShowModal(true);
  }, []);

  const openView = useCallback((emp) => {
    setModalMode('view');
    setCurrentEmp(emp);
    setShowModal(true);
  }, []);

  const handleSave = (formData) => {
    if (modalMode === 'add') {
      addEmployee(formData);
      toast.success('Empleado Creado', {
        description: 'Se ha agregado exitosamente.',
      });
    } else if (modalMode === 'edit' && currentEmp) {
      updateEmployee(currentEmp.id, formData);
      toast.success('Empleado Actualizado', {
        description: 'Los cambios se han guardado.',
      });
    }
    setShowModal(false);
  };

  const handleDelete = useCallback((id) => {
    confirmAction("¿Está seguro de eliminar este empleado completamente de la base de datos? (Para historial, use 'Dar de Baja')", () => {
      deleteEmployee(id);
    });
  }, [deleteEmployee, confirmAction]);

  const handleOffboard = () => {
    updateEmployee(offboardState.empId, { 
      estado: 'De Baja', 
      motivo_baja: offboardState.reason,
      fecha_baja: offboardState.date
    });
    setOffboardState({ show: false, empId: null, reason: '', date: '' });
  };

  const handleGenerateFiniquito = useCallback((emp) => {
    const baseTotal = Number(emp.sueldo_ordinario || 0) + Number(emp.bon_incentivo || 0);
    const calc = {
      indemnizacion: baseTotal * 1.5,
      aguinaldoProp: (baseTotal / 12) * 4,
      bono14Prop: (baseTotal / 12) * 2,
      vacaciones: (baseTotal / 30) * 15 * 0.5,
    };
    calc.total = calc.indemnizacion + calc.aguinaldoProp + calc.bono14Prop + calc.vacaciones;
    setFiniquitoState({ show: true, emp, calculation: calc });
  }, []);

  const getEmployeeCompany = (emp) => {
    const companyId = emp?.empresa_principal || emp?.companyId;
    return companies.find(c => String(c.id) === String(companyId)) || null;
  };

  const getEmployeeDepartment = (emp) => {
    const deptId = emp?.departmentId || emp?.departamento_laboral;
    const found = departments.find(d => String(d.id) === String(deptId) || d.nombre_dimension === deptId);
    return found ? found.nombre_dimension : (emp?.departamento_laboral || 'N/A');
  };

  const handlePrintFiniquito = async () => {
    if (!finiquitoState.emp || !finiquitoState.calculation) {
      toast.error('No hay datos para generar el finiquito.');
      return;
    }

    const element = finiquitoPrintRef.current;
    if (!element) {
      toast.error('No se pudo preparar el finiquito.');
      return;
    }

    const toastId = toast.loading('Generando PDF del finiquito...');
    try {
      const canvas = await (await getHtml2Canvas())(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new (await getJsPDF())('p', 'mm', 'letter');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      } else {
        let position = 0;
        let remaining = imgHeight;
        while (remaining > 0) {
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          remaining -= pdfHeight;
          position -= pdfHeight;
          if (remaining > 0) pdf.addPage();
        }
      }

      const fullName = getFullName(finiquitoState.emp);
      const safeName = (fullName || 'Empleado').replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Finiquito_${safeName}.pdf`);

      toast.success('PDF del finiquito generado', { id: toastId });
      setFiniquitoState({ show: false, emp: null, calculation: null });
    } catch (err) {
      toast.error('Error al generar el PDF del finiquito', { id: toastId });
    }
  };

  const handlePrintAbandono = async () => {
    if (!abandonoState.emp || !abandonoState.fechaFalta) {
      toast.error('Complete todos los campos para generar el reporte.');
      return;
    }

    const element = abandonoPrintRef.current;
    if (!element) {
      toast.error('No se pudo preparar el documento de abandono.');
      return;
    }

    const toastId = toast.loading('Generando PDF...');
    try {
      const canvas = await (await getHtml2Canvas())(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new (await getJsPDF())('p', 'mm', 'letter');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      } else {
        let position = 0;
        let remaining = imgHeight;
        while (remaining > 0) {
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          remaining -= pdfHeight;
          position -= pdfHeight;
          if (remaining > 0) pdf.addPage();
        }
      }

      const fullName = getFullName(abandonoState.emp);
      const safeName = (fullName || 'Empleado').replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Abandono_Labores_${safeName}.pdf`);

      toast.success('PDF generado exitosamente', { id: toastId });
      setAbandonoState({ show: false, emp: null, fechaFalta: new Date().toISOString().split('T')[0], representante: '' });
    } catch (err) {
      toast.error('Error al generar el PDF de abandono', { id: toastId });
    }
  };

  const handlePrintApertura = async () => {
    if (!aperturaState.emp || !aperturaState.nombreBanco) {
      toast.error('Complete todos los campos requeridos para generar la solicitud.');
      return;
    }
    const element = aperturaPrintRef.current;
    if (!element) return;

    const toastId = toast.loading('Generando PDF...');
    try {
      const canvas = await (await getHtml2Canvas())(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new (await getJsPDF())('p', 'mm', 'letter');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfHeight + 2) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      } else {
        let pos = 0; let remaining = imgHeight;
        while (remaining > 0) {
          pdf.addImage(imgData, 'PNG', 0, pos, pdfWidth, imgHeight);
          remaining -= pdfHeight; pos -= pdfHeight;
          if (remaining > 0) pdf.addPage();
        }
      }
      const fullName = getFullName(aperturaState.emp);
      pdf.save(`Apertura_Cuenta_${fullName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      toast.success('PDF generado exitosamente', { id: toastId });
      setAperturaState({ show: false, emp: null, nombreBanco: '', representante: '' });
    } catch (err) {
      toast.error('Error al generar PDF', { id: toastId });
    }
  };

  const handlePrintConstancia = async () => {
    if (!constanciaState.emp || !constanciaState.desde) {
      toast.error('Complete todos los campos requeridos para generar la constancia.');
      return;
    }
    const element = constanciaPrintRef.current;
    if (!element) return;

    const toastId = toast.loading('Generando PDF...');
    try {
      const canvas = await (await getHtml2Canvas())(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new (await getJsPDF())('p', 'mm', 'letter');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfHeight + 2) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      } else {
        let pos = 0; let remaining = imgHeight;
        while (remaining > 0) {
          pdf.addImage(imgData, 'PNG', 0, pos, pdfWidth, imgHeight);
          remaining -= pdfHeight; pos -= pdfHeight;
          if (remaining > 0) pdf.addPage();
        }
      }
      const fullName = getFullName(constanciaState.emp);
      pdf.save(`Constancia_Laboral_${fullName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      toast.success('PDF generado exitosamente', { id: toastId });
      setConstanciaState({ show: false, emp: null, desde: new Date().toISOString().split('T')[0], al: new Date().toISOString().split('T')[0], hastaLaFecha: true, representante: '', puesto: '' });
    } catch (err) {
      toast.error('Error al generar PDF', { id: toastId });
    }
  };

  const handlePrintCancelacion = async () => {
    if (!cancelacionState.emp || !cancelacionState.fechaCancelacion) {
      toast.error('Complete todos los campos requeridos para generar la cancelación.');
      return;
    }
    const element = cancelacionPrintRef.current;
    if (!element) return;

    const toastId = toast.loading('Generando PDF...');
    try {
      const canvas = await (await getHtml2Canvas())(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new (await getJsPDF())('p', 'mm', 'letter');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight <= pdfHeight + 2) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      } else {
        let pos = 0; let remaining = imgHeight;
        while (remaining > 0) {
          pdf.addImage(imgData, 'PNG', 0, pos, pdfWidth, imgHeight);
          remaining -= pdfHeight; pos -= pdfHeight;
          if (remaining > 0) pdf.addPage();
        }
      }
      const fullName = getFullName(cancelacionState.emp);
      pdf.save(`Cancelacion_Contrato_${fullName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      toast.success('PDF generado exitosamente', { id: toastId });
      setCancelacionState({ show: false, emp: null, fechaCancelacion: new Date().toISOString().split('T')[0], representante: '' });
    } catch (err) {
      toast.error('Error al generar PDF', { id: toastId });
    }
  };

  const handlePrintDisciplinaria = async () => {
    if (!disciplinariaState.emp) return;
    const emp = disciplinariaState.emp;
    const fullName = getFullName(emp);
    const company = companies.find(c => c.id === emp.empresa_principal)?.nombre_comercial || '';

    const toastId = toast.loading('Generando PDF...');
    try {
      const pdf = new (await getJsPDF())('p', 'mm', 'letter');
      // Letter: 215.9 x 279.4 mm
      const pageW = 215.9;
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      // Helper functions
      const setFont = (style = 'normal', size = 9) => {
        pdf.setFont('times', style);
        pdf.setFontSize(size);
      };
      const drawRect = (x, yPos, w, h, fillColor = null) => {
        if (fillColor) {
          pdf.setFillColor(...fillColor);
          pdf.rect(x, yPos, w, h, 'FD');
        } else {
          pdf.rect(x, yPos, w, h, 'S');
        }
      };
      const text = (str, x, yPos, opts = {}) => {
        pdf.text(String(str || ''), x, yPos, opts);
      };

      const rowH = 6;    // standard row height
      const col1 = contentW * 0.25; // 25% for labels
      const col2 = contentW * 0.75; // 75% for values
      const col50 = contentW * 0.50;
      const x0 = margin;

      // ─── TITLE ───
      pdf.setFillColor(0, 0, 0);
      pdf.rect(x0, y, contentW, rowH + 1, 'F');
      setFont('bold', 12);
      pdf.setTextColor(255, 255, 255);
      text('ACCION DISCIPLINARIA', x0 + contentW / 2, y + rowH - 1, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      y += rowH + 1;

      // ─── NOMBRE ───
      drawRect(x0, y, col1, rowH);
      drawRect(x0 + col1, y, col2, rowH);
      setFont('bold', 9);
      text('NOMBRE', x0 + 1, y + rowH - 1.5);
      setFont('normal', 9);
      text(fullName, x0 + col1 + col2 / 2, y + rowH - 1.5, { align: 'center' });
      y += rowH;

      // ─── CARGO ───
      drawRect(x0, y, col50, rowH);
      drawRect(x0 + col50, y, col50, rowH);
      setFont('bold', 9);
      text('CARGO', x0 + 1, y + rowH - 1.5);
      setFont('normal', 9);
      text(emp.puesto || '', x0 + contentW - 1, y + rowH - 1.5, { align: 'right' });
      y += rowH;

      // ─── EMPRESA ───
      drawRect(x0, y, col50, rowH);
      drawRect(x0 + col50, y, col50, rowH);
      setFont('bold', 9);
      text('EMPRESA', x0 + 1, y + rowH - 1.5);
      setFont('normal', 9);
      text(company, x0 + col50 + 2, y + rowH - 1.5);
      y += rowH;

      // ─── FECHA ───
      drawRect(x0, y, col50, rowH);
      drawRect(x0 + col50, y, col50, rowH);
      setFont('bold', 9);
      text('FECHA DEL ACONTECIMIENTO', x0 + 1, y + rowH - 1.5);
      y += rowH;

      // ─── DESCRIBA LA SITUACION ───
      drawRect(x0, y, contentW, rowH);
      setFont('bold', 9);
      text('Describa la situacion:', x0 + 1, y + rowH - 1.5);
      y += rowH;

      // 12 empty lines
      for (let i = 0; i < 12; i++) {
        drawRect(x0, y, contentW, rowH);
        y += rowH;
      }

      // ─── AMONESTACION ───
      const aW = contentW / 6;
      drawRect(x0, y, aW * 2, rowH);
      drawRect(x0 + aW * 2, y, aW, rowH);
      drawRect(x0 + aW * 3, y, aW, rowH);
      drawRect(x0 + aW * 4, y, aW, rowH);
      drawRect(x0 + aW * 5, y, aW, rowH);
      setFont('normal', 9);
      text('Amonestación es la:', x0 + 1, y + rowH - 1.5);
      text('Primera', x0 + aW * 2 + 1, y + rowH - 1.5);
      text('Segunda', x0 + aW * 3 + 1, y + rowH - 1.5);
      text('Tercera', x0 + aW * 4 + 1, y + rowH - 1.5);
      y += rowH;

      // ─── TESTIGOS ───
      drawRect(x0, y, col1, rowH);
      drawRect(x0 + col1, y, col2, rowH);
      setFont('bold', 9);
      text('Testigos', x0 + 1, y + rowH - 1.5);
      y += rowH;

      // ─── COMENTARIOS ───
      drawRect(x0, y, contentW, rowH);
      setFont('bold', 9);
      text('Comentarios del colaborador:', x0 + 1, y + rowH - 1.5);
      y += rowH;

      // 3 empty lines
      for (let i = 0; i < 3; i++) {
        drawRect(x0, y, contentW, rowH);
        y += rowH;
      }

      // ─── SIGNATURES ───
      y += 12;
      const sigW = contentW * 0.38;
      pdf.line(x0, y, x0 + sigW, y);
      pdf.line(x0 + contentW - sigW, y, x0 + contentW, y);
      y += 4;
      setFont('normal', 9);
      text('Jefe Inmediato', x0 + sigW / 2, y, { align: 'center' });
      text('Nombre y firma del colaborador', x0 + contentW - sigW / 2, y, { align: 'center' });
      y += 10;

      // ─── MEDIDA ADOPTADA ───
      // Header
      pdf.setFillColor(200, 200, 200);
      pdf.rect(x0, y, contentW, rowH, 'FD');
      setFont('bold', 11);
      text('MEDIDA ADOPTADA', x0 + contentW / 2, y + rowH - 1.5, { align: 'center' });
      y += rowH;

      // Column widths for MEDIDA (8 cols): 18 10 8 13 8 15 14 14
      const mCols = [
        contentW * 0.18,
        contentW * 0.10,
        contentW * 0.08,
        contentW * 0.13,
        contentW * 0.08,
        contentW * 0.15,
        contentW * 0.14,
        contentW * 0.14,
      ];
      const mX = [x0];
      for (let i = 0; i < mCols.length; i++) mX.push(mX[i] + mCols[i]);

      const r2H = rowH; // rows 1&2 each rowH height
      // Row 1
      pdf.rect(mX[0], y, mCols[0], r2H * 2, 'S');  // Llamada de atención rowSpan=2
      pdf.rect(mX[1], y, mCols[1], r2H, 'S');
      pdf.rect(mX[2], y, mCols[2], r2H, 'S');
      pdf.rect(mX[3], y, mCols[3], r2H, 'S');
      pdf.rect(mX[4], y, mCols[4], r2H, 'S');
      pdf.rect(mX[5], y, mCols[5], r2H * 2, 'S');  // No.Días rowSpan=2
      pdf.rect(mX[6], y, mCols[6], r2H * 2, 'S');  // Fecha rowSpan=2
      pdf.rect(mX[7], y, mCols[7], r2H * 2, 'S');  // empty rowSpan=2
      setFont('normal', 8);
      text('Llamada de atención', mX[0] + 1, y + r2H - 1.5);
      text('Verbal', mX[1] + 1, y + r2H - 1.5);
      text('Suspensión', mX[3] + 1, y + r2H - 1.5);
      text('No. Días\nsuspendidos', mX[5] + 1, y + r2H - 1.5);
      text('Fecha', mX[6] + mCols[6] / 2, y + r2H, { align: 'center' });
      y += r2H;

      // Row 2
      pdf.rect(mX[1], y, mCols[1], r2H, 'S');
      pdf.rect(mX[2], y, mCols[2], r2H, 'S');
      pdf.rect(mX[3], y, mCols[3], r2H, 'S');
      pdf.rect(mX[4], y, mCols[4], r2H, 'S');
      text('escrita', mX[1] + 1, y + r2H - 1.5);
      text('laboral', mX[3] + 1, y + r2H - 1.5);
      y += r2H;

      // Row 3 - Terminación
      const t1W = mCols[0]; const t2W = mCols[1]; const t3W = mCols[2];
      const t4W = mCols[3] + mCols[4]; const t5W = mCols[5] + mCols[6] + mCols[7];
      pdf.rect(mX[0], y, t1W, r2H, 'S');
      pdf.rect(mX[0] + t1W, y, t2W, r2H, 'S');
      pdf.rect(mX[0] + t1W + t2W, y, t3W, r2H, 'S');
      pdf.rect(mX[0] + t1W + t2W + t3W, y, t4W, r2H, 'S');
      pdf.rect(mX[0] + t1W + t2W + t3W + t4W, y, t5W, r2H, 'S');
      text('Terminación Laboral', mX[0] + 1, y + r2H - 1.5);
      text('Fecha', mX[0] + t1W + 1, y + r2H - 1.5);
      text('Indemnización', mX[0] + t1W + t2W + t3W + 1, y + r2H - 1.5);
      y += r2H;

      // ACCION EN NOMINA
      pdf.setFillColor(200, 200, 200);
      pdf.rect(x0, y, contentW, rowH, 'FD');
      setFont('bold', 11);
      text('ACCION EN NOMINA', x0 + contentW / 2, y + rowH - 1.5, { align: 'center' });
      y += rowH;

      // ─── FOOTER ───
      y += 20;
      pdf.setTextColor(180, 0, 0);
      setFont('normal', 8);
      text('Original: Recursos Humanos/File Personal', x0, y);
      y += 5;
      text('Duplicado: Ministerio de Trabajo - Inspección', x0, y);
      pdf.setTextColor(0, 0, 0);

      pdf.save(`Accion_Disciplinaria_${fullName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      toast.success('PDF generado exitosamente', { id: toastId });
      setDisciplinariaState({ show: false, emp: null });
    } catch (err) {
      toast.error('Error al generar PDF', { id: toastId });
    }
  };

  // ── Employee Report Exports ──
  const buildEmployeeRow = (e, idx) => {
    const comp = getEmployeeCompany(e);
    return {
      'No.': idx + 1,
      'Nombre Completo': getFullName(e),
      'DPI': e.dpi || '',
      'NIT': e.nit || '',
      'No. IGSS': e.no_igss || '',
      'Empresa': comp?.nombre_comercial || '',
      'Puesto': e.puesto || '',
      'Departamento': getEmployeeDepartment(e) || '',
      'Estado': e.estado || 'Activo',
      'Fecha Inicio': e.fecha_inicio ? new Date(e.fecha_inicio).toLocaleDateString('es-GT') : '',
      'Fecha Baja': e.fecha_baja ? new Date(e.fecha_baja).toLocaleDateString('es-GT') : '',
      'Motivo Baja': e.motivo_baja || '',
      'Salario Ordinario': Number(e.sueldo_ordinario) || 0,
      'Bono Incentivo': Number(e.bon_incentivo) || 0,
      'Bono Dec. 37-2001': Number(e.bon_dec_37_2001) || 0,
      'Tipo de Pago': e.tipo_de_pago || '',
      'Banco': e.banco || '',
      'No. Cuenta': e.no_cuenta || '',
      'Teléfono': e.telefono || '',
      'Dirección': e.direccion || '',
    };
  };

  const handleOpenReport = (type) => {
    let filtered;
    let fileName;
    let sheetName;
    let title;

    if (type === 'activos') {
      filtered = employees.filter(e => (e.estado || '').toUpperCase() === 'ACTIVO');
      fileName = 'Reporte_Empleados_Activos';
      sheetName = 'Empleados Activos';
      title = 'Reporte de Empleados Activos';
    } else if (type === 'baja') {
      filtered = employees.filter(e => (e.estado || '').toUpperCase() === 'DE BAJA');
      fileName = 'Reporte_Empleados_De_Baja';
      sheetName = 'Empleados De Baja';
      title = 'Reporte de Empleados De Baja';
    } else {
      filtered = [...employees];
      fileName = 'Reporte_Completo_Empleados';
      sheetName = 'Todos los Empleados';
      title = 'Reporte Completo de Empleados';
    }

    if (filtered.length === 0) {
      toast.warning('No hay empleados para este reporte.');
      return;
    }

    setReportModalState({
      show: true,
      type,
      title,
      data: filtered,
      fileName,
      sheetName
    });
  };

  const handleExportReport = async () => {
    const { data, fileName, sheetName } = reportModalState;
    if (!data || data.length === 0) return;

    toast.success(`Exportando ${data.length} registros a Excel...`);
    const XLSX = await getXLSX();
    const rows = data.map((e, idx) => buildEmployeeRow(e, idx));
    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 6 },  // No.
      { wch: 36 }, // Nombre
      { wch: 16 }, // DPI
      { wch: 14 }, // NIT
      { wch: 14 }, // IGSS
      { wch: 20 }, // Empresa
      { wch: 22 }, // Puesto
      { wch: 18 }, // Departamento
      { wch: 12 }, // Estado
      { wch: 14 }, // Fecha Inicio
      { wch: 14 }, // Fecha Baja
      { wch: 22 }, // Motivo Baja
      { wch: 16 }, // Salario
      { wch: 14 }, // Bono Incentivo
      { wch: 16 }, // Bono Dec
      { wch: 16 }, // Tipo Pago
      { wch: 16 }, // Banco
      { wch: 18 }, // No. Cuenta
      { wch: 14 }, // Teléfono
      { wch: 30 }, // Dirección
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${fileName}_${today}.xlsx`);
    
    setReportModalState({ ...reportModalState, show: false });
  };

  if (isLoading) {
    return (
      <Box p={{ base: 3, md: 6, lg: 8 }}>
        {/* Header skeleton */}
        <Flex
          justify="space-between"
          align={{ base: 'stretch', md: 'center' }}
          direction={{ base: 'column', md: 'row' }}
          mb={6}
          flexWrap="wrap"
          gap={4}
        >
          <Box>
            <Skeleton h="28px" w="260px" mb={2} borderRadius="md" />
            <Skeleton h="14px" w="340px" borderRadius="md" />
          </Box>
          <HStack spacing={3}>
            <Skeleton h="40px" w="140px" borderRadius="lg" />
            <Skeleton h="40px" w="170px" borderRadius="lg" />
          </HStack>
        </Flex>

        {/* Search bar skeleton */}
        <Box
          bg={cardBg}
          p={4}
          mb={5}
          borderRadius="xl"
          border="1px solid"
          borderColor={borderColor}
        >
          <Flex gap={3} align="center" flexWrap="wrap">
            <Skeleton h="40px" flex={1} minW="250px" borderRadius="lg" />
            <Skeleton h="40px" w="120px" borderRadius="lg" />
          </Flex>
        </Box>

        {/* Table skeleton */}
        <Box
          bg={cardBg}
          borderRadius="xl"
          border="1px solid"
          borderColor={borderColor}
          overflow="hidden"
        >
          {/* Table header skeleton */}
          <Flex bg={theadBg} px={4} py={3} gap={4} align="center">
            <Skeleton h="12px" w="30px" />
            <Skeleton h="12px" w="120px" />
            <Skeleton h="12px" w="160px" />
            <Skeleton h="12px" w="100px" />
            <Skeleton h="12px" w="100px" />
            <Skeleton h="12px" w="70px" />
            <Skeleton h="12px" w="90px" ml="auto" />
          </Flex>
          {/* Table rows skeleton */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Flex
              key={i}
              px={4}
              py={3}
              gap={4}
              align="center"
              borderTop="1px solid"
              borderColor={borderColor}
            >
              <Skeleton h="14px" w="30px" borderRadius="md" />
              <SkeletonCircle size="32px" />
              <Box>
                <Skeleton h="14px" w="150px" mb={1} borderRadius="md" />
                <Skeleton h="10px" w="100px" borderRadius="md" />
              </Box>
              <Skeleton h="20px" w="90px" borderRadius="md" />
              <Skeleton h="14px" w="100px" borderRadius="md" />
              <Skeleton h="8px" w="120px" borderRadius="full" />
              <Skeleton h="22px" w="60px" borderRadius="full" />
              <HStack spacing={1} ml="auto">
                <Skeleton h="28px" w="28px" borderRadius="md" />
                <Skeleton h="28px" w="28px" borderRadius="md" />
                <Skeleton h="28px" w="28px" borderRadius="md" />
              </HStack>
            </Flex>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box p={{ base: 3, md: 6, lg: 8 }}>
      {/* HEADER */}
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        mb={6}
        flexWrap="wrap"
        gap={4}
      >
        <Box>
          <Heading size="lg" fontWeight={800} mb={1}>
            Directorio de Empleados
          </Heading>
          <Text color={textSecondary} fontSize="md">
            Gestión de personal y distribución de costos · {employees.length} registros
          </Text>
        </Box>
        <HStack spacing={3} flexWrap="wrap">
          <Menu>
            <MenuButton
              as={Button}
              colorScheme="green"
              leftIcon={<Download size={16} />}
              rightIcon={<ChevronDown size={14} />}
              borderRadius="lg"
              transition="all 0.3s"
              _hover={{ shadow: 'md' }}
            >
              Reportería
            </MenuButton>
            <MenuList zIndex={50} shadow="lg">
              <MenuItem onClick={() => handleOpenReport('activos')}>Empleados Activos (De Alta)</MenuItem>
              <MenuItem onClick={() => handleOpenReport('baja')}>Empleados De Baja</MenuItem>
              <MenuItem onClick={() => handleOpenReport('completo')}>Reporte Completo</MenuItem>
            </MenuList>
          </Menu>

          <Button
            variant="outline"
            colorScheme="purple"
            leftIcon={<Cake size={16} />}
            onClick={() => setShowCumpleaneros(true)}
            borderRadius="lg"
            transition="all 0.3s"
            _hover={{ shadow: 'md', bg: 'purple.50' }}
          >
            Cumpleañeros
          </Button>
          {!isReadOnly && (
            <Button
              colorScheme="brand"
              leftIcon={<UserPlus size={16} />}
              onClick={openAdd}
              borderRadius="lg"
              transition="all 0.3s"
              _hover={{ shadow: 'lg' }}
            >
              Nuevo Empleado
            </Button>
          )}
        </HStack>
      </Flex>

      {/* SEARCH / FILTER BAR */}
      <Box
        bg={cardBg}
        p={4}
        mb={5}
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        boxShadow="sm"
      >
        <Flex gap={3} align="center" flexWrap="wrap">
          <InputGroup flex={1} minW={{ base: '100%', md: '250px' }}>
            <InputLeftElement pointerEvents="none">
              <Search size={18} color="gray" />
            </InputLeftElement>
            <Input
              placeholder="Buscar por nombre o puesto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              borderRadius="lg"
            />
          </InputGroup>
          <Button
            variant={showFilters ? 'solid' : 'outline'}
            leftIcon={<Filter size={16} />}
            onClick={() => setShowFilters(!showFilters)}
            borderRadius="lg"
            transition="all 0.3s"
          >
            Filtros {showFilters ? '▲' : '▼'}
          </Button>
          {(filterDept !== 'ALL' || filterArea !== 'ALL' || filterDiv !== 'ALL' || filterSubdiv !== 'ALL' || filterStatus !== 'ALL') && (
            <Button
              variant="ghost"
              leftIcon={<X size={16} />}
              onClick={() => { setFilterDept('ALL'); setFilterArea('ALL'); setFilterDiv('ALL'); setFilterSubdiv('ALL'); setFilterStatus('ALL'); }}
            >
              Limpiar
            </Button>
          )}
        </Flex>

        {/* Expandable filters */}
        <Collapse in={showFilters} animateOpacity>
          <Flex
            gap={3}
            mt={4}
            pt={4}
            borderTop="1px solid"
            borderColor={borderColor}
            flexWrap="wrap"
          >
            <FormControl minW={{ base: '100%', sm: '180px' }} maxW={{ base: '100%', sm: '240px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">Departamento</FormLabel>
              <Select
                value={filterDept}
                onChange={e => { setFilterDept(e.target.value); setFilterArea('ALL'); setFilterDiv('ALL'); setFilterSubdiv('ALL'); }}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todos</option>
                {departments.map((d, i) => <option key={d.id || i} value={d.nombre_dimension}>{d.nombre_dimension}</option>)}
              </Select>
            </FormControl>
            <FormControl minW={{ base: '100%', sm: '180px' }} maxW={{ base: '100%', sm: '240px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">Área</FormLabel>
              <Select
                value={filterArea}
                onChange={e => { setFilterArea(e.target.value); setFilterDiv('ALL'); setFilterSubdiv('ALL'); }}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todas</option>
                {(areas || []).map(a => <option key={a.id} value={String(a.id)}>{a.nombre}</option>)}
              </Select>
            </FormControl>
            <FormControl minW={{ base: '100%', sm: '180px' }} maxW={{ base: '100%', sm: '240px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">División</FormLabel>
              <Select
                value={filterDiv}
                onChange={e => { setFilterDiv(e.target.value); setFilterSubdiv('ALL'); }}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todas</option>
                {(divisions || []).map(d => <option key={d.id} value={String(d.id)}>{d.nombre}</option>)}
              </Select>
            </FormControl>
            <FormControl minW={{ base: '100%', sm: '180px' }} maxW={{ base: '100%', sm: '240px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">Subdivisión</FormLabel>
              <Select
                value={filterSubdiv}
                onChange={e => setFilterSubdiv(e.target.value)}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todas</option>
                {(subdivisions || []).map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
              </Select>
            </FormControl>
            <FormControl minW={{ base: '100%', sm: '140px' }} maxW={{ base: '100%', sm: '180px' }}>
              <FormLabel fontSize="xs" color={textSecondary} fontWeight="600" textTransform="uppercase">Estado</FormLabel>
              <Select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                borderRadius="lg"
                size="sm"
              >
                <option value="ALL">Todos</option>
                <option value="Activo">Activo</option>
                <option value="De Baja">De Baja</option>
              </Select>
            </FormControl>
          </Flex>
        </Collapse>
      </Box>

      {/* EMPLOYEE TABLE */}
      <Box
        bg={cardBg}
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        boxShadow="sm"
        overflow="hidden"
      >
        <TableContainer overflowX="auto">
          <Table variant="simple" size={{ base: 'sm', md: 'md' }} minW="900px">
            <Thead bg={theadBg}>
              <Tr>
                <Th fontWeight={600} color={textSecondary} w="50px">#</Th>
                <Th fontWeight={600} color={textSecondary}>Empleado</Th>
                <Th fontWeight={600} color={textSecondary}>Departamento / Empresa</Th>
                <Th fontWeight={600} color={textSecondary}>Salario Base</Th>
                <Th fontWeight={600} color={textSecondary}>Distribución</Th>
                <Th fontWeight={600} color={textSecondary}>Estado</Th>
                <Th fontWeight={600} color={textSecondary} textAlign="right">Acciones</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredEmployees.length === 0 ? (
                <Tr>
                  <Td colSpan={7} textAlign="center" py={16}>
                    <Text color={textSecondary} fontSize="md">
                      No se encontraron empleados con los criterios de búsqueda.
                    </Text>
                  </Td>
                </Tr>
              ) : (
                pagination.paginatedData.map((emp) => (
                  <EmployeeRow
                    key={emp.id}
                    emp={emp}
                    companies={companies}
                    hoverBg={hoverBg}
                    textSecondary={textSecondary}
                    brandColor={brandColor}
                    accentColor={accentColor}
                    distBarBg={distBarBg}
                    getFullName={getFullName}
                    getDist={getDist}
                    openView={openView}
                    openEdit={openEdit}
                    setOffboardState={setOffboardState}
                    setAbandonoState={setAbandonoState}
                    setAperturaState={setAperturaState}
                    setConstanciaState={setConstanciaState}
                    setCancelacionState={setCancelacionState}
                    setDisciplinariaState={setDisciplinariaState}
                    handleGenerateFiniquito={handleGenerateFiniquito}
                    handleDelete={handleDelete}
                    isReadOnly={isReadOnly}
                    getEmployeeDepartment={getEmployeeDepartment}
                  />
                ))
              )}
            </Tbody>
          </Table>
        </TableContainer>
        <Pagination {...pagination} />
      </Box>

      {/* EMPLOYEE FORM MODAL (add/edit) */}
      {showModal && (modalMode === 'add' || modalMode === 'edit') && (
        <EmployeeFormModal 
          mode={modalMode} 
          initialData={currentEmp || INITIAL_FORM} 
          onClose={() => setShowModal(false)} 
          onSave={handleSave} 
          employees={employees}
          companies={companies} 
          departments={departments}
          areas={areas}
          divisions={divisions}
          subdivisions={subdivisions}
          dimension5s={dimension5s}
        />
      )}

      {/* VIEW MODAL */}
      <EmployeeViewModal 
        isOpen={showModal && modalMode === 'view'} 
        onClose={() => setShowModal(false)} 
        employee={currentEmp} 
        companies={companies}
        areas={areas}
        divisions={divisions}
        subdivisions={subdivisions}
        onEdit={(emp) => {
          setCurrentEmp(emp);
          setModalMode('edit');
          setShowModal(true);
        }}
      />

      {/* IMPORT DATA */}
      {showImport && <ImportData onClose={() => setShowImport(false)} />}

      {/* OFFBOARDING MODAL */}
      <Modal
        isOpen={offboardState.show}
        onClose={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })}
        size={{ base: 'full', md: 'md' }}
        isCentered
      >
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent borderRadius="xl" bg={modalBg} boxShadow="2xl">
          <ModalHeader fontWeight={700} pb={2}>
            Dar de Baja
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color={textSecondary} mb={5}>
              El empleado pasará a estado DE BAJA y ya no aparecerá en nóminas futuras, pero su historial se mantendrá intacto.
            </Text>
            <FormControl mb={5}>
              <FormLabel fontSize="sm" fontWeight={600}>Fecha de Baja</FormLabel>
              <Input
                type="date"
                value={offboardState.date}
                onChange={e => setOffboardState({ ...offboardState, date: e.target.value })}
                borderRadius="lg"
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight={600}>Motivo / Observaciones</FormLabel>
              <Textarea
                value={offboardState.reason}
                onChange={e => setOffboardState({ ...offboardState, reason: e.target.value })}
                placeholder="Ej: Renuncia voluntaria, fin de contrato, despido justificado..."
                rows={3}
                borderRadius="lg"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter pt={4}>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => setOffboardState({ show: false, empId: null, reason: '', date: '' })}
            >
              Cancelar
            </Button>
            <Button
              colorScheme="orange"
              onClick={handleOffboard}
              isDisabled={!offboardState.reason}
              transition="all 0.3s"
            >
              Confirmar Baja
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Documento oculto para generación del PDF */}
      {finiquitoState.calculation && finiquitoState.emp && (
        <Box
          position="fixed"
          left="-9999px"
          top={0}
          zIndex={-1}
          pointerEvents="none"
        >
          <FiniquitoDocument ref={finiquitoPrintRef} emp={finiquitoState.emp} calculation={finiquitoState.calculation} company={getEmployeeCompany(finiquitoState.emp)} />
        </Box>
      )}

      {abandonoState.emp && (
        <Box position="fixed" left="-9999px" top={0} zIndex={-1} pointerEvents="none">
          <AbandonoDocument ref={abandonoPrintRef} emp={abandonoState.emp} fechaFalta={abandonoState.fechaFalta} representante={abandonoState.representante} />
        </Box>
      )}

      {aperturaState.emp && (
        <Box position="fixed" left="-9999px" top={0} zIndex={-1} pointerEvents="none">
          <AperturaDocument ref={aperturaPrintRef} emp={aperturaState.emp} nombreBanco={aperturaState.nombreBanco} representante={aperturaState.representante} />
        </Box>
      )}

      {constanciaState.emp && (
        <Box position="fixed" left="-9999px" top={0} zIndex={-1} pointerEvents="none">
          <ConstanciaDocument ref={constanciaPrintRef} emp={constanciaState.emp} desde={constanciaState.desde} al={constanciaState.al} hastaLaFecha={constanciaState.hastaLaFecha} representante={constanciaState.representante} puesto={constanciaState.puesto} />
        </Box>
      )}

      {cancelacionState.emp && (
        <Box position="fixed" left="-9999px" top={0} zIndex={-1} pointerEvents="none">
          <CancelacionDocument ref={cancelacionPrintRef} emp={cancelacionState.emp} fechaCancelacion={cancelacionState.fechaCancelacion} representante={cancelacionState.representante} />
        </Box>
      )}

      {disciplinariaState.emp && (
        <Box position="fixed" left="-9999px" top={0} zIndex={-1} pointerEvents="none">
          <DisciplinariaDocument ref={disciplinariaPrintRef} emp={disciplinariaState.emp} companyName={companies.find(c => c.id === disciplinariaState.emp.empresa_principal)?.nombre_comercial} />
        </Box>
      )}

      {/* REPORTE MODAL */}

      {/* FINIQUITO MODAL */}
      <Modal
        isOpen={finiquitoState.show && Boolean(finiquitoState.calculation)}
        onClose={() => setFiniquitoState({ show: false, emp: null, calculation: null })}
        size={{ base: 'full', md: 'lg' }}
        isCentered
      >
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent ref={finiquitoRef} borderRadius="xl" bg={modalBg} boxShadow="2xl">
          {finiquitoState.calculation && (
            <>
              <ModalHeader fontWeight={700} pb={2}>
                Cálculo de Finiquito (Liquidación)
              </ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <Text fontSize="xs" color={textSecondary} mb={4}>
                  {getEmployeeCompany(finiquitoState.emp)?.nombre_comercial || 'Empresa'} — Vista previa del documento
                </Text>
                <Flex mb={5} align="center" gap={4}>
                  <Box flex={1}>
                    <Text fontSize="md" fontWeight={700} color={brandColor}>
                      {getFullName(finiquitoState.emp)}
                    </Text>
                    <Text fontSize="sm" color={textSecondary}>
                      {finiquitoState.emp?.puesto}
                    </Text>
                    {finiquitoState.emp?.dpi && (
                      <Text fontSize="xs" color={textSecondary} mt={1}>
                        DPI: {finiquitoState.emp.dpi}
                      </Text>
                    )}
                  </Box>
                  <Box textAlign="right">
                    <Text fontSize="xs" color={textSecondary}>Salario base computable</Text>
                    <Text fontFamily="mono" fontWeight={700} color={brandColor}>
                      {formatQ(Number(finiquitoState.emp?.sueldo_ordinario || 0) + Number(finiquitoState.emp?.bon_incentivo || 0))}
                    </Text>
                  </Box>
                </Flex>

                <Box borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden">
                  <Table size="sm" variant="simple">
                    <Tbody>
                      {[
                        ['Indemnización por tiempo servido', finiquitoState.calculation.indemnizacion],
                        ['Aguinaldo proporcional', finiquitoState.calculation.aguinaldoProp],
                        ['Bono 14 proporcional', finiquitoState.calculation.bono14Prop],
                        ['Vacaciones pendientes de goce', finiquitoState.calculation.vacaciones],
                      ].map(([label, amount]) => (
                        <Tr key={label}>
                          <Td fontSize="sm">{label}</Td>
                          <Td textAlign="right">
                            <Text fontFamily="mono" color={brandColor} fontWeight={600}>
                              {formatQ(amount)}
                            </Text>
                          </Td>
                        </Tr>
                      ))}
                      <Tr bg={finiquitoRowBg}>
                        <Td>
                          <Text fontWeight={700} color={brandColor}>GRAN TOTAL A RECIBIR</Text>
                        </Td>
                        <Td textAlign="right">
                          <Text fontFamily="mono" fontWeight={700} color={accentColor} fontSize="lg">
                            {formatQ(finiquitoState.calculation.total)}
                          </Text>
                        </Td>
                      </Tr>
                    </Tbody>
                  </Table>
                </Box>
              </ModalBody>
              <ModalFooter pt={4}>
                <Button
                  variant="ghost"
                  mr={3}
                  onClick={() => setFiniquitoState({ show: false, emp: null, calculation: null })}
                >
                  Cerrar
                </Button>
                <Button
                  colorScheme="brand"
                  leftIcon={<FileText size={16} />}
                  onClick={handlePrintFiniquito}
                  transition="all 0.3s"
                  _hover={{ shadow: 'lg' }}
                >
                  Descargar PDF
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Abandono Modal */}
      <Modal isOpen={abandonoState.show} onClose={() => setAbandonoState({ ...abandonoState, show: false })} size="4xl" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={modalBg} borderRadius="xl">
          <ModalHeader color={textPrimary}>Abandono de labores</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Flex direction={{ base: "column", md: "row" }} gap={6}>
              <VStack spacing={4} flex={1}>
                <FormControl isRequired>
                  <FormLabel color={textSecondary} fontSize="sm">Falta de labores desde</FormLabel>
                  <Input
                    type="date"
                    value={abandonoState.fechaFalta}
                    onChange={(e) => setAbandonoState({ ...abandonoState, fechaFalta: e.target.value })}
                    bg={cardBg}
                    borderColor={borderColor}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color={textSecondary} fontSize="sm">Representante</FormLabel>
                  <Input
                    placeholder="Nombre de la persona que va a firmar"
                    value={abandonoState.representante}
                    onChange={(e) => setAbandonoState({ ...abandonoState, representante: e.target.value })}
                    bg={cardBg}
                    borderColor={borderColor}
                  />
                </FormControl>
              </VStack>
              <Box flex={2} maxH="400px" overflowY="auto" bg={subtleBg} p={4} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <AbandonoDocument emp={abandonoState.emp} fechaFalta={abandonoState.fechaFalta} representante={abandonoState.representante} isPreview={true} />
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={borderColor}>
            <Button variant="ghost" mr={3} onClick={() => setAbandonoState({ ...abandonoState, show: false })}>
              Cerrar
            </Button>
            <Button colorScheme="red" onClick={handlePrintAbandono}>
              Exportar a PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Apertura Modal */}
      <Modal isOpen={aperturaState.show} onClose={() => setAperturaState({ ...aperturaState, show: false })} size="4xl" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={modalBg} borderRadius="xl">
          <ModalHeader color={textPrimary}>Apertura de cuenta</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Flex direction={{ base: "column", md: "row" }} gap={6}>
              <VStack spacing={4} flex={1}>
                <FormControl isRequired>
                  <FormLabel color={textSecondary} fontSize="sm">Nombre del banco</FormLabel>
                  <Input
                    placeholder="Ingrese el nombre del banco"
                    value={aperturaState.nombreBanco}
                    onChange={(e) => setAperturaState({ ...aperturaState, nombreBanco: e.target.value })}
                    bg={cardBg}
                    borderColor={borderColor}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color={textSecondary} fontSize="sm">Representante</FormLabel>
                  <Input
                    placeholder="Nombre de la persona que va a firmar"
                    value={aperturaState.representante}
                    onChange={(e) => setAperturaState({ ...aperturaState, representante: e.target.value })}
                    bg={cardBg}
                    borderColor={borderColor}
                  />
                </FormControl>
              </VStack>
              <Box flex={2} maxH="400px" overflowY="auto" bg={subtleBg} p={4} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <AperturaDocument emp={aperturaState.emp} nombreBanco={aperturaState.nombreBanco} representante={aperturaState.representante} isPreview={true} />
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={borderColor}>
            <Button variant="ghost" mr={3} onClick={() => setAperturaState({ ...aperturaState, show: false })}>
              Cerrar
            </Button>
            <Button colorScheme="red" onClick={handlePrintApertura}>
              Exportar a PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Constancia Modal */}
      <Modal isOpen={constanciaState.show} onClose={() => setConstanciaState({ ...constanciaState, show: false })} size="5xl" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={modalBg} borderRadius="xl">
          <ModalHeader color={textPrimary}>Constancia laboral</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Flex direction={{ base: "column", md: "row" }} gap={6}>
              <VStack spacing={4} flex={1}>
                <Box w="100%">
                  <Text fontSize="sm" fontWeight="bold" mb={2} color={textPrimary}>Desempeño laboral</Text>
                  <FormControl isRequired mb={3}>
                    <FormLabel color={textSecondary} fontSize="xs">Desde</FormLabel>
                    <Input
                      type="date"
                      size="sm"
                      value={constanciaState.desde}
                      onChange={(e) => setConstanciaState({ ...constanciaState, desde: e.target.value })}
                      bg={cardBg}
                      borderColor={borderColor}
                    />
                  </FormControl>
                  <FormControl mb={2}>
                    <Flex justify="space-between" align="center">
                      <FormLabel color={textSecondary} fontSize="xs" m={0}>Al</FormLabel>
                      <Box>
                        <input
                          type="checkbox"
                          id="hasta-fecha"
                          checked={constanciaState.hastaLaFecha}
                          onChange={(e) => setConstanciaState({ ...constanciaState, hastaLaFecha: e.target.checked })}
                        />
                        <label htmlFor="hasta-fecha" style={{ fontSize: '12px', marginLeft: '6px', color: textSecondary }}>Hasta la fecha</label>
                      </Box>
                    </Flex>
                    <Input
                      type="date"
                      size="sm"
                      value={constanciaState.al}
                      onChange={(e) => setConstanciaState({ ...constanciaState, al: e.target.value })}
                      isDisabled={constanciaState.hastaLaFecha}
                      bg={cardBg}
                      borderColor={borderColor}
                      mt={1}
                    />
                  </FormControl>
                </Box>
                <FormControl>
                  <FormLabel color={textSecondary} fontSize="sm">Representante</FormLabel>
                  <Input
                    size="sm"
                    placeholder="Nombre de la persona que va a firmar"
                    value={constanciaState.representante}
                    onChange={(e) => setConstanciaState({ ...constanciaState, representante: e.target.value })}
                    bg={cardBg}
                    borderColor={borderColor}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color={textSecondary} fontSize="sm">Puesto del empleado</FormLabel>
                  <Input
                    size="sm"
                    value={constanciaState.puesto}
                    isReadOnly
                    bg={subtleBg}
                    borderColor={borderColor}
                  />
                </FormControl>
              </VStack>
              <Box flex={2} maxH="450px" overflowY="auto" bg={subtleBg} p={4} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <ConstanciaDocument emp={constanciaState.emp} desde={constanciaState.desde} al={constanciaState.al} hastaLaFecha={constanciaState.hastaLaFecha} representante={constanciaState.representante} puesto={constanciaState.puesto} isPreview={true} />
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={borderColor}>
            <Button variant="ghost" mr={3} onClick={() => setConstanciaState({ ...constanciaState, show: false })}>
              Cerrar
            </Button>
            <Button colorScheme="red" onClick={handlePrintConstancia}>
              Exportar a PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancelacion Modal */}
      <Modal isOpen={cancelacionState.show} onClose={() => setCancelacionState({ ...cancelacionState, show: false })} size="4xl" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={modalBg} borderRadius="xl">
          <ModalHeader color={textPrimary}>Cancelación de contrato</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Flex direction={{ base: "column", md: "row" }} gap={6}>
              <VStack spacing={4} flex={1}>
                <FormControl>
                  <FormLabel color={textSecondary} fontSize="sm">Representante</FormLabel>
                  <Input
                    placeholder="Nombre del representante"
                    value={cancelacionState.representante}
                    onChange={(e) => setCancelacionState({ ...cancelacionState, representante: e.target.value })}
                    bg={cardBg}
                    borderColor={borderColor}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel color={textSecondary} fontSize="sm">Fecha cancelación</FormLabel>
                  <Input
                    type="date"
                    value={cancelacionState.fechaCancelacion}
                    onChange={(e) => setCancelacionState({ ...cancelacionState, fechaCancelacion: e.target.value })}
                    bg={cardBg}
                    borderColor={borderColor}
                  />
                </FormControl>
              </VStack>
              <Box flex={2} maxH="400px" overflowY="auto" bg={subtleBg} p={4} borderRadius="md" border="1px solid" borderColor={borderColor}>
                <CancelacionDocument emp={cancelacionState.emp} fechaCancelacion={cancelacionState.fechaCancelacion} representante={cancelacionState.representante} isPreview={true} />
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={borderColor}>
            <Button variant="ghost" mr={3} onClick={() => setCancelacionState({ ...cancelacionState, show: false })}>
              Cerrar
            </Button>
            <Button colorScheme="red" onClick={handlePrintCancelacion}>
              Exportar a PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Disciplinaria Modal */}
      <Modal isOpen={disciplinariaState.show} onClose={() => setDisciplinariaState({ ...disciplinariaState, show: false })} size="3xl" isCentered>
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={modalBg} borderRadius="xl">
          <ModalHeader color={textPrimary}>Acción Disciplinaria</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Box maxH="60vh" overflowY="auto" bg={subtleBg} p={4} borderRadius="md" border="1px solid" borderColor={borderColor}>
              <DisciplinariaDocument emp={disciplinariaState.emp} companyName={companies.find(c => c.id === disciplinariaState.emp?.empresa_principal)?.nombre_comercial} isPreview={true} />
            </Box>
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={borderColor}>
            <Button variant="ghost" mr={3} onClick={() => setDisciplinariaState({ ...disciplinariaState, show: false })}>
              Cerrar
            </Button>
            <Button colorScheme="red" onClick={handlePrintDisciplinaria}>
              Exportar a PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Report Preview Modal */}
      <Modal isOpen={reportModalState.show} onClose={() => setReportModalState({ ...reportModalState, show: false })} size="5xl">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent bg={modalBg}>
          <ModalHeader pb={0}>
            <Heading size="md" color={textPrimary}>{reportModalState.title}</Heading>
            <Text fontSize="sm" color={textSecondary} mt={1} fontWeight="normal">
              Mostrando pre-visualización de los primeros {Math.min(reportModalState.data.length, 100)} de {reportModalState.data.length} registros.
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          
          <ModalBody py={4}>
            <Box borderRadius="xl" border="1px solid" borderColor={borderColor} overflow="hidden">
              <TableContainer maxH="400px" overflowY="auto">
                <Table variant="simple" size="sm">
                  <Thead position="sticky" top={0} bg={theadBg} zIndex={1}>
                    <Tr>
                      <Th color={textSecondary} fontSize="xs">Nombre Completo</Th>
                      <Th color={textSecondary} fontSize="xs">Empresa</Th>
                      <Th color={textSecondary} fontSize="xs">Departamento</Th>
                      <Th color={textSecondary} fontSize="xs">Puesto</Th>
                      <Th color={textSecondary} fontSize="xs" textAlign="center">Estado</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {reportModalState.data.slice(0, 100).map((e, idx) => (
                      <Tr key={idx} _hover={{ bg: hoverBg }}>
                        <Td fontSize="sm" fontWeight={500} color={brandColor}>{getFullName(e)}</Td>
                        <Td fontSize="sm">{getEmployeeCompany(e)?.nombre_comercial || 'Sin Empresa'}</Td>
                        <Td fontSize="sm">
                          <Badge variant="outline" colorScheme="gray">{getEmployeeDepartment(e)}</Badge>
                        </Td>
                        <Td fontSize="sm" color={textSecondary}>{e.puesto || 'N/A'}</Td>
                        <Td textAlign="center">
                          <Badge colorScheme={(e.estado || '').toUpperCase() === 'ACTIVO' ? 'green' : 'orange'} px={2} borderRadius="full">
                            {e.estado || 'Activo'}
                          </Badge>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>
          </ModalBody>

          <ModalFooter borderTop="1px solid" borderColor={borderColor} gap={3}>
            <Button variant="ghost" onClick={() => setReportModalState({ ...reportModalState, show: false })}>
              Cancelar
            </Button>
            <Button colorScheme="green" leftIcon={<Download size={16} />} onClick={handleExportReport}>
              Exportar a Excel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <CumpleanerosModal
        isOpen={showCumpleaneros}
        onClose={() => setShowCumpleaneros(false)}
        employees={employees}
        areas={areas}
      />
    </Box>
  );
}

const EmployeeRow = React.memo(({
  emp,
  companies,
  hoverBg,
  textSecondary,
  brandColor,
  accentColor,
  distBarBg,
  getFullName,
  getDist,
  openView,
  openEdit,
  setOffboardState,
  setAbandonoState,
  setAperturaState,
  setConstanciaState,
  setCancelacionState,
  setDisciplinariaState,
  handleGenerateFiniquito,
  handleDelete,
  isReadOnly,
  getEmployeeDepartment
}) => {
  const fullName = getFullName(emp);
  const companyName = companies.find(c => c.id === emp.empresa_principal)?.nombre_comercial || 'SIN ASIGNAR';

  return (
    <Tr transition="all 0.2s" _hover={{ bg: hoverBg }}>
      <Td>
        <Text fontSize="xs" fontWeight={600} color={textSecondary}>{emp.id}</Text>
      </Td>
      <Td>
        <HStack spacing={3}>
          <Avatar
            size="sm"
            name={fullName}
            bg="brand.500"
            color="white"
            fontSize="0.75rem"
            fontWeight={700}
          />
          <Box>
            <Text
              fontSize="sm"
              fontWeight={600}
              color={brandColor}
              cursor="pointer"
              onClick={() => openView(emp)}
              _hover={{ textDecoration: 'underline' }}
              transition="all 0.2s"
            >
              {fullName}
            </Text>
            <Text fontSize="xs" color={textSecondary}>
              {emp.puesto || 'Sin Puesto'}
            </Text>
          </Box>
        </HStack>
      </Td>
      <Td>
        <VStack spacing={1} align="flex-start">
          <Badge
            variant="outline"
            colorScheme="brand"
            fontSize="xs"
            borderRadius="md"
            px={2}
          >
            {getEmployeeDepartment(emp)}
          </Badge>
          <Badge
            variant="subtle"
            colorScheme="gray"
            fontSize="xs"
            borderRadius="md"
            px={2}
          >
            {companyName}
          </Badge>
        </VStack>
      </Td>
      <Td>
        <Text fontSize="sm" fontFamily="mono" fontWeight={600} color={accentColor}>
          {formatQ(emp.sueldo_ordinario || 0)}
        </Text>
      </Td>
      <Td>
        {(() => {
          const distObj = getDist(emp);
          const activeCompanies = companies.filter(c => (distObj[c.id] || 0) > 0);
          const tooltipLabel = activeCompanies.map(c => `${c.nombre_comercial || c.nit}: ${distObj[c.id]}%`).join(' · ');
          
          return (
            <Tooltip
              label={tooltipLabel}
              placement="top"
              hasArrow
              borderRadius="md"
            >
              <Flex
                w="120px"
                h="8px"
                borderRadius="full"
                overflow="hidden"
                bg={distBarBg}
              >
                {companies.map(c => {
                  const pct = distObj[c.id] || 0;
                  return pct > 0 ? (
                    <Box
                      key={c.id}
                      w={`${pct}%`}
                      bg={c.color || 'brand.500'}
                      transition="width 0.3s"
                    />
                  ) : null;
                })}
              </Flex>
            </Tooltip>
          );
        })()}
      </Td>
      <Td>
        <Badge
          colorScheme={emp.estado === 'Activo' ? 'green' : 'orange'}
          fontWeight={600}
          borderRadius="full"
          px={3}
          py={1}
          fontSize="xs"
        >
          {emp.estado}
        </Badge>
      </Td>
      <Td textAlign="right">
        <HStack spacing={{ base: 0, md: 1 }} justify="flex-end">
          <Tooltip label="Ver detalle" hasArrow>
            <IconButton
              aria-label="Ver detalle"
              icon={<Eye size={16} />}
              size={{ base: 'xs', md: 'sm' }}
              variant="ghost"
              colorScheme="brand"
              onClick={() => openView(emp)}
              transition="all 0.3s"
            />
          </Tooltip>
          {!isReadOnly && (
            <Tooltip label="Editar" hasArrow>
              <IconButton
                aria-label="Editar"
                icon={<Edit2 size={16} />}
                size={{ base: 'xs', md: 'sm' }}
                variant="ghost"
                colorScheme="accent"
                onClick={() => openEdit(emp)}
                transition="all 0.3s"
              />
            </Tooltip>
          )}
          {!isReadOnly && emp.estado === 'Activo' && (
            <>
              <Menu>
                <Tooltip label="Generar Documentos" hasArrow>
                  <MenuButton
                    as={IconButton}
                    icon={<FileText size={16} />}
                    size={{ base: 'xs', md: 'sm' }}
                    variant="ghost"
                    colorScheme="blue"
                    transition="all 0.3s"
                  />
                </Tooltip>
                <MenuList fontSize="sm" zIndex={10} shadow="lg">
                  <MenuItem 
                    icon={<UserMinus size={14} />} 
                    onClick={() => setAbandonoState(prev => ({ ...prev, show: true, emp }))}
                  >
                    Abandono de labores
                  </MenuItem>
                  <MenuItem 
                    icon={<FileText size={14} />} 
                    onClick={() => setAperturaState(prev => ({ ...prev, show: true, emp, nombreBanco: '', representante: '' }))}
                  >
                    Apertura de cuenta
                  </MenuItem>
                  <MenuItem 
                    icon={<FileText size={14} />} 
                    onClick={() => setConstanciaState(prev => ({ ...prev, show: true, emp, desde: new Date().toISOString().split('T')[0], al: new Date().toISOString().split('T')[0], hastaLaFecha: true, representante: '', puesto: emp.puesto || '' }))}
                  >
                    Constancia laboral
                  </MenuItem>
                  <MenuItem 
                    icon={<FileText size={14} />} 
                    onClick={() => setCancelacionState(prev => ({ ...prev, show: true, emp, fechaCancelacion: new Date().toISOString().split('T')[0], representante: '' }))}
                  >
                    Cancelación de contrato
                  </MenuItem>
                  <MenuItem 
                    icon={<FileText size={14} />} 
                    onClick={() => setDisciplinariaState(prev => ({ ...prev, show: true, emp }))}
                  >
                    Acción disciplinaria
                  </MenuItem>
                </MenuList>
              </Menu>
              <Tooltip label="Dar de Baja" hasArrow>
                <IconButton
                  aria-label="Dar de Baja"
                  icon={<X size={16} />}
                  size={{ base: 'xs', md: 'sm' }}
                  variant="ghost"
                  colorScheme="orange"
                  onClick={() => setOffboardState({ show: true, empId: emp.id, reason: '', date: new Date().toISOString().split('T')[0] })}
                  transition="all 0.3s"
                />
              </Tooltip>
            </>
          )}
          {emp.estado === 'De Baja' && (
            <Tooltip label="Generar Finiquito" hasArrow>
              <IconButton
                aria-label="Generar Finiquito"
                icon={<FileText size={16} />}
                size={{ base: 'xs', md: 'sm' }}
                variant="ghost"
                colorScheme="blue"
                onClick={() => handleGenerateFiniquito(emp)}
                transition="all 0.3s"
              />
            </Tooltip>
          )}
          {!isReadOnly && (
            <Tooltip label="Eliminar (Permanente)" hasArrow>
              <IconButton
                aria-label="Eliminar"
                icon={<Trash2 size={16} />}
                size={{ base: 'xs', md: 'sm' }}
                variant="ghost"
                colorScheme="red"
                onClick={() => handleDelete(emp.id)}
                transition="all 0.3s"
              />
            </Tooltip>
          )}
        </HStack>
      </Td>
    </Tr>
  );
});
