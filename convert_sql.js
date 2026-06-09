const fs = require('fs');

// Este script lee el archivo SQL original (por ejemplo, "empleados_viejos.sql")
// Y genera un nuevo archivo "migracion_empleados.sql" con la estructura de tu nuevo sistema.

// Instrucciones de uso:
// 1. Guarda todo tu INSERT INTO `empleado` ... en un archivo llamado "empleados_viejos.sql" en esta misma carpeta.
// 2. Ejecuta este script con: node convert_sql.js
// 3. Importa el archivo resultante "migracion_empleados.sql" a tu base de datos nueva.

const inputFile = 'empleados_viejos.sql';
const outputFile = 'migracion_empleados.sql';

if (!fs.existsSync(inputFile)) {
  console.log(`Por favor, crea el archivo ${inputFile} con tus datos INSERT originales para poder convertirlo.`);
  process.exit(1);
}

const sqlData = fs.readFileSync(inputFile, 'utf8');

// Extraer sólo los VALUES
const valuesMatch = sqlData.match(/VALUES\s+([\s\S]*);?/i);
if (!valuesMatch) {
  console.log("No se encontraron registros VALUES en el archivo.");
  process.exit(1);
}

const valuesStr = valuesMatch[1].trim();
const lines = valuesStr.split(/\),\s*\(/);

const mappedData = lines.map((line, index) => {
  let l = line.trim();
  if (index === 0 && l.startsWith('(')) l = l.substring(1);
  if (index === lines.length - 1 && l.endsWith(')')) l = l.substring(0, l.length - 1);
  if (l.endsWith(');')) l = l.substring(0, l.length - 2);
  
  // parse csv with single quotes handling
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
  
  // Unquote
  const unquote = (str) => {
    if (str === 'NULL') return null;
    if (str.startsWith("'") && str.endsWith("'")) return str.substring(1, str.length - 1);
    return str;
  };
  
  const escapeSql = (str) => {
    if (str === null) return 'NULL';
    return "'" + str.replace(/'/g, "''") + "'";
  };

  const parsedRow = row.map(unquote);
  if (parsedRow.length < 90) return null; // Saltar filas mal formadas

  const mapEstado = (val) => val == 1 ? 'Activo' : 'De Baja';
  const mapEstadoCivil = (val) => val == 1 ? 'Soltero/a' : (val == 2 ? 'Casado/a' : 'Unido/a');
  const mapGenero = (val) => val == 1 ? 'Hombre' : 'Mujer';
  const mapTipoLicencia = (val) => val == 1 ? 'Carro' : 'Moto';
  const mapClaseLicencia = (val) => val == 1 ? 'A' : (val == 2 ? 'B' : (val == 3 ? 'C' : 'M'));
  const mapTipoPago = (val) => val == 1 ? 'Cheque' : 'Transferencia';
  const mapBanco = (val) => val == 1 ? 'Banco Industrial' : (val == 2 ? 'Banco Promerica' : 'Banco de Desarrollo Rural');
  const mapTipoCuenta = (val) => val == 1 ? 'Monetaria' : 'Ahorro';
  const mapMoneda = (val) => val == 1 ? 'GTQ' : 'USD';
  const mapCondicion = (val) => val == 1 ? 'Temporal' : 'Fijo';
  const mapJornada = (val) => val == 1 ? 'Diurna' : 'Nocturna';

  const newRow = {
    id: parseInt(parsedRow[0]),
    estado: mapEstado(parsedRow[1]),
    primer_nombre: parsedRow[2],
    segundo_nombre: parsedRow[3],
    otro_nombre: parsedRow[4],
    primer_apellido: parsedRow[5],
    segundo_apellido: parsedRow[6],
    direccion: parsedRow[7],
    estado_civil: mapEstadoCivil(parsedRow[8]),
    fecha_nacimiento: parsedRow[9],
    dpi: parsedRow[11],
    no_igss: parsedRow[12],
    centro_de_costo: parsedRow[13],
    fecha_inicio: parsedRow[14],
    fecha_baja: parsedRow[15] !== '0000-00-00 00:00:00' ? parsedRow[15] : null,
    telefono: parsedRow[16],
    genero: mapGenero(parsedRow[17]),
    licencia: parsedRow[18],
    tipo_licencia: mapTipoLicencia(parsedRow[19]),
    clase_licencia: mapClaseLicencia(parsedRow[20]),
    horas_extra: parsedRow[21] == 1 ? 1 : 0,
    tipo_de_pago: mapTipoPago(parsedRow[22]),
    banco: mapBanco(parsedRow[23]),
    no_cuenta: parsedRow[24],
    tipo_cuenta: mapTipoCuenta(parsedRow[25]),
    moneda: mapMoneda(parsedRow[26]),
    sueldo_ordinario: parseFloat(parsedRow[33] || 0),
    bon_dec_37_2001: parseFloat(parsedRow[29] || 250),
    bon_incentivo: parseFloat(parsedRow[30] || 0),
    nacionalidad: parsedRow[55],
    departamento_originario: parsedRow[57],
    municipio_originario: parsedRow[58],
    apellido_casada: parsedRow[61],
    condicion_laboral: mapCondicion(parsedRow[62]),
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
    jornada: mapJornada(parsedRow[91]),
    dist: '{}'
  };

  const keys = Object.keys(newRow);
  const vals = Object.values(newRow).map(val => typeof val === 'number' ? val : escapeSql(val));
  
  return `(${vals.join(', ')})`;
}).filter(Boolean);

if (mappedData.length > 0) {
    const columns = Object.keys({
        id: 1, estado: 1, primer_nombre: 1, segundo_nombre: 1, otro_nombre: 1, primer_apellido: 1, 
        segundo_apellido: 1, direccion: 1, estado_civil: 1, fecha_nacimiento: 1, dpi: 1, no_igss: 1, 
        centro_de_costo: 1, fecha_inicio: 1, fecha_baja: 1, telefono: 1, genero: 1, licencia: 1, 
        tipo_licencia: 1, clase_licencia: 1, horas_extra: 1, tipo_de_pago: 1, banco: 1, no_cuenta: 1, 
        tipo_cuenta: 1, moneda: 1, sueldo_ordinario: 1, bon_dec_37_2001: 1, bon_incentivo: 1, 
        nacionalidad: 1, departamento_originario: 1, municipio_originario: 1, apellido_casada: 1, 
        condicion_laboral: 1, telefono_celular: 1, telefono_emergencia: 1, nombre_emergencia: 1, 
        edad: 1, nit: 1, departamento_laboral: 1, puesto: 1, rol_permisos: 1, jubilacion: 1, 
        discapacidad: 1, jornada: 1, dist: 1
    });

    const insertStatement = `INSERT INTO \`employee\` (\`${columns.join('`, `')}\`) VALUES\n` + mappedData.join(',\n') + ';';
    fs.writeFileSync(outputFile, insertStatement);
    console.log(`¡Éxito! Se han migrado ${mappedData.length} registros y guardado en ${outputFile}.`);
} else {
    console.log("No se pudo procesar ninguna fila.");
}
