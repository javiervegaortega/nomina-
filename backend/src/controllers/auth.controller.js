const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { Op } = require('sequelize');
require('dotenv').config();

const register = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [
          { email },
          { username: username || '' }
        ]
      } 
    });
    if (existingUser) {
      return res.status(400).json({ error: 'El correo o nombre de usuario ya está registrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      username,
      email,
      password: hashedPassword
    });

    res.status(201).json({ message: 'Usuario creado exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const identifier = req.body.email; 
    const password = req.body.password;
    
    const user = await User.findOne({ 
      where: { 
        [Op.or]: [
          { email: identifier },
          { username: identifier }
        ]
      } 
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  register,
  login
};
