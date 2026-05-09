ALTER TABLE appointment_applications ADD COLUMN `role` text DEFAULT 'NORMAL' NOT NULL;
ALTER TABLE appointment_applications ADD COLUMN `admin_note` text DEFAULT '' NOT NULL;

CREATE TABLE `appointment_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`appointment_id` integer NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `appointment_sections_appointment_id_idx` ON `appointment_sections` (`appointment_id`);
CREATE INDEX `appointment_sections_sort_order_idx` ON `appointment_sections` (`sort_order`);

CREATE TABLE `appointment_section_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`section_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `appointment_sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `appointment_section_members_unique` ON `appointment_section_members` (`section_id`,`user_id`);
CREATE INDEX `appointment_section_members_section_id_idx` ON `appointment_section_members` (`section_id`);
CREATE INDEX `appointment_section_members_user_id_idx` ON `appointment_section_members` (`user_id`);

