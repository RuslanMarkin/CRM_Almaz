ALTER TABLE `counterparties` ADD `businessRole` enum('farmer','exporter','processor','carrier','other') NOT NULL DEFAULT 'other';--> statement-breakpoint
ALTER TABLE `counterparties` ADD `region` varchar(256);--> statement-breakpoint
ALTER TABLE `counterparties` ADD `profile` text;--> statement-breakpoint
ALTER TABLE `counterparties` ADD `postalAddress` text;--> statement-breakpoint
ALTER TABLE `counterparties` ADD `representativeName` varchar(256);--> statement-breakpoint
ALTER TABLE `counterparties` ADD `representativePosition` varchar(128);--> statement-breakpoint
ALTER TABLE `counterparties` ADD `authorityBasis` varchar(512);--> statement-breakpoint
ALTER TABLE `document_attachments` MODIFY COLUMN `entityType` enum('contract','specification','counterparty') NOT NULL;
