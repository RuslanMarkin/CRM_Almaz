CREATE TABLE `contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(128) NOT NULL,
	`counterpartyId` int NOT NULL,
	`type` enum('framework','one_time','service') NOT NULL DEFAULT 'framework',
	`subject` text,
	`startDate` timestamp,
	`endDate` timestamp,
	`amount` decimal(15,2),
	`currency` varchar(3) DEFAULT 'RUB',
	`status` enum('draft','active','suspended','completed','terminated') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `counterparties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(512) NOT NULL,
	`shortName` varchar(256),
	`type` enum('legal','individual','sole_trader') NOT NULL DEFAULT 'legal',
	`inn` varchar(12),
	`ogrn` varchar(15),
	`kpp` varchar(9),
	`legalAddress` text,
	`actualAddress` text,
	`bankName` varchar(512),
	`bankBik` varchar(9),
	`bankAccount` varchar(20),
	`corrAccount` varchar(20),
	`phone` varchar(32),
	`email` varchar(320),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `counterparties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `specifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(128) NOT NULL,
	`contractId` int NOT NULL,
	`counterpartyId` int NOT NULL,
	`loadingAddress` text,
	`unloadingAddress` text,
	`cargoName` varchar(512),
	`pricePerUnit` decimal(15,2),
	`unit` varchar(32) DEFAULT 'т',
	`currency` varchar(3) DEFAULT 'RUB',
	`volumeTotal` decimal(15,3),
	`volumeShipped` decimal(15,3) DEFAULT '0',
	`startDate` timestamp,
	`endDate` timestamp,
	`status` enum('draft','active','completed','cancelled') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `specifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `waybill_counter` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`lastNumber` int NOT NULL DEFAULT 0,
	CONSTRAINT `waybill_counter_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `waybills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(64) NOT NULL,
	`specificationId` int,
	`contractId` int,
	`supplierId` int,
	`supplierName` varchar(512),
	`loadingAddress` text,
	`buyerId` int,
	`buyerName` varchar(512),
	`unloadingAddress` text,
	`carrierId` int,
	`carrierName` varchar(512),
	`tractorNumber` varchar(32),
	`trailerNumber` varchar(32),
	`grossWeight` decimal(10,3),
	`tareWeight` decimal(10,3),
	`netWeight` decimal(10,3),
	`cargoName` varchar(512),
	`pricePerUnit` decimal(15,2),
	`currency` varchar(3) DEFAULT 'RUB',
	`status` enum('draft','in_transit','delivered','cancelled') NOT NULL DEFAULT 'draft',
	`waybillDate` timestamp DEFAULT (now()),
	`notes` text,
	`pdfKey` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waybills_id` PRIMARY KEY(`id`),
	CONSTRAINT `waybills_number_unique` UNIQUE(`number`)
);
