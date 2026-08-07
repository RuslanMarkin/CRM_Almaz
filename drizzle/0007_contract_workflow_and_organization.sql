ALTER TABLE `counterparties` MODIFY COLUMN `businessRole` enum('farmer','exporter','processor','carrier','other','seller','buyer') NULL;--> statement-breakpoint
UPDATE `counterparties` SET `businessRole` = CASE WHEN `businessRole` = 'carrier' THEN 'carrier' ELSE NULL END;--> statement-breakpoint
ALTER TABLE `counterparties` MODIFY COLUMN `businessRole` enum('seller','buyer','carrier') NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `contractKind` enum('purchase','sale','carriage');--> statement-breakpoint
ALTER TABLE `document_attachments` ADD `documentKind` enum('contract_scan','specification_scan','other') NOT NULL DEFAULT 'other';--> statement-breakpoint
ALTER TABLE `document_attachments` ADD `specificationId` int;--> statement-breakpoint
CREATE TABLE `organization_profiles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(512) NOT NULL,
  `shortName` varchar(256),
  `inn` varchar(12),
  `ogrn` varchar(15),
  `kpp` varchar(9),
  `legalAddress` text,
  `postalAddress` text,
  `representativeName` varchar(256),
  `representativePosition` varchar(128),
  `authorityBasis` varchar(512),
  `bankName` varchar(512),
  `bankBik` varchar(9),
  `bankAccount` varchar(20),
  `corrAccount` varchar(20),
  `phone` varchar(32),
  `email` varchar(320),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `organization_profiles_id` PRIMARY KEY(`id`)
);
