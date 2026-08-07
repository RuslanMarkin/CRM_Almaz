ALTER TABLE `waybills` DROP COLUMN `actualGrossWeight`;--> statement-breakpoint
ALTER TABLE `waybills` DROP COLUMN `actualTareWeight`;--> statement-breakpoint
ALTER TABLE `waybills` DROP COLUMN `actualNetWeight`;--> statement-breakpoint
ALTER TABLE `waybills` ADD `dispatchedWeight` decimal(10,3);--> statement-breakpoint
ALTER TABLE `waybills` ADD `receivedWeight` decimal(10,3);
