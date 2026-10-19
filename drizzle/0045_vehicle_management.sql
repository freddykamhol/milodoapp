CREATE TABLE `vehicles` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `license_plate` text NOT NULL,
  `type` text NOT NULL,
  `initial_mileage` integer NOT NULL DEFAULT 0,
  `mileage` integer NOT NULL DEFAULT 0,
  `location` text NOT NULL DEFAULT '',
  `tuv_last_at` integer,
  `notes` text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX `vehicles_license_plate_unique` ON `vehicles` (`license_plate`);
CREATE TABLE `vehicle_defects` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `vehicle_id` integer NOT NULL REFERENCES `vehicles`(`id`) ON DELETE cascade,
  `title` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `category` text NOT NULL,
  `status` text NOT NULL DEFAULT 'ERSTELLT',
  `mileage` integer NOT NULL DEFAULT 0,
  `image_urls` text NOT NULL DEFAULT '[]',
  `reported_by_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE restrict
);
CREATE INDEX `vehicle_defects_vehicle_id_idx` ON `vehicle_defects` (`vehicle_id`);
CREATE INDEX `vehicle_defects_status_idx` ON `vehicle_defects` (`status`);
CREATE TABLE `vehicle_trips` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `vehicle_id` integer NOT NULL REFERENCES `vehicles`(`id`) ON DELETE restrict,
  `title` text NOT NULL,
  `km_start` integer NOT NULL,
  `km_end` integer NOT NULL,
  `start_at` integer NOT NULL,
  `end_at` integer NOT NULL,
  `appointment_id` integer REFERENCES `appointments`(`id`) ON DELETE set null,
  `created_by_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE restrict
);
CREATE INDEX `vehicle_trips_vehicle_id_idx` ON `vehicle_trips` (`vehicle_id`);
CREATE INDEX `vehicle_trips_start_at_idx` ON `vehicle_trips` (`start_at`);
CREATE TABLE `vehicle_maintenances` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `vehicle_id` integer NOT NULL REFERENCES `vehicles`(`id`) ON DELETE cascade,
  `title` text NOT NULL,
  `last_at` integer NOT NULL,
  `interval_days` integer NOT NULL DEFAULT 0,
  `next_at` integer NOT NULL,
  `confirmed_at` integer
);
CREATE INDEX `vehicle_maintenances_vehicle_id_idx` ON `vehicle_maintenances` (`vehicle_id`);
