ALTER TABLE `counterparties` ADD `vatType` enum('with_vat','without_vat') NOT NULL DEFAULT 'with_vat';
