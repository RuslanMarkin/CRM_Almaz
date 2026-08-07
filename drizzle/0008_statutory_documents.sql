ALTER TABLE `document_attachments` MODIFY COLUMN `entityType` enum('contract','specification','counterparty','organization') NOT NULL;--> statement-breakpoint
ALTER TABLE `document_attachments` MODIFY COLUMN `documentKind` enum('contract_scan','specification_scan','statutory_document','other') NOT NULL DEFAULT 'other';
