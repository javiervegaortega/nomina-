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
-- Table structure for table `employee`
--

DROP TABLE IF EXISTS `employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `companyId` int(11) DEFAULT NULL,
  `estado` varchar(255) DEFAULT 'Activo',
  `primer_nombre` varchar(255) DEFAULT NULL,
  `segundo_nombre` varchar(255) DEFAULT NULL,
  `otro_nombre` varchar(255) DEFAULT '',
  `primer_apellido` varchar(255) DEFAULT NULL,
  `segundo_apellido` varchar(255) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `estado_civil` varchar(255) DEFAULT NULL,
  `fecha_nacimiento` datetime DEFAULT NULL,
  `cedula` varchar(255) DEFAULT NULL,
  `dpi` varchar(255) DEFAULT NULL,
  `no_igss` varchar(255) DEFAULT NULL,
  `centro_de_costo` varchar(255) DEFAULT NULL,
  `fecha_inicio` datetime DEFAULT NULL,
  `fecha_baja` datetime DEFAULT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `genero` varchar(255) DEFAULT NULL,
  `licencia` varchar(255) DEFAULT NULL,
  `tipo_licencia` varchar(255) DEFAULT NULL,
  `clase_licencia` varchar(255) DEFAULT NULL,
  `horas_extra` tinyint(1) DEFAULT NULL,
  `tipo_de_pago` varchar(255) DEFAULT NULL,
  `banco` varchar(255) DEFAULT NULL,
  `no_cuenta` varchar(255) DEFAULT NULL,
  `tipo_cuenta` varchar(255) DEFAULT NULL,
  `moneda` varchar(255) DEFAULT 'GTQ',
  `conyugue` varchar(255) DEFAULT NULL,
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
  `grado_primaria` varchar(255) DEFAULT NULL,
  `secundaria` tinyint(1) DEFAULT NULL,
  `grado_secundaria` varchar(255) DEFAULT NULL,
  `diversificado` tinyint(1) DEFAULT NULL,
  `universidad` tinyint(1) DEFAULT NULL,
  `titulo_diploma` varchar(255) DEFAULT NULL,
  `nacionalidad` varchar(255) DEFAULT NULL,
  `region_originario` varchar(255) DEFAULT NULL,
  `departamento_originario` varchar(255) DEFAULT NULL,
  `municipio_originario` varchar(255) DEFAULT NULL,
  `municipio_cedula` varchar(255) DEFAULT NULL,
  `municipio_laboral` varchar(255) DEFAULT NULL,
  `apellido_casada` varchar(255) DEFAULT NULL,
  `apellido_casada_originario` varchar(255) DEFAULT NULL,
  `nombre_emergencia` varchar(255) DEFAULT NULL,
  `telefono_emergencia` varchar(255) DEFAULT NULL,
  `edad_conyuge` varchar(255) DEFAULT NULL,
  `ocupacion_conyuge` varchar(255) DEFAULT NULL,
  `nombre_padre` varchar(255) DEFAULT NULL,
  `edad_padre` varchar(255) DEFAULT NULL,
  `ocupacion_padre` varchar(255) DEFAULT NULL,
  `nombre_madre` varchar(255) DEFAULT NULL,
  `edad_madre` varchar(255) DEFAULT NULL,
  `ocupacion_madre` varchar(255) DEFAULT NULL,
  `condicion_laboral` varchar(255) DEFAULT NULL,
  `codigo_ocupacion` varchar(255) DEFAULT NULL,
  `tipo_plantilla` varchar(255) DEFAULT NULL,
  `horas_laborales` int(11) DEFAULT NULL,
  `jornada` varchar(255) DEFAULT NULL,
  `ventas_economicas` decimal(11,2) DEFAULT NULL,
  `temporal` datetime DEFAULT NULL,
  `telefono_celular` varchar(255) DEFAULT NULL,
  `edad` varchar(255) DEFAULT NULL,
  `emision_dpi` varchar(255) DEFAULT NULL,
  `nit` varchar(255) DEFAULT NULL,
  `departamento_laboral` varchar(255) DEFAULT NULL,
  `dias_laborados` int(11) DEFAULT 0,
  `puesto` varchar(255) DEFAULT NULL,
  `afiliacion` varchar(255) DEFAULT NULL,
  `rol_permisos` varchar(255) DEFAULT 'empleado',
  `jubilacion` tinyint(1) DEFAULT 0,
  `discapacidad` varchar(255) DEFAULT NULL,
  `motivo_baja` varchar(255) DEFAULT NULL,
  `dist` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`dist`)),
  PRIMARY KEY (`id`),
  KEY `companyId` (`companyId`),
  CONSTRAINT `employee_ibfk_1` FOREIGN KEY (`companyId`) REFERENCES `empresa` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee`
--

