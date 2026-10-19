CREATE TABLE `vehicle_service_companies` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `name` text NOT NULL,
  `address` text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX `vehicle_service_companies_name_unique` ON `vehicle_service_companies` (`name`);
CREATE TABLE `vehicle_maintenance_appointments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
  `vehicle_id` integer NOT NULL REFERENCES `vehicles`(`id`) ON DELETE cascade,
  `maintenance_id` integer REFERENCES `vehicle_maintenances`(`id`) ON DELETE cascade,
  `company_id` integer REFERENCES `vehicle_service_companies`(`id`) ON DELETE set null,
  `company_name` text NOT NULL,
  `address` text NOT NULL DEFAULT '',
  `title` text NOT NULL,
  `start_at` integer NOT NULL,
  `end_at` integer,
  `created_by_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE restrict
);
CREATE INDEX `vehicle_maintenance_appointments_start_at_idx` ON `vehicle_maintenance_appointments` (`start_at`);
CREATE INDEX `vehicle_maintenance_appointments_vehicle_id_idx` ON `vehicle_maintenance_appointments` (`vehicle_id`);
