const fs = require('fs');
const transcriptPath = 'C:/Users/juanp/.gemini/antigravity/brain/3af566d7-e679-4bf5-ac06-80f27eada619/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

let userMessage = '';
for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i]) continue;
  try {
    const obj = JSON.parse(lines[i]);
    if (obj.type === 'USER_INPUT' && obj.content && obj.content.includes('CREATE TABLE `empleado`')) {
      userMessage = obj.content;
      break;
    }
  } catch (e) {}
}

if (!userMessage) {
  console.log("Could not find the user message with the SQL dump.");
  process.exit(1);
}

// Extraer sólo los VALUES del string
const valuesMatch = userMessage.match(/VALUES\s*([\s\S]*)/i);
if (!valuesMatch) {
  console.log("No se encontraron registros VALUES en el mensaje.");
  process.exit(1);
}

const valuesStr = valuesMatch[1].trim();
const rowsRaw = valuesStr.split(/\),\s*\(/);

const mappedData = rowsRaw.map((line, index) => {
  let l = line.trim();
  if (index === 0 && l.startsWith('(')) l = l.substring(1);
  if (index === rowsRaw.length - 1) {
     if (l.endsWith(')')) l = l.substring(0, l.length - 1);
     if (l.endsWith(');')) l = l.substring(0, l.length - 2);
  }
  
  const row = [];
  let inString = false;
  let current = '';
  for(let i=0; i<l.length; i++) {
    const c = l[i];
    if (c === "'") {
      inString = !inString;
    } else if (c === ',' && !inString) {
      row.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  row.push(current.trim());
  
  const unquote = (str) => {
    if (!str) return '';
    if (str === 'NULL') return null;
    if (str.startsWith("'") && str.endsWith("'")) return str.substring(1, str.length - 1);
    return str;
  };
  
  const parsedRow = row.map(unquote);
  if (parsedRow.length < 90) return null;

  const mapEstado = (val) => val == 1 ? 'active' : 'inactive'; // Para el UI usamos 'active' o 'inactive'
  
  const newRow = {
    id: parseInt(parsedRow[0]),
    name: (parsedRow[5] || '') + ' ' + (parsedRow[6] || '') + ' ' + (parsedRow[2] || '') + ' ' + (parsedRow[3] || ''),
    role: parsedRow[85],
    dept: parsedRow[82] == 24 ? 'RECURSOS HUMANOS' : (parsedRow[82] == 11 ? 'PRODUCCION' : 'ADMINISTRATIVO'),
    company: 'UNHESA',
    base: parseFloat(parsedRow[33] || 0),
    bonus: parseFloat(parsedRow[29] || 0) + parseFloat(parsedRow[30] || 0),
    days: 30,
    status: mapEstado(parsedRow[1]),
    bankAccount: parsedRow[24],
    bankName: parsedRow[23] == 1 ? 'INDUSTRIAL' : (parsedRow[23] == 2 ? 'PROMERICA' : 'BANTRAB'),
    igssNumber: parsedRow[12],
    dist: { proquima: 0, unhesa: 100, unhesaLiq: 0, econacional: 0, ecomezclas: 0 },
    deductions: { isr: parseFloat(parsedRow[42] || 0), bank: 0, cell: 0, cafe: 0, product: 0, insurance: parseFloat(parsedRow[47] || 0), other: parseFloat(parsedRow[43] || 0), shoes: 0, uniform: 0 },
    extras: { simplesQty: 0, simplesVal: parseFloat(parsedRow[32] || 0), doblesQty: 0, doblesVal: parseFloat(parsedRow[31] || 0), comisiones: 0, otrosIngresos: parseFloat(parsedRow[34] || 0) },
    
    // Todos los demas datos para EmployeeFormModal:
    primer_nombre: parsedRow[2],
    segundo_nombre: parsedRow[3],
    otro_nombre: parsedRow[4],
    primer_apellido: parsedRow[5],
    segundo_apellido: parsedRow[6],
    direccion: parsedRow[7],
    estado_civil: parsedRow[8] == 1 ? 'Soltero/a' : 'Casado/a',
    fecha_nacimiento: parsedRow[9],
    dpi: parsedRow[11],
    no_igss: parsedRow[12],
    centro_de_costo: parsedRow[13],
    fecha_inicio: parsedRow[14],
    fecha_baja: parsedRow[15] !== '0000-00-00 00:00:00' ? parsedRow[15] : null,
    telefono: parsedRow[16],
    genero: parsedRow[17] == 1 ? 'Hombre' : 'Mujer',
    licencia: parsedRow[18],
    tipo_licencia: parsedRow[19] == 1 ? 'Carro' : 'Moto',
    clase_licencia: parsedRow[20] == 1 ? 'A' : 'B',
    horas_extra: parsedRow[21] == 1 ? 1 : 0,
    tipo_de_pago: parsedRow[22] == 1 ? 'Cheque' : 'Transferencia',
    banco_id: parsedRow[23],
    no_cuenta: parsedRow[24],
    tipo_cuenta: parsedRow[25] == 1 ? 'Monetaria' : 'Ahorro',
    moneda: parsedRow[26] == 1 ? 'GTQ' : 'USD',
    sueldo_ordinario: parseFloat(parsedRow[33] || 0),
    bon_dec_37_2001: parseFloat(parsedRow[29] || 250),
    bon_incentivo: parseFloat(parsedRow[30] || 0),
    nacionalidad: parsedRow[55],
    departamento_originario: parsedRow[57],
    municipio_originario: parsedRow[58],
    apellido_casada: parsedRow[61],
    condicion_laboral: parsedRow[62] == 1 ? 'Temporal' : 'Fijo',
    telefono_celular: parsedRow[68],
    telefono_emergencia: parsedRow[69],
    nombre_emergencia: parsedRow[70],
    edad: parsedRow[71],
    nit: parsedRow[81],
    departamento_laboral: parsedRow[82],
    puesto: parsedRow[85],
    rol_permisos: parsedRow[87] || 'empleado',
    jubilacion: parsedRow[88] == 1 ? 1 : 0,
    discapacidad: parsedRow[89],
    jornada: parsedRow[91] == 1 ? 'Diurna' : 'Nocturna',
  };

  newRow.name = newRow.name.trim();
  return newRow;
}).filter(Boolean);

console.log(`Parsed ${mappedData.length} employees.`);

// Escribir los empleados nuevos dentro de mockData.js
const mockDataPath = 'c:/Users/juanp/OneDrive/Desktop/nomina-/frontend/src/data/mockData.js';
let mockDataContent = fs.readFileSync(mockDataPath, 'utf8');

// Eliminar el const EMPLOYEES viejo
const startIdx = mockDataContent.indexOf('export const EMPLOYEES = [');
if (startIdx !== -1) {
    // Buscar donde termina la array EMPLOYEES
    let endIdx = -1;
    let bracketCount = 0;
    let foundStart = false;
    for (let i = startIdx; i < mockDataContent.length; i++) {
        if (mockDataContent[i] === '[') {
            bracketCount++;
            foundStart = true;
        } else if (mockDataContent[i] === ']') {
            bracketCount--;
            if (foundStart && bracketCount === 0) {
                endIdx = i + 1;
                // si hay un punto y coma
                if (mockDataContent[i+1] === ';') endIdx++;
                break;
            }
        }
    }
    
    if (endIdx !== -1) {
        // Generar codigo stringificado
        const mappedString = 'export const EMPLOYEES = ' + JSON.stringify(mappedData, null, 2) + ';';
        mockDataContent = mockDataContent.substring(0, startIdx) + mappedString + mockDataContent.substring(endIdx);
        fs.writeFileSync(mockDataPath, mockDataContent);
        console.log('Successfully updated mockData.js!');
    }
} else {
    console.log('Could not find export const EMPLOYEES in mockData.js');
}