LOCK TABLES `employee` WRITE;
/*!40000 ALTER TABLE `employee` DISABLE KEYS */;
INSERT INTO `employee` VALUES (1,NULL,'Activo',NULL,NULL,'',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'GTQ',NULL,NULL,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'empleado',0,NULL,NULL,'{\"ecomezclas\":0,\"econacional\":0,\"proquima\":0,\"unhesa\":0,\"unhesaLiq\":0}'),(2,NULL,'Activo','JUAN','PABLO','',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'GTQ',NULL,NULL,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'empleado',0,NULL,NULL,'{\"ecomezclas\":0,\"econacional\":0,\"proquima\":0,\"unhesa\":0,\"unhesaLiq\":0}');
/*!40000 ALTER TABLE `employee` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `empresa`
--

DROP TABLE IF EXISTS `empresa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `empresa` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nit` varchar(255) DEFAULT NULL,
  `nombre_comercial` varchar(255) DEFAULT NULL,
  `razon_social` varchar(255) DEFAULT NULL,
  `calle` varchar(255) DEFAULT NULL,
  `apto` varchar(255) DEFAULT NULL,
  `departamento` varchar(255) DEFAULT NULL,
  `apartado_postal` varchar(255) DEFAULT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `fax` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `nomenclatura` varchar(255) DEFAULT NULL,
  `numero` varchar(255) DEFAULT NULL,
  `colonia` varchar(255) DEFAULT NULL,
  `municipio` varchar(255) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `nombre_patrono` varchar(255) DEFAULT NULL,
  `direccion_patrono` varchar(255) DEFAULT NULL,
  `numero_patrono` varchar(255) DEFAULT NULL,
  `nit_patrono` varchar(255) DEFAULT NULL,
  `id_estado` int(11) DEFAULT NULL,
  `id_banco` int(11) DEFAULT NULL,
  `color` varchar(255) DEFAULT '#0ea5e9',
  `gradient` varchar(255) DEFAULT 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `empresa`
--

LOCK TABLES `empresa` WRITE;
/*!40000 ALTER TABLE `empresa` DISABLE KEYS */;
INSERT INTO `empresa` VALUES (1,'24612227','PROQUIMA,S.A.','PROQUIMA,S.A.','ZONA 13','GUATEMALA','GUATEMALA','502','23105400','00000','mperez@grupoeconsa.com','1515','1515','SANTA FE','GUATEMALA','10MA AVE 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19','PROQUIMA,S.A.','10MA AVENIDA 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19','81376','24612227',1,1,'#0ea5e9','linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)'),(2,'23038187','UNION HERMANOS,S.A.','UNION HERMANOS,S.A.','ZONA 13','GUATEMALA','GUATEMALA','502','23105400','0','mperez@grupoeconsa.com','1515','1515','SANTA FE','GUATEMALA','10MA AVE 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19','UNION HERMANOS,S.A.','10MA AVENIDA 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19','76559','23038187',1,1,'#3b82f6','linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'),(3,'75364255','ECONACIONAL,S.A.','ECONACIONAL,S.A.','ZONA 13','GUATEMALA','GUATEMALA','502','23105400','00000','mperez@grupoeconsa.com','1515','1515','SANTA FE','GUATEMALA','10MA AVE 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19','ECONACIONAL,S.A.','10MA AVENIDA 25-63 ZONA 13 INTERIOR BODEGAS 18 Y 19','139389','75364255',1,1,'#8b5cf6','linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)'),(4,'86417177','CLEARTEC, S. A.','Cleartec, S. A.','','','Guatemala','','23105400','','','','','','Guatemala','10 AVE 25-63 BOD 1 COL STA FE Z13 GUATE','Cleartec, S. A.','10 AVE 25-63 BOD 1 COL STA FE Z13 GUATE','141653','86417177',1,1,'#f97316','linear-gradient(135deg, #f97316 0%, #f59e0b 100%)'),(5,'69063427','CALIDUL','Calidul','25','0','Guatemala','01001','23105400','23105400','ihlemus@grupoeconsa.com','0','0','Santa Fe','Guatemala','10 Ave. 25-63, zona 13 Int. 18 y 19','CALIDUL','10 calle','138044','69063427',1,1,'#10b981','linear-gradient(135deg, #10b981 0%, #14b8a6 100%)');
/*!40000 ALTER TABLE `empresa` ENABLE KEYS */;
UNLOCK TABLES;

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
  `username` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(255) DEFAULT 'admin',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `email_2` (`email`),
  UNIQUE KEY `email_3` (`email`),
  UNIQUE KEY `email_4` (`email`),
  UNIQUE KEY `email_5` (`email`),
  UNIQUE KEY `email_6` (`email`),
  UNIQUE KEY `email_7` (`email`),
  UNIQUE KEY `email_8` (`email`),
  UNIQUE KEY `email_9` (`email`),
  UNIQUE KEY `email_10` (`email`),
  UNIQUE KEY `email_11` (`email`),
  UNIQUE KEY `email_12` (`email`),
  UNIQUE KEY `email_13` (`email`),
  UNIQUE KEY `email_14` (`email`),
  UNIQUE KEY `email_15` (`email`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `username_2` (`username`),
  UNIQUE KEY `username_3` (`username`),
  UNIQUE KEY `username_4` (`username`),
  UNIQUE KEY `username_5` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Administrador del Sistema',NULL,'admin@nomina.com','$2b$10$MhDsFqQ/6JG3vu59tI9DUuF6kRxy0CeA58CSKJhm8QoNauS8LdFcG','admin','2026-05-26 04:48:26','2026-05-26 04:48:26'),(2,'javier',NULL,'informatica2@grupoeconsa.com','$2b$10$3E1NwFvlyNGiR7NMnDxSqevIZoTeHqVMTARJhX52gOk6xnIryYzA2','admin','2026-05-26 04:52:31','2026-05-26 04:52:31'),(3,'Juan Pablo Yaxon','jyaxon','jyaxon@example.com','$2b$10$38t./4.mNQp/ZMe.zwJYzeJOPOTpEJK/xDQVK070T6Idvp4sgZu/6','admin','2026-05-28 19:17:04','2026-05-29 17:02:52');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-29 14:40:06
