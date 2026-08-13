CREATE TABLE `recovery_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`action` enum('delete','restore') NOT NULL,
	`actor` varchar(256) NOT NULL,
	`snapshot` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recovery_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contracts` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `counterparties` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `deals` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `specifications` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `document_attachments` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `waybills` ADD `deletedAt` timestamp;--> statement-breakpoint
CREATE INDEX `recovery_audit_entity_idx` ON `recovery_audit_log` (`entityType`,`entityId`);
