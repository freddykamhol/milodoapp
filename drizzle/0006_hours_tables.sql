CREATE TABLE `hour_entries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `appointment_id` integer NOT NULL REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
  `actual_start_at` integer NOT NULL,
  `actual_end_at` integer NOT NULL
);

CREATE UNIQUE INDEX `hour_entries_user_appointment_unique` ON `hour_entries` (`user_id`,`appointment_id`);
CREATE INDEX `hour_entries_user_id_idx` ON `hour_entries` (`user_id`);
CREATE INDEX `hour_entries_appointment_id_idx` ON `hour_entries` (`appointment_id`);
CREATE INDEX `hour_entries_actual_start_idx` ON `hour_entries` (`actual_start_at`);

CREATE TABLE `timesheet_months` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `year` integer NOT NULL,
  `month` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'OPEN',
  `closed_at` integer
);

CREATE UNIQUE INDEX `timesheet_months_user_year_month_unique` ON `timesheet_months` (`user_id`,`year`,`month`);
CREATE INDEX `timesheet_months_user_id_idx` ON `timesheet_months` (`user_id`);
