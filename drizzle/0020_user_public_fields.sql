ALTER TABLE `users` ADD COLUMN `public_first_name` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `public_last_name` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `public_geb` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `public_qualifications` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `public_address` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `public_contact` integer NOT NULL DEFAULT 0;

