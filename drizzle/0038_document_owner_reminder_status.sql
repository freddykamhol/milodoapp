ALTER TABLE `documents` ADD COLUMN `owner_expiry_reminder_sent_at` integer;
ALTER TABLE `documents` ADD COLUMN `owner_expired_reminder_sent_at` integer;
