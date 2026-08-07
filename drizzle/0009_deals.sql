CREATE TABLE `deals` (
  `id` int AUTO_INCREMENT NOT NULL,
  `number` varchar(128) NOT NULL,
  `sellerId` int NOT NULL,
  `buyerId` int NOT NULL,
  `carrierId` int,
  `cargoName` varchar(512) NOT NULL,
  `cargoGrade` varchar(128),
  `plannedVolume` decimal(10,3),
  `purchasePrice` decimal(15,2),
  `salePrice` decimal(15,2),
  `currency` varchar(3) DEFAULT 'RUB',
  `startDate` timestamp,
  `endDate` timestamp,
  `status` enum('planning','active','closing','completed','cancelled') NOT NULL DEFAULT 'planning',
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `deals_id` PRIMARY KEY(`id`),
  CONSTRAINT `deals_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
ALTER TABLE `specifications` ADD `dealId` int;
