import React from 'react';
import { Box } from '@chakra-ui/react';

const DisciplinariaDocument = React.forwardRef(({ emp, companyName, isPreview = false }, ref) => {
  if (!emp) return <div ref={ref} style={{ display: 'none' }} />;

  const fullName = `${emp.primer_nombre || ''} ${emp.segundo_nombre || ''} ${emp.otro_nombre || ''} ${emp.primer_apellido || ''} ${emp.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim() || 'Empleado';

  // Use consistent pixel values. Letter = 816x1056 at 96dpi
  const printW = 816;
  const printPad = 50;
  const fs = '11px';
  const fsTitle = '14px';
  const fsSmall = '10px';
  const b = '1px solid black';
  const cellPad = '3px 6px';

  const docContent = (
    <div
      ref={!isPreview ? ref : undefined}
      style={{
        width: isPreview ? '100%' : `${printW}px`,
        minHeight: isPreview ? 'auto' : `${1056}px`,
        padding: isPreview ? '16px' : `${printPad}px`,
        backgroundColor: 'white',
        color: 'black',
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: fs,
        lineHeight: '1.4',
        boxSizing: 'border-box',
      }}
    >
      {/* ===== MAIN TABLE ===== */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '16.6%' }} />
          <col style={{ width: '16.6%' }} />
          <col style={{ width: '16.8%' }} />
          <col style={{ width: '16.6%' }} />
          <col style={{ width: '16.6%' }} />
          <col style={{ width: '16.8%' }} />
        </colgroup>
        <tbody>
          {/* Title */}
          <tr>
            <td colSpan={6} style={{ background: 'black', color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: fsTitle, padding: '5px 0', border: b }}>
              ACCION DISCIPLINARIA
            </td>
          </tr>
          {/* NOMBRE */}
          <tr>
            <td style={{ border: b, padding: cellPad, fontWeight: 'bold', fontSize: fs }}>NOMBRE</td>
            <td colSpan={5} style={{ border: b, padding: cellPad, textAlign: 'center', fontSize: fs }}>{fullName}</td>
          </tr>
          {/* CARGO */}
          <tr>
            <td colSpan={3} style={{ border: b, padding: cellPad, fontWeight: 'bold', fontSize: fs }}>CARGO</td>
            <td colSpan={3} style={{ border: b, padding: cellPad, textAlign: 'right', fontSize: fs }}>{emp.puesto || ''}</td>
          </tr>
          {/* EMPRESA */}
          <tr>
            <td colSpan={3} style={{ border: b, padding: cellPad, fontWeight: 'bold', fontSize: fs }}>EMPRESA</td>
            <td colSpan={3} style={{ border: b, padding: cellPad, fontSize: fs }}>{companyName || ''}</td>
          </tr>
          {/* FECHA */}
          <tr>
            <td colSpan={3} style={{ border: b, padding: cellPad, fontWeight: 'bold', fontSize: fs, whiteSpace: 'nowrap' }}>FECHA DEL ACONTECIMIENTO</td>
            <td colSpan={3} style={{ border: b, padding: cellPad, fontSize: fs }}></td>
          </tr>
          {/* Describa */}
          <tr>
            <td colSpan={6} style={{ border: b, padding: cellPad, fontWeight: 'bold', fontSize: fs }}>Describa la situacion:</td>
          </tr>
          {/* 12 empty lines */}
          {Array.from({ length: 12 }).map((_, i) => (
            <tr key={`line-${i}`}>
              <td colSpan={6} style={{ border: b, padding: cellPad, fontSize: fs, height: '20px' }}>&nbsp;</td>
            </tr>
          ))}
          {/* Amonestación */}
          <tr>
            <td colSpan={2} style={{ border: b, padding: cellPad, fontSize: fs, whiteSpace: 'nowrap' }}>Amonestación es la:</td>
            <td style={{ border: b, padding: cellPad, fontSize: fs }}>Primera</td>
            <td style={{ border: b, padding: cellPad, fontSize: fs }}>Segunda</td>
            <td style={{ border: b, padding: cellPad, fontSize: fs }}>Tercera</td>
            <td style={{ border: b, padding: cellPad, fontSize: fs }}></td>
          </tr>
          {/* Testigos */}
          <tr>
            <td style={{ border: b, padding: cellPad, fontWeight: 'bold', fontSize: fs }}>Testigos</td>
            <td colSpan={5} style={{ border: b, padding: cellPad, fontSize: fs }}></td>
          </tr>
          {/* Comentarios */}
          <tr>
            <td colSpan={6} style={{ border: b, padding: cellPad, fontWeight: 'bold', fontSize: fs }}>Comentarios del colaborador:</td>
          </tr>
          {Array.from({ length: 3 }).map((_, i) => (
            <tr key={`com-${i}`}>
              <td colSpan={6} style={{ border: b, padding: cellPad, fontSize: fs, height: '20px' }}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== SIGNATURES ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', marginBottom: '20px', paddingLeft: '10px', paddingRight: '10px' }}>
        <div style={{ width: '38%', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid black', marginBottom: '4px' }}></div>
          <span style={{ fontSize: fs }}>Jefe Inmediato</span>
        </div>
        <div style={{ width: '38%', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid black', marginBottom: '4px' }}></div>
          <span style={{ fontSize: fs }}>Nombre y firma del colaborador</span>
        </div>
      </div>

      {/* ===== MEDIDA ADOPTADA ===== */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '18%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <tbody>
          {/* Header */}
          <tr>
            <td colSpan={8} style={{ background: '#d0d0d0', textAlign: 'center', fontWeight: 'bold', fontSize: fsTitle, padding: '4px 0', border: b }}>
              MEDIDA ADOPTADA
            </td>
          </tr>
          {/* Row 1 */}
          <tr>
            <td rowSpan={2} style={{ border: b, padding: cellPad, fontSize: fsSmall, verticalAlign: 'middle' }}>Llamada de atención</td>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}>Verbal</td>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}></td>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}>Suspensión</td>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}></td>
            <td rowSpan={2} style={{ border: b, padding: cellPad, fontSize: fsSmall, verticalAlign: 'middle' }}>No. Días suspendidos</td>
            <td rowSpan={2} style={{ border: b, padding: cellPad, fontSize: fsSmall, textAlign: 'center', verticalAlign: 'middle' }}>Fecha</td>
            <td rowSpan={2} style={{ border: b, padding: cellPad, fontSize: fsSmall }}></td>
          </tr>
          {/* Row 2 */}
          <tr>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}>escrita</td>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}></td>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}>laboral</td>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}></td>
          </tr>
          {/* Terminación */}
          <tr>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}>Terminación Laboral</td>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}>Fecha</td>
            <td style={{ border: b, padding: cellPad, fontSize: fsSmall }}></td>
            <td colSpan={2} style={{ border: b, padding: cellPad, fontSize: fsSmall }}>Indemnización</td>
            <td colSpan={3} style={{ border: b, padding: cellPad, fontSize: fsSmall }}></td>
          </tr>
          {/* ACCION EN NOMINA */}
          <tr>
            <td colSpan={8} style={{ background: '#d0d0d0', textAlign: 'center', fontWeight: 'bold', fontSize: fsTitle, padding: '4px 0', border: b }}>
              ACCION EN NOMINA
            </td>
          </tr>
        </tbody>
      </table>

      {/* ===== FOOTER ===== */}
      <div style={{ marginTop: '50px' }}>
        <p style={{ margin: 0, fontSize: fsSmall, color: 'red' }}>Original: Recursos Humanos/File Personal</p>
        <p style={{ margin: 0, fontSize: fsSmall, color: 'red' }}>Duplicado: Ministerio de Trabajo - Inspección</p>
      </div>
    </div>
  );

  if (isPreview) {
    return (
      <Box bg="white" borderRadius="md" boxShadow="sm" border="1px solid" borderColor="gray.200">
        {docContent}
      </Box>
    );
  }

  return docContent;
});

export default DisciplinariaDocument;
