CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`owner_id` integer NOT NULL,
	`title` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text,
	`storage_key` text NOT NULL,
	`size_bytes` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_storage_key_unique` ON `documents` (`storage_key`);--> statement-breakpoint
CREATE INDEX `documents_owner_id_idx` ON `documents` (`owner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`qual_rd` text,
	`qual_ausb` text,
	`geb` integer,
	`telefon` text,
	`email` text,
	`eintritt` integer,
	`anzahl_einsaetze` integer DEFAULT 0 NOT NULL,
	`strasse` text,
	`hausnummer` text,
	`plz` text,
	`ort` text,
	`einsatzort` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_einsatzort_idx` ON `users` (`einsatzort`);--> statement-breakpoint
CREATE INDEX `users_qual_rd_idx` ON `users` (`qual_rd`);