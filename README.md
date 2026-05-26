# Sistema de Nómina

Aplicación web para gestión de nómina con backend Node.js/Express, frontend React (Vite) y base de datos MySQL/MariaDB.

## Requisitos

- [XAMPP](https://www.apachefriends.org/) (o MySQL/MariaDB + Apache opcional)
- [Node.js](https://nodejs.org/) 18 o superior

## Base de datos

1. Inicia MySQL en XAMPP.
2. Importa el volcado incluido en el repositorio:

```bash
mysql -u root < database.sql
```

En Windows (XAMPP):

```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database.sql
```

La base de datos `nomina_db` incluye empresas, empleados y usuarios de acceso.

**Usuario por defecto:** `admin@nomina.com` (contraseña definida en el sistema local).

## Instalación

```bash
# Backend
cd backend
npm install
npm start

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

El backend usa MySQL en `localhost` con usuario `root` sin contraseña (configuración XAMPP por defecto). Ajusta `backend/db.js` si tu entorno es distinto.

## Estructura

| Carpeta / archivo | Descripción |
|-------------------|-------------|
| `backend/` | API REST (Express + Sequelize) |
| `frontend/` | Interfaz React |
| `database.sql` | Volcado completo de `nomina_db` |
| `NOMINA 30.01.xlsx` | Datos de referencia de nómina |

## Repositorio

https://github.com/javiervegaortega/nomina-
