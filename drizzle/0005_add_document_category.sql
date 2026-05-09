ALTER TABLE `documents` ADD COLUMN `category` text;

CREATE INDEX `documents_owner_category_idx` ON `documents` (`owner_id`,`category`);
