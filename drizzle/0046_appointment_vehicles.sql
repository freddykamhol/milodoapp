CREATE TABLE `appointment_vehicles` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `appointment_id` integer NOT NULL REFERENCES `appointments`(`id`) ON DELETE cascade,
  `vehicle_id` integer NOT NULL REFERENCES `vehicles`(`id`) ON DELETE restrict,
  `sort_order` integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX `appointment_vehicles_unique` ON `appointment_vehicles` (`appointment_id`,`vehicle_id`);
CREATE INDEX `appointment_vehicles_appointment_id_idx` ON `appointment_vehicles` (`appointment_id`);
CREATE TABLE `appointment_vehicle_members` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `appointment_vehicle_id` integer NOT NULL REFERENCES `appointment_vehicles`(`id`) ON DELETE cascade,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `appointment_vehicle_members_unique` ON `appointment_vehicle_members` (`appointment_vehicle_id`,`user_id`);
CREATE INDEX `appointment_vehicle_members_vehicle_idx` ON `appointment_vehicle_members` (`appointment_vehicle_id`);
