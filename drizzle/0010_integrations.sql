CREATE TABLE IF NOT EXISTS `smtp_settings` (
  `id` integer PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `enabled` integer NOT NULL DEFAULT 0,
  `host` text NOT NULL DEFAULT '',
  `port` integer NOT NULL DEFAULT 587,
  `username` text NOT NULL DEFAULT '',
  `password` text NOT NULL DEFAULT '',
  `from_email` text NOT NULL DEFAULT '',
  `secure` integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `telegram_settings` (
  `id` integer PRIMARY KEY NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `bot_token` text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS `telegram_chats` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `enabled` integer NOT NULL DEFAULT 1,
  `name` text NOT NULL DEFAULT '',
  `chat_id` text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS `telegram_chats_enabled_idx` ON `telegram_chats` (`enabled`);

CREATE TABLE IF NOT EXISTS `prowl_keys` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `user_id` integer NOT NULL,
  `enabled` integer NOT NULL DEFAULT 1,
  `label` text NOT NULL DEFAULT '',
  `api_key` text NOT NULL DEFAULT '',
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `prowl_keys_user_id_idx` ON `prowl_keys` (`user_id`);
CREATE INDEX IF NOT EXISTS `prowl_keys_enabled_idx` ON `prowl_keys` (`enabled`);

