const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sequelize, Company, Employee, Bonus, PayrollHistory, User } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'super-secret-key-for-nomina-123'; // In production, use env var

// Middlewares
app.use(cors());
app.use(express.json());

// ======================= AUTH MIDDLEWARE =======================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
  
  if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
    req.user = user;
    next();
  });
};

// ======================= AUTH ENDPOINTS =======================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El correo ya está registrado.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword
    });

    res.status(201).json({ message: 'Usuario creado exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================= API ENDPOINTS =======================

// --- EMPRESAS ---
app.get('/api/companies', async (req, res) => {
  try {
    const companies = await Company.findAll();
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/companies', authenticateToken, async (req, res) => {
  try {
    const newCompany = await Company.create(req.body);
    res.status(201).json(newCompany);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/companies/:id', authenticateToken, async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ error: 'No encontrado' });
    await company.update(req.body);
    res.json(company);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/companies/:id', authenticateToken, async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ error: 'No encontrado' });
    await company.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- EMPLEADOS ---
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await Employee.findAll();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    const newEmployee = await Employee.create(req.body);
    res.status(201).json(newEmployee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'No encontrado' });
    await employee.update(req.body);
    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'No encontrado' });
    await employee.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- HISTORIAL DE NOMINAS ---
app.get('/api/payrolls', async (req, res) => {
  try {
    const payrolls = await PayrollHistory.findAll();
    res.json(payrolls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payrolls', authenticateToken, async (req, res) => {
  try {
    const newPayroll = await PayrollHistory.create(req.body);
    res.status(201).json(newPayroll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/payrolls/:id', authenticateToken, async (req, res) => {
  try {
    const payroll = await PayrollHistory.findByPk(req.params.id);
    if (!payroll) return res.status(404).json({ error: 'No encontrado' });
    await payroll.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ======================= INTEGRACION FRONTEND =======================
// Servir la carpeta estática del Build de React
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Cualquier otra ruta no capturada por la API devolverá el index.html de React
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});


// ======================= INICIO DEL SERVIDOR =======================
const startServer = async () => {
  try {
    // Sincronizar modelos con la base de datos (Crea las tablas si no existen)
    await sequelize.sync({ alter: true });
    console.log('Base de datos sincronizada correctamente.');
    
    app.listen(PORT, () => {
      console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
  }
};

startServer();
