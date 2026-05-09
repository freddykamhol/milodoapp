ALTER TABLE `users` ADD COLUMN `first_name` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `last_name` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `ort_ergaenzung` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `customers` ADD COLUMN `main_bereich` text NOT NULL DEFAULT 'RD_BOERSE';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
  `user_id` integer NOT NULL,
  `token_hash` text NOT NULL,
  `expires_at` integer NOT NULL,
  `used_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `password_reset_tokens_hash_unique` ON `password_reset_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `password_reset_tokens_user_id_idx` ON `password_reset_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `password_reset_tokens_expires_at_idx` ON `password_reset_tokens` (`expires_at`);

