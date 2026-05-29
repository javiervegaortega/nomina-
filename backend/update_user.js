const { User, sequelize } = require('./models');

async function updateUserData() {
  try {
    // Sincronizar para asegurar que la columna `username` exista en la tabla
    await sequelize.sync({ alter: true });

    // Buscar el usuario "Juan Pablo" o con su correo
    const user = await User.findOne({ where: { email: 'jyaxon@example.com' } });
    
    if (user) {
      await user.update({
        name: 'Juan Pablo Yaxon',
        username: 'jyaxon'
      });
      console.log('Usuario actualizado correctamente:');
      console.log(`Nombre: ${user.name}`);
      console.log(`Usuario: ${user.username}`);
    } else {
      console.log('No se encontró el usuario con email jyaxon@example.com');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error actualizando usuario:', err);
    process.exit(1);
  }
}

updateUserData();
