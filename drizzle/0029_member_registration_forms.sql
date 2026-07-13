CREATE TABLE `member_registration_forms` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
  `token` text NOT NULL,
  `title` text DEFAULT 'Registrierungsformular' NOT NULL,
  `user_limit` integer NOT NULL,
  `role` text DEFAULT 'PERSONAL' NOT NULL,
  `verification_mode` text DEFAULT 'ADMIN' NOT NULL,
  `password_mode` text DEFAULT 'SELF' NOT NULL,
  `expires_at` integer NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_by_id` integer,
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_registration_forms_token_unique` ON `member_registration_forms` (`token`);
--> statement-breakpoint
CREATE INDEX `member_registration_forms_expires_at_idx` ON `member_registration_forms` (`expires_at`);
--> statement-breakpoint
CREATE INDEX `member_registration_forms_active_idx` ON `member_registration_forms` (`active`);
--> statement-breakpoint
CREATE TABLE `member_registration_submissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
  `form_id` integer NOT NULL,
  `user_id` integer NOT NULL,
  `status` text DEFAULT 'PENDING' NOT NULL,
  `approved_at` integer,
  `approved_by_id` integer,
  FOREIGN KEY (`form_id`) REFERENCES `member_registration_forms`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_registration_submissions_user_unique` ON `member_registration_submissions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `member_registration_submissions_form_id_idx` ON `member_registration_submissions` (`form_id`);
--> statement-breakpoint
CREATE INDEX `member_registration_submissions_status_idx` ON `member_registration_submissions` (`status`);
