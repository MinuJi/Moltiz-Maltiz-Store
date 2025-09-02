-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: moltiz
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `cart_items`
--

DROP TABLE IF EXISTS `cart_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cart_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_product` (`user_id`,`product_id`),
  KEY `idx_cart_user` (`user_id`),
  KEY `idx_cart_product` (`product_id`),
  CONSTRAINT `fk_cart_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cart_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=149 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cart_items`
--

LOCK TABLES `cart_items` WRITE;
/*!40000 ALTER TABLE `cart_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `cart_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coupon_types`
--

DROP TABLE IF EXISTS `coupon_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coupon_types` (
  `code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` enum('amount','shipping') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` int NOT NULL DEFAULT '0',
  `min_order_krw` int NOT NULL DEFAULT '0',
  `expires_days` int NOT NULL DEFAULT '0',
  `level_required` enum('LV1','LV10','LV100') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coupon_types`
--

LOCK TABLES `coupon_types` WRITE;
/*!40000 ALTER TABLE `coupon_types` DISABLE KEYS */;
INSERT INTO `coupon_types` VALUES ('M_LV1_5K','Level 1: 5,000₩ Discount','amount',5000,0,0,'LV1'),('M_LV10_10K','Level 10: 10,000₩ Discount','amount',10000,0,0,'LV10'),('M_LV10_5K','Level 10: 5,000₩ Discount','amount',5000,0,0,'LV10'),('M_LV100_100K','Level 100: 100,000₩ Discount','amount',100000,0,0,'LV100'),('M_LV100_SHP','Level 100: Free Shipping','shipping',0,0,0,'LV100');
/*!40000 ALTER TABLE `coupon_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `product_id` int NOT NULL,
  `price` int NOT NULL,
  `quantity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_product` (`product_id`),
  CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=133 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `status` enum('CREATED','PAID','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREATED',
  `total_price` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_user` (`user_id`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=132 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_resets`
--

DROP TABLE IF EXISTS `password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_resets`
--

LOCK TABLES `password_resets` WRITE;
/*!40000 ALTER TABLE `password_resets` DISABLE KEYS */;
INSERT INTO `password_resets` VALUES (1,'c71c345e-9281-4db5-901d-88bbea721464',1,'2025-08-12 17:38:22',0,'2025-08-12 08:23:22'),(2,'9f491b9f-2771-4c33-a22e-01d0defcc7f2',1,'2025-08-12 17:38:28',0,'2025-08-12 08:23:27'),(3,'75ab0598-2fe2-4021-bb84-f637146a66b7',1,'2025-08-12 17:38:28',0,'2025-08-12 08:23:28'),(4,'7363e9fe-86de-4113-ba8e-d945f782d107',1,'2025-08-12 17:38:29',0,'2025-08-12 08:23:28'),(5,'7eaaeb70-e418-455c-8f13-40b994fb621a',1,'2025-08-12 17:38:29',0,'2025-08-12 08:23:29'),(6,'721b0d4d-f7cf-4729-af96-744b25b8954e',1,'2025-08-12 17:42:08',0,'2025-08-12 08:27:07'),(7,'2969bec2-5bda-4ccb-be52-7e94123c569f',1,'2025-08-12 17:42:08',0,'2025-08-12 08:27:08'),(8,'30ec6755-5121-4755-a2ff-f7706a59ba70',1,'2025-08-12 17:42:22',0,'2025-08-12 08:27:21'),(9,'db0d2567-6e6e-4e1f-8303-826080d0b2f7',1,'2025-08-12 17:42:42',0,'2025-08-12 08:27:42'),(10,'a0cc4f3d-492f-4f6a-92f4-a6786a891dd4',1,'2025-08-12 17:44:14',0,'2025-08-12 08:29:13'),(11,'4d7b05b9-f30d-441a-9bd0-955ef4d83086',1,'2025-08-12 17:44:15',0,'2025-08-12 08:29:15'),(12,'cfd91db9-e235-48d7-9a28-42e9b6d91b76',2,'2025-08-12 17:55:25',1,'2025-08-12 08:40:25'),(13,'299d49ca-7054-4f08-bc67-8b2984afc27f',2,'2025-08-12 18:01:39',1,'2025-08-12 08:46:38'),(14,'a922dee8-bd06-4527-9556-7bcc6cceddf4',2,'2025-08-12 18:10:23',1,'2025-08-12 08:55:22'),(15,'0f9c291b-f7d9-49b9-910f-4384e801784e',2,'2025-08-12 18:11:45',1,'2025-08-12 08:56:45'),(16,'abd4eb30-927c-4905-a52a-f582cede0cb0',3,'2025-08-12 21:24:25',1,'2025-08-12 12:09:25'),(17,'84e452fa-3cf1-4395-a2dd-9008d9afe8ca',4,'2025-08-12 21:39:56',1,'2025-08-12 12:24:55'),(18,'04fb30c9-f4b0-4ad3-9fc8-627812f8017d',1,'2025-08-13 17:06:46',0,'2025-08-13 07:36:46'),(20,'0726d4c2-37da-42de-8f69-45d931a63405',3,'2025-08-14 17:32:43',1,'2025-08-14 08:02:43'),(21,'aee7f6cc-6b2d-4d50-bb34-9fd3dd397448',2,'2025-08-19 12:58:26',1,'2025-08-19 03:28:25');
/*!40000 ALTER TABLE `password_resets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` int NOT NULL,
  `sale_price` int DEFAULT NULL,
  `sale_ends_at` datetime DEFAULT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `shipping_fee` int NOT NULL DEFAULT '1000',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_products_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (4,'Moltiz Blanket',20000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/a6add642-72ad-4590-a7b4-693a837973c7.png','2025-08-14 03:30:03',0),(25,'Moltiz Random Figure Version1',3000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/e7887290-755c-4fcf-9f29-157c97748c77.png','2025-08-14 03:45:24',1000),(26,'Moltiz Random Figure Version2',3000,NULL,NULL,100,'https://godomall.speedycdn.net/7005dcd972c52bd79615cc6621d0e4c4/goods/1000001208/image/detail/1000001208_detail_0100.jpg','2025-08-14 03:45:24',1000),(29,'Moltiz Keyring',6000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/dbd3626a-c267-4a90-992f-3f0ef34858ac.png','2025-08-14 03:45:24',1000),(30,'Maltiz Keyring',6000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/5826d83e-7090-4bbf-80b1-fc565c215d00.png','2025-08-14 03:45:24',1000),(31,'Moltiz Memo',3000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/4b038cfc-1c6d-4830-9c5d-0d3a5f328870.png','2025-08-14 03:45:24',1000),(32,'Moltiz MousePad',4000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/70025876-36ec-44de-b782-d89db7db9411.png','2025-08-14 03:45:24',1000),(33,'Moltiz Bag',12000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/779b76b0-c177-4289-82ef-09d7301b188c.png','2025-08-14 03:45:24',1000),(44,'Moltiz Logistic',8000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/6d843bc4-17c3-4e76-9110-3ea98a4abc6c.png','2025-08-14 05:09:47',1000),(45,'Maltiz Logistic',8000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/7b85b074-e7d5-41b2-8504-e94ae23a3ac8.png','2025-08-14 05:09:47',1000),(54,'Moltiz Blanket (Sale)',14000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/a6add642-72ad-4590-a7b4-693a837973c7.png','2025-08-14 05:20:11',0),(55,'Maltiz Logistic (Sale)',6000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/7b85b074-e7d5-41b2-8504-e94ae23a3ac8.png','2025-08-14 05:20:11',1000),(56,'Moltiz Bag (Sale)',6000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/779b76b0-c177-4289-82ef-09d7301b188c.png','2025-08-14 05:20:11',1000),(57,'Moltiz Logistic (Sale)',6000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/6d843bc4-17c3-4e76-9110-3ea98a4abc6c.png','2025-08-14 05:20:11',1000),(58,'Moltiz Diary',32000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/5aea7cd8-86d3-46a7-983b-69534cdf086a.png','2025-08-29 09:41:20',1000),(69,'Maltiz Airplane',13000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/c2ba94b7-b1ad-4df2-93d2-c81cb7ec6cfa.png','2025-08-29 11:14:48',1000),(70,'Moltiz Airplane',13000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/5993ee2b-c3c2-4531-a0ef-ab313de74a7e.png','2025-08-29 11:14:48',1000),(82,'Maltiz Washing Band',10000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/edbbe9fd-0f85-4cec-8ec1-33bab72e60a8.png','2025-09-01 11:47:36',1000),(83,'Moltiz Makarong Ring',14000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/3aad1ff0-0262-4e1b-bb69-877fcc729229.png','2025-09-01 11:47:36',1000),(84,'Maltiz Makarong Ring',14000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/fe718c5d-079a-4ad2-a3a6-1a8fa28b833b.png','2025-09-01 11:47:36',1000),(85,'Moltiz Ready to Sleep',24000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/796d1bcb-15ca-4163-8174-ecc52532b30e.png','2025-09-01 11:47:36',1000),(86,'Maltiz Ready to Sleep',24000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/a78190f7-d853-42e8-be3c-c2fcaff5dc92.png','2025-09-01 11:47:36',1000),(87,'Moltiz Original',16000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/0eb65ca6-0da3-437d-8303-21e594fbfb1f.png','2025-09-01 11:47:36',1000),(88,'Maltiz Original',16000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/874063cd-f839-4854-a598-6c5cf6fa677e.png','2025-09-01 11:47:36',1000),(89,'Moltiz Neck Pillow',26000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/95f93b61-69e2-45c8-a6ff-9d9851c76fed.png','2025-09-01 11:47:36',1000),(90,'Maltiz Neck Pillow',26000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/2a936a28-69e1-4a8d-8473-2d51b9c52bbb.png','2025-09-01 11:47:36',1000),(91,'Maltiz Sweet Blanket',20000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/965e330d-59eb-4594-89c9-8c6529e83105.png','2025-09-01 11:47:36',1000),(92,'Moltiz DonutBag',15000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/9e7fbf36-1d23-453a-91c1-2a424f307240.png','2025-09-01 11:47:36',1000),(93,'Moltiz Note P',7000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/074b551b-fd77-4d0a-9407-535f855c0029.png','2025-09-01 11:47:36',1000),(94,'Maltiz Note H',7000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/758f170d-f74c-498f-a444-3e43a2c7c0cd.png','2025-09-01 11:47:36',1000),(95,'Maltiz HartBag',15000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/4ccfc0b7-54cb-4028-b09a-273d7fd58cbf.png','2025-09-01 11:47:36',1000),(96,'Maltiz Pouch',15000,NULL,NULL,100,'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/315b8920-7a56-43f5-a0e5-6be68ef50700.png','2025-09-01 11:47:36',1000);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_coupons`
--

DROP TABLE IF EXISTS `user_coupons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_coupons` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `coupon_code` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  `used_order_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_coupon_once` (`user_id`,`coupon_code`),
  KEY `idx_user` (`user_id`),
  KEY `fk_uc_ct` (`coupon_code`),
  CONSTRAINT `fk_uc_ct` FOREIGN KEY (`coupon_code`) REFERENCES `coupon_types` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=613 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_coupons`
--

LOCK TABLES `user_coupons` WRITE;
/*!40000 ALTER TABLE `user_coupons` DISABLE KEYS */;
INSERT INTO `user_coupons` VALUES (1,1,'M_LV1_5K','2025-08-20 14:28:09',NULL,NULL),(134,123,'M_LV1_5K','2025-08-20 17:06:36',NULL,NULL),(189,10,'M_LV1_5K','2025-08-20 18:39:08',NULL,NULL);
/*!40000 ALTER TABLE `user_coupons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` enum('Male','Female') COLLATE utf8mb4_unicode_ci DEFAULT 'Male',
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_name_phone` (`name`,`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'minwooji00@gmail.com','지민우','Male','서울시 강남구','01037199102','$2b$10$QFE7F4xaYimjHFq1POsqjuEemKshRZ71TIi1pzjIzj54.uMZaB.wK','2025-08-12 07:26:56'),(2,'minwoojee','minu','Male','seoul','01058774485','$2b$10$89a8P/cvSL1I2tGXVVtotutca/cd0edc.2szbOx6TvMHPWpdNHKhC','2025-08-12 08:39:43'),(3,'hong','홍길동','Male','대한민국','01099998888','$2b$10$IP/Gm3tMfqMcfB1uFEExneMUUPe7r5GIr0ifjbdom1IXD4D0BGV4m','2025-08-12 12:08:18'),(4,'minwooji0715','moltiz','Male','korea','01037199100','$2b$10$Wosk9d1gxRT1m9gcdNL/y.C9ewhSnPx8jpOgzmTW/YaxQbEGnsqu2','2025-08-12 12:23:43'),(8,'Ji@gmail.com','mj','Male','영국','01088889999','$2b$10$KuJBBW6x2eI7WEkV9i/cvOPYmrUc8x4ocMaZEgydNoypTR/UusdEK','2025-08-13 14:52:08'),(9,'Moltiz@naver.com','Molt','Male','UK','01055556666','$2b$10$T29TsRNjhYXuImnxnSXVEu3msmdjX.dZdZP39br.hlpEpv7Vo1Zjy','2025-08-14 08:55:31'),(10,'Maltiz@gmail.com','Maltiz','Female','UK','01077778888','$2b$10$Wfn9oaLRQBioh8Y4z/VETuDNcVMQMZVMBY28GmWXcTtCodr8cjeOm','2025-08-19 03:49:02'),(11,'MoltizMaltiz@nate.com','개발자','Female','Jeju','01066668899','$2b$10$wmueAjyjACLEd91NH75D1Ok6jQ.7AmlY0V7.pwGO1mUA.NxviKu.K','2025-09-01 11:52:30'),(12,'MoltizMaltiz@naver.com','개발자10','Female','Usa','01065568899','$2b$10$tSeXHf7DiQbtB9uk55CRg.bkwEkCx6BPT0su2MZ14H5B8PmjsKzbK','2025-09-01 11:53:03'),(13,'MoltizMaltiz@google.com','개발자100','Female','England','01085568899','$2b$10$OxDj3X0Vf44tNkKJLcXjRel2PM.naBY3NSCtxxFagJbWMbuq8dM7W','2025-09-01 11:53:46');
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

-- Dump completed on 2025-09-02 20:42:02
