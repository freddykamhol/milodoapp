CREATE TABLE IF NOT EXISTS `notification_prefs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `user_id` integer NOT NULL,
  `key` text NOT NULL,
  `telegram_enabled` integer NOT NULL DEFAULT 0,
  `email_enabled` integer NOT NULL DEFAULT 0,
  `reminder_days_before` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `notification_prefs_user_key_unique` ON `notification_prefs` (`user_id`,`key`);
CREATE INDEX IF NOT EXISTS `notification_prefs_user_id_idx` ON `notification_prefs` (`user_id`);

