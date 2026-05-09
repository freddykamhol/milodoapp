PRAGMA foreign_keys=off;

ALTER TABLE `appointment_applications` RENAME TO `appointment_applications_old`;

CREATE TABLE `appointment_applications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `appointment_id` integer NOT NULL REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `status` text NOT NULL
);

INSERT INTO `appointment_applications` (`id`,`created_at`,`updated_at`,`appointment_id`,`user_id`,`status`)
SELECT `id`,`created_at`,`updated_at`,`appointment_id`,`user_id`,`status`
FROM `appointment_applications_old`;

DROP TABLE `appointment_applications_old`;

CREATE UNIQUE INDEX `appointment_applications_user_appointment_unique`
ON `appointment_applications` (`user_id`,`appointment_id`);
CREATE INDEX `appointment_applications_user_id_idx` ON `appointment_applications` (`user_id`);
CREATE INDEX `appointment_applications_appointment_id_idx` ON `appointment_applications` (`appointment_id`);
CREATE INDEX `appointment_applications_status_idx` ON `appointment_applications` (`status`);

PRAGMA foreign_keys=on;
