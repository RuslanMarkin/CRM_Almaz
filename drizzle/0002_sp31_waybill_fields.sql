ALTER TABLE `counterparties` ADD `okpo` varchar(10);--> statement-breakpoint
ALTER TABLE `waybills` ADD `vehicleOwnerId` int;--> statement-breakpoint
ALTER TABLE `waybills` ADD `vehicleOwnerName` varchar(512);--> statement-breakpoint
ALTER TABLE `waybills` ADD `payerId` int;--> statement-breakpoint
ALTER TABLE `waybills` ADD `payerName` varchar(512);--> statement-breakpoint
ALTER TABLE `waybills` ADD `driverName` varchar(256);--> statement-breakpoint
ALTER TABLE `waybills` ADD `vehicleMake` varchar(128);--> statement-breakpoint
ALTER TABLE `waybills` ADD `tripSheetNumber` varchar(128);--> statement-breakpoint
ALTER TABLE `waybills` ADD `routeNumber` varchar(128);--> statement-breakpoint
ALTER TABLE `waybills` ADD `garageNumber` varchar(128);--> statement-breakpoint
ALTER TABLE `waybills` ADD `cargoGrade` varchar(128);--> statement-breakpoint
ALTER TABLE `waybills` ADD `impurityPercent` decimal(5,2);--> statement-breakpoint
ALTER TABLE `waybills` ADD `moisturePercent` decimal(5,2);--> statement-breakpoint
ALTER TABLE `waybills` ADD `packageType` varchar(64) DEFAULT 'н/у';--> statement-breakpoint
ALTER TABLE `waybills` ADD `quantity` decimal(10,3);--> statement-breakpoint
ALTER TABLE `waybills` ADD `cargoClass` varchar(64);--> statement-breakpoint
ALTER TABLE `waybills` ADD `declarationInfo` text;--> statement-breakpoint
ALTER TABLE `waybill_counter` ADD CONSTRAINT `waybill_counter_year_unique` UNIQUE(`year`);