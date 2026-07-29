const bcrypt = require('bcryptjs');
const { User, Department } = require('../models');
const { Op } = require('sequelize');

const ROLES_WITH_DEPARTMENT = new Set(['SOLICITANTE', 'GERENTE']);

const resolveDepartmentForRole = async (role, rawDepartmentId) => {
  const normalizedRole = String(role || '').trim().toUpperCase();
  if (!ROLES_WITH_DEPARTMENT.has(normalizedRole)) return null;

  const departmentId = String(rawDepartmentId || '').trim();
  if (!departmentId) {
    const error = new Error('El departamento es obligatorio para los roles SOLICITANTE y GERENTE.');
    error.statusCode = 400;
    throw error;
  }

  const department = await Department.findByPk(departmentId);
  if (!department) {
    const error = new Error('El departamento seleccionado no existe.');
    error.statusCode = 400;
    throw error;
  }

  return String(department.id);
};

const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] }
    });
    res.json(users);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, username, email, password, role, idDepartamento } = req.body;
    const resolvedDepartmentId = await resolveDepartmentForRole(role, idDepartamento);
    
    // Check role constraints based on requester
    const requesterRole = req.user.role;
    if (requesterRole === 'NOMINA' || requesterRole === 'DIGITADOR') {
      if (role !== 'NOMINA' && role !== 'DIGITADOR') {
        return res.status(403).json({ error: 'Solo puedes asignar el rol NOMINA o DIGITADOR.' });
      }
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username: username || null }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'El correo o nombre de usuario ya está en uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      username: username || null,
      email,
      password: hashedPassword,
      role,
      idDepartamento: resolvedDepartmentId
    });

    const userObj = newUser.toJSON();
    delete userObj.password;
    
    res.status(201).json(userObj);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, email, password, role, idDepartamento } = req.body;

    const userToUpdate = await User.findByPk(id);
    if (!userToUpdate) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const effectiveRole = role || userToUpdate.role;
    const resolvedDepartmentId = await resolveDepartmentForRole(effectiveRole, idDepartamento);

    // Check role constraints
    const requesterRole = req.user.role;
    if (requesterRole === 'NOMINA' || requesterRole === 'DIGITADOR') {
      // Si el usuario a editar ya tiene un rol distinto a NOMINA/DIGITADOR, no dejar editar
      if (userToUpdate.role !== 'NOMINA' && userToUpdate.role !== 'DIGITADOR') {
         return res.status(403).json({ error: 'No tienes permisos para editar a este usuario.' });
      }
      // No permitir que le asignen un rol distinto a NOMINA/DIGITADOR
      if (role && role !== 'NOMINA' && role !== 'DIGITADOR') {
        return res.status(403).json({ error: 'Solo puedes asignar el rol NOMINA o DIGITADOR.' });
      }
    }

    const updateData = {
      name,
      username: username || null,
      email,
      idDepartamento: resolvedDepartmentId
    };

    if (role) {
      updateData.role = role;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    await userToUpdate.update(updateData);

    const userObj = userToUpdate.toJSON();
    delete userObj.password;

    res.json(userObj);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevenir auto-eliminación
    if (req.user.id.toString() === id.toString()) {
        return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
    }

    const userToDelete = await User.findByPk(id);
    if (!userToDelete) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const requesterRole = req.user.role;
    if (requesterRole === 'NOMINA' || requesterRole === 'DIGITADOR') {
      if (userToDelete.role !== 'NOMINA' && userToDelete.role !== 'DIGITADOR') {
         return res.status(403).json({ error: 'No tienes permisos para eliminar a este usuario.' });
      }
    }

    await userToDelete.destroy();
    res.json({ message: 'Usuario eliminado exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
