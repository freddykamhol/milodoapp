CREATE TABLE IF NOT EXISTS `notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `scope` text NOT NULL DEFAULT 'ALL',
  `user_id` integer,
  `kind` text NOT NULL DEFAULT 'SYSTEM',
  `title` text NOT NULL DEFAULT '',
  `body` text NOT NULL DEFAULT '',
  `href` text NOT NULL DEFAULT '',
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `notifications_created_at_idx` ON `notifications` (`created_at`);
CREATE INDEX IF NOT EXISTS `notifications_scope_idx` ON `notifications` (`scope`);
CREATE INDEX IF NOT EXISTS `notifications_user_id_idx` ON `notifications` (`user_id`);

CREATE TABLE IF NOT EXISTS `notification_reads` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `notification_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `notification_reads_user_notification_unique` ON `notification_reads` (`user_id`,`notification_id`);
CREATE INDEX IF NOT EXISTS `notification_reads_user_id_idx` ON `notification_reads` (`user_id`);
CREATE INDEX IF NOT EXISTS `notification_reads_notification_id_idx` ON `notification_reads` (`notification_id`);

