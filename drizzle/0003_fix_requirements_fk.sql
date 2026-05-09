PRAGMA foreign_keys=off;

ALTER TABLE `appointment_requirements` RENAME TO `appointment_requirements_old`;

CREATE TABLE `appointment_requirements` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `appointment_id` integer NOT NULL REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
  `kind` text NOT NULL,
  `value` text NOT NULL,
  `min_count` integer NOT NULL
);

INSERT INTO `appointment_requirements` (`id`,`created_at`,`updated_at`,`appointment_id`,`kind`,`value`,`min_count`)
SELECT `id`,`created_at`,`updated_at`,`appointment_id`,`kind`,`value`,`min_count`
FROM `appointment_requirements_old`;

DROP TABLE `appointment_requirements_old`;

CREATE UNIQUE INDEX `appointment_requirements_unique` ON `appointment_requirements` (`appointment_id`,`kind`,`value`);
CREATE INDEX `appointment_requirements_appointment_id_idx` ON `appointment_requirements` (`appointment_id`);
CREATE INDEX `appointment_requirements_kind_value_idx` ON `appointment_requirements` (`kind`,`value`);

PRAGMA foreign_keys=on;
