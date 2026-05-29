const { Company } = require('./models');

const companiesToInsert = [
  {
    id: 1,
    nit: '24612227',
    nombre_comercial: 'PROQUIMA,S.A.',
    razon_social: 'PROQUIMA,S.A.',
    calle: 'ZONA 13',
    apto: 'GUATEMALA',
    departamento: 'GUATEMALA',
    apartado_postal: '502',
    telefono: '23105400',
    fax: '00000',
    email: 'mperez@grupoeconsa.com',
    nomenclatura: '1515',
    numero: '1515',
    colonia: 'SANTA FE',
    municipio: 'GUATEMALA',
    direccion: '10MA AVE 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19',
    nombre_patrono: 'PROQUIMA,S.A.',
    direccion_patrono: '10MA AVENIDA 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19',
    numero_patrono: '81376',
    nit_patrono: '24612227',
    id_estado: 1,
    id_banco: 1,
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)'
  },
  {
    id: 2,
    nit: '23038187',
    nombre_comercial: 'UNION HERMANOS,S.A.',
    razon_social: 'UNION HERMANOS,S.A.',
    calle: 'ZONA 13',
    apto: 'GUATEMALA',
    departamento: 'GUATEMALA',
    apartado_postal: '502',
    telefono: '23105400',
    fax: '0',
    email: 'mperez@grupoeconsa.com',
    nomenclatura: '1515',
    numero: '1515',
    colonia: 'SANTA FE',
    municipio: 'GUATEMALA',
    direccion: '10MA AVE 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19',
    nombre_patrono: 'UNION HERMANOS,S.A.',
    direccion_patrono: '10MA AVENIDA 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19',
    numero_patrono: '76559',
    nit_patrono: '23038187',
    id_estado: 1,
    id_banco: 1,
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
  },
  {
    id: 3,
    nit: '75364255',
    nombre_comercial: 'ECONACIONAL,S.A.',
    razon_social: 'ECONACIONAL,S.A.',
    calle: 'ZONA 13',
    apto: 'GUATEMALA',
    departamento: 'GUATEMALA',
    apartado_postal: '502',
    telefono: '23105400',
    fax: '00000',
    email: 'mperez@grupoeconsa.com',
    nomenclatura: '1515',
    numero: '1515',
    colonia: 'SANTA FE',
    municipio: 'GUATEMALA',
    direccion: '10MA AVE 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19',
    nombre_patrono: 'ECONACIONAL,S.A.',
    direccion_patrono: '10MA AVENIDA 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19',
    numero_patrono: '139389',
    nit_patrono: '75364255',
    id_estado: 1,
    id_banco: 1,
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)'
  },
  {
    id: 4,
    nit: '86417177',
    nombre_comercial: 'CLEARTEC, S. A.',
    razon_social: 'Cleartec, S. A.',
    calle: '',
    apto: '',
    departamento: 'Guatemala',
    apartado_postal: '',
    telefono: '23105400',
    fax: '',
    email: '',
    nomenclatura: '',
    numero: '',
    colonia: '',
    municipio: 'Guatemala',
    direccion: '10 AVE 25-63 BOD 1 COL STA FE Z13 GUATE',
    nombre_patrono: 'Cleartec, S. A.',
    direccion_patrono: '10 AVE 25-63 BOD 1 COL STA FE Z13 GUATE',
    numero_patrono: '141653',
    nit_patrono: '86417177',
    id_estado: 1,
    id_banco: 1,
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)'
  },
  {
    id: 5,
    nit: '69063427',
    nombre_comercial: 'CALIDUL',
    razon_social: 'Calidul',
    calle: '25',
    apto: '0',
    departamento: 'Guatemala',
    apartado_postal: '01001',
    telefono: '23105400',
    fax: '23105400',
    email: 'ihlemus@grupoeconsa.com',
    nomenclatura: '0',
    numero: '0',
    colonia: 'Santa Fe',
    municipio: 'Guatemala',
    direccion: '10 Ave. 25-63, zona 13 Int. 18 y 19',
    nombre_patrono: 'CALIDUL',
    direccion_patrono: '10 calle',
    numero_patrono: '138044',
    nit_patrono: '69063427',
    id_estado: 1,
    id_banco: 1,
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)'
  }
];

async function seed() {
  try {
    for (const data of companiesToInsert) {
      const exists = await Company.findByPk(data.id);
      if (exists) {
        await exists.update(data);
      } else {
        await Company.create(data);
      }
    }
    console.log('Se insertaron/actualizaron correctamente las empresas en la base de datos.');
    process.exit(0);
  } catch (error) {
    console.error('Error al insertar las empresas:', error);
    process.exit(1);
  }
}

seed();
