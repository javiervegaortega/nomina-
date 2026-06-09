import React from 'react';
import { formatQ } from '../data/mockData';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
};

const getFullName = (emp) => {
  const first = emp?.primer_nombre || emp?.nombres || '';
  const last = emp?.primer_apellido || emp?.apellidos || '';
  return `${first} ${last}`.trim() || 'Sin Nombre';
};

const ROWS = [
  { key: 'indemnizacion', label: 'Indemnización por tiempo servido' },
  { key: 'aguinaldoProp', label: 'Aguinaldo proporcional' },
  { key: 'bono14Prop', label: 'Bono 14 proporcional' },
  { key: 'vacaciones', label: 'Vacaciones pendientes de goce' },
];

export default function FiniquitoDocument({ emp, calculation, company }) {
  const baseSalary = Number(emp?.sueldo_ordinario || 0) + Number(emp?.bon_incentivo || 0);
  const issueDate = formatDate(new Date().toISOString());

  return (
    <div
      style={{
        width: '794px',
        minHeight: '1123px',
        backgroundColor: '#ffffff',
        color: '#1a1a1a',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: '13px',
        lineHeight: 1.5,
        padding: '48px 56px',
        boxSizing: 'border-box',
      }}
    >
      {/* Encabezado empresa */}
      <div style={{ borderBottom: '2px solid #1e3a5f', paddingBottom: '20px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a5f', letterSpacing: '0.02em' }}>
              {company?.nombre_comercial || 'Empresa'}
            </div>
            {company?.nit && (
              <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                NIT: {company.nit}
              </div>
            )}
            {company?.direccion && (
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                {company.direccion}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Documento oficial
            </div>
            <div style={{ fontSize: '12px', color: '#333', marginTop: '4px' }}>
              Fecha de emisión: <strong>{issueDate}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Título */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Cálculo de Finiquito (Liquidación Laboral)
        </div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
          Constancia de prestaciones y beneficios laborales al momento de la baja
        </div>
      </div>

      {/* Datos del empleado */}
      <div style={{ marginBottom: '28px', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#f0f4f8', padding: '10px 16px', fontWeight: 700, fontSize: '12px', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Datos del trabajador
        </div>
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          <InfoField label="Nombre completo" value={getFullName(emp)} bold />
          <InfoField label="Puesto" value={emp?.puesto || '—'} />
          <InfoField label="DPI" value={emp?.dpi || '—'} />
          <InfoField label="NIT" value={emp?.nit || '—'} />
          <InfoField label="No. IGSS" value={emp?.no_igss || '—'} />
          <InfoField label="Salario base computable" value={formatQ(baseSalary)} bold />
          <InfoField label="Fecha de ingreso" value={formatDate(emp?.fecha_inicio)} />
          <InfoField label="Fecha de baja" value={formatDate(emp?.fecha_baja)} />
          {emp?.motivo_baja && (
            <div style={{ gridColumn: '1 / -1' }}>
              <InfoField label="Motivo de baja" value={emp.motivo_baja} />
            </div>
          )}
        </div>
      </div>

      {/* Tabla de conceptos */}
      <div style={{ marginBottom: '28px', border: '1px solid #d0d7de', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#f0f4f8', padding: '10px 16px', fontWeight: 700, fontSize: '12px', color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Desglose de prestaciones
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafbfc', borderBottom: '1px solid #d0d7de' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>
                Concepto
              </th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '11px', color: '#666', fontWeight: 600, textTransform: 'uppercase', width: '160px' }}>
                Monto (GTQ)
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.key} style={{ borderBottom: i < ROWS.length - 1 ? '1px solid #eaeef2' : 'none' }}>
                <td style={{ padding: '12px 16px', color: '#333' }}>{row.label}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#1e3a5f' }}>
                  {formatQ(calculation?.[row.key] || 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#1e3a5f' }}>
              <td style={{ padding: '14px 16px', fontWeight: 700, color: '#ffffff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Gran total a recibir
              </td>
              <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#ffffff', fontSize: '16px' }}>
                {formatQ(calculation?.total || 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Nota legal */}
      <div style={{ marginBottom: '40px', padding: '14px 16px', backgroundColor: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', color: '#555', lineHeight: 1.6 }}>
        El presente documento constituye una constancia del cálculo de prestaciones laborales conforme a la legislación
        guatemalteca vigente. Los montos indicados corresponden a la liquidación al momento de la terminación de la
        relación laboral. Con la recepción del pago, el trabajador declara haber recibido a satisfacción las
        prestaciones aquí detalladas.
      </div>

      {/* Firmas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '48px', marginTop: '60px' }}>
        <SignatureBlock label="Por la empresa" name={company?.nombre_comercial || 'Representante legal'} />
        <SignatureBlock label="Recibí conforme" name={getFullName(emp)} />
      </div>
    </div>
  );
}

function InfoField({ label, value, bold }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: bold ? 700 : 400, color: '#1a1a1a' }}>
        {value}
      </div>
    </div>
  );
}

function SignatureBlock({ label, name }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ borderTop: '1px solid #333', paddingTop: '8px', marginTop: '48px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>{name}</div>
        <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </div>
      </div>
    </div>
  );
}
