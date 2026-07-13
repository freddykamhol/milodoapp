ALTER TABLE `member_registration_forms` ADD COLUMN `verification_password_hash` text;
--> statement-breakpoint
UPDATE `member_registration_forms` SET `verification_mode` = 'PASSWORD' WHERE `verification_mode` = 'AUTO';
