const { sequelize, Company } = require('./src/models');

const addHidroxon = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const newCompany = await Company.create({
      nit: 'N/A',
      nombre_comercial: 'HIDROXON',
      razon_social: 'HIDROXON',
      calle: 'N/A',
      apto: 'N/A',
      departamento: 'N/A',
      apartado_postal: 'N/A',
      telefono: '23105400',
      fax: 'N/A',
      email: 'N/A',
      nomenclatura: 'N/A',
      numero: 'N/A',
      colonia: 'N/A',
      municipio: 'N/A',
      direccion: '10A. AVE 25-63 ZONA 13 INT 18 Y 19',
      nombre_patrono: 'GERARDO ESTRADA',
      direccion_patrono: '10A AVE 25-63 Z 13 INT 18 Y 19',
      numero_patrono: 'N/A',
      nit_patrono: 'N/A',
      id_estado: 1, // Default to active
      id_banco: 1, // Banco Industrial
      color: '#14b8a6', // teal
      gradient: 'linear-gradient(135deg, #14b8a6, #0f766e)'
    });

    console.log('HIDROXON created successfully:', newCompany.toJSON());
  } catch (error) {
    console.error('Error creating company:', error);
  } finally {
    await sequelize.close();
  }
};

addHidroxon();
