CREATE TABLE `responsibility_recipients` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `type` text NOT NULL,
  `recipient_type` text NOT NULL,
  `role` text,
  `user_id` integer REFERENCES `users`(`id`) ON DELETE CASCADE,
  `email` text,
  `location` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL,
  CONSTRAINT `responsibility_recipients_unique` UNIQUE(`type`,`recipient_type`,`role`,`user_id`,`email`)
);
