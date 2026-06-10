const fs = require('fs');
const { sequelize, Employee, Company } = require('./src/models');

const cleanPrefix = (str) => {
  if (!str) return '';
  str = str.trim();
  return str.startsWith("'") ? str.substring(1) : str;
};

const parseDate = (str) => {
  if (!str) return null;
  str = str.trim();
  if (str === '0000-00-00 00:00:00' || str === '0000-00-00') return null;
  // If it's a valid date string
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d;
};

const parseBool = (str) => {
  if (!str) return false;
  str = str.trim().toLowerCase();
  return str === 'sí' || str === 'si' || str === '1' || str === 'true';
};

const parseDecimal = (str) => {
  if (!str) return 0;
  str = str.replace(/,/g, '').trim();
  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
};

async function run() {
  try {
    console.log('Fetching companies...');
    const companies = await sequelize.query('SELECT id, nombre_comercial FROM empresa', { type: sequelize.QueryTypes.SELECT });
    const companyMap = {};
    companies.forEach(c => {
      companyMap[c.nombre_comercial.trim().toLowerCase()] = c.id;
    });

    console.log('Reading Excel data...');
    const data = fs.readFileSync('C:\\Users\\jyaxo\\Desktop\\nomina-v2\\nomina-\\Reporte_Completo_2026-06-10_09-10.xls', 'utf-8');
    const trRegex = /<tr>(.*?)<\/tr>/gs;
    const tdRegex = /<td>(.*?)<\/td>/gs;

    let match;
    let updatedCount = 0;
    let notFoundCount = 0;
    const errors = [];

    while ((match = trRegex.exec(data)) !== null) {
      const tds = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(match[1])) !== null) {
        tds.push(tdMatch[1].trim());
      }
      
      // Check if this is a valid data row (ID is present and not 'ID')
      if (tds.length >= 94 && tds[0] && tds[0] !== 'ID' && !isNaN(parseInt(tds[0]))) {
        const id = parseInt(tds[0]);
        
        let estado = tds[1];
        if (estado === 'Inactivo') estado = 'DE BAJA';

        const primer_nombre = tds[3];
        const segundo_nombre = tds[4];
        const otro_nombre = tds[5];
        const primer_apellido = tds[6];
        const segundo_apellido = tds[7];
        const apellido_casada = tds[8];
        const genero = tds[9];
        const estado_civil = tds[10];
        const fecha_nacimiento = parseDate(tds[11]);
        const edad = tds[12];
        const nacionalidad = tds[13];
        const dpi = cleanPrefix(tds[14]);
        const emision_dpi = tds[15];
        const lugar_emision_dpi = tds[15];
        const nit = cleanPrefix(tds[16]);
        const no_igss = cleanPrefix(tds[17]);
        const afiliacion = tds[18];
        const licencia = cleanPrefix(tds[19]);
        const tipo_licencia = tds[20];
        const clase_licencia = tds[21];
        const direccion = tds[22];
        const telefono = cleanPrefix(tds[23]);
        const telefono_celular = cleanPrefix(tds[24]);
        const region_originario = tds[25];
        const departamento_originario = tds[26];
        const municipio_originario = tds[27];
        const municipio_laboral = tds[29];
        
        // Empresa Principal
        const empresaName = tds[30] ? tds[30].trim().toLowerCase() : '';
        const empresa_principal = companyMap[empresaName] || null;

        // Distribucion
        const distStr = tds[31];
        const distObj = {};
        if (distStr) {
          const parts = distStr.split('|');
          parts.forEach(p => {
            const [cName, pctStr] = p.split(':');
            if (cName && pctStr) {
              const cleanedCName = cName.trim().toLowerCase();
              const cid = companyMap[cleanedCName];
              if (cid) {
                distObj[cid] = parseDecimal(pctStr.replace('%',''));
              }
            }
          });
        }

        const centro_de_costo = tds[33];
        const dimension_5 = tds[36];
        const nivel_5 = tds[36];
        const puesto = tds[37];
        const codigo_ocupacion = tds[38];
        const condicion_laboral = tds[39];
        const fecha_inicio = parseDate(tds[40]);
        const fecha_baja = parseDate(tds[41]);
        const dias_laborados = parseInt(tds[42]) || 0;
        const horas_laborales = parseInt(tds[43]) || 0;
        const jornada = tds[44];
        const temporal = parseDate(tds[45]);
        const tipo_planilla = tds[46];
        const tipo_de_pago = tds[47];
        const banco = tds[48];
        const tipo_cuenta = tds[49];
        const no_cuenta = cleanPrefix(tds[50]);
        
        let moneda = tds[51];
        if (moneda === 'Quetzal') moneda = 'GTQ';
        else if (moneda === 'Dólar' || moneda === 'Dolar') moneda = 'USD';

        const sueldo_ordinario = parseDecimal(tds[52]);
        const bon_dec_37_2001 = parseDecimal(tds[53]);
        const bon_incentivo = parseDecimal(tds[54]);
        const horas_extras_simples = parseDecimal(tds[55]);
        const horas_extras_dobles = parseDecimal(tds[56]);
        const horas_extra = parseBool(tds[57]);
        const otro_ingresos = parseDecimal(tds[58]);
        const ventas_economicas = parseDecimal(tds[59]);
        const vacaciones = parseDecimal(tds[60]);
        const igss_laboral = parseDecimal(tds[61]);
        const igss_patronal = parseDecimal(tds[62]);
        const isr = parseDecimal(tds[63]);
        const bancos = parseDecimal(tds[64]);
        const judiciales = parseDecimal(tds[65]);
        const seguro = parseDecimal(tds[66]);
        const parqueo = parseDecimal(tds[67]);
        const anticipo_quincenal = parseDecimal(tds[68]);
        const bantrab = parseDecimal(tds[69]);
        const boleto_de_ornato = parseDecimal(tds[70]);
        const prestamo_empresa = parseDecimal(tds[71]);
        const otro_descuentos = parseDecimal(tds[72]);
        
        const primaria = parseBool(tds[73]);
        const grado_primaria = tds[74];
        const secundaria = parseBool(tds[75]);
        const grado_secundaria = tds[76];
        const diversificado = parseBool(tds[77]);
        const universidad = parseBool(tds[78]);
        const titulo_diploma = tds[79];
        const conyugue = tds[80];
        const edad_conyuge = tds[81];
        const ocupacion_conyuge = tds[82];
        const nombre_padre = tds[83];
        const edad_padre = tds[84];
        const ocupacion_padre = tds[85];
        const nombre_madre = tds[86];
        const edad_madre = tds[87];
        const ocupacion_madre = tds[88];
        const nombre_emergencia = tds[89];
        const telefono_emergencia = cleanPrefix(tds[90]);
        const jubilacion = parseBool(tds[91]);
        const discapacidad = tds[92];
        const rol_permisos = tds[93];

        const updateData = {
          estado,
          primer_nombre,
          segundo_nombre,
          otro_nombre,
          primer_apellido,
          segundo_apellido,
          apellido_casada,
          genero,
          estado_civil,
          fecha_nacimiento,
          edad,
          nacionalidad,
          dpi,
          emision_dpi,
          lugar_emision_dpi,
          nit,
          no_igss,
          afiliacion,
          licencia,
          tipo_licencia,
          clase_licencia,
          direccion,
          telefono,
          telefono_celular,
          region_originario,
          departamento_originario,
          municipio_originario,
          municipio_laboral,
          empresa_principal,
          dist: distObj,
          centro_de_costo,
          dimension_5,
          nivel_5,
          puesto,
          codigo_ocupacion,
          condicion_laboral,
          fecha_inicio,
          fecha_baja,
          dias_laborados,
          horas_laborales,
          jornada,
          temporal,
          tipo_planilla,
          tipo_de_pago,
          banco,
          tipo_cuenta,
          no_cuenta,
          moneda,
          sueldo_ordinario,
          bon_dec_37_2001,
          bon_incentivo,
          horas_extras_simples,
          horas_extras_dobles,
          horas_extra,
          otro_ingresos,
          ventas_economicas,
          vacaciones,
          igss_laboral,
          igss_patronal,
          isr,
          bancos,
          judiciales,
          seguro,
          parqueo,
          anticipo_quincenal,
          bantrab,
          boleto_de_ornato,
          prestamo_empresa,
          otro_descuentos,
          primaria,
          grado_primaria,
          secundaria,
          grado_secundaria,
          diversificado,
          universidad,
          titulo_diploma,
          conyugue,
          edad_conyuge,
          ocupacion_conyuge,
          nombre_padre,
          edad_padre,
          ocupacion_padre,
          nombre_madre,
          edad_madre,
          ocupacion_madre,
          nombre_emergencia,
          telefono_emergencia,
          jubilacion,
          discapacidad,
          rol_permisos
        };

        const [affectedRows] = await Employee.update(updateData, { where: { id } });
        if (affectedRows > 0) {
          updatedCount++;
        } else {
          notFoundCount++;
          errors.push(`ID ${id} no encontrado en base de datos.`);
        }
      }
    }

    console.log(`\n=== MIGRACIÓN COMPLETADA ===`);
    console.log(`Actualizados: ${updatedCount}`);
    console.log(`No encontrados: ${notFoundCount}`);
    if (errors.length > 0) {
      console.log('Errores:', errors);
    }

  } catch (err) {
    console.error('FATAL ERROR:', err);
  } finally {
    process.exit();
  }
}

run();
