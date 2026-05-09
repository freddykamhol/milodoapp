CREATE TABLE `appointment_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`appointment_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_applications_user_appointment_unique` ON `appointment_applications` (`user_id`,`appointment_id`);--> statement-breakpoint
CREATE INDEX `appointment_applications_user_id_idx` ON `appointment_applications` (`user_id`);--> statement-breakpoint
CREATE INDEX `appointment_applications_appointment_id_idx` ON `appointment_applications` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `appointment_applications_status_idx` ON `appointment_applications` (`status`);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer,
	`title` text NOT NULL,
	`einsatzort` text NOT NULL,
	`required_qual_rd` text,
	`required_qual_ausb` text,
	`target_user_id` integer,
	`status` text DEFAULT 'OPEN' NOT NULL,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `appointments_start_at_idx` ON `appointments` (`start_at`);--> statement-breakpoint
CREATE INDEX `appointments_status_idx` ON `appointments` (`status`);--> statement-breakpoint
CREATE INDEX `appointments_target_user_id_idx` ON `appointments` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `appointments_required_qual_rd_idx` ON `appointments` (`required_qual_rd`);--> statement-breakpoint
CREATE INDEX `appointments_required_qual_ausb_idx` ON `appointments` (`required_qual_ausb`);