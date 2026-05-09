CREATE TABLE IF NOT EXISTS `timesheet_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `user_id` integer NOT NULL,
  `year` integer NOT NULL,
  `month` integer NOT NULL,
  `action` text NOT NULL,
  `note` text,
  `actor_user_id` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);

CREATE INDEX IF NOT EXISTS `timesheet_events_user_year_month_idx` ON `timesheet_events` (`user_id`,`year`,`month`);
CREATE INDEX IF NOT EXISTS `timesheet_events_actor_user_id_idx` ON `timesheet_events` (`actor_user_id`);

