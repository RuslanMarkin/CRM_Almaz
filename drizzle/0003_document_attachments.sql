CREATE TABLE `document_attachments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `entityType` enum('contract','specification') NOT NULL,
  `entityId` int NOT NULL,
  `fileName` varchar(512) NOT NULL,
  `contentType` varchar(128) NOT NULL,
  `size` int NOT NULL,
  `dataUrl` longtext NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `document_attachments_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `document_attachments_entity_idx` ON `document_attachments` (`entityType`,`entityId`);
