ALTER TABLE `documents` ADD COLUMN `expires_at` integer;

CREATE INDEX `documents_expires_at_idx` ON `documents` (`expires_at`);

CREATE TABLE `document_expiry_settings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `category` text NOT NULL,
  `expiry_months` integer NOT NULL DEFAULT 0,
  `reminder_days_before` integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX `document_expiry_settings_category_unique` ON `document_expiry_settings` (`category`);
