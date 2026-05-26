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

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'Estrada Robles Victor Gerardo','Presidente','PRESIDENCIA','unhesa',19750.00,250.00,'active','4510765','PROMERICA','12345678','{\"proquima\":0,\"unhesa\":100,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":0,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":0,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(2,'Estrada Robles Victor Gerardo','Gerente General','PRESIDENCIA','proquima',61000.00,250.00,'active','4510766','PROMERICA','12345679','{\"proquima\":100,\"unhesa\":0,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":3507.5,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":0,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(3,'Estrada Robles Juan Pablo','Asesor','PRESIDENCIA','proquima',15000.00,155000.00,'active','143132884','INDUSTRIAL','12345680','{\"proquima\":100,\"unhesa\":0,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":15719.44,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":0,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(4,'Alvarez Caceros Genesis Arleth','Asistente de Gerencia','PRESIDENCIA','proquima',3500.00,1500.00,'active','4510768','BANTRAB','12345681','{\"proquima\":50,\"unhesa\":50,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":41.55,\"bank\":0,\"cell\":0,\"cafe\":17,\"product\":165,\"insurance\":50,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(5,'Mu├▒oz Laparra Orly Gabriela','Asistente','PRESIDENCIA','unhesa',5000.00,4000.00,'active','4510769','PROMERICA','12345682','{\"proquima\":35,\"unhesa\":35,\"unhesaLiq\":0,\"econacional\":30,\"ecomezclas\":0}','{\"isr\":237.93,\"bank\":0,\"cell\":0,\"cafe\":80,\"product\":0,\"insurance\":75,\"other\":240,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(6,'Quevedo Lopez Ingrid Aracely','Conserje','PRESIDENCIA','unhesa',3166.38,250.00,'active','4510770','INDUSTRIAL','12345683','{\"proquima\":0,\"unhesa\":100,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":0,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":50,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(7,'Morales Alvarez Yony','Conserje','PRESIDENCIA','unhesa',3166.38,250.00,'active','4510771','PROMERICA','12345684','{\"proquima\":0,\"unhesa\":100,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":0,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":50,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(8,'Veliz Carias Elder Danilo','Piloto','PRESIDENCIA','unhesa',3166.38,250.00,'active','4510772','BANTRAB','12345685','{\"proquima\":0,\"unhesa\":100,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":0,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":50,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(9,'Alvarez Fajardo Erick Geovanni','Piloto','PRESIDENCIA','proquima',3166.38,1540.76,'inactive','4510773','PROMERICA','12345686','{\"proquima\":100,\"unhesa\":0,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":0,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":0,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(10,'Gaitan Hernandez Luis Daniel','Piloto de Presidencia','ADMINISTRATIVO','proquima',3262.50,2250.00,'active','4510774','INDUSTRIAL','12345687','{\"proquima\":100,\"unhesa\":0,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":67.75,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":50,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(11,'Saenz Lemus Dulce Maria','Recepcionista','ADMINISTRATIVO','proquima',3166.38,250.00,'active','4510775','PROMERICA','12345688','{\"proquima\":50,\"unhesa\":50,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":0,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":50,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(12,'Pu Canto Domingo','Conserje','ADMINISTRATIVO','proquima',3166.38,250.00,'active','4510776','PROMERICA','12345689','{\"proquima\":50,\"unhesa\":50,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":0,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":82.5,\"insurance\":50,\"other\":306.62,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(13,'Patzan Quib Lucrecia','Contador General','CONTABILIDAD Y FINANZAS','unhesa',10036.54,657.70,'active','4510777','BANTRAB','12345690','{\"proquima\":45,\"unhesa\":45,\"unhesaLiq\":0,\"econacional\":10,\"ecomezclas\":0}','{\"isr\":310.47,\"bank\":1484.26,\"cell\":796,\"cafe\":0,\"product\":0,\"insurance\":100,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(14,'Lorenzana Gonzalez Cesar Leonel','Gerente Financiero','CONTABILIDAD Y FINANZAS','unhesa',18000.00,5000.00,'active','4510778','PROMERICA','12345691','{\"proquima\":60,\"unhesa\":30,\"unhesaLiq\":0,\"econacional\":10,\"ecomezclas\":0}','{\"isr\":906.53,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":150,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(15,'De Floran Rodas Luis Arnau','Jefe I & D','INVESTIGACION Y DESARROLLO','proquima',8000.00,3000.00,'active','4510779','INDUSTRIAL','12345692','{\"proquima\":100,\"unhesa\":0,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":330.68,\"bank\":0,\"cell\":0,\"cafe\":30,\"product\":0,\"insurance\":100,\"other\":240,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(16,'Saban Culajay Edson Omar','Jefe de Gesti├│n de Calidad','CONTROL DE CALIDAD','proquima',5250.00,2750.00,'active','4510780','PROMERICA','12345693','{\"proquima\":35,\"unhesa\":60,\"unhesaLiq\":0,\"econacional\":5,\"ecomezclas\":0}','{\"isr\":187.32,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":75,\"other\":240,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(17,'Jimenez Sosa Luis Eduardo','Jefe de Inform├ítica','INFORMATICA','proquima',7000.00,5250.00,'active','640000414','PROMERICA','12345694','{\"proquima\":45,\"unhesa\":40,\"unhesaLiq\":0,\"econacional\":15,\"ecomezclas\":0}','{\"isr\":395.6,\"bank\":1491.76,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":150,\"other\":187.5,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(18,'Cabrera Guzman Javier Antonio','Analista Programador','INFORMATICA','proquima',3459.24,1250.00,'active','4510782','PROMERICA','12345695','{\"proquima\":45,\"unhesa\":40,\"unhesaLiq\":0,\"econacional\":15,\"ecomezclas\":0}','{\"isr\":27.11,\"bank\":0,\"cell\":0,\"cafe\":445.5,\"product\":0,\"insurance\":50,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(19,'Guerra Lopez Jonathan Otoniel','Analista Programador','INFORMATICA','proquima',4750.00,1250.00,'active','4510783','BANTRAB','12345696','{\"proquima\":45,\"unhesa\":40,\"unhesaLiq\":0,\"econacional\":15,\"ecomezclas\":0}','{\"isr\":88.53,\"bank\":0,\"cell\":0,\"cafe\":0,\"product\":0,\"insurance\":0,\"other\":0,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":0,\"simplesVal\":0,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26'),(20,'Guzman Hernandez Edgar Geovanni','Auxiliar de Control de Calidad','CONTROL DE CALIDAD','proquima',3166.38,600.00,'active','4510784','PROMERICA','12345697','{\"proquima\":60,\"unhesa\":40,\"unhesaLiq\":0,\"econacional\":0,\"ecomezclas\":0}','{\"isr\":0,\"bank\":702.56,\"cell\":0,\"cafe\":131.75,\"product\":82.5,\"insurance\":110,\"other\":125,\"shoes\":0,\"uniform\":0}','{\"simplesQty\":1,\"simplesVal\":19.79,\"doblesQty\":0,\"doblesVal\":0,\"comisiones\":0,\"otrosIngresos\":0}','2026-05-26 04:48:26','2026-05-26 04:48:26');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
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
