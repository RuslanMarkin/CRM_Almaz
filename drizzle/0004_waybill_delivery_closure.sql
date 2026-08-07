ALTER TABLE `waybills` ADD `actualGrossWeight` decimal(10,3);--> statement-breakpoint
ALTER TABLE `waybills` ADD `actualTareWeight` decimal(10,3);--> statement-breakpoint
ALTER TABLE `waybills` ADD `actualNetWeight` decimal(10,3);--> statement-breakpoint
ALTER TABLE `waybills` ADD `closedAt` timestamp;--> statement-breakpoint
ALTER TABLE `waybills` ADD `closureNotes` text;
