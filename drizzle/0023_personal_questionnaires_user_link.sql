ALTER TABLE `personal_questionnaires` ADD COLUMN `created_user_id` integer;
ALTER TABLE `personal_questionnaires` ADD COLUMN `created_username` text NOT NULL DEFAULT '';
ALTER TABLE `personal_questionnaires` ADD COLUMN `created_user_at` integer;

CREATE INDEX IF NOT EXISTS `personal_questionnaires_created_user_id_idx` ON `personal_questionnaires` (`created_user_id`);

