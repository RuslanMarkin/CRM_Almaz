ALTER TABLE `document_attachments` MODIFY COLUMN `dataUrl` longtext;--> statement-breakpoint
ALTER TABLE `document_attachments` ADD `storageKey` varchar(1024);
