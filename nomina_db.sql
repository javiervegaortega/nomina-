-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: nomina_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `nomina_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `nomina_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;

USE `nomina_db`;

--
-- Table structure for table `bonuses`
--

DROP TABLE IF EXISTS `bonuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bonuses` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(255) DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `date` varchar(255) DEFAULT NULL,
  `assignments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`assignments`)),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bonuses`
--

LOCK TABLES `bonuses` WRITE;
/*!40000 ALTER TABLE `bonuses` DISABLE KEYS */;
/*!40000 ALTER TABLE `bonuses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `companies`
--

DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `companies` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `color` varchar(255) DEFAULT NULL,
  `gradient` varchar(255) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `companies`
--

LOCK TABLES `companies` WRITE;
/*!40000 ALTER TABLE `companies` DISABLE KEYS */;
INSERT INTO `companies` VALUES ('ecomezclas','ECOMEZCLAS','#ec4899','linear-gradient(135deg, #ec4899, #f43f5e)','2026-05-26 04:48:26','2026-05-26 04:48:26'),('econacional','ECONACIONAL','#10b981','linear-gradient(135deg, #10b981, #34d399)','2026-05-26 04:48:26','2026-05-26 04:48:26'),('proquima','PROQUIMA','#6366f1','linear-gradient(135deg, #6366f1, #8b5cf6)','2026-05-26 04:48:26','2026-05-26 04:48:26'),('unhesa','UNHESA','#f59e0b','linear-gradient(135deg, #f59e0b, #ef4444)','2026-05-26 04:48:26','2026-05-26 04:48:26'),('unhesaLiq','UNHESA LIQ.','#3b82f6','linear-gradient(135deg, #3b82f6, #06b6d4)','2026-05-26 04:48:26','2026-05-26 04:48:26');
/*!40000 ALTER TABLE `companies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `role` varchar(255) DEFAULT NULL,
  `dept` varchar(255) DEFAULT NULL,
  `companyId` varchar(255) DEFAULT NULL,
  `base` decimal(10,2) DEFAULT 0.00,
  `bonus` decimal(10,2) DEFAULT 250.00,
  `status` varchar(255) DEFAULT 'active',
  `bankAccount` varchar(255) DEFAULT NULL,
  `bankName` varchar(255) DEFAULT NULL,
  `igssNumber` varchar(255) DEFAULT NULL,
  `dist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`dist`)),
  `deductions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`deductions`)),
  `extras` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`extras`)),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `companyId` (`companyId`),
  CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

-- (No data for table employees)

--
-- Table structure for table `employee`
--

DROP TABLE IF EXISTS `employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `companyId` varchar(255) DEFAULT NULL,
  `estado` varchar(50) DEFAULT 'Activo',
  `primer_nombre` varchar(250) DEFAULT NULL,
  `segundo_nombre` varchar(250) DEFAULT NULL,
  `otro_nombre` varchar(250) DEFAULT '',
  `primer_apellido` varchar(250) DEFAULT NULL,
  `segundo_apellido` varchar(250) DEFAULT NULL,
  `direccion` varchar(300) DEFAULT NULL,
  `estado_civil` varchar(50) DEFAULT NULL,
  `fecha_nacimiento` datetime DEFAULT NULL,
  `cedula` varchar(250) DEFAULT NULL,
  `dpi` varchar(20) DEFAULT NULL,
  `no_igss` varchar(20) DEFAULT NULL,
  `centro_de_costo` varchar(250) DEFAULT NULL,
  `fecha_inicio` datetime DEFAULT NULL,
  `fecha_baja` datetime DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `genero` varchar(50) DEFAULT NULL,
  `licencia` varchar(20) DEFAULT NULL,
  `tipo_licencia` varchar(50) DEFAULT NULL,
  `clase_licencia` varchar(50) DEFAULT NULL,
  `horas_extra` tinyint(1) DEFAULT NULL,
  `tipo_de_pago` varchar(100) DEFAULT NULL,
  `banco` varchar(100) DEFAULT NULL,
  `no_cuenta` varchar(100) DEFAULT NULL,
  `tipo_cuenta` varchar(50) DEFAULT NULL,
  `moneda` varchar(20) DEFAULT 'GTQ',
  `conyugue` varchar(300) DEFAULT NULL,
  `foto` longblob DEFAULT NULL,
  `bon_dec_37_2001` decimal(11,2) DEFAULT 0.00,
  `bon_incentivo` decimal(11,2) DEFAULT 0.00,
  `horas_extras_dobles` decimal(11,2) DEFAULT 0.00,
  `horas_extras_simples` decimal(11,2) DEFAULT 0.00,
  `sueldo_ordinario` decimal(11,2) DEFAULT 0.00,
  `otro_ingresos` decimal(11,2) DEFAULT 0.00,
  `total_igss` decimal(11,2) DEFAULT 0.00,
  `vacaciones` decimal(11,2) DEFAULT 0.00,
  `anticipo_quincenal` decimal(11,2) DEFAULT 0.00,
  `bantrab` decimal(11,2) DEFAULT 0.00,
  `boleto_de_ornato` decimal(11,2) DEFAULT 0.00,
  `igss_laboral` decimal(11,2) DEFAULT 0.00,
  `igss_patronal` decimal(11,2) DEFAULT 0.00,
  `isr` decimal(11,2) DEFAULT 0.00,
  `otro_descuentos` decimal(11,2) DEFAULT 0.00,
  `prestamo_empresa` decimal(11,2) DEFAULT 0.00,
  `bancos` decimal(11,2) DEFAULT 0.00,
  `judiciales` decimal(11,2) DEFAULT 0.00,
  `seguro` decimal(11,2) DEFAULT 0.00,
  `parqueo` decimal(11,2) DEFAULT 0.00,
  `primaria` tinyint(1) DEFAULT NULL,
  `grado_primaria` varchar(200) DEFAULT NULL,
  `secundaria` tinyint(1) DEFAULT NULL,
  `grado_secundaria` varchar(200) DEFAULT NULL,
  `diversificado` tinyint(1) DEFAULT NULL,
  `universidad` tinyint(1) DEFAULT NULL,
  `titulo_diploma` varchar(1000) DEFAULT NULL,
  `nacionalidad` varchar(250) DEFAULT NULL,
  `region_originario` varchar(250) DEFAULT NULL,
  `departamento_originario` varchar(250) DEFAULT NULL,
  `municipio_originario` varchar(250) DEFAULT NULL,
  `municipio_cedula` varchar(250) DEFAULT NULL,
  `municipio_laboral` varchar(250) DEFAULT NULL,
  `apellido_casada` varchar(250) DEFAULT NULL,
  `apellido_casada_originario` varchar(200) DEFAULT NULL,
  `nombre_emergencia` varchar(100) DEFAULT NULL,
  `telefono_emergencia` varchar(20) DEFAULT NULL,
  `edad_conyuge` varchar(10) DEFAULT NULL,
  `ocupacion_conyuge` varchar(100) DEFAULT NULL,
  `nombre_padre` varchar(200) DEFAULT NULL,
  `edad_padre` varchar(10) DEFAULT NULL,
  `ocupacion_padre` varchar(200) DEFAULT NULL,
  `nombre_madre` varchar(200) DEFAULT NULL,
  `edad_madre` varchar(10) DEFAULT NULL,
  `ocupacion_madre` varchar(200) DEFAULT NULL,
  `condicion_laboral` varchar(100) DEFAULT NULL,
  `codigo_ocupacion` varchar(50) DEFAULT NULL,
  `tipo_plantilla` varchar(100) DEFAULT NULL,
  `horas_laborales` int(11) DEFAULT NULL,
  `jornada` varchar(50) DEFAULT NULL,
  `ventas_economicas` decimal(11,2) DEFAULT NULL,
  `temporal` datetime DEFAULT NULL,
  `telefono_celular` varchar(20) DEFAULT NULL,
  `edad` varchar(10) DEFAULT NULL,
  `emision_dpi` varchar(200) DEFAULT NULL,
  `nit` varchar(20) DEFAULT NULL,
  `departamento_laboral` varchar(200) DEFAULT NULL,
  `dias_laborados` int(11) DEFAULT 0,
  `puesto` varchar(500) DEFAULT NULL,
  `afiliacion` varchar(50) DEFAULT NULL,
  `rol_permisos` varchar(50) DEFAULT 'empleado',
  `jubilacion` tinyint(1) DEFAULT 0,
  `discapacidad` varchar(1000) DEFAULT NULL,
  `motivo_baja` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `companyId` (`companyId`),
  CONSTRAINT `employee_ibfk_1` FOREIGN KEY (`companyId`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payrollhistories`
--

DROP TABLE IF EXISTS `payrollhistories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payrollhistories` (
  `id` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `closedAt` varchar(255) DEFAULT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`data`)),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payrollhistories`
--

LOCK TABLES `payrollhistories` WRITE;
/*!40000 ALTER TABLE `payrollhistories` DISABLE KEYS */;
/*!40000 ALTER TABLE `payrollhistories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(255) DEFAULT 'admin',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `email_2` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Administrador del Sistema','admin@nomina.com','$2b$10$MhDsFqQ/6JG3vu59tI9DUuF6kRxy0CeA58CSKJhm8QoNauS8LdFcG','admin','2026-05-26 04:48:26','2026-05-26 04:48:26'),(2,'javier','informatica2@grupoeconsa.com','$2b$10$3E1NwFvlyNGiR7NMnDxSqevIZoTeHqVMTARJhX52gOk6xnIryYzA2','admin','2026-05-26 04:52:31','2026-05-26 04:52:31');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'nomina_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-25 23:09:14
