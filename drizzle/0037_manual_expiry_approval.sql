ALTER TABLE `documents` ADD COLUMN `requested_expires_at` integer;
ALTER TABLE `documents` ADD COLUMN `expiry_approval_status` text NOT NULL DEFAULT 'NONE';
CREATE TABLE `document_expiry_preferences` (
  `id` integer PRIMARY KEY NOT NULL,
  `manual_expiry_requires_approval` integer NOT NULL DEFAULT 0,
  `updated_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer))
);
INSERT INTO `document_expiry_preferences` (`id`, `manual_expiry_requires_approval`) VALUES (1, 0);
