ALTER TABLE `counterparties`
  ADD `status` enum('normal','missing_scans','blacklisted','debtor') NOT NULL DEFAULT 'normal';
