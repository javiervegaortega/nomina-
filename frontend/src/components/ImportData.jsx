import React, { useState, useContext, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, X, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { DataContext } from '../context/DataContext';

export default function ImportData({ onClose }) {
  const { setAllEmployees, companies } = useContext(DataContext);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setStatus('idle');
      setMessage('');
      
      // Auto-preview
      Papa.parse(selected, {
        complete: (results) => {
          setPreview(results.data.slice(0, 15)); // Preview first 15 lines
        }
      });
    }
  };

  const processImport = () => {
    if (!file) return;
    setStatus('processing');
    setMessage('Procesando archivo...');

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        // La nómina específica tiene los encabezados en la fila 7 (índice 6) o similares
        // Buscamos la fila que empiece con "Nombre" en la segunda columna o algo identificable.
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(20, data.length); i++) {
          if (data[i] && data[i].some(cell => cell && cell.toString().toLowerCase().includes('nombre'))) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          setStatus('error');
          setMessage('No se pudo encontrar la fila de encabezados en el archivo.');
          return;
        }

        const headerRow = data[headerRowIndex] || [];
        let isrColIndex = -1;
        headerRow.forEach((cell, idx) => {
          if (cell && cell.toString().trim().toUpperCase() === 'ISR') {
            isrColIndex = idx; // Get the last ISR column
          }
        });

        // Procesar empleados
        const newEmployees = [];
        let currentId = Date.now();

        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          // Asumimos que la fila tiene suficientes columnas y la primera columna suele ser un ID o vacío, la segunda es el Nombre.
          // Ignoramos filas totales o subtotales
          const firstCell = row[0] ? row[0].toString().toLowerCase() : '';
          const nameCell = row[1] ? row[1].toString().trim() : '';
          
          if (!nameCell || nameCell === '' || nameCell.includes('total') || firstCell.includes('total')) continue;

          // Parseo rudimentario de las columnas basado en la estructura que vimos
          const name = nameCell;
          const role = row[2] ? row[2].toString().trim() : 'Sin puesto';
          const companyRaw = row[3] ? row[3].toString().trim() : '';
          
          // Buscar empresa en nuestro sistema
          let companyId = companies[0]?.id || 'proquima';
          const foundCompany = companies.find(c => (c.nombre_comercial && c.nombre_comercial.toLowerCase() === companyRaw.toLowerCase()) || c.id === Number(companyRaw) || (c.nit && c.nit.toLowerCase() === companyRaw.toLowerCase()));
          if (foundCompany) companyId = foundCompany.id;

          // Salarios (eliminar puntos de miles, cambiar coma por punto decimal)
          const parseCurrency = (val) => {
            if (!val) return 0;
            let clean = val.toString().replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]+/g, "");
            return parseFloat(clean) || 0;
          };

          const base = parseCurrency(row[4]);
          const bonus = parseCurrency(row[5]);
          const parsedIsr = isrColIndex !== -1 ? parseCurrency(row[isrColIndex]) : 0;

          newEmployees.push({
            id: currentId++,
            name,
            role,
            company: companyId,
            dept: 'OPERACIONES', // Default
            base,
            bonus,
            status: 'ACTIVO',
            dist: { [companyId]: 100 },
            deductions: { isr: parsedIsr, bank: 0, cell: 0, cafe: 0, product: 0, insurance: 0, other: 0, shoes: 0, uniform: 0 },
            extras: { simplesQty: 0, simplesVal: 0, doblesQty: 0, doblesVal: 0, comisiones: 0, otrosIngresos: 0 }
          });
        }

        if (newEmployees.length > 0) {
          setAllEmployees(newEmployees);
          setStatus('success');
          setMessage(`Se importaron exitosamente ${newEmployees.length} empleados.`);
        } else {
          setStatus('error');
          setMessage('No se encontraron empleados válidos en el archivo.');
        }
      },
      error: (err) => {
        setStatus('error');
        setMessage('Error al leer el archivo: ' + err.message);
      }
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importar Datos de Nómina (CSV)</h2>
          <button className="btn btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Sube tu archivo <code style={{ color: 'var(--accent-light)' }}>NOMINA.csv</code> original. El sistema detectará automáticamente los empleados, sus puestos, salarios base y empresas asignadas.
          </p>

          <div style={{
            border: '2px dashed var(--border)', padding: '2rem', borderRadius: 'var(--radius-lg)',
            textAlign: 'center', background: 'var(--bg-glass)', marginBottom: '1.5rem'
          }}>
            <FileText size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '1rem' }} />
            <h3>{file ? file.name : 'Selecciona o arrastra tu archivo CSV'}</h3>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
              {file ? `${(file.size / 1024).toFixed(2)} KB` : 'Formato soportado: .csv delimitado por punto y coma (;)'}
            </p>
            <input 
              type="file" 
              accept=".csv" 
              style={{ display: 'none' }} 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
              Elegir Archivo
            </button>
          </div>

          {status === 'success' && (
            <div style={{ padding: '1rem', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <CheckCircle size={18} /> {message}
            </div>
          )}

          {status === 'error' && (
            <div style={{ padding: '1rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <AlertTriangle size={18} /> {message}
            </div>
          )}

        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            {status === 'success' ? 'Cerrar' : 'Cancelar'}
          </button>
          {file && status !== 'success' && (
            <button className="btn btn-primary" onClick={processImport} disabled={status === 'processing'}>
              <Upload size={16} /> {status === 'processing' ? 'Procesando...' : 'Iniciar Importación'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
